import { Router } from 'express';
import { WaitlistController } from '../controllers/WaitlistController';
import { authGuard } from '../guards/auth.guard';
import { validate } from '../guards/validate.guard';
import { waitlistSchema } from '../dtos/validation/common.schema';

const router = Router();
const waitlistController = new WaitlistController();

router.post('/submit', validate(waitlistSchema), waitlistController.submitWaitlist);
router.post('/check-email', validate(waitlistSchema), waitlistController.checkEmailExists);

router.use(authGuard);
router.get('/', waitlistController.getWaitlistEntries);
router.get('/stats', waitlistController.getWaitlistStats);
router.get('/:id', waitlistController.getWaitlistById);
router.delete('/:id', waitlistController.deleteWaitlist);

export default router;
