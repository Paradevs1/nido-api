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
  deadline: number | undefined;
  paymentTxXDR: string | undefined;
  refundTxXDR: string | undefined;
  releaseTxHash: string | undefined;
  refundCloseTxHash: string | undefined;
  createdAt: Date;
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
