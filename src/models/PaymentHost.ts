import { ObjectId } from 'mongodb';

export interface IPaymentHost {
  _id?: ObjectId;
  hostId: string;
  campaignId: string;
  signature: string;
  walletAddressHost: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'error';
  created_at: Date;
  updated_at: Date;
}

export class PaymentHostModel {
  private static collectionName = 'payment_hosts';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IPaymentHost>(this.collectionName);
  }

  static async create(paymentHostData: Omit<IPaymentHost, '_id' | 'created_at' | 'updated_at'>): Promise<IPaymentHost> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newPaymentHost: IPaymentHost = {
      ...paymentHostData,
      created_at: now,
      updated_at: now
    };

    const result = await collection.insertOne(newPaymentHost);
    return { ...newPaymentHost, _id: result.insertedId };
  }

  static async findByHostId(hostId: string): Promise<IPaymentHost[]> {
    const collection = await this.getCollection();
    return await collection.find({ hostId }).sort({ created_at: -1 }).toArray();
  }

  static async findByCampaignId(campaignId: string): Promise<IPaymentHost[]> {
    const collection = await this.getCollection();
    return await collection.find({ campaignId }).sort({ created_at: -1 }).toArray();
  }

  static async findBySignature(signature: string): Promise<IPaymentHost | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ signature });
  }

  static async updateStatus(signature: string, status: 'pending' | 'confirmed' | 'error'): Promise<IPaymentHost | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { signature },
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

  static async updateStatusAndSignature(paymentId: string, signature: string, status: 'pending' | 'confirmed' | 'error'): Promise<IPaymentHost | null> {
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

  static async findById(id: string): Promise<IPaymentHost | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async findAll(limit: number = 100, skip: number = 0): Promise<IPaymentHost[]> {
    const collection = await this.getCollection();
    return await collection.find({}).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();
  }

  static async count(): Promise<number> {
    const collection = await this.getCollection();
    return await collection.countDocuments();
  }

  static async findWithFilters(
    limit: number,
    skip: number,
    filters: { campaignId?: string; status?: string } = {}
  ): Promise<IPaymentHost[]> {
    const collection = await this.getCollection();
    const mongoFilter: Record<string, unknown> = {};
    if (filters['campaignId']) mongoFilter['campaignId'] = filters['campaignId'];
    if (filters['status']) mongoFilter['status'] = filters['status'];
    return collection.find(mongoFilter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();
  }

  static async countWithFilters(filters: { campaignId?: string; status?: string } = {}): Promise<number> {
    const collection = await this.getCollection();
    const mongoFilter: Record<string, unknown> = {};
    if (filters['campaignId']) mongoFilter['campaignId'] = filters['campaignId'];
    if (filters['status']) mongoFilter['status'] = filters['status'];
    return collection.countDocuments(mongoFilter);
  }
}
