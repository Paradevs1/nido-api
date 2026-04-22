import { ObjectId } from 'mongodb';
import { RequiredPlatform } from './Campaign';

export interface ICommunity {
  _id?: ObjectId;
  name: string;
  description: string;
  rules: string;
  logo?: string | undefined; // Base64 encoded image
  required_platforms?: RequiredPlatform[] | undefined;
  enrollment_start?: Date | null | undefined;
  enrollment_end?: Date | null | undefined;
  host_id: string;
  created_at: Date;
  updated_at: Date;
}

export class CommunityModel {
  private static collectionName = 'communities';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<ICommunity>(this.collectionName);
  }

  static async create(data: Omit<ICommunity, '_id' | 'created_at' | 'updated_at'>): Promise<ICommunity> {
    const collection = await this.getCollection();
    const now = new Date();
    const newCommunity: ICommunity = {
      ...data,
      created_at: now,
      updated_at: now
    };
    const result = await collection.insertOne(newCommunity);
    return { ...newCommunity, _id: result.insertedId };
  }

  static async findById(id: string): Promise<ICommunity | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async updateById(id: string, updateData: Partial<ICommunity>): Promise<ICommunity | null> {
    const collection = await this.getCollection();
    const update = {
      ...updateData,
      updated_at: new Date()
    };
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    return result || null;
  }

  static async deleteById(id: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  static async findByHostId(hostId: string): Promise<ICommunity[]> {
    const collection = await this.getCollection();
    return await collection.find({ host_id: hostId }).sort({ created_at: -1 }).toArray();
  }

  static async findAll(search?: string): Promise<ICommunity[]> {
    const collection = await this.getCollection();
    const filter: any = {};
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }
    return await collection.find(filter).sort({ created_at: -1 }).toArray();
  }

  static async countByHostId(hostId: string): Promise<number> {
    const collection = await this.getCollection();
    return await collection.countDocuments({ host_id: hostId });
  }

  static async findWithPagination(
    page: number = 1,
    limit: number = 10,
    filters: Partial<ICommunity> = {}
  ): Promise<{ communities: ICommunity[]; total: number; page: number; totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;
    const mongoFilters: any = { ...filters };

    const [communities, total] = await Promise.all([
      collection.find(mongoFilters).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(mongoFilters)
    ]);

    return {
      communities,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
}
