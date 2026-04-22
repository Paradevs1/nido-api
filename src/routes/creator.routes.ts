import { Router } from 'express';
import { CreatorController } from '../controllers/CreatorController';
import { creatorGuard, optionalAuthGuard } from '../guards/auth.guard';
import { validate, validateParams } from '../guards/validate.guard';
import { campaignIdParam, walletsSchema, commentSchema, updateCommentSchema } from '../dtos/validation/common.schema';

const router = Router();
const creatorController = new CreatorController();

router.get('/campaign-winners/:campaignId', validateParams(campaignIdParam), optionalAuthGuard, creatorController.getCampaignWinners);
router.get('/get-recent-earners', optionalAuthGuard, creatorController.getRecentEarners);
router.get('/campaign-short-urls/:campaignId', validateParams(campaignIdParam), optionalAuthGuard, creatorController.getCampaignShortUrls);

router.post('/comments', optionalAuthGuard, validate(commentSchema), creatorController.insertComment);
router.put('/comments/:id', optionalAuthGuard, validate(updateCommentSchema), creatorController.updateComment);
router.delete('/comments/:id', optionalAuthGuard, creatorController.deleteComment);
router.get('/comments/:campaignId', validateParams(campaignIdParam), optionalAuthGuard, creatorController.getComments);

router.use(creatorGuard);
router.post('/create-short-url/:campaignId', validateParams(campaignIdParam), creatorController.createShortUrl);
router.post('/create-shortener-kols/:campaignId', validateParams(campaignIdParam), creatorController.createShortenerKols);
router.get('/get-shortener-kols/:campaignId', validateParams(campaignIdParam), creatorController.getShortenerKols);
router.get('/profile', creatorController.getProfile);
router.get('/welcome', creatorController.getTwitterInfo);
router.put('/update-description-profile', creatorController.updateDescriptionProfile);
router.put('/update-profile-after-login', creatorController.updateProfileAfterLogin);
router.put('/update-profile', creatorController.updateProfile);
router.get('/validate-submission-campaign/:campaignId', validateParams(campaignIdParam), creatorController.validateSubmissionCampaign);
router.get('/get-submission/:campaignId', validateParams(campaignIdParam), creatorController.getCampaignSubmission);
router.get('/get-shortener-user-campaign/:campaignId', validateParams(campaignIdParam), creatorController.getShortenerUserCampaign);
router.post('/submit-campaign/:campaign_id', creatorController.submitCampaign);
router.get('/campaigns-submitted', creatorController.getSubmittedCampaigns);
router.get('/view-transactions-creator', creatorController.viewTransactionsCreator);
router.post('/insert-wallets', validate(walletsSchema), creatorController.insertWallets);
router.delete('/delete-wallet/:walletType', creatorController.deleteWallet);

export default router;
