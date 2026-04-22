import { ObjectId } from 'mongodb';

export interface ICommunityAnnouncement {
  _id?: ObjectId;
  community_id: string;
  title: string;
  description: string;
  image_url?: string | undefined; // Base64 encoded image (optional) - mantido para retrocompatibilidade
  images?: string[] | undefined; // Array de imagens base64 (max 5)
  link?: string | undefined; // URL link (optional)
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class CommunityAnnouncementModel {
  private static collectionName = 'community_announcements';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<ICommunityAnnouncement>(this.collectionName);
  }

  static async create(data: Omit<ICommunityAnnouncement, '_id' | 'created_at' | 'updated_at'>): Promise<ICommunityAnnouncement> {
    const collection = await this.getCollection();
    const now = new Date();
    const newAnnouncement: ICommunityAnnouncement = {
      ...data,
      created_at: now,
      updated_at: now
    };
    const result = await collection.insertOne(newAnnouncement);
    return { ...newAnnouncement, _id: result.insertedId };
  }

  static async findById(id: string): Promise<ICommunityAnnouncement | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async updateById(id: string, updateData: Partial<ICommunityAnnouncement>): Promise<ICommunityAnnouncement | null> {
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

  static async findByCommunityId(
    communityId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ announcements: ICommunityAnnouncement[]; total: number; page: number; totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;
    const filter = { community_id: communityId };

    const [announcements, total] = await Promise.all([
      collection.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter)
    ]);

    return {
      announcements,
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
