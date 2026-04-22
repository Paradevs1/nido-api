import { ObjectId } from 'mongodb';

export interface OfficialLink {
  title: string;
  url: string;
  type: 'website' | 'twitter' | 'discord' | 'telegram' | 'docs' | 'github' | 'youtube' | 'other';
}

export interface SupportContact {
  type: 'email' | 'discord' | 'telegram' | 'twitter' | 'github' | 'youtube' | 'other';
  value: string;
  is_primary: boolean;
}

export interface RewardTier {
  position_initial: number;
  position_final: number;
  title: string;
  payment_amount: number;  
}

export interface ContentFormat {
  type: 'video' | 'thread' | 'post' | 'meme' | 'article' | 'feedback' | 'other';
}

export interface SubmissionFormat {
  type: 'twitter' | 'tiktok' | 'instagram' | 'youtube' | 'feedback';
}

export interface ContentCategory {
  slug: string;
}

export interface Country {
  name: string;
}

export interface KolReward {
  userId: string;
  amount: number;
}

export type RequiredPlatform = 'DISCORD' | 'INSTAGRAM' | 'TWITTER' | 'TIKTOK' | 'YOUTUBE' | 'TELEGRAM';

export interface ICampaign {
  _id?: ObjectId;
  host_id: string;
  community_id?: string;
  title: string;
  about_project: string;
  what_we_need: string;
  content_type: string;
  content_pillars: string;
  benefits: string;
  requirements: string;
  submission_format: SubmissionFormat[];
  content_format: ContentFormat[];
  content_categories: ContentCategory[];
  target_blockchain: string;
  official_links: OfficialLink[];
  support_contact: SupportContact[];
  country: Country[];
  start_date: Date;
  end_date: Date;
  payment_chain: string;
  payment_token: string;
  max_participants: number;
  winner_count: number | null; // Null por que quando usa mindshare não tem numero de vencedores
  reward_tiers: RewardTier[];
  total_prize_pool: number;
  links_officials: string[];
  original_url_shortener?: string;
  list_kols?: KolReward[];
  qtd_min_links?: number;
  qtd_max_links?: number;
  status: 'active' | 'inactive' | 'completed' | 'cancelled' | 'waiting payment';
  payment_received: boolean;
  rewards_distributed: boolean;
  is_job_twitter_executed: boolean;
  is_job_tiktok_executed: boolean;
  is_job_instagram_executed: boolean;
  is_job_youtube_executed: boolean;
  payment_rank_generate_ai?: boolean;
  isPrivate?: boolean;
  is_cac?: boolean;
  format_cac?: 'clicks' | 'view';
  quantity_conversion?: number;
  amount_convertion?: number;
  limit_amount_convertion?: number;
  created_at: Date;
  updated_at: Date;
} 

