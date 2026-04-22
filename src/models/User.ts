import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { BCRYPT_SALT_ROUNDS } from '../utils/consts';

export interface CategoryAtuation {
  slug: string;
}

export interface SocialMedia {
  type: 'discord' | 'github' | 'youtube' | 'other';
  url: string;
}

/** @deprecated Prefer string (ISO codes e.g. "en") or comma-separated for fluent_language */
export type PrimaryLanguage = 'english' | 'portuguese' | 'spanish' | 'other';

export type ContentCategoryUser =
  | 'technology'
  | 'travel'
  | 'finance'
  | 'crypto_blockchain'
  | 'web3'
  | 'gaming'
  | 'lifestyle'
  | 'education'
  | 'defi'
  | 'trading'
  | 'business'
  | 'nfts';

export type AudienceSize = '1k' | '1k – 5k' | '5k – 20k' | '20k – 100k' | '100k+';

export type UserAccountStatus = 'active' | 'inactive';

export interface IUser {
  _id?: ObjectId;
  username: string;
  user_type: 'CREATOR' | 'HOST' | 'ADMIN';
  email?: string;
  password_hash?: string;
  email_verified: boolean;
  isActive: boolean;
  status?: UserAccountStatus;
  active_account_host?: boolean;
  plan_id?: string;
  duration_plan?: Date | null;
  discord_id?: string;
  campaigns_created: number;
  twitter_id?: string;
  twitter_username?: string;
  twitter_display_name?: string;
  twitter_profile_image?: string;
  twitter_verified?: boolean;
  twitter_followers_count?: number;
  tiktok_name?: string;
  tiktok_id?: string;
  tiktok_username?: string;
  google_id?: string;
  google_name?: string;
  google_email?: string;
  total_earnings?: number;
  position_company?: string;
  telegram_username?: string;
  name_company?: string;
  website_company?: string;
  social_media?: SocialMedia[];
  introduction_company?: string;
  logo_company?: string; // Base64 da imagem
  categories_atuation?: CategoryAtuation[];
  wallet_evm?: string;
  wallet_sol?: string;
  wallet_sui?: string;
  wallet_stellar?: string;
  registerCompleted?: boolean;
  description?: string;
  username_youtube?: string;
  username_tiktok?: string;
  username_instagram?: string;
  username_telegram?: string;
  username_discord?: string;
  primary_language?: string;
  fluent_language?: string;
  fluent_language_others?: string;
  audience_region?: string[];
  average_views_per_post?: string;
  content_category_list?: ContentCategoryUser[];
  content_formats?: string[];
  example_content_links?: string;
  audience_size?: AudienceSize;
  crypto_experience?: string;
  trading_experience?: string;
  main_chains?: string[];
  main_chains_other?: string;
  crypto_content_specialization?: string[];
  favorite_protocols_projects?: string;
  investment_participation_style?: string;
  first_login?: boolean | null;
  created_at: Date;
  updated_at: Date;
}

