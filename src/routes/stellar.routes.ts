import { Router } from 'express';
import { StellarController } from '../controllers/StellarController';
import { authGuard, adminGuard } from '../guards/auth.guard';

const router = Router();
const stellar = new StellarController();

// Sprint 1 — Create escrow
router.post('/escrow/create', stellar.createEscrow.bind(stellar));

// Sprint 2 — Get unsigned XDRs for Freighter to sign
router.get('/escrow/:jobId/payment-xdr', stellar.getPaymentXDR.bind(stellar));
router.get('/escrow/:jobId/refund-xdr', stellar.getRefundXDR.bind(stellar));

// Sprint 2 — Submit host-signed XDR + backend adds arbiter
router.post('/escrow/release', stellar.releasePayment.bind(stellar));
router.post('/escrow/refund', stellar.refundEscrow.bind(stellar));

// Sprint 1+2 — Real-time status from Horizon
router.get('/escrow/:jobId/status', stellar.getEscrowStatus.bind(stellar));

// Sprint 3 — Dispute flow (any authenticated user)
router.post('/dispute', authGuard, stellar.openDispute.bind(stellar));
router.get('/escrow/:jobId/dispute-xdr', authGuard, stellar.getDisputeXDR.bind(stellar));
router.post('/dispute/claim', authGuard, stellar.claimDispute.bind(stellar));

// Sprint 3 — Admin arbitration (ADMIN only)
router.get('/admin/disputes', adminGuard, stellar.listDisputes.bind(stellar));
router.post('/admin/resolve', adminGuard, stellar.resolveDispute.bind(stellar));

export default router;
