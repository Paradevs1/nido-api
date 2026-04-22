import { ObjectId } from 'mongodb';

export type NotificationType =
  | 'JOIN_REQUEST'
  | 'JOIN_REQUEST_APPROVED'
  | 'JOIN_REQUEST_REJECTED'
  | 'ANNOUNCEMENT_PUBLISHED'
  | 'MEMBER_REMOVED';

export interface INotification {
  _id?: ObjectId;
  recipient_id: string;
  type: NotificationType;
  payload: Record<string, any>;
  read: boolean;
  created_at: Date;
}

export class NotificationModel {
  private static collectionName = 'notifications';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<INotification>(this.collectionName);
  }

  static async create(data: Omit<INotification, '_id' | 'created_at' | 'read'>): Promise<INotification> {
    const collection = await this.getCollection();
    const notification: INotification = {
      ...data,
      read: false,
      created_at: new Date()
    };
    const result = await collection.insertOne(notification);
    return { ...notification, _id: result.insertedId };
  }

  static async createMany(notifications: Array<Omit<INotification, '_id' | 'created_at' | 'read'>>): Promise<number> {
    if (notifications.length === 0) return 0;
    const collection = await this.getCollection();
    const now = new Date();
    const docs = notifications.map(n => ({
      ...n,
      read: false,
      created_at: now
    }));
    const result = await collection.insertMany(docs);
    return result.insertedCount;
  }

  static async findByRecipient(
    recipientId: string,
    readFilter?: boolean,
    page: number = 1,
    limit: number = 20
  ): Promise<{ notifications: INotification[]; total: number; page: number; totalPages: number; unread_count: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;
    const filter: any = { recipient_id: recipientId };
    if (readFilter !== undefined) filter.read = readFilter;

    const [notifications, total, unread_count] = await Promise.all([
      collection.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter),
      collection.countDocuments({ recipient_id: recipientId, read: false })
    ]);

    return {
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      unread_count
    };
  }

  static async markAsRead(id: string, recipientId: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: new ObjectId(id), recipient_id: recipientId },
      { $set: { read: true } }
    );
    return result.modifiedCount > 0;
  }

  static async markAllAsRead(recipientId: string): Promise<number> {
    const collection = await this.getCollection();
    const result = await collection.updateMany(
      { recipient_id: recipientId, read: false },
      { $set: { read: true } }
    );
    return result.modifiedCount;
  }

  static async getUnreadCount(recipientId: string): Promise<number> {
    const collection = await this.getCollection();
    return await collection.countDocuments({ recipient_id: recipientId, read: false });
  }

  static async deleteByRecipient(recipientId: string): Promise<number> {
    const collection = await this.getCollection();
    const result = await collection.deleteMany({ recipient_id: recipientId });
    return result.deletedCount;
  }
}
