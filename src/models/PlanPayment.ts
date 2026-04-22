import { ObjectId } from 'mongodb';

export interface IPlanPayment {
  _id?: ObjectId;
  plan_id: string;
  user_id: string;
  tax: string;
  date: Date;
  status: 'pending' | 'confirmed' | 'error';
  created_at: Date;
  updated_at: Date;
}

export class PlanPaymentModel {
  private static collectionName = 'plan_payments';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IPlanPayment>(this.collectionName);
  }

  static async create(data: Omit<IPlanPayment, '_id' | 'created_at' | 'updated_at'>): Promise<IPlanPayment> {
    const collection = await this.getCollection();
    const now = new Date();

    const doc: IPlanPayment = {
      ...data,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findByUserId(userId: string, limit: number = 50): Promise<IPlanPayment[]> {
    const collection = await this.getCollection();
    return await collection
      .find({ user_id: userId })
      .sort({ date: -1, created_at: -1 })
      .limit(limit)
      .toArray();
  }

  static async findByTax(tax: string): Promise<IPlanPayment | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ tax });
  }

  static async findWithFilters(
    limit: number,
    skip: number,
    filters: { userId?: string; status?: string } = {}
  ): Promise<IPlanPayment[]> {
    const collection = await this.getCollection();
    const mongoFilter: Record<string, unknown> = {};
    if (filters['userId']) mongoFilter['user_id'] = filters['userId'];
    if (filters['status']) mongoFilter['status'] = filters['status'];
    return collection.find(mongoFilter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();
  }

  static async countWithFilters(filters: { userId?: string; status?: string } = {}): Promise<number> {
    const collection = await this.getCollection();
    const mongoFilter: Record<string, unknown> = {};
    if (filters['userId']) mongoFilter['user_id'] = filters['userId'];
    if (filters['status']) mongoFilter['status'] = filters['status'];
    return collection.countDocuments(mongoFilter);
  }
}

