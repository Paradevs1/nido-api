export interface CreateEscrowDto {
  jobId: string;
  hostPublicKey: string;
  talentPublicKey: string;
  amount: string;
  deadlineDays?: number;
}

export interface ReleaseEscrowDto {
  jobId: string;
  hostSignedXDR: string;
}

export interface RefundEscrowDto {
  jobId: string;
  hostSignedXDR: string;
}

export interface EscrowStatusDto {
  publicKey: string;
  jobId: string;
  status: EscrowStatus;
  balance: string;
  signers: SignerDto[];
  thresholds: ThresholdDto;
  deadline?: number;
  paymentTxXDR?: string;
  refundTxXDR?: string;
  releaseTxHash?: string;
  refundCloseTxHash?: string;
  createdAt: Date;
  // Dispute
  disputeReason?: string;
  disputeInitiator?: 'HOST' | 'TALENT';
  disputeWinner?: 'HOST' | 'TALENT';
  disputeResolutionXDR?: string;
  disputeClosedTxHash?: string;
}

export enum EscrowStatus {
  CREATED = 'CREATED',
  FUNDED = 'FUNDED',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED',
}

export interface SignerDto {
  publicKey: string;
  weight: number;
  type: 'host' | 'talent' | 'arbiter' | 'preauth';
}

export interface ThresholdDto {
  low: number;
  medium: number;
  high: number;
  masterWeight: number;
}

export interface PreAuthTxDto {
  paymentTxXDR: string;
  paymentTxHash: string;
  refundTxXDR: string;
  refundTxHash: string;
  deadline: number;
}

export interface CreateEscrowResponseDto {
  success: boolean;
  data: {
    escrowPublicKey: string;
    jobId: string;
    status: EscrowStatus;
    transactionHash: string;
    preAuthTxs: PreAuthTxDto;
  };
  message: string;
}

// ─── Dispute DTOs ──────────────────────────────────────────────────────────────

export interface OpenDisputeDto {
  jobId: string;
  reason: string;
  initiator: 'HOST' | 'TALENT';
}

export interface ResolveDisputeDto {
  jobId: string;
  winner: 'HOST' | 'TALENT';
}

export interface ClaimDisputeDto {
  jobId: string;
  winnerSignedXDR: string;
}

export interface DisputeResolutionDto {
  disputeResolutionXDR: string;
  winnerPublicKey: string;
  winner: 'HOST' | 'TALENT';
}
