import { Router } from 'express';
import { CommunityController } from '../controllers/CommunityController';
import { authGuard, hostEnterpriseGuard, creatorGuard } from '../guards/auth.guard';
import { validate, validateParams, validateQuery } from '../guards/validate.guard';
import {
  createCommunitySchema,
  updateCommunitySchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  createMessageSchema,
  communityIdParamSchema,
  memberIdParamSchema,
  announcementIdParamSchema,
  messageIdParamSchema,
  createCommunityCampaignSchema,
} from '../dtos/validation/community.schema';

const router = Router();
const communityController = new CommunityController();

// ── Creator: list all communities (public discovery) ────────────────────
router.get('/', creatorGuard, communityController.getAllCommunities);

// ── My communities (Host or Creator) ────────────────────────────────────
router.get('/mine', authGuard, communityController.getHostCommunities);

// ── Community CRUD (Host Enterprise only) ───────────────────────────────
router.post('/', hostEnterpriseGuard, validate(createCommunitySchema), communityController.createCommunity);
router.get('/:id', authGuard, validateParams(communityIdParamSchema), communityController.getCommunityDetail);
router.put('/:id', hostEnterpriseGuard, validateParams(communityIdParamSchema), validate(updateCommunitySchema), communityController.updateCommunity);
router.delete('/:id', authGuard, validateParams(communityIdParamSchema), communityController.deleteCommunity);

// ── Members (Host Enterprise only) ──────────────────────────────────────
router.post('/:id/join', creatorGuard, validateParams(communityIdParamSchema), communityController.joinCommunity);
router.post('/:id/leave', creatorGuard, validateParams(communityIdParamSchema), communityController.leaveCommunity);
router.get('/:id/members', authGuard, validateParams(communityIdParamSchema), communityController.getMembers);
router.get('/:id/members/public', authGuard, validateParams(communityIdParamSchema), communityController.getPublicMembers);
router.patch('/:id/members/:memberId/approve', hostEnterpriseGuard, validateParams(memberIdParamSchema), communityController.approveMember);
router.patch('/:id/members/:memberId/reject', hostEnterpriseGuard, validateParams(memberIdParamSchema), communityController.rejectMember);
router.delete('/:id/members/:memberId', authGuard, validateParams(memberIdParamSchema), communityController.removeMember);

// ── Announcements (Host Enterprise only) ────────────────────────────────
router.post('/:id/announcements', hostEnterpriseGuard, validateParams(communityIdParamSchema), validate(createAnnouncementSchema), communityController.createAnnouncement);
router.get('/:id/announcements', authGuard, validateParams(communityIdParamSchema), communityController.getAnnouncements);
router.put('/:id/announcements/:announcementId', hostEnterpriseGuard, validateParams(announcementIdParamSchema), validate(updateAnnouncementSchema), communityController.updateAnnouncement);
router.patch('/:id/announcements/:announcementId/pin', hostEnterpriseGuard, validateParams(announcementIdParamSchema), communityController.togglePinAnnouncement);
router.delete('/:id/announcements/:announcementId', hostEnterpriseGuard, validateParams(announcementIdParamSchema), communityController.deleteAnnouncement);

// ── Chat Messages ───────────────────────────────────────────────────────
router.post('/:id/messages', authGuard, validateParams(communityIdParamSchema), validate(createMessageSchema), communityController.createMessage);
router.get('/:id/messages', authGuard, validateParams(communityIdParamSchema), communityController.getMessages);
router.get('/:id/messages/search', authGuard, validateParams(communityIdParamSchema), communityController.searchMessages);
router.delete('/:id/messages/:messageId', authGuard, validateParams(messageIdParamSchema), communityController.deleteMessage);

// ── Community Campaigns (Host Enterprise only) ──────────────────────────
router.post('/:id/campaigns', hostEnterpriseGuard, validateParams(communityIdParamSchema), validate(createCommunityCampaignSchema), communityController.createCommunityCampaign);
router.get('/:id/campaigns', authGuard, validateParams(communityIdParamSchema), communityController.getCommunityCampaigns);

// ── Export CSV (Host Enterprise only) ───────────────────────────────────
router.get('/:id/export/members', hostEnterpriseGuard, validateParams(communityIdParamSchema), communityController.exportMembersCsv);
router.get('/:id/export/analytics', hostEnterpriseGuard, validateParams(communityIdParamSchema), communityController.exportAnalyticsCsv);

export default router;
