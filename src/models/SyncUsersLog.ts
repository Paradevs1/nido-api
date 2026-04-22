import { ObjectId } from 'mongodb';

export interface ISyncUsersLog {
  _id?: ObjectId;
  userid_old: string;
  userid_new: string;
  old_user: {
    email: string | null;
    twitter_id: string | null;
    twitter_username: string | null;
    twitter_display_name: string | null;
    wallet_evm: string | null;
    wallet_sol: string | null;
    wallet_sui: string | null;
    wallet_stellar: string | null;
    total_earnings: number;
    user_type: string | null;
  };
  new_user: {
    email: string | null;
    twitter_id: string | null;
    google_id: string | null;
    user_type: string | null;
  };
  merged_fields: string[];
  created_at: Date;
}

export class SyncUsersLogModel {
  private static collectionName = 'sync_users_log';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<ISyncUsersLog>(this.collectionName);
  }

  static async create(data: Omit<ISyncUsersLog, '_id' | 'created_at'>): Promise<ISyncUsersLog> {
    const collection = await this.getCollection();
    const log: ISyncUsersLog = { ...data, created_at: new Date() };
    const result = await collection.insertOne(log);
    return { ...log, _id: result.insertedId };
  }

  static async findByUserIdOld(userid_old: string): Promise<ISyncUsersLog[]> {
    const collection = await this.getCollection();
    return collection.find({ userid_old }).sort({ created_at: -1 }).toArray();
  }

  static async findByUserIdNew(userid_new: string): Promise<ISyncUsersLog[]> {
    const collection = await this.getCollection();
    return collection.find({ userid_new }).sort({ created_at: -1 }).toArray();
  }

  static async findAll(): Promise<ISyncUsersLog[]> {
    const collection = await this.getCollection();
    return collection.find().sort({ created_at: -1 }).toArray();
  }
}
