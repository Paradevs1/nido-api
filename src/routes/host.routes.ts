import { Router } from 'express';
import { HostController } from '../controllers/HostController';
import { hostGuard, optionalAuthGuard, authenticatedUserGuard } from '../guards/auth.guard';

const router = Router();
const hostController = new HostController();

router.get('/campaigns/public', authenticatedUserGuard, hostController.getAllCampaigns);

router.get('/campaigns/:id', optionalAuthGuard, hostController.getCampaignById);
router.get('/campaigns/:id/get-campaign-tiers', optionalAuthGuard, hostController.getCampaignTiers);
router.post('/resend-verification-code', optionalAuthGuard, hostController.resendVerificationCode);
router.post('/validate-email-code', optionalAuthGuard, hostController.validateEmailCode);

router.use(hostGuard);
router.get('/active-account', hostController.HostActiveAccount);
router.get('/profile', hostController.getProfile);
router.get('/is-parabuilders', hostController.isParabuilders);
router.put('/update-profile', hostController.updateProfile);
router.get('/get-count-campaigns-by-host', hostController.getCountCampaignsByHost);
router.get('/get-kols', hostController.getKols);
router.get('/campaigns', hostController.getCampaigns);
router.get('/campaigns/:id/metrics', hostController.getCampaignMetrics);
router.get('/campaigns/:id/metrics/summary', hostController.getCampaignMetricsSummary);
router.get('/campaigns/:id/metrics/platforms', hostController.getCampaignMetricsPlatforms);
router.get('/campaigns/:id/leaderboard-submits', hostController.getLeaderboardSubmits);
router.get('/campaigns/:id/get-users-campaign-winners', hostController.getUsersCampaignWinners);
router.get('/campaigns/:id/generate-rank-twitter', hostController.generateMindshare);
router.post('/campaigns/:id/create-campaign-winners', hostController.createCampaignWinners);
router.get('/get-info-post-twitter-creator/:id', hostController.getInfoPostTwitterCreator);
router.post('/campaigns', hostController.createCampaign);
router.put('/campaigns/:id', hostController.editCampaign);
router.delete('/campaigns/:id', hostController.deleteCampaign);
router.put('/fixed-comment-host', hostController.fixedCommentHost);

export default router;
