export interface CreateEscrowDto {
  jobId: string;
  hostPublicKey: string;
  talentPublicKey: string;
  amount: string;
  deadlineDays?: number;
}

export interface FundEscrowDto {
  jobId: string;
  hostSignedXDR: string;
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
  hostPublicKey: string;
  talentPublicKey: string;
  jobId: string;
  status: EscrowStatus;
  balance: string;
  lockedAmount: string;
  signers: SignerDto[];
  thresholds: ThresholdDto;
  deadline?: number;
  fundingTxXDR?: string;
  fundTxHash?: string;
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
  mergeTxHash?: string;
  // CCTP inbound funding
  fundingMethod?: 'STELLAR_NATIVE' | 'CCTP';
  inboundSourceChain?: string;
  inboundSourceTxHash?: string;
  inboundAttestationStatus?: 'PENDING' | 'COMPLETE';
  inboundMintTxHash?: string;
}

export enum EscrowStatus {
  CREATED = 'CREATED',
  PENDING_INBOUND_MINT = 'PENDING_INBOUND_MINT',
  FUNDED = 'FUNDED',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED',
}

// ─── CCTP inbound funding DTOs ─────────────────────────────────────────────────

export interface PrepareInboundDto {
  jobId: string;
  sourceChain: string; // ethereum | arbitrum | base | polygon | solana
}

/**
 * Everything the frontend needs to build the source-chain `depositForBurnWithHook`
 * call. The host's wallet (ethers/solana) signs the actual burn — the backend
 * never touches the host's source-chain keys.
 */
export interface PrepareInboundResponseDto {
  jobId: string;
  sourceChain: string;
  sourceDomain: number;
  destinationDomain: number; // 27 (Stellar)
  burnToken: string; // USDC token address on the source chain
  amount: string; // base units (6 decimals) for depositForBurn
  mintRecipient: string; // 0x-prefixed bytes32 of the CctpForwarder contract
  destinationCaller: string; // 0x0 (anyone can relay)
  hookData: string; // 0x-prefixed; encodes the escrow G-account strkey
  maxFee: string; // burn-token base units (0 for standard finality)
  minFinalityThreshold: number;
  escrowPublicKey: string;
}

export interface RegisterBurnDto {
  jobId: string;
  sourceChain: string;
  sourceTxHash: string; // burn tx hash on the source chain
}

export interface RelayMintDto {
  jobId: string;
}

export interface InboundStatusDto {
  jobId: string;
  status: EscrowStatus;
  attestationStatus?: 'PENDING' | 'COMPLETE';
  sourceChain?: string;
  sourceTxHash?: string;
  mintTxHash?: string;
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
    // Unsigned payment (host → escrow) the host must sign to deposit the USDC
    fundingTxXDR: string;
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
