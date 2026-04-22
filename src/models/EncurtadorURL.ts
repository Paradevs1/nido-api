import { ObjectId, Db, Collection } from 'mongodb';
import { getBountiesDB } from '../config/database';

/** Short URL tracking record */
export interface IShortURL {
  _id?: ObjectId;
  idString: string;
  shortURL: string;
  campaignId?: string;
  userId?: string;
  clicks: number;
  created_at: Date;
  updated_at: Date;
}

/** @deprecated Use ShortURLModel instead */
export type IEncurtadorURL = IShortURL;

export class ShortURLModel {
  private static collectionName = 'encurtador_url';

  private static async getCollection(): Promise<Collection<IShortURL>> {
    const db: Db = await getBountiesDB();
    return db.collection<IShortURL>(this.collectionName);
  }

  static async create(urlData: Omit<IShortURL, '_id' | 'created_at' | 'updated_at'>): Promise<IShortURL> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newURL: IShortURL = {
      ...urlData,
      clicks: urlData.clicks || 0,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(newURL);
    return { ...newURL, _id: result.insertedId };
  }

  static async findById(id: string): Promise<IShortURL | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async findByIdString(idString: string): Promise<IShortURL | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ idString });
  }

  static async findByShortURL(shortURL: string): Promise<IShortURL | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ shortURL });
  }

  static async findByCampaignId(campaignId: string): Promise<IShortURL | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ campaignId });
  }

  static async findAllByCampaignId(campaignId: string): Promise<IShortURL[]> {
    const collection = await this.getCollection();
    return await collection.find({ campaignId }).toArray();
  }

  static async findByCampaignIdAndUserId(campaignId: string, userId: string): Promise<IShortURL | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ campaignId, userId });
  }

  static async findKolsByCampaignIdAndUserId(campaignId: string, userId: string): Promise<IShortURL | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ campaignId, userId });
  }

  static async updateClicks(idString: string, clicks: number): Promise<IShortURL | null> {
    const collection = await this.getCollection();
    const update = {
      clicks,
      updated_at: new Date()
    };
    
    const result = await collection.findOneAndUpdate(
      { idString },
      { $set: update },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async incrementClicks(idString: string): Promise<IShortURL | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { idString },
      { 
        $inc: { clicks: 1 },
        $set: { updated_at: new Date() }
      },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async findAll(page: number = 1, limit: number = 10): Promise<{ urls: IShortURL[], total: number, page: number, limit: number, totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;
    
    const [urls, total] = await Promise.all([
      collection.find({}).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments({})
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    return { urls, total, page, limit, totalPages };
  }

  static async findAllUrls(): Promise<IShortURL[]> {
    const collection = await this.getCollection();
    return await collection.find({}).toArray();
  }
}

/** @deprecated Use ShortURLModel instead */
export const EncurtadorURLModel = ShortURLModel;
