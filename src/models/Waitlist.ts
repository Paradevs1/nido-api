import { ObjectId } from 'mongodb';
import { getBountiesDB } from '../config/database';

export interface IWaitlist {
  _id?: ObjectId;
  email: string;
  xHandle: string;
  role: 'creator' | 'protocol';
  createdAt: Date;
  updatedAt: Date;
}

export class WaitlistModel {
  private static readonly COLLECTION_NAME = 'waitlists';

  static async create(waitlistData: Omit<IWaitlist, '_id' | 'createdAt' | 'updatedAt'>): Promise<IWaitlist> {
    const db = await getBountiesDB();
    const collection = db.collection<IWaitlist>(this.COLLECTION_NAME);

    // Check if email already exists
    const existingEntry = await collection.findOne({ email: waitlistData.email });
    if (existingEntry) {
      throw new Error('Email already exists in waitlist');
    }

    const newWaitlist: Omit<IWaitlist, '_id'> = {
      ...waitlistData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(newWaitlist);
    
    const insertedWaitlist = await collection.findOne({ _id: result.insertedId });
    if (!insertedWaitlist) {
      throw new Error('Failed to create waitlist entry');
    }

    return insertedWaitlist;
  }

  static async findByEmail(email: string): Promise<IWaitlist | null> {
    const db = await getBountiesDB();
    const collection = db.collection<IWaitlist>(this.COLLECTION_NAME);
    return await collection.findOne({ email });
  }

  static async findByUsernameTwitter(username: string): Promise<boolean> {
    const db = await getBountiesDB();
    const collection = db.collection<IWaitlist>(this.COLLECTION_NAME);
    const escaped = username.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const result = await collection.findOne({ xHandle: { $regex: new RegExp(`^${escaped}$`, 'i') } });
    return result ? true : false;
  }

  static async findById(id: string): Promise<IWaitlist | null> {
    const db = await getBountiesDB();
    const collection = db.collection<IWaitlist>(this.COLLECTION_NAME);
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async findAll(
    filter: Partial<Pick<IWaitlist, 'role'>> = {},
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: IWaitlist[]; total: number; page: number; totalPages: number }> {
    const db = await getBountiesDB();
    const collection = db.collection<IWaitlist>(this.COLLECTION_NAME);

    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      collection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter)
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async deleteById(id: string): Promise<boolean> {
    const db = await getBountiesDB();
    const collection = db.collection<IWaitlist>(this.COLLECTION_NAME);
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  static async updateById(id: string, updateData: Partial<Omit<IWaitlist, '_id' | 'createdAt'>>): Promise<IWaitlist | null> {
    const db = await getBountiesDB();
    const collection = db.collection<IWaitlist>(this.COLLECTION_NAME);

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          ...updateData,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  static async getStats(): Promise<{
    total: number;
    creators: number;
    protocols: number;
    recent: number; // Last 7 days
  }> {
    const db = await getBountiesDB();
    const collection = db.collection<IWaitlist>(this.COLLECTION_NAME);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [total, creators, protocols, recent] = await Promise.all([
      collection.countDocuments(),
      collection.countDocuments({ role: 'creator' }),
      collection.countDocuments({ role: 'protocol' }),
      collection.countDocuments({ createdAt: { $gte: sevenDaysAgo } })
    ]);

    return {
      total,
      creators,
      protocols,
      recent
    };
  }
}