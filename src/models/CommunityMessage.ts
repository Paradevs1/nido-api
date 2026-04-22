import { ObjectId } from 'mongodb';

export type CommunityMessageSenderRole = 'HOST' | 'CREATOR';

export interface ICommunityMessage {
  _id?: ObjectId;
  community_id: string;
  sender_id: string;
  sender_role: CommunityMessageSenderRole;
  message: string;
  created_at: Date;
}

export class CommunityMessageModel {
  private static collectionName = 'community_messages';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<ICommunityMessage>(this.collectionName);
  }

  static async create(data: Omit<ICommunityMessage, '_id' | 'created_at'>): Promise<ICommunityMessage> {
    const collection = await this.getCollection();
    const newMessage: ICommunityMessage = {
      ...data,
      created_at: new Date()
    };
    const result = await collection.insertOne(newMessage);
    return { ...newMessage, _id: result.insertedId };
  }

  static async findById(id: string): Promise<ICommunityMessage | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async deleteById(id: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  static async findByCommunityId(
    communityId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: ICommunityMessage[]; total: number; page: number; totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;
    const filter = { community_id: communityId };

    const [messages, total] = await Promise.all([
      collection.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter)
    ]);

    return {
      messages,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async deleteByCommunityId(communityId: string): Promise<number> {
    const collection = await this.getCollection();
    const result = await collection.deleteMany({ community_id: communityId });
    return result.deletedCount;
  }
}
