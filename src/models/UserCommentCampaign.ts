import { ObjectId, Db, Collection } from 'mongodb';
import { getBountiesDB } from '../config/database';

export interface IUserCommentCampaign {
  _id?: ObjectId;
  userId: string;
  campaignId: string;
  comment: string;
  create_date: Date;
  is_fixed?: boolean;
  created_at: Date;
  updated_at: Date;
}

export class UserCommentCampaignModel {
  private static collectionName = 'user_comment_campaign';

  private static async getCollection(): Promise<Collection<IUserCommentCampaign>> {
    const db: Db = await getBountiesDB();
    return db.collection<IUserCommentCampaign>(this.collectionName);
  }

  static async create(commentData: Omit<IUserCommentCampaign, '_id' | 'created_at' | 'updated_at'>): Promise<IUserCommentCampaign> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newComment: IUserCommentCampaign = {
      ...commentData,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(newComment);
    return { ...newComment, _id: result.insertedId };
  }

  static async findById(id: string): Promise<IUserCommentCampaign | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async findByCampaignId(campaignId: string, page: number = 1, limit: number = 10): Promise<{ comments: IUserCommentCampaign[], total: number, page: number, limit: number, totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;
    const query = { campaignId };
    
    const [comments, total] = await Promise.all([
      collection.find(query).sort({ create_date: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(query)
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    return { comments, total, page, limit, totalPages };
  }

  static async updateById(id: string, updateData: Partial<IUserCommentCampaign>): Promise<IUserCommentCampaign | null> {
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

  static async findByUserAndCampaign(userId: string, campaignId: string): Promise<IUserCommentCampaign[]> {
    const collection = await this.getCollection();
    return await collection.find({ userId, campaignId }).toArray();
  }
}
