import { Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  getNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const readParam = req.query['read'];
      const readFilter = readParam === 'true' ? true : readParam === 'false' ? false : undefined;

      const result = await this.notificationService.getNotifications(userId, readFilter, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ message: error.message, error: 'GET_NOTIFICATIONS_ERROR' });
    }
  };

  getUnreadCount = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const count = await this.notificationService.getUnreadCount(userId);
      res.status(200).json({ success: true, unread_count: count });
    } catch (error: any) {
      res.status(400).json({ message: error.message, error: 'GET_UNREAD_COUNT_ERROR' });
    }
  };

  markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const notificationId = req.params['id']!;
      const updated = await this.notificationService.markAsRead(notificationId, userId);
      if (!updated) {
        res.status(404).json({ message: 'Notification not found', error: 'NOTIFICATION_NOT_FOUND' });
        return;
      }
      res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (error: any) {
      res.status(400).json({ message: error.message, error: 'MARK_READ_ERROR' });
    }
  };

  markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const count = await this.notificationService.markAllAsRead(userId);
      res.status(200).json({ success: true, message: `${count} notifications marked as read`, count });
    } catch (error: any) {
      res.status(400).json({ message: error.message, error: 'MARK_ALL_READ_ERROR' });
    }
  };
}