export class UserModel {
  private static collectionName = 'users';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IUser>(this.collectionName);
  }

  static async create(userData: Omit<IUser, '_id' | 'created_at' | 'updated_at'>): Promise<IUser> {
    const collection = await this.getCollection();
    
    const now = new Date();
    
    const newUser: IUser = {
      ...userData,
      first_login: userData.first_login ?? null,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(newUser);
    return { ...newUser, _id: result.insertedId };
  }

  static async findByEmail(email: string): Promise<IUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ email: email });
  }

  static async findByTwitterId(twitterId: string): Promise<IUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ twitter_id: twitterId });
  }

  static async findByTiktokId(tiktokId: string): Promise<IUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ tiktok_id: tiktokId });
  }

  static async findByInstagramId(instagramId: string): Promise<IUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ instagram_id: instagramId });
  }

  static async findByGoogleId(googleId: string): Promise<IUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ google_id: googleId });
  }

  static async findByUsername(username: string): Promise<IUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ username: username.toLowerCase() });
  }

  static async findByEmailOrUsername(email: string, username: string): Promise<IUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username }
      ]
    });
  }

  static async updateById(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
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

  static async comparePassword(user: IUser, candidatePassword: string): Promise<boolean> {
    if (!user.password_hash) {
      return false;
    }
    return await bcrypt.compare(candidatePassword, user.password_hash);
  }

  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  static async incrementCampaignsCreated(userId: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $inc: { campaigns_created: 1 },
        $set: { updated_at: new Date() }
      }
    );
    return result.modifiedCount > 0;
  }

  static async decrementCampaignsCreated(userId: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $inc: { campaigns_created: -1 },
        $set: { updated_at: new Date() }
      }
    );
    return result.modifiedCount > 0;
  }

  // Buscar usuário por ID
  static async findById(id: string): Promise<IUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  /** Buscar usuário por endereço de carteira (EVM, SOL, SUI ou Stellar). Útil para Reembolsos. */
  static async findByWalletAddress(address: string): Promise<IUser | null> {
    if (!address || !address.trim()) return null;
    const collection = await this.getCollection();
    return await collection.findOne({
      $or: [
        { wallet_evm: address.trim() },
        { wallet_sol: address.trim() },
        { wallet_sui: address.trim() },
        { wallet_stellar: address.trim() }
      ]
    });
  }

  // Atualizar dados do host (part-two)
  static async updateHostData(userId: string, hostData: Partial<IUser>): Promise<IUser | null> {
    const collection = await this.getCollection();
    const update = {
      ...hostData,
      updated_at: new Date()
    };
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: update },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async addWallets(userId: string, walletEVM?: string, walletSOL?: string, walletSUI?: string, walletStellar?: string): Promise<IUser | null> {
    const collection = await this.getCollection();
    const updateData: any = { updated_at: new Date() };

    if (walletEVM !== undefined) updateData.wallet_evm = walletEVM;
    if (walletSOL !== undefined) updateData.wallet_sol = walletSOL;
    if (walletSUI !== undefined) updateData.wallet_sui = walletSUI;
    if (walletStellar !== undefined) updateData.wallet_stellar = walletStellar;
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async removeWallet(userId: string, walletType: 'evm' | 'sol' | 'sui' | 'stellar'): Promise<IUser | null> {
    const collection = await this.getCollection();
    const updateData: any = { updated_at: new Date() };

    if (walletType === 'evm') {
      updateData.wallet_evm = null;
    } else if (walletType === 'sol') {
      updateData.wallet_sol = null;
    } else if (walletType === 'sui') {
      updateData.wallet_sui = null;
    } else if (walletType === 'stellar') {
      updateData.wallet_stellar = null;
    }
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async updateActiveAccountHost(userId: string): Promise<IUser | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          isActive: true,
          active_account_host: true,
          updated_at: new Date() 
        }
      },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  static async findByIds(ids: string[]): Promise<Map<string, IUser>> {
    if (ids.length === 0) return new Map();
    const collection = await this.getCollection();
    const uniqueIds = [...new Set(ids)];
    const objectIds = uniqueIds.map(id => new ObjectId(id));
    const users = await collection.find({ _id: { $in: objectIds } }).toArray();
    const map = new Map<string, IUser>();
    for (const user of users) {
      if (user._id) map.set(user._id.toString(), user);
    }
    return map;
  }

  static async deleteInactiveHostsOlderThan(days: number): Promise<number> {
    const collection = await this.getCollection();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await collection.deleteMany({
      user_type: 'HOST',
      status: 'inactive',
      created_at: { $lte: cutoff }
    });
    return result.deletedCount;
  }

  static async findByUserType(userType: 'CREATOR' | 'HOST' | 'ADMIN'): Promise<IUser[]> {
    const collection = await this.getCollection();
    return await collection.find({ user_type: userType }).toArray();
  }

  static async findByUserTypeWithPagination(
    userType: 'CREATOR' | 'HOST' | 'ADMIN',
    page: number = 1,
    limit: number = 10,
    usernameFilter?: string,
    filterForHost?: boolean,
    isActiveFilter?: boolean,
    creatorListSort?: 'followers_asc' | 'followers_desc' | 'earnings_asc' | 'earnings_desc',
    /** Somente HOST: filtra por aprovação da conta (`status` inactive = aguardando admin). */
    hostAccountStatusFilter?: 'active' | 'inactive'
  ): Promise<{ users: IUser[]; total: number; page: number; totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;

    const mongoFilter: any = { user_type: userType };

    if (isActiveFilter !== undefined) {
      mongoFilter.isActive = isActiveFilter;
    }

    let searchOr: Record<string, unknown>[] | undefined;
    if (usernameFilter && usernameFilter.trim()) {
      const escaped = usernameFilter.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const filterRegex = new RegExp(escaped, 'i');
      if (filterForHost && userType === 'HOST') {
        searchOr = [{ name_company: filterRegex }, { email: filterRegex }];
      } else {
        searchOr = [
          { username: filterRegex },
          { twitter_username: filterRegex },
          { google_name: filterRegex }
        ];
      }
    }

    let hostAccountClause: Record<string, unknown> | undefined;
    if (userType === 'HOST' && hostAccountStatusFilter === 'inactive') {
      hostAccountClause = { status: 'inactive' };
    } else if (userType === 'HOST' && hostAccountStatusFilter === 'active') {
      hostAccountClause = { $nor: [{ status: 'inactive' }] };
    }

    if (searchOr && hostAccountClause) {
      mongoFilter.$and = [{ $or: searchOr }, hostAccountClause];
    } else if (searchOr) {
      mongoFilter.$or = searchOr;
    } else if (hostAccountClause) {
      Object.assign(mongoFilter, hostAccountClause);
    }

    let sortSpec: Record<string, 1 | -1> = { username: 1, twitter_username: 1, google_name: 1 };
    if (userType === 'CREATOR' && creatorListSort) {
      switch (creatorListSort) {
        case 'followers_asc':
          sortSpec = { twitter_followers_count: 1, _id: 1 };
          break;
        case 'followers_desc':
          sortSpec = { twitter_followers_count: -1, _id: 1 };
          break;
        case 'earnings_asc':
          sortSpec = { total_earnings: 1, _id: 1 };
          break;
        case 'earnings_desc':
          sortSpec = { total_earnings: -1, _id: 1 };
          break;
        default:
          break;
      }
    }

    const [users, total] = await Promise.all([
      collection
        .find(mongoFilter)
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(mongoFilter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      users,
      total,
      page,
      totalPages
    };
  }
}
