import { Router } from 'express';
import { JobController } from '../controllers/JobController';
import { cronGuard } from '../guards/cron.guard';

const router = Router();
const jobController = new JobController();

router.use(cronGuard);

router.post('/run-expired-campaigns', jobController.runExpiredCampaignsJob);
router.get('/run-expired-campaigns', jobController.runExpiredCampaignsJob);
router.post('/run-get-info-post-x', jobController.runGetInfoPostX);
router.get('/run-get-info-post-x', jobController.runGetInfoPostX);
router.post('/run-get-clicks', jobController.runGetClicksJob);
router.get('/run-get-clicks', jobController.runGetClicksJob);
router.post('/run-update-twitter-followers', jobController.runUpdateTwitterFollowersJob);
router.get('/run-update-twitter-followers', jobController.runUpdateTwitterFollowersJob);
router.post('/run-get-metrics-submissions', jobController.runGetMetricsSubmissions);
router.get('/run-get-metrics-submissions', jobController.runGetMetricsSubmissions);
router.post('/run-auto-pay-waiting-payment', jobController.runAutoPayWaitingPaymentCampaignsJob);
router.get('/run-auto-pay-waiting-payment', jobController.runAutoPayWaitingPaymentCampaignsJob);
router.post('/run-cleanup-inactive-hosts', jobController.runCleanupInactiveHosts);
router.get('/run-cleanup-inactive-hosts', jobController.runCleanupInactiveHosts);
router.post('/run-expired-stellar-escrows', jobController.runExpiredStellarEscrows);
router.get('/run-expired-stellar-escrows', jobController.runExpiredStellarEscrows);

export default router;

