import { ObjectId, Db, Collection } from 'mongodb';
import { getBountiesDB } from '../config/database';

export interface ICampaignParticipants {
  _id?: ObjectId;
  userId: string;
  campaignId: string;
  date_submit: Date;
  amount_received: number;
  date_received?: Date;
  submission_twitter: string;
  submission_tiktok: string;
  submission_instagram: string;
  submission_youtube: string;
  submission_feedback: string;
  media_twitter: string;
  views_twitter: number;
  replies_twitter: number;
  retweets_twitter: number;
  quotes_twitter: number;
  bookmarks_twitter: number;
  likes_twitter: number;
  content_length: number;
  media_tiktok: string;
  views_tiktok: number;
  replies_tiktok: number;
  retweets_tiktok: number;
  quotes_tiktok: number;
  bookmarks_tiktok: number;
  likes_tiktok: number;
  media_instagram: string;
  views_instagram: number;
  replies_instagram: number;
  retweets_instagram: number;
  quotes_instagram: number;
  bookmarks_instagram: number;
  likes_instagram: number;
  media_youtube: string;
  views_youtube: number;
  replies_youtube: number;
  retweets_youtube: number;
  quotes_youtube: number;
  bookmarks_youtube: number;
  likes_youtube: number;
  views_instagram_story: number;
  replies_instagram_story: number;
  retweets_instagram_story: number;
  likes_instagram_story: number;
  winner: boolean;
  rank?: number;
  submissions_kols?: string[];
  submissions_images?: string[]; // Base64 encoded images (e.g. "data:image/png;base64,iVBOR...")
  created_at: Date;
  updated_at: Date;
}

export class CampaignParticipantsModel {
  private static collectionName = 'campaign_participants';

  private static async getCollection(): Promise<Collection<ICampaignParticipants>> {
    const db: Db = await getBountiesDB();
    return db.collection<ICampaignParticipants>(this.collectionName);
  }

  static async create(participantData: Omit<ICampaignParticipants, '_id' | 'created_at' | 'updated_at'>): Promise<ICampaignParticipants> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newParticipant: ICampaignParticipants = {
      ...participantData,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(newParticipant);
    return { ...newParticipant, _id: result.insertedId };
  }

