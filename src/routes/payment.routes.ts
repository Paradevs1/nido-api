import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { authGuard, hostGuard, adminGuard } from '../guards/auth.guard';
import { paymentLimiter } from '../app';

const router = Router();
const paymentController = new PaymentController();

router.use(authGuard);

// Admin only
router.get('/solana/balance', adminGuard, paymentController.getBalanceSOL);
router.get('/evm/balance', adminGuard, paymentController.getBalanceEVM);
router.get('/sui/balance', adminGuard, paymentController.getBalanceSUI);
router.get('/stellar/balance', adminGuard, paymentController.getBalanceStellar);

// Host only
router.post('/send-winners/:campaign_id', hostGuard, paymentLimiter, paymentController.sendTokenWinners);
router.post('/send-payment-kols-selective/:campaign_id', hostGuard, paymentLimiter, paymentController.paymentKolsSelective);
router.post('/payment-host-create', hostGuard, paymentLimiter, paymentController.paymentHostCreate);
router.post('/payment-host-confirm', hostGuard, paymentLimiter, paymentController.paymentHostConfirm);
router.post('/plan-create', hostGuard, paymentLimiter, paymentController.paymentPlanCreate);
router.post('/plan-confirm', hostGuard, paymentLimiter, paymentController.paymentPlanConfirm);

export default router;
