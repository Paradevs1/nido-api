import { Request, Response } from 'express';
import { CommunityService } from '../services/CommunityService';
import { CommunityMemberStatus } from '../models/CommunityMember';

export class CommunityController {
  private communityService: CommunityService;

  constructor() {
    this.communityService = new CommunityService();
  }

  // ── Communities ──────────────────────────────────────────────────────────

  createCommunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = req.user!.userId;
      const community = await this.communityService.createCommunity(hostId, req.body);
      res.status(201).json({ success: true, message: 'Community created successfully', data: community });
    } catch (error: any) {
      res.status(400).json({ message: error.message, error: 'CREATE_COMMUNITY_ERROR' });
    }
  };

  getHostCommunities = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      if (userRole === 'HOST') {
        const communities = await this.communityService.getHostCommunities(userId);
        res.status(200).json({ success: true, data: communities });
      } else if (userRole === 'CREATOR') {
        const communities = await this.communityService.getCreatorCommunities(userId);
        res.status(200).json({ success: true, data: communities });
      } else {
        res.status(403).json({ message: 'Invalid role for this endpoint', error: 'FORBIDDEN' });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message, error: 'GET_COMMUNITIES_ERROR' });
    }
  };

  getCommunityDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const userId = req.user!.userId;
      const userRole = req.user!.role || '';
      const community = await this.communityService.getCommunityDetail(communityId, userId, userRole);
      res.status(200).json({ success: true, data: community });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('permission') || error.message.includes('approved member') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'GET_COMMUNITY_ERROR' });
    }
  };

  updateCommunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const hostId = req.user!.userId;
      const community = await this.communityService.updateCommunity(communityId, hostId, req.body);
      res.status(200).json({ success: true, message: 'Community updated successfully', data: community });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'UPDATE_COMMUNITY_ERROR' });
    }
  };

  deleteCommunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const userId = req.user!.userId;
      const userRole = req.user!.role || '';
      await this.communityService.deleteCommunity(communityId, userId, userRole);
      res.status(200).json({ success: true, message: 'Community deleted successfully' });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'DELETE_COMMUNITY_ERROR' });
    }
  };

  // ── Creator: list all communities ────────────────────────────────────────

  getAllCommunities = async (req: Request, res: Response): Promise<void> => {
    try {
      const creatorId = req.user!.userId;
      const search = req.query['search'] as string | undefined;
      const communities = await this.communityService.getAllCommunitiesForCreator(creatorId, search);
      res.status(200).json({ success: true, data: communities });
    } catch (error: any) {
      res.status(400).json({ message: error.message, error: 'GET_COMMUNITIES_ERROR' });
    }
  };

  // ── Members ──────────────────────────────────────────────────────────────

  joinCommunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const creatorId = req.user!.userId;
      const member = await this.communityService.joinCommunity(communityId, creatorId);
      res.status(201).json({ success: true, message: 'Join request submitted successfully', data: member });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('already have') ? 409 : 400;
      res.status(status).json({ message: error.message, error: 'JOIN_COMMUNITY_ERROR' });
    }
  };

  leaveCommunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const creatorId = req.user!.userId;
      await this.communityService.leaveCommunity(communityId, creatorId);
      res.status(200).json({ success: true, message: 'You have left the community' });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('not an approved') ? 400 : 400;
      res.status(status).json({ message: error.message, error: 'LEAVE_COMMUNITY_ERROR' });
    }
  };

  getMembers = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const userId = req.user!.userId;
      const userRole = req.user!.role || '';
      const memberStatus = req.query['status'] as CommunityMemberStatus | undefined;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 50;
      const result = await this.communityService.getMembers(communityId, userId, userRole, memberStatus, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'GET_MEMBERS_ERROR' });
    }
  };

  approveMember = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const memberId = req.params['memberId']!;
      const hostId = req.user!.userId;
      const member = await this.communityService.approveMember(communityId, memberId, hostId);
      res.status(200).json({ success: true, message: 'Member approved successfully', data: member });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'APPROVE_MEMBER_ERROR' });
    }
  };

  rejectMember = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const memberId = req.params['memberId']!;
      const hostId = req.user!.userId;
      const member = await this.communityService.rejectMember(communityId, memberId, hostId);
      res.status(200).json({ success: true, message: 'Member rejected successfully', data: member });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'REJECT_MEMBER_ERROR' });
    }
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const memberId = req.params['memberId']!;
      const userId = req.user!.userId;
      const userRole = req.user!.role || '';
      await this.communityService.removeMember(communityId, memberId, userId, userRole);
      res.status(200).json({ success: true, message: 'Member removed successfully' });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'REMOVE_MEMBER_ERROR' });
    }
  };

  // ── Announcements ────────────────────────────────────────────────────────

  createAnnouncement = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const hostId = req.user!.userId;
      const announcement = await this.communityService.createAnnouncement(communityId, hostId, req.body);
      res.status(201).json({ success: true, message: 'Announcement created successfully', data: announcement });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'CREATE_ANNOUNCEMENT_ERROR' });
    }
  };

  getAnnouncements = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const userId = req.user!.userId;
      const userRole = req.user!.role || '';
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const result = await this.communityService.getAnnouncements(communityId, userId, userRole, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('permission') || error.message.includes('approved member') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'GET_ANNOUNCEMENTS_ERROR' });
    }
  };

  updateAnnouncement = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const announcementId = req.params['announcementId']!;
      const hostId = req.user!.userId;
      const announcement = await this.communityService.updateAnnouncement(communityId, announcementId, hostId, req.body);
      res.status(200).json({ success: true, message: 'Announcement updated successfully', data: announcement });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'UPDATE_ANNOUNCEMENT_ERROR' });
    }
  };

  deleteAnnouncement = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const announcementId = req.params['announcementId']!;
      const hostId = req.user!.userId;
      await this.communityService.deleteAnnouncement(communityId, announcementId, hostId);
      res.status(200).json({ success: true, message: 'Announcement deleted successfully' });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'DELETE_ANNOUNCEMENT_ERROR' });
    }
  };

  // ── Chat Messages ────────────────────────────────────────────────────────

  createMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const senderId = req.user!.userId;
      const senderRole = req.user!.role || '';
      const messageResult = await this.communityService.createMessage(communityId, senderId, senderRole, req.body);
      res.status(201).json({ success: true, message: 'Message sent successfully', data: messageResult });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('permission') || error.message.includes('approved member') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'CREATE_MESSAGE_ERROR' });
    }
  };

  getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const userId = req.user!.userId;
      const userRole = req.user!.role || '';
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 50;
      const result = await this.communityService.getMessages(communityId, userId, userRole, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('permission') || error.message.includes('approved member') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'GET_MESSAGES_ERROR' });
    }
  };

  deleteMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const messageId = req.params['messageId']!;
      const userId = req.user!.userId;
      const userRole = req.user!.role || '';
      await this.communityService.deleteMessage(communityId, messageId, userId, userRole);
      res.status(200).json({ success: true, message: 'Message deleted successfully' });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'DELETE_MESSAGE_ERROR' });
    }
  };

  // ── Community Campaigns ──────────────────────────────────────────────────

  createCommunityCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const hostId = req.user!.userId;
      const campaign = await this.communityService.createCommunityCampaign(communityId, hostId, req.body);
      res.status(201).json({ success: true, message: 'Campaign created successfully', data: campaign });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 :
                     error.message.includes('enrollment') || error.message.includes('Invalid platform') ? 422 : 400;
      res.status(status).json({ message: error.message, error: 'CREATE_CAMPAIGN_ERROR' });
    }
  };

  getCommunityCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const userId = req.user!.userId;
      const userRole = req.user!.role || '';
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const result = await this.communityService.getCommunityCampaigns(communityId, userId, userRole, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('permission') || error.message.includes('approved member') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'GET_CAMPAIGNS_ERROR' });
    }
  };

  // ── Admin ────────────────────────────────────────────────────────────────

  getAllCommunitiesAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const result = await this.communityService.getAllCommunitiesAdmin(page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ message: error.message, error: 'GET_COMMUNITIES_ERROR' });
    }
  };

  getCommunityDetailAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const community = await this.communityService.getCommunityDetailAdmin(communityId);
      res.status(200).json({ success: true, data: community });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 : 400;
      res.status(status).json({ message: error.message, error: 'GET_COMMUNITY_ERROR' });
    }
  };

  getCommunityMembersAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 50;
      const result = await this.communityService.getCommunityMembersAdmin(communityId, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 : 400;
      res.status(status).json({ message: error.message, error: 'GET_MEMBERS_ERROR' });
    }
  };

  // ── [HOST-02] Export CSV ─────────────────────────────────────────────────

  exportMembersCsv = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const hostId = req.user!.userId;
      const csv = await this.communityService.exportMembersCsv(communityId, hostId);
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="members_${date}.csv"`);
      res.status(200).send(csv);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'EXPORT_MEMBERS_ERROR' });
    }
  };

  exportAnalyticsCsv = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const hostId = req.user!.userId;
      const campaignId = req.query['campaign_id'] as string;
      if (!campaignId) {
        res.status(400).json({ message: 'campaign_id is required', error: 'MISSING_CAMPAIGN_ID' });
        return;
      }
      const csv = await this.communityService.exportAnalyticsCsv(communityId, hostId, campaignId);
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${date}.csv"`);
      res.status(200).send(csv);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'EXPORT_ANALYTICS_ERROR' });
    }
  };

  // ── [HOST-03] Pin Announcement ───────────────────────────────────────────

  togglePinAnnouncement = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const announcementId = req.params['announcementId']!;
      const hostId = req.user!.userId;
      const announcement = await this.communityService.togglePinAnnouncement(communityId, announcementId, hostId);
      res.status(200).json({ success: true, message: 'Announcement pin toggled', data: announcement });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : error.message.includes('permission') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'PIN_ANNOUNCEMENT_ERROR' });
    }
  };

  // ── [CREATOR-02] Chat Search ─────────────────────────────────────────────

  searchMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const userId = req.user!.userId;
      const userRole = req.user!.role || '';
      const query = req.query['q'] as string;
      if (!query || query.length < 2) {
        res.status(400).json({ message: 'Search query must be at least 2 characters', error: 'INVALID_QUERY' });
        return;
      }
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const result = await this.communityService.searchMessages(communityId, userId, userRole, query, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('permission') || error.message.includes('approved member') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'SEARCH_MESSAGES_ERROR' });
    }
  };

  // ── [CREATOR-03] Public Member List ──────────────────────────────────────

  getPublicMembers = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = req.params['id']!;
      const userId = req.user!.userId;
      const userRole = req.user!.role || '';
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const result = await this.communityService.getPublicMembers(communityId, userId, userRole, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      const status = error.message === 'Community not found' ? 404 :
                     error.message.includes('permission') || error.message.includes('approved member') ? 403 : 400;
      res.status(status).json({ message: error.message, error: 'GET_PUBLIC_MEMBERS_ERROR' });
    }
  };
}