export class CampaignModel {
  private static collectionName = 'campaigns';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<ICampaign>(this.collectionName);
  }

  static async create(campaignData: Omit<ICampaign, '_id' | 'created_at' | 'updated_at' | 'rewards_distributed'>): Promise<ICampaign> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newCampaign: ICampaign = {
      ...campaignData,
      start_date: new Date(campaignData.start_date),
      end_date: new Date(campaignData.end_date),
      links_officials: campaignData.links_officials || [],
      list_kols: campaignData.list_kols || [],
      is_job_twitter_executed: false,
      is_job_tiktok_executed: false,
      is_job_instagram_executed: false,
      is_job_youtube_executed: false,
      rewards_distributed: false,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(newCampaign);
    return { ...newCampaign, _id: result.insertedId };
  }

  static async findById(id: string): Promise<ICampaign | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }
  
  static async updateById(id: string, updateData: Partial<ICampaign>): Promise<ICampaign | null> {
    const collection = await this.getCollection();
    const update = {
      ...updateData,
      ...(updateData.start_date && { start_date: new Date(updateData.start_date) }),
      ...(updateData.end_date && { end_date: new Date(updateData.end_date) }),
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

  static async findWithPagination(page: number = 1, limit: number = 10, filters: Partial<ICampaign> = {}): Promise<{ campaigns: ICampaign[], total: number, page: number, totalPages: number }> {
    try {
      const collection = await this.getCollection();
      const skip = (page - 1) * limit;
      
      const mongoFilters: any = {
        status: { $in: ['active', 'completed', 'waiting payment'] },
        $and: [
          { $or: [{ community_id: { $exists: false } }, { community_id: null }, { community_id: '' }] }
        ]
      };

      if (filters.host_id && typeof filters.host_id === 'string' && /^[0-9a-fA-F]{24}$/.test(filters.host_id)) {
        mongoFilters.host_id = filters.host_id;
      }
      
      if (filters.content_categories) {
        if (Array.isArray(filters.content_categories) && filters.content_categories.length > 0) {
          const validCategories = filters.content_categories.filter((cat): cat is { slug: string } => 
            cat !== null &&
            cat !== undefined &&
            typeof cat === 'object' && 
            'slug' in cat &&
            typeof cat.slug === 'string' && 
            cat.slug.length > 0 && 
            cat.slug.length !== 24 &&
            !/^[0-9a-fA-F]{24}$/.test(cat.slug)
          );
        }
      }
      
      let campaigns: ICampaign[] = [];
      let total = 0;

      try {
        campaigns = await collection.aggregate([
          { $match: mongoFilters },
          { $addFields: {
            _statusOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ['$status', 'active'] }, then: 1 },
                  { case: { $eq: ['$status', 'waiting payment'] }, then: 2 },
                  { case: { $eq: ['$status', 'completed'] }, then: 3 },
                ],
                default: 99
              }
            },
            _created_at_date: {
              $cond: {
                if: { $eq: [{ $type: '$created_at' }, 'string'] },
                then: { $dateFromString: { dateString: '$created_at' } },
                else: '$created_at'
              }
            }
          }},
          { $sort: { _statusOrder: 1, _created_at_date: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: { _statusOrder: 0, _created_at_date: 0 } }
        ]).toArray() as ICampaign[];
      } catch (error: any) {
        console.error('Error in find query:', error.message);
        throw error;
      }
      
      try {
        total = await collection.countDocuments(mongoFilters);
      } catch (error: any) {
        console.error('Error in countDocuments:', error.message);
        total = campaigns.length;
      }
      
      return {
        campaigns,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error: any) {
      throw error;
    }
  }

  static async findWithPaginationAllStatus(page: number = 1, limit: number = 10, filters: Partial<ICampaign> = {}): Promise<{ campaigns: ICampaign[], total: number, page: number, totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;
    
    const mongoFilters: any = { ...filters };
    
    const [campaigns, total] = await Promise.all([
      collection.find(mongoFilters).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(mongoFilters)
    ]);
    
    return {
      campaigns,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async updateStatus(campaignId: string, status: 'active' | 'inactive' | 'completed' | 'cancelled' | 'waiting payment'): Promise<ICampaign | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(campaignId) },
      { 
        $set: { 
          status: status,
          updated_at: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    return result;
  }

  static async findActiveCampaigns(): Promise<ICampaign[]> {
    const collection = await this.getCollection();
    return await collection.find({ 
      status: { $in: ['active'] }
    }).toArray();
  }

  static async updateExpiredCampaigns(): Promise<number> {
    const collection = await this.getCollection();
    const now = new Date();
    const nowBRT = new Date(now.getTime() - 3 * 60 * 60 * 1000); // BRT is UTC-3
    const nowBRTISO = nowBRT.toISOString();
    const result = await collection.updateMany(
      {
        status: 'active',
        $or: [
          { end_date: { $lte: nowBRT } },
          { end_date: { $lte: nowBRTISO } },
        ]
      } as any,
      { $set: { status: 'waiting payment' as const, updated_at: now } }
    );
    return result.modifiedCount;
  }

  static async findWaitingPaymentPublicOlderThan(days: number): Promise<ICampaign[]> {
    const collection = await this.getCollection();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return await collection.find({
      status: 'waiting payment',
      payment_received: true,
      rewards_distributed: false,
      $and: [
        { $or: [{ isPrivate: false }, { isPrivate: { $exists: false } }] },
        { updated_at: { $lte: cutoff } }
      ]
    }).toArray();
  }

  static async findByIds(ids: string[]): Promise<Map<string, ICampaign>> {
    if (ids.length === 0) return new Map();
    const collection = await this.getCollection();
    const uniqueIds = [...new Set(ids)];
    const objectIds = uniqueIds.map(id => new ObjectId(id));
    const campaigns = await collection.find({ _id: { $in: objectIds } }).toArray();
    const map = new Map<string, ICampaign>();
    for (const campaign of campaigns) {
      if (campaign._id) map.set(campaign._id.toString(), campaign);
    }
    return map;
  }

  static async countByPrivateAndPublic(): Promise<{ private: number; public: number }> {
    const collection = await this.getCollection();
    const [privateCount, publicCount] = await Promise.all([
      collection.countDocuments({ isPrivate: true }),
      collection.countDocuments({ $or: [{ isPrivate: false }, { isPrivate: { $exists: false } }] })
    ]);
    return { private: privateCount, public: publicCount };
  }

  static async findLastNByCreatedAt(n: number, campaignType?: 'public' | 'private' | 'all'): Promise<ICampaign[]> {
    if (n < 1) return [];
    const collection = await this.getCollection();
    const filter: any = { status: { $ne: 'inactive' } };

    if (campaignType === 'public') {
      filter.$or = [{ isPrivate: false }, { isPrivate: { $exists: false } }];
    } else if (campaignType === 'private') {
      filter.isPrivate = true;
    }
    // 'all' or undefined → no filter on isPrivate

    return collection.find(filter).sort({ created_at: -1 }).limit(n).toArray();
  }
}
