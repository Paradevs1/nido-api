import { ObjectId, Db, Collection } from 'mongodb';
import { getBountiesDB } from '../config/database';

export interface IRankEntry {
  rank: number;
  username: string;
  amount_received: number;
  submission_twitter: string;
  user_id: string;
  campaign_id: string;
  mindshare_score: number;
  views_twitter: number;
  likes_twitter: number;
  retweets_twitter: number;
  replies_twitter: number;
  quotes_twitter: number;
  bookmarks_twitter: number;
  submission_instagram: string;
  views_instagram: number;
  likes_instagram: number;
  replies_instagram: number;
  submission_tiktok: string;
  views_tiktok: number;
  likes_tiktok: number;
  replies_tiktok: number;
  retweets_tiktok: number;
  bookmarks_tiktok: number;
  submission_youtube: string;
  views_youtube: number;
  likes_youtube: number;
  replies_youtube: number;
}

export interface ICampaignSugestionBountiesRank {
  _id?: ObjectId;
  campaignId: string;
  ranking: IRankEntry[];
  created_at: Date;
  updated_at: Date;
}

export class CampaignSugestionBountiesRankModel {
  private static collectionName = 'campaign_sugestion_bounties_rank';

  private static async getCollection(): Promise<Collection<ICampaignSugestionBountiesRank>> {
    const db: Db = await getBountiesDB();
    return db.collection<ICampaignSugestionBountiesRank>(this.collectionName);
  }

  static async create(rankData: Omit<ICampaignSugestionBountiesRank, '_id' | 'created_at' | 'updated_at'>): Promise<ICampaignSugestionBountiesRank> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newRank: ICampaignSugestionBountiesRank = {
      ...rankData,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(newRank);
    return { ...newRank, _id: result.insertedId };
  }

  static async findByCampaignId(campaignId: string): Promise<ICampaignSugestionBountiesRank | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ campaignId });
  }

  static async updateByCampaignId(campaignId: string, ranking: IRankEntry[]): Promise<ICampaignSugestionBountiesRank | null> {
    const collection = await this.getCollection();
    const now = new Date();
    
    const existing = await collection.findOne({ campaignId });
    
    if (existing) {
      const result = await collection.findOneAndUpdate(
        { campaignId },
        { $set: { ranking, updated_at: now } },
        { returnDocument: 'after' }
      );
      return result || null;
    } else {
      const newRank: ICampaignSugestionBountiesRank = {
        campaignId,
        ranking,
        created_at: now,
        updated_at: now
      };
      const result = await collection.insertOne(newRank);
      return { ...newRank, _id: result.insertedId };
    }
  }

  static async deleteByCampaignId(campaignId: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ campaignId });
    return result.deletedCount > 0;
  }
}

