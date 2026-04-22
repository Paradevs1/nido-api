import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authGuard } from '../guards/auth.guard';

const router = Router();
const notificationController = new NotificationController();

router.use(authGuard);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);

export default router;
