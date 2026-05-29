import { Router, Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { StellarController } from '../controllers/StellarController';
import { authGuard, adminGuard } from '../guards/auth.guard';
import {
  RATE_LIMIT_STELLAR_WINDOW_MS,
  RATE_LIMIT_STELLAR_CREATE_MAX,
  RATE_LIMIT_STELLAR_RELEASE_MAX,
  RATE_LIMIT_STELLAR_STATUS_MAX,
  RATE_LIMIT_STELLAR_DISPUTE_MAX,
} from '../utils/consts';

const router = Router();
const stellar = new StellarController();

// authGuard validates JWT and populates req.user before any rate limiter runs
router.use(authGuard);

// Rate limit key: userId from JWT — buckets are per-user, not per-IP
const userKey = (req: Request): string =>
  req.user?.userId ?? req.ip ?? 'anonymous';

const createEscrowLimiter = rateLimit({
  windowMs: RATE_LIMIT_STELLAR_WINDOW_MS,
  limit: RATE_LIMIT_STELLAR_CREATE_MAX,
  keyGenerator: userKey,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  skipFailedRequests: true,
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    message: 'Too many escrow creation requests. Please wait before trying again.',
    error: 'RATE_LIMIT_EXCEEDED',
  },
});

// Shared limiter for release / refund / dispute claim — all trigger on-chain TX submissions
const releaseRefundLimiter = rateLimit({
  windowMs: RATE_LIMIT_STELLAR_WINDOW_MS,
  limit: RATE_LIMIT_STELLAR_RELEASE_MAX,
  keyGenerator: userKey,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  skipFailedRequests: true,
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    message: 'Too many payment requests. Please wait before trying again.',
    error: 'RATE_LIMIT_EXCEEDED',
  },
});

const statusLimiter = rateLimit({
  windowMs: RATE_LIMIT_STELLAR_WINDOW_MS,
  limit: RATE_LIMIT_STELLAR_STATUS_MAX,
  keyGenerator: userKey,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  skipFailedRequests: true,
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    message: 'Too many status requests. Please wait before trying again.',
    error: 'RATE_LIMIT_EXCEEDED',
  },
});

const disputeLimiter = rateLimit({
  windowMs: RATE_LIMIT_STELLAR_WINDOW_MS,
  limit: RATE_LIMIT_STELLAR_DISPUTE_MAX,
  keyGenerator: userKey,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  skipFailedRequests: true,
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    message: 'Too many dispute requests. Please wait before trying again.',
    error: 'RATE_LIMIT_EXCEEDED',
  },
});

// Sprint 1 — Create escrow setup (max 5/min per user — treasury reserve exhaustion guard)
router.post('/escrow/create', createEscrowLimiter, stellar.createEscrow.bind(stellar));

// Host-funded deposit — fetch funding XDR (status quota) + submit host-signed funding (create quota)
router.get('/escrow/:jobId/funding-xdr', statusLimiter, stellar.getFundingXDR.bind(stellar));
router.post('/escrow/fund', createEscrowLimiter, stellar.fundEscrow.bind(stellar));

// CCTP V2 inbound funding (gated by CCTP_ENABLED) — prepare burn params, register the
// source-chain burn, relay the mint. The burn itself is signed by the host's own wallet.
router.post('/escrow/inbound/prepare', createEscrowLimiter, stellar.prepareInbound.bind(stellar));
router.post('/escrow/inbound/register', createEscrowLimiter, stellar.registerBurn.bind(stellar));
router.post('/escrow/inbound/relay', releaseRefundLimiter, stellar.relayInboundMint.bind(stellar));

// Sprint 2 — Get unsigned XDRs for Freighter (read-only, shared status quota)
router.get('/escrow/:jobId/payment-xdr', statusLimiter, stellar.getPaymentXDR.bind(stellar));
router.get('/escrow/:jobId/refund-xdr', statusLimiter, stellar.getRefundXDR.bind(stellar));

// Sprint 2 — Submit host-signed XDR + backend adds arbiter (max 10/min per user)
router.post('/escrow/release', releaseRefundLimiter, stellar.releasePayment.bind(stellar));
router.post('/escrow/refund', releaseRefundLimiter, stellar.refundEscrow.bind(stellar));

// Sprint 1+2 — Real-time status from Horizon (max 30/min per user)
router.get('/escrow/:jobId/status', statusLimiter, stellar.getEscrowStatus.bind(stellar));

// Sprint 3 — Dispute flow: open (max 5/min), XDR fetch (status quota), claim (release quota)
router.post('/dispute', disputeLimiter, stellar.openDispute.bind(stellar));
router.get('/escrow/:jobId/dispute-xdr', statusLimiter, stellar.getDisputeXDR.bind(stellar));
router.post('/dispute/claim', releaseRefundLimiter, stellar.claimDispute.bind(stellar));

// Sprint 3 — Admin arbitration: adminGuard re-validates JWT and enforces ADMIN role
router.get('/admin/disputes', adminGuard, stellar.listDisputes.bind(stellar));
router.post('/admin/resolve', adminGuard, stellar.resolveDispute.bind(stellar));

export default router;
