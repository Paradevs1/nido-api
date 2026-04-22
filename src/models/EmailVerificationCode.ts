import { ObjectId } from 'mongodb';

export interface IEmailVerificationCode {
  _id?: ObjectId;
  user_id: string;
  email: string;
  code: string;
  expires_at: Date;
  created_at: Date;
  verified: boolean;
}

export class EmailVerificationCodeModel {
  private static collectionName = 'email_verification_codes';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IEmailVerificationCode>(this.collectionName);
  }

  static async create(codeData: Omit<IEmailVerificationCode, '_id' | 'created_at'>): Promise<IEmailVerificationCode> {
    const collection = await this.getCollection();
    
    const newCode: IEmailVerificationCode = {
      ...codeData,
      created_at: new Date()
    };

    const result = await collection.insertOne(newCode);
    return { ...newCode, _id: result.insertedId };
  }

  static async findByUserIdAndCode(userId: string, code: string): Promise<IEmailVerificationCode | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ 
      user_id: userId, 
      code: code.toUpperCase(),
      verified: false,
      expires_at: { $gt: new Date() }
    });
  }

  static async findByUserId(userId: string): Promise<IEmailVerificationCode | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ 
      user_id: userId,
      verified: false,
      expires_at: { $gt: new Date() }
    }, { sort: { created_at: -1 } });
  }

  static async markAsVerified(userId: string, code: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { user_id: userId, code: code.toUpperCase() },
      { $set: { verified: true } }
    );
    return result.modifiedCount > 0;
  }

  static async deleteExpiredCodes(): Promise<number> {
    const collection = await this.getCollection();
    const result = await collection.deleteMany({ expires_at: { $lt: new Date() } });
    return result.deletedCount;
  }

  static async invalidateUserCodes(userId: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateMany(
      { user_id: userId, verified: false },
      { $set: { verified: true } }
    );
    return result.modifiedCount > 0;
  }

  static async findByEmailAndCode(email: string, code: string): Promise<IEmailVerificationCode | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ 
      email: email.toLowerCase(), 
      code: code.toUpperCase(),
      verified: false,
      expires_at: { $gt: new Date() }
    });
  }

  static async invalidateEmailCodes(email: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateMany(
      { email: email.toLowerCase(), verified: false },
      { $set: { verified: true } }
    );
    return result.modifiedCount > 0;
  }

  static async markAsVerifiedByEmail(email: string, code: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { email: email.toLowerCase(), code: code.toUpperCase() },
      { $set: { verified: true } }
    );
    return result.modifiedCount > 0;
  }
}