  static async findById(id: string): Promise<ICampaignParticipants | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async findByUserAndCampaign(userId: string, campaignId: string): Promise<ICampaignParticipants | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ userId, campaignId });
  }

  static async findByUserId(userId: string, page: number = 1, limit: number = 10): Promise<{ participants: ICampaignParticipants[], total: number, page: number, limit: number, totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;
    const query = { userId: userId };
    
    const participants = await collection.find(query).skip(skip).limit(limit).toArray();
    const total = await collection.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    
    return { participants, total, page, limit, totalPages };
  }

  static async findByCampaignId(campaignId: string, page: number = 1, limit: number = 10): Promise<{ participants: ICampaignParticipants[], total: number, page: number, limit: number, totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;
    const query = { campaignId };
    
    const [participants, total] = await Promise.all([
      collection.find(query).sort({ date_submit: 1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(query)
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    return { participants, total, page, limit, totalPages };
  }

  static async countByCampaignId(campaignId: string): Promise<number> {
    const collection = await this.getCollection();
    
    if (!campaignId || typeof campaignId !== 'string') {
      return 0;
    }
    
    campaignId = campaignId.trim();
    
    if (campaignId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(campaignId)) {
      return 0;
    }
    
    try {
      return await collection.countDocuments({ campaignId: campaignId as any });
    } catch (error: any) {
      return 0;
    }
  }

  static async findWinnersByCampaignId(campaignId: string): Promise<ICampaignParticipants[]> {
    const collection = await this.getCollection();
    return await collection.find({ 
      campaignId, 
      winner: true 
    }).sort({ rank: 1 }).toArray();
  }

  static async getTotalEarningsByUserId(userId: string): Promise<number> {
    const collection = await this.getCollection();
    const result = await collection.aggregate<{ total: number }>([
      { $match: { userId, winner: true } },
      { $group: { _id: null, total: { $sum: '$amount_received' } } }
    ]).toArray();
    return result[0]?.total ?? 0;
  }

  static async countByUserId(userId: string): Promise<number> {
    const collection = await this.getCollection();
    return await collection.countDocuments({ userId });
  }

  static async updateWinnerData(userId: string, campaignId: string, updateData: { amount_received: number, winner: boolean, rank?: number }): Promise<ICampaignParticipants | null> {
    const collection = await this.getCollection();
    const update = {
      ...updateData,
      updated_at: new Date()
    };
    
    const result = await collection.findOneAndUpdate(
      { userId, campaignId },
      { $set: update },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async updateDateReceived(userId: string, campaignId: string): Promise<ICampaignParticipants | null> {
    const collection = await this.getCollection();
    const update = {
      date_received: new Date(),
      updated_at: new Date()
    };
    
    const result = await collection.findOneAndUpdate(
      { userId, campaignId },
      { $set: update },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async updateById(id: string, updateData: Partial<ICampaignParticipants>): Promise<ICampaignParticipants | null> {
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

  static async findPendingTwitterJobParticipants(): Promise<ICampaignParticipants[]> {
    const collection = await this.getCollection();
    const { CampaignModel } = await import('./Campaign');
    
    const completedCampaigns = await CampaignModel.findWithPaginationAllStatus(1, 1000, {
      status: 'waiting payment',
      is_job_twitter_executed: false
    });

    const campaignIds = completedCampaigns.campaigns.map(c => c._id!.toString());
    
    if (campaignIds.length === 0) {
      return [];
    }

    const participants = await collection.find({
      campaignId: { $in: campaignIds },
      submission_twitter: { $exists: true, $ne: '' },
      views_twitter: { $exists: false }
    }).toArray();

    return participants;
  }

  static async findPendingInstagramJobParticipants(): Promise<ICampaignParticipants[]> {
    const collection = await this.getCollection();
    const { CampaignModel } = await import('./Campaign');

    const completedCampaigns = await CampaignModel.findWithPaginationAllStatus(1, 1000, {
      status: 'waiting payment',
      is_job_instagram_executed: false
    });

    const campaignIds = completedCampaigns.campaigns.map(c => c._id!.toString());
    if (campaignIds.length === 0) return [];

    return await collection.find({
      campaignId: { $in: campaignIds },
      submission_instagram: { $exists: true, $ne: '' }
    }).toArray();
  }

  static async findPendingTiktokJobParticipants(): Promise<ICampaignParticipants[]> {
    const collection = await this.getCollection();
    const { CampaignModel } = await import('./Campaign');

    const completedCampaigns = await CampaignModel.findWithPaginationAllStatus(1, 1000, {
      status: 'waiting payment',
      is_job_tiktok_executed: false
    });

    const campaignIds = completedCampaigns.campaigns.map(c => c._id!.toString());
    if (campaignIds.length === 0) return [];

    return await collection.find({
      campaignId: { $in: campaignIds },
      submission_tiktok: { $exists: true, $ne: '' }
    }).toArray();
  }

  static async findPendingYoutubeJobParticipants(): Promise<ICampaignParticipants[]> {
    const collection = await this.getCollection();
    const { CampaignModel } = await import('./Campaign');

    const completedCampaigns = await CampaignModel.findWithPaginationAllStatus(1, 1000, {
      status: 'waiting payment',
      is_job_youtube_executed: false
    });

    const campaignIds = completedCampaigns.campaigns.map(c => c._id!.toString());
    if (campaignIds.length === 0) return [];

    return await collection.find({
      campaignId: { $in: campaignIds },
      submission_youtube: { $exists: true, $ne: '' }
    }).toArray();
  }

  static async updateInstagramData(
    participantId: string,
    data: {
      media_instagram?: string;
      views_instagram?: number;
      replies_instagram?: number;
      likes_instagram?: number;
    }
  ): Promise<ICampaignParticipants | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(participantId) },
      { $set: { ...data, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    return result || null;
  }

  static async updateTiktokData(
    participantId: string,
    data: {
      media_tiktok?: string;
      views_tiktok?: number;
      replies_tiktok?: number;
      retweets_tiktok?: number;
      bookmarks_tiktok?: number;
      likes_tiktok?: number;
    }
  ): Promise<ICampaignParticipants | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(participantId) },
      { $set: { ...data, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    return result || null;
  }

  static async updateYoutubeData(
    participantId: string,
    data: {
      media_youtube?: string;
      views_youtube?: number;
      replies_youtube?: number;
      likes_youtube?: number;
    }
  ): Promise<ICampaignParticipants | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(participantId) },
      { $set: { ...data, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    return result || null;
  }

  static async updateInstagramStoryData(
    participantId: string,
    data: {
      views_instagram_story?: number;
      replies_instagram_story?: number;
      retweets_instagram_story?: number;
      likes_instagram_story?: number;
    }
  ): Promise<ICampaignParticipants | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(participantId) },
      { $set: { ...data, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    return result || null;
  }

  static async clearInstagramStoryData(
    participantId: string
  ): Promise<ICampaignParticipants | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(participantId) },
      { $set: {
        views_instagram_story: 0,
        replies_instagram_story: 0,
        retweets_instagram_story: 0,
        likes_instagram_story: 0,
        updated_at: new Date()
      }},
      { returnDocument: 'after' }
    );
    return result || null;
  }

  static async updateTwitterData(
    participantId: string,
    twitterData: {
      media_twitter?: string;
      views_twitter?: number;
      replies_twitter?: number;
      retweets_twitter?: number;
      quotes_twitter?: number;
      bookmarks_twitter?: number;
      likes_twitter?: number;
      content_length?: number;
    }
  ): Promise<ICampaignParticipants | null> {
    const collection = await this.getCollection();
    const update = {
      ...twitterData,
      updated_at: new Date()
    };
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(participantId) },
      { $set: update },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async aggregateCreatorParticipationStats(
    skip: number,
    limit: number,
    search?: string
  ): Promise<{
    rows: Array<{
      userId: string;
      campaigns_participated: number;
      username?: string;
      twitter_username?: string;
      isActive?: boolean;
    }>;
    total: number;
  }> {
    const collection = await this.getCollection();
    const pipeline: object[] = [
      { $group: { _id: '$userId', campaignIds: { $addToSet: '$campaignId' } } },
      {
        $project: {
          userId: '$_id',
          campaigns_participated: { $size: '$campaignIds' }
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { uid: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: [{ $toString: '$_id' }, '$$uid'] }, { $eq: ['$user_type', 'CREATOR'] }]
                }
              }
            },
            { $project: { username: 1, twitter_username: 1, isActive: 1 } }
          ],
          as: 'u'
        }
      },
      { $match: { 'u.0': { $exists: true } } },
      { $unwind: '$u' },
      {
        $project: {
          userId: 1,
          campaigns_participated: 1,
          username: '$u.username',
          twitter_username: '$u.twitter_username',
          isActive: '$u.isActive'
        }
      }
    ];

    const trimmed = search?.trim();
    if (trimmed) {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pipeline.push({
        $match: {
          $or: [
            { username: { $regex: escaped, $options: 'i' } },
            { twitter_username: { $regex: escaped, $options: 'i' } }
          ]
        }
      });
    }

    pipeline.push({
      $facet: {
        data: [{ $sort: { campaigns_participated: -1, userId: 1 } }, { $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'total' }]
      }
    });

    const agg = await collection.aggregate(pipeline).toArray();
    const facet = agg[0] as { data: typeof pipeline; totalCount: Array<{ total: number }> };
    const rows = (facet?.data ?? []) as Array<{
      userId: string;
      campaigns_participated: number;
      username?: string;
      twitter_username?: string;
      isActive?: boolean;
    }>;
    const total = facet?.totalCount?.[0]?.total ?? 0;
    return { rows, total };
  }

  static async aggregateRecurringCreators(
    campaignIds: string[],
    skip: number,
    limit: number,
    search?: string
  ): Promise<{
    rows: Array<{
      userId: string;
      campaigns_participated: number;
      username?: string;
      twitter_username?: string;
      isActive?: boolean;
    }>;
    total: number;
  }> {
    if (campaignIds.length === 0) {
      return { rows: [], total: 0 };
    }
    const collection = await this.getCollection();
    const expected = campaignIds.length;
    const pipeline: object[] = [
      { $match: { campaignId: { $in: campaignIds } } },
      { $group: { _id: '$userId', camps: { $addToSet: '$campaignId' } } },
      { $match: { $expr: { $eq: [{ $size: '$camps' }, expected] } } },
      {
        $project: {
          userId: '$_id',
          campaigns_participated: { $size: '$camps' }
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { uid: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: [{ $toString: '$_id' }, '$$uid'] }, { $eq: ['$user_type', 'CREATOR'] }]
                }
              }
            },
            { $project: { username: 1, twitter_username: 1, isActive: 1 } }
          ],
          as: 'u'
        }
      },
      { $match: { 'u.0': { $exists: true } } },
      { $unwind: '$u' },
      {
        $project: {
          userId: 1,
          campaigns_participated: 1,
          username: '$u.username',
          twitter_username: '$u.twitter_username',
          isActive: '$u.isActive'
        }
      }
    ];

    const trimmed = search?.trim();
    if (trimmed) {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pipeline.push({
        $match: {
          $or: [
            { username: { $regex: escaped, $options: 'i' } },
            { twitter_username: { $regex: escaped, $options: 'i' } }
          ]
        }
      });
    }

    pipeline.push({
      $facet: {
        data: [{ $sort: { twitter_username: 1, userId: 1 } }, { $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'total' }]
      }
    });

    const agg = await collection.aggregate(pipeline).toArray();
    const facet = agg[0] as { data: typeof pipeline; totalCount: Array<{ total: number }> };
    const rows = (facet?.data ?? []) as Array<{
      userId: string;
      campaigns_participated: number;
      username?: string;
      twitter_username?: string;
      isActive?: boolean;
    }>;
    const total = facet?.totalCount?.[0]?.total ?? 0;
    return { rows, total };
  }
}
