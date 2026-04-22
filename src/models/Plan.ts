import { ObjectId } from 'mongodb';

export type PlanName = 'BASIC' | 'CORE' | 'ENTERPRISE';

export interface IPlan {
  _id?: ObjectId;
  name: PlanName;
  duration_months: number | null;
  created_at: Date;
  updated_at: Date;
}

export class PlanModel {
  private static collectionName = 'plans';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IPlan>(this.collectionName);
  }

  static async ensureDefaults(): Promise<void> {
    const collection = await this.getCollection();

    const defaults: Array<Pick<IPlan, 'name' | 'duration_months'>> = [
      { name: 'BASIC', duration_months: null },
      { name: 'CORE', duration_months: 3 },
      { name: 'ENTERPRISE', duration_months: null }
    ];

    for (const def of defaults) {
      const existing = await collection.findOne({ name: def.name });
      if (existing) continue;

      const now = new Date();
      await collection.insertOne({
        ...def,
        created_at: now,
        updated_at: now
      } as IPlan);
    }
  }

  static async findByName(name: PlanName): Promise<IPlan | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ name });
  }

  static async findById(id: string): Promise<IPlan | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async listAll(): Promise<IPlan[]> {
    const collection = await this.getCollection();
    return await collection.find({}).sort({ name: 1 }).toArray();
  }
}

