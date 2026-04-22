import { NotificationModel, INotification, NotificationType } from '../models/Notification';
import { CommunityMemberModel } from '../models/CommunityMember';

export class NotificationService {

  async notify(
    recipientId: string,
    type: NotificationType,
    payload: Record<string, any>
  ): Promise<INotification> {
    return await NotificationModel.create({ recipient_id: recipientId, type, payload });
  }

  async notifyMany(
    recipientIds: string[],
    type: NotificationType,
    payload: Record<string, any>
  ): Promise<number> {
    const notifications = recipientIds.map(recipient_id => ({
      recipient_id,
      type,
      payload
    }));
    return await NotificationModel.createMany(notifications);
  }

  async notifyCommunityMembers(
    communityId: string,
    type: NotificationType,
    payload: Record<string, any>,
    excludeUserId?: string
  ): Promise<number> {
    const { members } = await CommunityMemberModel.findByCommunityId(communityId, 'APPROVED', 1, 10000);
    const recipientIds = members
      .map(m => m.creator_id)
      .filter(id => id !== excludeUserId);
    if (recipientIds.length === 0) return 0;
    return await this.notifyMany(recipientIds, type, payload);
  }

  async getNotifications(
    recipientId: string,
    readFilter?: boolean,
    page: number = 1,
    limit: number = 20
  ) {
    const result = await NotificationModel.findByRecipient(recipientId, readFilter, page, limit);
    return {
      notifications: result.notifications.map(n => ({
        id: n._id!.toString(),
        type: n.type,
        payload: n.payload,
        read: n.read,
        created_at: n.created_at
      })),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      unread_count: result.unread_count
    };
  }

  async markAsRead(notificationId: string, recipientId: string): Promise<boolean> {
    return await NotificationModel.markAsRead(notificationId, recipientId);
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    return await NotificationModel.markAllAsRead(recipientId);
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return await NotificationModel.getUnreadCount(recipientId);
  }
}
