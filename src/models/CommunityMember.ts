import { ObjectId } from 'mongodb';

export type CommunityMemberStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ICommunityMember {
  _id?: ObjectId;
  community_id: string;
  creator_id: string;
  status: CommunityMemberStatus;
  requested_at: Date;
  reviewed_at?: Date | undefined;
  reviewed_by?: string | undefined;
}

export class CommunityMemberModel {
  private static collectionName = 'community_members';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<ICommunityMember>(this.collectionName);
  }

  static async create(data: Omit<ICommunityMember, '_id' | 'requested_at'>): Promise<ICommunityMember> {
    const collection = await this.getCollection();
    const newMember: ICommunityMember = {
      ...data,
      requested_at: new Date()
    };
    const result = await collection.insertOne(newMember);
    return { ...newMember, _id: result.insertedId };
  }

  static async findById(id: string): Promise<ICommunityMember | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async findByCommunityAndCreator(communityId: string, creatorId: string): Promise<ICommunityMember | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ community_id: communityId, creator_id: creatorId });
  }

  static async findByCommunityId(
    communityId: string,
    status?: CommunityMemberStatus,
    page: number = 1,
    limit: number = 50
  ): Promise<{ members: ICommunityMember[]; total: number; page: number; totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;
    const filter: any = { community_id: communityId };
    if (status) filter.status = status;

    const [members, total] = await Promise.all([
      collection.find(filter).sort({ requested_at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter)
    ]);

    return {
      members,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async updateStatus(
    id: string,
    status: CommunityMemberStatus,
    reviewedBy: string
  ): Promise<ICommunityMember | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, reviewed_at: new Date(), reviewed_by: reviewedBy } },
      { returnDocument: 'after' }
    );
    return result || null;
  }

  static async deleteById(id: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  static async deleteByCommunityId(communityId: string): Promise<number> {
    const collection = await this.getCollection();
    const result = await collection.deleteMany({ community_id: communityId });
    return result.deletedCount;
  }

  static async countByCommunityId(communityId: string, status?: CommunityMemberStatus): Promise<number> {
    const collection = await this.getCollection();
    const filter: any = { community_id: communityId };
    if (status) filter.status = status;
    return await collection.countDocuments(filter);
  }

  static async findApprovedCommunitiesByCreator(creatorId: string): Promise<ICommunityMember[]> {
    const collection = await this.getCollection();
    return await collection.find({ creator_id: creatorId, status: 'APPROVED' }).toArray();
  }

  static async findByCreatorId(creatorId: string): Promise<ICommunityMember[]> {
    const collection = await this.getCollection();
    return await collection.find({ creator_id: creatorId }).toArray();
  }
}
