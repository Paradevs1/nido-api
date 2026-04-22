import { ObjectId } from 'mongodb';

export interface IActiveAccountHost {
  _id?: ObjectId;
  hostId: string;
  signature: string;
  walletAddressHost: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'error';
  created_at: Date;
  updated_at: Date;
}

export class ActiveAccountHostModel {
  private static collectionName = 'active_account_hosts';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IActiveAccountHost>(this.collectionName);
  }

  static async create(activeAccountHostData: Omit<IActiveAccountHost, '_id' | 'created_at' | 'updated_at'>): Promise<IActiveAccountHost> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newActiveAccountHost: IActiveAccountHost = {
      ...activeAccountHostData,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(newActiveAccountHost);
    return { ...newActiveAccountHost, _id: result.insertedId };
  }

  static async updateStatusAndSignature(paymentId: string, signature: string, status: 'pending' | 'confirmed' | 'error'): Promise<IActiveAccountHost | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(paymentId) },
      { 
        $set: { 
          signature: signature,
          status: status,
          updated_at: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    return result;
  }

}
