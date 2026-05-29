import { Request, Response } from 'express';
import { StellarService } from '../services/StellarService';
import type { CctpInboundService } from '../services/CctpInboundService';
import {
  CreateEscrowDto,
  FundEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  OpenDisputeDto,
  ResolveDisputeDto,
  ClaimDisputeDto,
  PrepareInboundDto,
  RegisterBurnDto,
  RelayMintDto,
} from '../dtos/stellar.dto';

export class StellarController {
  private stellarService: StellarService;
  private _cctpInbound?: CctpInboundService;

  constructor() {
    this.stellarService = new StellarService();
  }

  // Lazy-loaded so the CCTP subsystem (which pulls config/stellar → dotenv) is
  // only imported when an inbound endpoint is actually hit. Keeps the controller's
  // module-load graph minimal for tests that mock StellarService.
  private get cctpInbound(): CctpInboundService {
    if (!this._cctpInbound) {
      const { CctpInboundService } = require('../services/CctpInboundService');
      this._cctpInbound = new CctpInboundService();
    }
    return this._cctpInbound!;
  }

  // ─── Sprint 1: Create Escrow ──────────────────────────────────────────────────

  async createEscrow(req: Request, res: Response): Promise<Response> {
    try {
      const dto: CreateEscrowDto = req.body;

      if (!dto.jobId || !dto.hostPublicKey || !dto.talentPublicKey || !dto.amount) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: jobId, hostPublicKey, talentPublicKey, amount',
        });
      }

      const escrow = await this.stellarService.createEscrow(dto);

      return res.status(201).json({
        success: true,
        data: {
          escrowPublicKey: escrow.escrow_public_key,
          jobId: escrow.job_id,
          status: escrow.status,
          transactionHash: escrow.stellar_tx_hash,
          preAuthTxs: {
            paymentTxHash: escrow.payment_tx_hash,
            refundTxHash: escrow.refund_tx_hash,
            deadline: escrow.deadline,
          },
          // Host must sign this to deposit the USDC (non-custodial funding)
          fundingTxXDR: escrow.funding_tx_xdr,
        },
        message: 'Escrow created — host must sign the funding payment to deposit USDC',
      });
    } catch (error: any) {
      console.error('[StellarController] createEscrow error:', error.message);
      return res.status(500).json({ success: false, message: error.message || 'Failed to create escrow' });
    }
  }

  // ─── Host-funded deposit: fetch funding XDR + submit host-signed funding ──────

  async getFundingXDR(req: Request, res: Response): Promise<Response> {
    try {
      const jobId = req.params['jobId']!;
      const callerWallet = (req as any).user?.wallet_stellar as string | undefined;
      const result = await this.stellarService.getFundingXDR(jobId, callerWallet);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      const status = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async fundEscrow(req: Request, res: Response): Promise<Response> {
    try {
      const dto: FundEscrowDto = req.body;
      if (!dto.jobId || !dto.hostSignedXDR) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: jobId, hostSignedXDR',
        });
      }
      const callerWallet = (req as any).user?.wallet_stellar as string | undefined;
      const txHash = await this.stellarService.fundEscrow(dto.jobId, dto.hostSignedXDR, callerWallet);
      return res.status(200).json({
        success: true,
        data: { transactionHash: txHash },
        message: 'Escrow funded successfully',
      });
    } catch (error: any) {
      console.error('[StellarController] fundEscrow error:', error.message);
      const status = error.message?.includes('Unauthorized') ? 403 : 500;
      return res.status(status).json({ success: false, message: error.message || 'Failed to fund escrow' });
    }
  }

  // ─── CCTP V2 inbound funding (gated by CCTP_ENABLED) ──────────────────────────

  private inboundErrorStatus(message?: string): number {
    if (message?.includes('Unauthorized')) return 403;
    if (message?.includes('disabled')) return 404; // feature off — behave as if route doesn't exist
    return 400;
  }

  async prepareInbound(req: Request, res: Response): Promise<Response> {
    try {
      const dto: PrepareInboundDto = req.body;
      if (!dto.jobId || !dto.sourceChain) {
        return res.status(400).json({ success: false, message: 'Missing required fields: jobId, sourceChain' });
      }
      const callerWallet = (req as any).user?.wallet_stellar as string | undefined;
      const data = await this.cctpInbound.prepareInbound(dto, callerWallet);
      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(this.inboundErrorStatus(error.message)).json({ success: false, message: error.message });
    }
  }

  async registerBurn(req: Request, res: Response): Promise<Response> {
    try {
      const dto: RegisterBurnDto = req.body;
      if (!dto.jobId || !dto.sourceChain || !dto.sourceTxHash) {
        return res.status(400).json({ success: false, message: 'Missing required fields: jobId, sourceChain, sourceTxHash' });
      }
      const callerWallet = (req as any).user?.wallet_stellar as string | undefined;
      const data = await this.cctpInbound.registerBurn(dto, callerWallet);
      return res.status(200).json({ success: true, data, message: 'Burn registered — relaying mint to Stellar' });
    } catch (error: any) {
      return res.status(this.inboundErrorStatus(error.message)).json({ success: false, message: error.message });
    }
  }

  async relayInboundMint(req: Request, res: Response): Promise<Response> {
    try {
      const dto: RelayMintDto = req.body;
      if (!dto.jobId) {
        return res.status(400).json({ success: false, message: 'Missing required field: jobId' });
      }
      const data = await this.cctpInbound.relayMint(dto.jobId);
      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error('[StellarController] relayInboundMint error:', error.message);
      return res.status(this.inboundErrorStatus(error.message)).json({ success: false, message: error.message });
    }
  }

  // ─── Sprint 2: Get unsigned XDR for host to sign ──────────────────────────────

  async getPaymentXDR(req: Request, res: Response): Promise<Response> {
    try {
      const jobId = req.params['jobId']!;
      const callerWallet = (req as any).user?.wallet_stellar as string | undefined;
      const result = await this.stellarService.getPaymentXDR(jobId, callerWallet);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      const status = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async getRefundXDR(req: Request, res: Response): Promise<Response> {
    try {
      const jobId = req.params['jobId']!;
      const callerWallet = (req as any).user?.wallet_stellar as string | undefined;
      const result = await this.stellarService.getRefundXDR(jobId, callerWallet);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      const status = error.message?.includes('Unauthorized') ? 403 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  // ─── Sprint 2: Release Payment ────────────────────────────────────────────────

  async releasePayment(req: Request, res: Response): Promise<Response> {
    try {
      const dto: ReleaseEscrowDto = req.body;

      if (!dto.jobId || !dto.hostSignedXDR) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: jobId, hostSignedXDR',
        });
      }

      const callerWallet = (req as any).user?.wallet_stellar as string | undefined;
      const txHash = await this.stellarService.releasePayment(dto.jobId, dto.hostSignedXDR, callerWallet);

      return res.status(200).json({
        success: true,
        data: { transactionHash: txHash },
        message: 'Payment released successfully',
      });
    } catch (error: any) {
      console.error('[StellarController] releasePayment error:', error.message);
      return res.status(500).json({ success: false, message: error.message || 'Failed to release payment' });
    }
  }

  // ─── Sprint 2: Refund ─────────────────────────────────────────────────────────

  async refundEscrow(req: Request, res: Response): Promise<Response> {
    try {
      const dto: RefundEscrowDto = req.body;

      if (!dto.jobId || !dto.hostSignedXDR) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: jobId, hostSignedXDR',
        });
      }

      const callerWallet = (req as any).user?.wallet_stellar as string | undefined;
      const txHash = await this.stellarService.refundEscrow(dto.jobId, dto.hostSignedXDR, callerWallet);

      return res.status(200).json({
        success: true,
        data: { transactionHash: txHash },
        message: 'Escrow refunded successfully',
      });
    } catch (error: any) {
      console.error('[StellarController] refundEscrow error:', error.message);
      const status = error.message?.includes('not available yet') ? 400 : 500;
      return res.status(status).json({ success: false, message: error.message || 'Failed to refund escrow' });
    }
  }

  // ─── Sprint 1+2: Status ───────────────────────────────────────────────────────

  async getEscrowStatus(req: Request, res: Response): Promise<Response> {
    try {
      const jobId = req.params['jobId']!;
      const status = await this.stellarService.getEscrowStatus(jobId);
      return res.status(200).json({ success: true, data: status });
    } catch (error: any) {
      return res.status(404).json({ success: false, message: error.message });
    }
  }

  // ─── Sprint 3: Dispute Flow ───────────────────────────────────────────────────

  async openDispute(req: Request, res: Response): Promise<Response> {
    try {
      const dto: OpenDisputeDto = req.body;
      if (!dto.jobId || !dto.reason || !dto.initiator) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: jobId, reason, initiator',
        });
      }
      if (!['HOST', 'TALENT'].includes(dto.initiator)) {
        return res.status(400).json({ success: false, message: 'initiator must be HOST or TALENT' });
      }
      const callerWallet = ((req as any).user?.wallet_stellar as string | undefined) ?? '';
      await this.stellarService.openDispute({ ...dto, callerWallet });
      return res.status(200).json({ success: true, message: 'Dispute opened successfully' });
    } catch (error: any) {
      console.error('[StellarController] openDispute error:', error.message);
      const status = error.message?.includes('status is') ? 400 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async listDisputes(req: Request, res: Response): Promise<Response> {
    try {
      const disputes = await this.stellarService.listDisputes();
      return res.status(200).json({ success: true, data: disputes });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async resolveDispute(req: Request, res: Response): Promise<Response> {
    try {
      const dto: ResolveDisputeDto = req.body;
      if (!dto.jobId || !dto.winner) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: jobId, winner',
        });
      }
      if (!['HOST', 'TALENT'].includes(dto.winner)) {
        return res.status(400).json({ success: false, message: 'winner must be HOST or TALENT' });
      }
      const result = await this.stellarService.resolveDispute(dto);
      return res.status(200).json({
        success: true,
        data: result,
        message: `Dispute resolved — ${dto.winner} wins. Waiting for winner signature.`,
      });
    } catch (error: any) {
      console.error('[StellarController] resolveDispute error:', error.message);
      const status = error.message?.includes('status is') ? 400 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async getDisputeXDR(req: Request, res: Response): Promise<Response> {
    try {
      const jobId = req.params['jobId']!;
      // Re-use getEscrowStatus — dispute XDR is included when status=DISPUTED + winner set
      const status = await this.stellarService.getEscrowStatus(jobId);
      if (status.status !== 'DISPUTED') {
        return res.status(400).json({ success: false, message: 'Escrow is not in DISPUTED status' });
      }
      if (!status.disputeWinner || !status.disputeResolutionXDR) {
        return res.status(400).json({ success: false, message: 'Dispute not yet resolved by arbiter' });
      }
      return res.status(200).json({
        success: true,
        data: {
          disputeResolutionXDR: status.disputeResolutionXDR,
          winner: status.disputeWinner,
          jobId,
        },
      });
    } catch (error: any) {
      return res.status(404).json({ success: false, message: error.message });
    }
  }

  async claimDispute(req: Request, res: Response): Promise<Response> {
    try {
      const dto: ClaimDisputeDto = req.body;
      if (!dto.jobId || !dto.winnerSignedXDR) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: jobId, winnerSignedXDR',
        });
      }
      const txHash = await this.stellarService.claimDispute(dto.jobId, dto.winnerSignedXDR);
      return res.status(200).json({
        success: true,
        data: { transactionHash: txHash },
        message: 'Dispute settled — funds transferred on-chain',
      });
    } catch (error: any) {
      console.error('[StellarController] claimDispute error:', error.message);
      const status = error.message?.includes('not been resolved') ? 400 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }
}
