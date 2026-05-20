import { Request, Response } from 'express';
import { StellarService } from '../services/StellarService';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  OpenDisputeDto,
  ResolveDisputeDto,
  ClaimDisputeDto,
} from '../dtos/stellar.dto';

export class StellarController {
  private stellarService: StellarService;

  constructor() {
    this.stellarService = new StellarService();
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
        },
        message: 'Escrow created successfully',
      });
    } catch (error: any) {
      console.error('[StellarController] createEscrow error:', error.message);
      return res.status(500).json({ success: false, message: error.message || 'Failed to create escrow' });
    }
  }

  // ─── Sprint 2: Get unsigned XDR for host to sign ──────────────────────────────

  async getPaymentXDR(req: Request, res: Response): Promise<Response> {
    try {
      const jobId = req.params['jobId']!;
      const result = await this.stellarService.getPaymentXDR(jobId);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async getRefundXDR(req: Request, res: Response): Promise<Response> {
    try {
      const jobId = req.params['jobId']!;
      const result = await this.stellarService.getRefundXDR(jobId);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
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

      const txHash = await this.stellarService.releasePayment(dto.jobId, dto.hostSignedXDR);

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

      const txHash = await this.stellarService.refundEscrow(dto.jobId, dto.hostSignedXDR);

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
      await this.stellarService.openDispute(dto);
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
