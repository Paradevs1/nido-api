import { ObjectId } from 'mongodb';

export interface IPaymentRefund {
  _id?: ObjectId;
  campaign_id: string;
  signature: string;
  to: string;
  amount: number;
  symbol: string;
  chain: string;
  status: 'confirmed';
  created_at: Date;
  updated_at: Date;
}

export class PaymentRefundModel {
  private static collectionName = 'payment_refunds';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IPaymentRefund>(this.collectionName);
  }

  static async create(refundData: Omit<IPaymentRefund, '_id' | 'created_at' | 'updated_at'>): Promise<IPaymentRefund> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newRefund: IPaymentRefund = {
      ...refundData,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(newRefund);
    return { ...newRefund, _id: result.insertedId };
  }

  static async findById(id: string): Promise<IPaymentRefund | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async findByCampaignId(campaignId: string): Promise<IPaymentRefund[]> {
    const collection = await this.getCollection();
    return await collection.find({ campaign_id: campaignId }).sort({ created_at: -1 }).toArray();
  }

  static async findBySignature(signature: string): Promise<IPaymentRefund | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ signature });
  }

  static async findWithFilters(
    limit: number,
    skip: number,
    filters: { campaignId?: string; status?: string } = {}
  ): Promise<IPaymentRefund[]> {
    const collection = await this.getCollection();
    const mongoFilter: Record<string, unknown> = {};
    if (filters['campaignId']) mongoFilter['campaign_id'] = filters['campaignId'];
    if (filters['status']) mongoFilter['status'] = filters['status'];
    return collection.find(mongoFilter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();
  }

  static async countWithFilters(filters: { campaignId?: string; status?: string } = {}): Promise<number> {
    const collection = await this.getCollection();
    const mongoFilter: Record<string, unknown> = {};
    if (filters['campaignId']) mongoFilter['campaign_id'] = filters['campaignId'];
    if (filters['status']) mongoFilter['status'] = filters['status'];
    return collection.countDocuments(mongoFilter);
  }
}
