import { ObjectId } from 'mongodb';

export enum EscrowStatus {
  CREATED = 'CREATED',
  FUNDED = 'FUNDED',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED',
}

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
  payment_tx_xdr?: string;
  payment_tx_hash?: string;
  refund_tx_xdr?: string;
  refund_tx_hash?: string;
  deadline?: number;
  stellar_tx_hash?: string;
  release_tx_hash?: string;
  refund_close_tx_hash?: string;
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

  static async create(
    escrowData: Omit<IStellarEscrow, '_id' | 'created_at' | 'updated_at'>
  ): Promise<IStellarEscrow> {
    const collection = await this.getCollection();
    const newEscrow: IStellarEscrow = {
      ...escrowData,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const result = await collection.insertOne(newEscrow);
    return { ...newEscrow, _id: result.insertedId };
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
}
