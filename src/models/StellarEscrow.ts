import { ObjectId } from 'mongodb';

export enum EscrowStatus {
  CREATED = 'CREATED',
  // CCTP inbound: host burned USDC on a source chain; waiting for Iris
  // attestation + the forwarder mint to land USDC on the escrow account.
  PENDING_INBOUND_MINT = 'PENDING_INBOUND_MINT',
  FUNDED = 'FUNDED',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED',
}

// How the escrow was (or will be) funded.
export type FundingMethod = 'STELLAR_NATIVE' | 'CCTP';

export interface IStellarEscrow {
  _id?: ObjectId;
  job_id: string;
  escrow_public_key: string;
  secret_key_encrypted?: string;
  host_public_key: string;
  talent_public_key: string;
  arbiter_public_key: string;
  amount: string;
  asset_code: string;
  status: EscrowStatus;
  // Host-funded deposit: unsigned payment (host → escrow) the host signs to fund the escrow
  funding_tx_xdr?: string;
  funding_tx_hash?: string;
  fund_tx_hash?: string; // on-chain hash once the funding payment is submitted
  payment_tx_xdr?: string;
  payment_tx_hash?: string;
  refund_tx_xdr?: string;
  refund_tx_hash?: string;
  deadline?: number;
  stellar_tx_hash?: string;
  release_tx_hash?: string;
  refund_close_tx_hash?: string;
  // Dispute fields
  dispute_reason?: string;
  dispute_initiator?: 'HOST' | 'TALENT';
  dispute_opened_at?: Date;
  dispute_winner?: 'HOST' | 'TALENT';
  dispute_resolution_xdr?: string;
  dispute_closed_tx_hash?: string;
  merge_tx_hash?: string;
  // ─── CCTP inbound funding ───────────────────────────────────────────────
  funding_method?: FundingMethod; // defaults to STELLAR_NATIVE when unset
  inbound_source_chain?: string; // slug: ethereum | arbitrum | base | polygon | solana
  inbound_source_domain?: number; // CCTP domain id of the source chain
  inbound_source_tx_hash?: string; // burn tx hash on the source chain
  inbound_attestation_status?: 'PENDING' | 'COMPLETE';
  inbound_mint_tx_hash?: string; // Stellar tx hash of mint_and_forward relay
  created_at: Date;
  updated_at: Date;
}

export class StellarEscrowModel {
  private static collectionName = 'stellar_escrows';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IStellarEscrow>(this.collectionName);
  }

  static async ensureIndexes(): Promise<void> {
    const collection = await this.getCollection();
    await collection.createIndex({ job_id: 1 }, { unique: true, name: 'job_id_unique' });
  }

  static async create(
    escrowData: Omit<IStellarEscrow, '_id' | 'created_at' | 'updated_at'>
  ): Promise<IStellarEscrow> {
    const collection = await this.getCollection();
    const newEscrow: IStellarEscrow = {
      ...escrowData,
      created_at: new Date(),
      updated_at: new Date(),
    };
    try {
      const result = await collection.insertOne(newEscrow);
      return { ...newEscrow, _id: result.insertedId };
    } catch (err: any) {
      if (err.code === 11000) {
        throw new Error(`Escrow already exists for job ${escrowData.job_id}`);
      }
      throw err;
    }
  }

  static async findByJobId(jobId: string): Promise<IStellarEscrow | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ job_id: jobId });
  }

  static async findByPublicKey(publicKey: string): Promise<IStellarEscrow | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ escrow_public_key: publicKey });
  }

  static async findByHostPublicKey(hostPublicKey: string): Promise<IStellarEscrow[]> {
    const collection = await this.getCollection();
    return await collection.find({ host_public_key: hostPublicKey }).toArray();
  }

  static async findByTalentPublicKey(talentPublicKey: string): Promise<IStellarEscrow[]> {
    const collection = await this.getCollection();
    return await collection.find({ talent_public_key: talentPublicKey }).toArray();
  }

  static async findByStatus(status: EscrowStatus): Promise<IStellarEscrow[]> {
    const collection = await this.getCollection();
    return await collection.find({ status }).sort({ created_at: -1 }).toArray();
  }

  static async updateStatus(
    jobId: string,
    status: EscrowStatus,
    extra?: Partial<IStellarEscrow>
  ): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { job_id: jobId },
      { $set: { status, updated_at: new Date(), ...extra } }
    );
    return result.modifiedCount > 0;
  }

  static async findDisputed(): Promise<IStellarEscrow[]> {
    const collection = await this.getCollection();
    return await collection
      .find({ status: EscrowStatus.DISPUTED })
      .sort({ dispute_opened_at: -1 })
      .toArray();
  }

  static async findPendingInboundMints(): Promise<IStellarEscrow[]> {
    const collection = await this.getCollection();
    return await collection
      .find({ status: EscrowStatus.PENDING_INBOUND_MINT })
      .sort({ updated_at: 1 })
      .toArray();
  }

  static async findExpiredEscrows(): Promise<IStellarEscrow[]> {
    const collection = await this.getCollection();
    const now = Math.floor(Date.now() / 1000);
    return await collection
      .find({ status: EscrowStatus.FUNDED, deadline: { $lt: now } })
      .toArray();
  }

  static async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalAmount: number;
  }> {
    const collection = await this.getCollection();
    const [total, byStatus, amountAgg] = await Promise.all([
      collection.countDocuments(),
      collection
        .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
        .toArray(),
      collection
        .aggregate([{ $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }])
        .toArray(),
    ]);
    const statusCounts = byStatus.reduce((acc: Record<string, number>, item: any) => {
      acc[item['_id'] as string] = item['count'] as number;
      return acc;
    }, {} as Record<string, number>);
    return { total, byStatus: statusCounts, totalAmount: (amountAgg[0] as any)?.['total'] || 0 };
  }

  static async updateTxHash(jobId: string, txHash: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { job_id: jobId },
      { $set: { stellar_tx_hash: txHash, updated_at: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  static async deleteOldEscrows(daysOld: number): Promise<number> {
    const collection = await this.getCollection();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    const result = await collection.deleteMany({
      status: { $in: [EscrowStatus.COMPLETED, EscrowStatus.REFUNDED] },
      created_at: { $lt: cutoff },
    });
    return result.deletedCount;
  }
}
