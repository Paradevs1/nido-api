import { Request, Response } from 'express';
import { StellarService } from '../services/StellarService';
import { CreateEscrowDto, ReleaseEscrowDto, RefundEscrowDto } from '../dtos/stellar.dto';

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
}
