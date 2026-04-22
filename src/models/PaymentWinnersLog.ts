import { ObjectId } from 'mongodb';

export interface IPaymentWinnersLog {
  _id?: ObjectId;
  campaignId: string;
  userId: string;
  wallet: string;
  amount: number;
  chain: string;
  symbol: string;
  status: 'pending' | 'confirmed' | 'failed' | 'skipped';
  signature?: string | undefined;
  error?: string | undefined;
  source: 'sendTokenWinners' | 'retryFailedPayments';
  created_at: Date;
}

export class PaymentWinnersLogModel {
  private static collectionName = 'payment_winners_logs';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IPaymentWinnersLog>(this.collectionName);
  }

  static async create(data: Omit<IPaymentWinnersLog, '_id' | 'created_at'>): Promise<IPaymentWinnersLog> {
    const collection = await this.getCollection();
    const log: IPaymentWinnersLog = { ...data, created_at: new Date() };
    const result = await collection.insertOne(log);
    return { ...log, _id: result.insertedId };
  }

  static async createMany(entries: Omit<IPaymentWinnersLog, '_id' | 'created_at'>[]): Promise<void> {
    if (entries.length === 0) return;
    const collection = await this.getCollection();
    const now = new Date();
    const docs = entries.map(e => ({ ...e, created_at: now }));
    await collection.insertMany(docs);
  }

  static async findByCampaignId(campaignId: string): Promise<IPaymentWinnersLog[]> {
    const collection = await this.getCollection();
    return collection.find({ campaignId }).sort({ created_at: -1 }).toArray();
  }

  static async findByCampaignIdAndStatus(campaignId: string, status: IPaymentWinnersLog['status']): Promise<IPaymentWinnersLog[]> {
    const collection = await this.getCollection();
    return collection.find({ campaignId, status }).sort({ created_at: -1 }).toArray();
  }
}
