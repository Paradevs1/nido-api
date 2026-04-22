import { Router } from 'express';
import { PlanController } from '../controllers/PlanController';
import { hostGuard } from '../guards/auth.guard';

const router = Router();
const planController = new PlanController();

router.get('/list', planController.listPlans);

router.use(hostGuard);
router.get('/me', planController.getMyPlan);

export default router;

