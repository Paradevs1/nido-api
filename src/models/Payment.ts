import { ObjectId } from 'mongodb';

export interface IPayment {
  _id?: ObjectId;
  userId: string;
  campaignId: string;
  signature: string;
  to: string;
  amount: number;
  chain?: string;
  symbol: string;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: Date;
  updated_at: Date;
}

export class PaymentModel {
  private static collectionName = 'payments_winners_campaigns';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IPayment>(this.collectionName);
  }

  static async create(paymentData: Omit<IPayment, '_id' | 'created_at' | 'updated_at'>): Promise<IPayment> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newPayment: IPayment = {
      ...paymentData,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(newPayment);
    return { ...newPayment, _id: result.insertedId };
  }

  static async findById(id: string): Promise<IPayment | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async findByUserId(userId: string): Promise<IPayment[]> {
    const collection = await this.getCollection();
    return await collection.find({ userId }).toArray();
  }

  static async findByCampaignId(campaignId: string): Promise<IPayment[]> {
    const collection = await this.getCollection();
    return await collection.find({ campaignId }).toArray();
  }

  static async findBySignature(signature: string): Promise<IPayment | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ signature });
  }

  static async updateStatus(id: string, status: 'pending' | 'confirmed' | 'failed'): Promise<IPayment | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status,
          updated_at: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async updateTaxId(id: string, taxId: string): Promise<IPayment | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          taxId,
          updated_at: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async deleteById(id: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  static async getPaymentsByUserAndCampaign(userId: string, campaignId: string): Promise<IPayment[]> {
    const collection = await this.getCollection();
    return await collection.find({ userId, campaignId }).toArray();
  }

  static async getTotalAmountByCampaign(campaignId: string): Promise<number> {
    const collection = await this.getCollection();
    const result = await collection.aggregate([
      { $match: { campaignId, status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    return result.length > 0 ? (result[0] as any)['total'] : 0;
  }

  static async getTotalEarningsByUserId(userId: string): Promise<number> {
    const collection = await this.getCollection();
    const result = await collection.aggregate<{ total: number }>([
      { $match: { userId, status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    return result[0]?.total ?? 0;
  }

  static async findWithFilters(
    limit: number,
    skip: number,
    filters: { userId?: string; campaignId?: string; status?: string } = {}
  ): Promise<IPayment[]> {
    const collection = await this.getCollection();
    const mongoFilter: Record<string, unknown> = {};
    if (filters['userId']) mongoFilter['userId'] = filters['userId'];
    if (filters['campaignId']) mongoFilter['campaignId'] = filters['campaignId'];
    if (filters['status']) mongoFilter['status'] = filters['status'];
    return collection.find(mongoFilter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();
  }

  static async countWithFilters(filters: { userId?: string; campaignId?: string; status?: string } = {}): Promise<number> {
    const collection = await this.getCollection();
    const mongoFilter: Record<string, unknown> = {};
    if (filters['userId']) mongoFilter['userId'] = filters['userId'];
    if (filters['campaignId']) mongoFilter['campaignId'] = filters['campaignId'];
    if (filters['status']) mongoFilter['status'] = filters['status'];
    return collection.countDocuments(mongoFilter);
  }

  static async findWithPagination(
    page: number = 1,
    limit: number = 50,
    filters: { userId?: string; campaignId?: string; status?: string } = {}
  ): Promise<{ payments: IPayment[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.findWithFilters(limit, skip, filters),
      this.countWithFilters(filters)
    ]);
    return {
      payments,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
}
