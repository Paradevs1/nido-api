import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { adminGuard } from '../guards/auth.guard';

const router = Router();
const adminController = new AdminController();

router.use(adminGuard);

router.get('/creators/participation-stats', adminController.getCreatorsParticipationStats);
router.get('/creators/recurring', adminController.getRecurringCreators);
router.get('/creators', adminController.getCreatorsList);
router.get('/creators/insights/options', adminController.getCreatorsInsightsOptions);
router.get('/creators/insights', adminController.getCreatorsInsightsList);
router.get('/payments', adminController.getPaymentsList);
router.get('/users/:userId', adminController.getUserDetail);
router.patch('/users/:userId/active', adminController.setUserActive);
router.patch('/host/:userId/status', adminController.setHostAccountStatus);
router.get('/hosts/options', adminController.getHostsCombo);
router.get('/hosts', adminController.getHostsList);
router.get('/campaigns/options', adminController.getCampaignsCombo);
router.get('/campaigns/counts', adminController.getCampaignCountsPrivatePublic);
router.get('/campaigns/:campaignId/short-urls', adminController.getCampaignShortUrls);
router.patch('/hosts/:hostId/plan', adminController.updateHostPlan);

router.get('/export/campaigns/:campaignId/short-urls', adminController.exportShortUrlsExcel);
router.get('/export/creators', adminController.exportCreatorsExcel);
router.get('/export/hosts', adminController.exportHostsExcel);
router.get('/export/payments', adminController.exportPaymentsExcel);

router.get('/campaign-stats/:campaignId', adminController.getCampaignStats);
router.get('/campaign-metrics/:campaignId', adminController.getCampaignMetrics);
router.put('/instagram-story-metrics', adminController.upsertInstagramStoryMetrics);
router.delete('/instagram-story-metrics', adminController.deleteInstagramStoryMetrics);
router.post('/run-all-metrics/:campaignId', adminController.runAllMetricsForCampaign);
router.post('/retry-failed-payments/:campaignId', adminController.retryFailedPayments);
//router.get('/users-submissions/export', adminController.exportUsersWithSubmissions);

// ── Communities (Admin) ─────────────────────────────────────────────────
import { CommunityController } from '../controllers/CommunityController';
const communityController = new CommunityController();

router.get('/communities', communityController.getAllCommunitiesAdmin);
router.get('/communities/:id', communityController.getCommunityDetailAdmin);
router.get('/communities/:id/members', communityController.getCommunityMembersAdmin);

export default router;
