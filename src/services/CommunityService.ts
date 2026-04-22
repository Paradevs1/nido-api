import { CommunityModel, ICommunity } from '../models/Community';
import { CommunityMemberModel, ICommunityMember, CommunityMemberStatus } from '../models/CommunityMember';
import { CommunityAnnouncementModel, ICommunityAnnouncement } from '../models/CommunityAnnouncement';
import { CommunityMessageModel, ICommunityMessage } from '../models/CommunityMessage';
import { CampaignModel, ICampaign } from '../models/Campaign';
import { UserModel, IUser } from '../models/User';
import { CampaignParticipantsModel } from '../models/CampaignParticipants';
import { NotificationService } from './NotificationService';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  CommunityResponse,
  CommunityDetailResponse,
  CommunityMemberResponse,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  CommunityAnnouncementResponse,
  CreateMessageDto,
  CommunityMessageResponse
} from '../dtos/community.dto';

export class CommunityService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private formatCommunityResponse(community: ICommunity, membersCount?: number, memberStatus?: CommunityMemberStatus): CommunityResponse {
    return {
      id: community._id!.toString(),
      name: community.name,
      description: community.description,
      rules: community.rules,
      logo: community.logo,
      required_platforms: community.required_platforms,
      enrollment_start: community.enrollment_start,
      enrollment_end: community.enrollment_end,
      host_id: community.host_id,
      members_count: membersCount,
      member_status: memberStatus,
      created_at: community.created_at,
      updated_at: community.updated_at
    };
  }

  private formatMemberResponse(member: ICommunityMember, creator?: IUser | null): CommunityMemberResponse {
    const response: CommunityMemberResponse = {
      id: member._id!.toString(),
      community_id: member.community_id,
      creator_id: member.creator_id,
      status: member.status,
      requested_at: member.requested_at,
      reviewed_at: member.reviewed_at,
      reviewed_by: member.reviewed_by,
    };
    if (creator) {
      response.creator = {
        username: creator.username,
        twitter_username: creator.twitter_username,
        username_instagram: creator.username_instagram,
        username_tiktok: creator.username_tiktok,
        username_youtube: creator.username_youtube,
        username_telegram: creator.username_telegram,
        username_discord: creator.username_discord,
        twitter_profile_image: creator.twitter_profile_image,
      };
    }
    return response;
  }

  private formatAnnouncementResponse(announcement: ICommunityAnnouncement): CommunityAnnouncementResponse {
    return {
      id: announcement._id!.toString(),
      community_id: announcement.community_id,
      title: announcement.title,
      description: announcement.description,
      image_url: announcement.image_url,
      images: announcement.images,
      link: announcement.link,
      created_by: announcement.created_by,
      pinned: !!(announcement as any).pinned,
      pinned_at: (announcement as any).pinned_at || null,
      created_at: announcement.created_at,
      updated_at: announcement.updated_at
    };
  }

  private formatMessageResponse(message: ICommunityMessage, sender?: IUser | null): CommunityMessageResponse {
    const response: CommunityMessageResponse = {
      id: message._id!.toString(),
      community_id: message.community_id,
      sender_id: message.sender_id,
      sender_role: message.sender_role,
      message: message.message,
      created_at: message.created_at,
    };
    if (sender) {
      response.sender = {
        username: sender.user_type === 'HOST' ? (sender.name_company || sender.username) : sender.username,
        twitter_profile_image: sender.user_type === 'HOST' ? (sender.logo_company || sender.twitter_profile_image) : sender.twitter_profile_image,
      };
    }
    return response;
  }

  private async assertCommunityOwner(communityId: string, hostId: string): Promise<ICommunity> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');
    if (community.host_id !== hostId) throw new Error('You do not have permission to manage this community');
    return community;
  }

  private async assertApprovedMember(communityId: string, creatorId: string): Promise<ICommunityMember> {
    const member = await CommunityMemberModel.findByCommunityAndCreator(communityId, creatorId);
    if (!member || member.status !== 'APPROVED') throw new Error('You must be an approved member of this community');
    return member;
  }

  // ── Communities (Host) ───────────────────────────────────────────────────

  async createCommunity(hostId: string, dto: CreateCommunityDto): Promise<CommunityResponse> {
    const count = await CommunityModel.countByHostId(hostId);
    if (count >= 10) throw new Error('You have reached the maximum of 10 communities');

    const community = await CommunityModel.create({
      name: dto.name,
      description: dto.description,
      rules: dto.rules,
      logo: dto.logo,
      required_platforms: dto.required_platforms,
      enrollment_start: dto.enrollment_start ? new Date(dto.enrollment_start) : null,
      enrollment_end: dto.enrollment_end ? new Date(dto.enrollment_end) : null,
      host_id: hostId
    });
    return this.formatCommunityResponse(community, 0);
  }

  async getHostCommunities(hostId: string): Promise<CommunityResponse[]> {
    const communities = await CommunityModel.findByHostId(hostId);
    const responses: CommunityResponse[] = [];
    for (const community of communities) {
      const membersCount = await CommunityMemberModel.countByCommunityId(community._id!.toString(), 'APPROVED');
      responses.push(this.formatCommunityResponse(community, membersCount));
    }
    return responses;
  }

  async getCommunityDetail(communityId: string, userId: string, userRole: string): Promise<CommunityDetailResponse> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const isOwner = userRole === 'HOST' && community.host_id === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      // Creator must be approved member
      if (userRole !== 'CREATOR') throw new Error('You do not have permission to view this community');
      await this.assertApprovedMember(communityId, userId);
    }

    const membersCount = await CommunityMemberModel.countByCommunityId(communityId, 'APPROVED');

    // Get approved members with creator data
    const { members: memberRecords } = await CommunityMemberModel.findByCommunityId(communityId, 'APPROVED', 1, 100);
    const creatorIds = memberRecords.map(m => m.creator_id);
    const creatorsMap = await UserModel.findByIds(creatorIds);
    const members = memberRecords.map(m => this.formatMemberResponse(m, creatorsMap.get(m.creator_id)));

    // Get campaigns linked to this community (with submission count)
    const campaignsResult = await CampaignModel.findWithPaginationAllStatus(1, 50, { community_id: communityId } as any);
    const isCreator = userRole === 'CREATOR';
    const filteredCampaigns = isCreator
      ? campaignsResult.campaigns.filter(c => c.status !== 'inactive')
      : campaignsResult.campaigns;

    const campaignsWithSubmissions = await Promise.all(
      filteredCampaigns.map(async (campaign) => {
        const campaignId = campaign._id!.toString();
        const totalSubmissions = await CampaignParticipantsModel.countByCampaignId(campaignId);
        return {
          ...campaign,
          id: campaignId,
          total_submissions: isCreator ? undefined : totalSubmissions
        };
      })
    );

    // Get recent announcements
    const { announcements: announcementRecords } = await CommunityAnnouncementModel.findByCommunityId(communityId, 1, 10);
    const announcements = announcementRecords.map(a => this.formatAnnouncementResponse(a));

    return {
      ...this.formatCommunityResponse(community, membersCount),
      members,
      campaigns: campaignsWithSubmissions,
      announcements
    };
  }

  async updateCommunity(communityId: string, hostId: string, dto: UpdateCommunityDto): Promise<CommunityResponse> {
    await this.assertCommunityOwner(communityId, hostId);
    const updated = await CommunityModel.updateById(communityId, dto as Partial<ICommunity>);
    if (!updated) throw new Error('Failed to update community');
    const membersCount = await CommunityMemberModel.countByCommunityId(communityId, 'APPROVED');
    return this.formatCommunityResponse(updated, membersCount);
  }

  async deleteCommunity(communityId: string, userId: string, userRole: string): Promise<void> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const isOwner = userRole === 'HOST' && community.host_id === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) throw new Error('You do not have permission to delete this community');

    // Check if community has approved members
    const membersCount = await CommunityMemberModel.countByCommunityId(communityId, 'APPROVED');
    if (membersCount > 0) throw new Error('Cannot delete community with active members. Remove all members first.');

    // Check if community has active campaigns
    const { campaigns } = await CampaignModel.findWithPaginationAllStatus(1, 1, { community_id: communityId, status: 'active' } as any);
    if (campaigns.length > 0) throw new Error('Cannot delete community with active campaigns. Complete or cancel all campaigns first.');

    // Safe to delete: cleanup announcements, messages, pending/rejected members
    await Promise.all([
      CommunityMemberModel.deleteByCommunityId(communityId),
      CommunityAnnouncementModel.deleteByCommunityId(communityId),
      CommunityMessageModel.deleteByCommunityId(communityId),
    ]);

    await CommunityModel.deleteById(communityId);
  }

  // ── Members ──────────────────────────────────────────────────────────────

  async joinCommunity(communityId: string, creatorId: string): Promise<CommunityMemberResponse> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    // Validate enrollment period
    if (community.enrollment_start && new Date(community.enrollment_start) > new Date()) {
      throw new Error('Enrollment period has not started yet');
    }
    if (community.enrollment_end && new Date(community.enrollment_end) < new Date()) {
      throw new Error('Enrollment period has ended');
    }

    // Validate required_platforms: creator must have corresponding social accounts
    if (community.required_platforms && community.required_platforms.length > 0) {
      const creator = await UserModel.findById(creatorId);
      if (!creator) throw new Error('User not found');

      const platformToField: Record<string, string | undefined> = {
        'TWITTER': creator.twitter_username,
        'INSTAGRAM': creator.username_instagram,
        'TIKTOK': creator.username_tiktok,
        'YOUTUBE': creator.username_youtube,
        'TELEGRAM': creator.username_telegram,
        'DISCORD': creator.username_discord,
      };

      const missing = community.required_platforms.filter(p => !platformToField[p]);
      if (missing.length > 0) {
        throw new Error(`You must have the following platforms configured in your profile to join this community: ${missing.join(', ')}`);
      }
    }

    const existing = await CommunityMemberModel.findByCommunityAndCreator(communityId, creatorId);
    if (existing && (existing.status === 'PENDING' || existing.status === 'APPROVED')) {
      throw new Error('You already have a pending or approved membership for this community');
    }

    // If previously rejected, allow re-application by creating a new record
    if (existing && existing.status === 'REJECTED') {
      await CommunityMemberModel.deleteById(existing._id!.toString());
    }

    const member = await CommunityMemberModel.create({
      community_id: communityId,
      creator_id: creatorId,
      status: 'PENDING'
    });

    const creator = await UserModel.findById(creatorId);

    // Notify host about new join request
    this.notificationService.notify(community.host_id, 'JOIN_REQUEST', {
      community_id: communityId,
      community_name: community.name,
      creator_id: creatorId,
      creator_name: creator?.username || '',
      creator_avatar: creator?.twitter_profile_image || null
    }).catch(err => console.error('[Notification] JOIN_REQUEST failed:', err.message));

    return this.formatMemberResponse(member, creator);
  }

  async getMembers(
    communityId: string,
    userId: string,
    userRole: string,
    status?: CommunityMemberStatus,
    page: number = 1,
    limit: number = 50
  ): Promise<{ members: CommunityMemberResponse[]; total: number; page: number; totalPages: number }> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const isOwner = userRole === 'HOST' && community.host_id === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) throw new Error('You do not have permission to view members');

    const { members: memberRecords, total, totalPages } = await CommunityMemberModel.findByCommunityId(communityId, status, page, limit);
    const creatorIds = memberRecords.map(m => m.creator_id);
    const creatorsMap = await UserModel.findByIds(creatorIds);
    const members = memberRecords.map(m => this.formatMemberResponse(m, creatorsMap.get(m.creator_id)));

    return { members, total, page, totalPages };
  }

  async approveMember(communityId: string, memberId: string, hostId: string): Promise<CommunityMemberResponse> {
    await this.assertCommunityOwner(communityId, hostId);

    const member = await CommunityMemberModel.findById(memberId);
    if (!member || member.community_id !== communityId) throw new Error('Member not found in this community');
    if (member.status === 'APPROVED') throw new Error('Member is already approved');

    const updated = await CommunityMemberModel.updateStatus(memberId, 'APPROVED', hostId);
    if (!updated) throw new Error('Failed to approve member');

    const creator = await UserModel.findById(updated.creator_id);
    const community = await CommunityModel.findById(communityId);
    const host = await UserModel.findById(hostId);

    // Notify creator about approval
    this.notificationService.notify(updated.creator_id, 'JOIN_REQUEST_APPROVED', {
      community_id: communityId,
      community_name: community?.name || '',
      host_name: host?.name_company || host?.username || '',
      host_logo: host?.logo_company || null
    }).catch(err => console.error('[Notification] JOIN_REQUEST_APPROVED failed:', err.message));

    return this.formatMemberResponse(updated, creator);
  }

  async rejectMember(communityId: string, memberId: string, hostId: string): Promise<CommunityMemberResponse> {
    await this.assertCommunityOwner(communityId, hostId);

    const member = await CommunityMemberModel.findById(memberId);
    if (!member || member.community_id !== communityId) throw new Error('Member not found in this community');
    if (member.status === 'REJECTED') throw new Error('Member is already rejected');

    const updated = await CommunityMemberModel.updateStatus(memberId, 'REJECTED', hostId);
    if (!updated) throw new Error('Failed to reject member');

    const creator = await UserModel.findById(updated.creator_id);
    const community = await CommunityModel.findById(communityId);

    // Notify creator about rejection
    this.notificationService.notify(updated.creator_id, 'JOIN_REQUEST_REJECTED', {
      community_id: communityId,
      community_name: community?.name || ''
    }).catch(err => console.error('[Notification] JOIN_REQUEST_REJECTED failed:', err.message));

    return this.formatMemberResponse(updated, creator);
  }

  async removeMember(communityId: string, memberId: string, userId: string, userRole: string): Promise<void> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const isOwner = userRole === 'HOST' && community.host_id === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) throw new Error('You do not have permission to remove members');

    const member = await CommunityMemberModel.findById(memberId);
    if (!member || member.community_id !== communityId) throw new Error('Member not found in this community');

    await CommunityMemberModel.deleteById(memberId);

    // Notify removed creator
    this.notificationService.notify(member.creator_id, 'MEMBER_REMOVED', {
      community_id: communityId,
      community_name: community.name
    }).catch(err => console.error('[Notification] MEMBER_REMOVED failed:', err.message));
  }

  async leaveCommunity(communityId: string, creatorId: string): Promise<void> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const member = await CommunityMemberModel.findByCommunityAndCreator(communityId, creatorId);
    if (!member || member.status !== 'APPROVED') throw new Error('You are not an approved member of this community');

    await CommunityMemberModel.deleteById(member._id!.toString());

    // Notify host that a member left
    const creator = await UserModel.findById(creatorId);
    this.notificationService.notify(community.host_id, 'MEMBER_REMOVED', {
      community_id: communityId,
      community_name: community.name,
      creator_id: creatorId,
      creator_name: creator?.username || '',
      left_voluntarily: true
    }).catch(err => console.error('[Notification] MEMBER_LEFT failed:', err.message));
  }

  // ── Announcements ────────────────────────────────────────────────────────

  async createAnnouncement(communityId: string, hostId: string, dto: CreateAnnouncementDto): Promise<CommunityAnnouncementResponse> {
    await this.assertCommunityOwner(communityId, hostId);

    const announcement = await CommunityAnnouncementModel.create({
      community_id: communityId,
      title: dto.title,
      description: dto.description,
      image_url: dto.image_url,
      images: dto.images,
      link: dto.link,
      created_by: hostId
    });

    // Notify all approved members about new announcement
    const community = await CommunityModel.findById(communityId);
    this.notificationService.notifyCommunityMembers(communityId, 'ANNOUNCEMENT_PUBLISHED', {
      community_id: communityId,
      community_name: community?.name || '',
      announcement_id: announcement._id!.toString(),
      announcement_title: dto.title
    }).catch(err => console.error('[Notification] ANNOUNCEMENT_PUBLISHED failed:', err.message));

    return this.formatAnnouncementResponse(announcement);
  }

  async getAnnouncements(
    communityId: string,
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ announcements: CommunityAnnouncementResponse[]; total: number; page: number; totalPages: number }> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const isOwner = userRole === 'HOST' && community.host_id === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (userRole !== 'CREATOR') throw new Error('You do not have permission to view announcements');
      await this.assertApprovedMember(communityId, userId);
    }

    const { announcements: records, total, totalPages } = await CommunityAnnouncementModel.findByCommunityId(communityId, page, limit);
    const announcements = records
      .map(a => this.formatAnnouncementResponse(a))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    return { announcements, total, page, totalPages };
  }

  async updateAnnouncement(communityId: string, announcementId: string, hostId: string, dto: UpdateAnnouncementDto): Promise<CommunityAnnouncementResponse> {
    await this.assertCommunityOwner(communityId, hostId);

    const announcement = await CommunityAnnouncementModel.findById(announcementId);
    if (!announcement || announcement.community_id !== communityId) throw new Error('Announcement not found in this community');

    const updated = await CommunityAnnouncementModel.updateById(announcementId, dto as Partial<ICommunityAnnouncement>);
    if (!updated) throw new Error('Failed to update announcement');

    return this.formatAnnouncementResponse(updated);
  }

  async deleteAnnouncement(communityId: string, announcementId: string, hostId: string): Promise<void> {
    await this.assertCommunityOwner(communityId, hostId);

    const announcement = await CommunityAnnouncementModel.findById(announcementId);
    if (!announcement || announcement.community_id !== communityId) throw new Error('Announcement not found in this community');

    await CommunityAnnouncementModel.deleteById(announcementId);
  }

  // ── Chat Messages ────────────────────────────────────────────────────────

  async createMessage(communityId: string, senderId: string, senderRole: string, dto: CreateMessageDto): Promise<CommunityMessageResponse> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const isOwner = senderRole === 'HOST' && community.host_id === senderId;

    if (!isOwner) {
      if (senderRole !== 'CREATOR') throw new Error('You do not have permission to send messages');
      await this.assertApprovedMember(communityId, senderId);
    }

    const message = await CommunityMessageModel.create({
      community_id: communityId,
      sender_id: senderId,
      sender_role: isOwner ? 'HOST' : 'CREATOR',
      message: dto.message
    });

    const sender = await UserModel.findById(senderId);
    return this.formatMessageResponse(message, sender);
  }

  async getMessages(
    communityId: string,
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: CommunityMessageResponse[]; total: number; page: number; totalPages: number }> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const isOwner = userRole === 'HOST' && community.host_id === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (userRole !== 'CREATOR') throw new Error('You do not have permission to view messages');
      await this.assertApprovedMember(communityId, userId);
    }

    const { messages: records, total, totalPages } = await CommunityMessageModel.findByCommunityId(communityId, page, limit);
    const senderIds = [...new Set(records.map(m => m.sender_id))];
    const sendersMap = await UserModel.findByIds(senderIds);
    const messages = records.map(m => this.formatMessageResponse(m, sendersMap.get(m.sender_id)));

    return { messages, total, page, totalPages };
  }

  async deleteMessage(communityId: string, messageId: string, userId: string, userRole: string): Promise<void> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const message = await CommunityMessageModel.findById(messageId);
    if (!message || message.community_id !== communityId) throw new Error('Message not found in this community');

    const isOwner = userRole === 'HOST' && community.host_id === userId;
    const isAuthor = message.sender_id === userId;

    if (!isOwner && !isAuthor) throw new Error('You do not have permission to delete this message');

    await CommunityMessageModel.deleteById(messageId);
  }

  // ── Community Campaigns ──────────────────────────────────────────────────

  async createCommunityCampaign(communityId: string, hostId: string, campaignData: any): Promise<ICampaign> {
    await this.assertCommunityOwner(communityId, hostId);

    const campaign = await CampaignModel.create({
      ...campaignData,
      host_id: hostId,
      community_id: communityId,
      status: 'inactive',
      payment_received: false,
    });

    await UserModel.incrementCampaignsCreated(hostId);
    return campaign;
  }

  async getCommunityCampaigns(
    communityId: string,
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ campaigns: any[]; total: number; page: number; totalPages: number }> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const isOwner = userRole === 'HOST' && community.host_id === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (userRole !== 'CREATOR') throw new Error('You do not have permission to view campaigns');
      await this.assertApprovedMember(communityId, userId);
    }

    const result = await CampaignModel.findWithPaginationAllStatus(page, limit, { community_id: communityId } as any);

    if (isOwner || isAdmin) {
      // Return with metrics
      const campaignsWithMetrics = await Promise.all(
        result.campaigns.map(async (campaign) => {
          const campaignId = campaign._id!.toString();
          const participantsCount = await CampaignParticipantsModel.countByCampaignId(campaignId);
          return {
            ...campaign,
            id: campaignId,
            total_submissions: participantsCount
          };
        })
      );
      return { campaigns: campaignsWithMetrics, total: result.total, page: result.page, totalPages: result.totalPages };
    }

    // Creator: hide inactive campaigns
    const activeCampaigns = result.campaigns
      .filter(campaign => campaign.status !== 'inactive')
      .map(campaign => ({
        ...campaign,
        id: campaign._id!.toString()
      }));

    return { campaigns: activeCampaigns, total: activeCampaigns.length, page: result.page, totalPages: result.totalPages };
  }

  // ── Creator Views ────────────────────────────────────────────────────────

  async getAllCommunitiesForCreator(creatorId: string, search?: string): Promise<CommunityResponse[]> {
    const communities = await CommunityModel.findAll(search);
    const memberships = await CommunityMemberModel.findByCreatorId(creatorId);
    const membershipMap = new Map(memberships.map(m => [m.community_id, m.status]));

    const responses: CommunityResponse[] = [];
    for (const community of communities) {
      const communityId = community._id!.toString();
      const membersCount = await CommunityMemberModel.countByCommunityId(communityId, 'APPROVED');
      const memberStatus = membershipMap.get(communityId);
      responses.push(this.formatCommunityResponse(community, membersCount, memberStatus));
    }
    return responses;
  }

  async getCreatorCommunities(creatorId: string): Promise<CommunityResponse[]> {
    const approvedMemberships = await CommunityMemberModel.findApprovedCommunitiesByCreator(creatorId);
    const communityIds = approvedMemberships.map(m => m.community_id);

    const responses: CommunityResponse[] = [];
    for (const communityId of communityIds) {
      const community = await CommunityModel.findById(communityId);
      if (community) {
        const membersCount = await CommunityMemberModel.countByCommunityId(communityId, 'APPROVED');
        responses.push(this.formatCommunityResponse(community, membersCount, 'APPROVED'));
      }
    }
    return responses;
  }

  // ── Admin Views ──────────────────────────────────────────────────────────

  async getAllCommunitiesAdmin(page: number = 1, limit: number = 10): Promise<{ communities: any[]; total: number; page: number; totalPages: number }> {
    const result = await CommunityModel.findWithPagination(page, limit);

    const communities = await Promise.all(
      result.communities.map(async (community) => {
        const communityId = community._id!.toString();
        const membersCount = await CommunityMemberModel.countByCommunityId(communityId, 'APPROVED');
        const host = await UserModel.findById(community.host_id);
        return {
          ...this.formatCommunityResponse(community, membersCount),
          host: host ? {
            username: host.username,
            email: host.email,
            name_company: host.name_company,
            logo_company: host.logo_company,
          } : null
        };
      })
    );

    return { communities, total: result.total, page: result.page, totalPages: result.totalPages };
  }

  async getCommunityDetailAdmin(communityId: string): Promise<any> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const membersCount = await CommunityMemberModel.countByCommunityId(communityId, 'APPROVED');
    const pendingCount = await CommunityMemberModel.countByCommunityId(communityId, 'PENDING');

    const host = await UserModel.findById(community.host_id);

    const { members: memberRecords } = await CommunityMemberModel.findByCommunityId(communityId, undefined, 1, 100);
    const creatorIds = memberRecords.map(m => m.creator_id);
    const creatorsMap = await UserModel.findByIds(creatorIds);
    const members = memberRecords.map(m => this.formatMemberResponse(m, creatorsMap.get(m.creator_id)));

    const campaigns = await CampaignModel.findWithPaginationAllStatus(1, 50, { community_id: communityId } as any);
    const { announcements: announcementRecords } = await CommunityAnnouncementModel.findByCommunityId(communityId, 1, 20);
    const announcements = announcementRecords.map(a => this.formatAnnouncementResponse(a));

    return {
      ...this.formatCommunityResponse(community, membersCount),
      pending_members_count: pendingCount,
      host: host ? {
        id: host._id!.toString(),
        username: host.username,
        email: host.email,
        name_company: host.name_company,
        position_company: host.position_company,
        website_company: host.website_company,
        introduction_company: host.introduction_company,
        logo_company: host.logo_company,
        categories_atuation: host.categories_atuation,
        telegram_username: host.telegram_username,
        social_media: host.social_media,
        campaigns_created: host.campaigns_created,
        created_at: host.created_at,
      } : null,
      members,
      campaigns: campaigns.campaigns,
      announcements,
    };
  }

  async getCommunityMembersAdmin(
    communityId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ members: CommunityMemberResponse[]; total: number; page: number; totalPages: number }> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const { members: memberRecords, total, totalPages } = await CommunityMemberModel.findByCommunityId(communityId, undefined, page, limit);
    const creatorIds = memberRecords.map(m => m.creator_id);
    const creatorsMap = await UserModel.findByIds(creatorIds);
    const members = memberRecords.map(m => this.formatMemberResponse(m, creatorsMap.get(m.creator_id)));

    return { members, total, page, totalPages };
  }

  // ── [HOST-02] Export CSV ─────────────────────────────────────────────────

  async exportMembersCsv(communityId: string, hostId: string): Promise<string> {
    await this.assertCommunityOwner(communityId, hostId);

    const { members: memberRecords } = await CommunityMemberModel.findByCommunityId(communityId, undefined, 1, 10000);
    const creatorIds = memberRecords.map(m => m.creator_id);
    const creatorsMap = await UserModel.findByIds(creatorIds);

    const escCsv = (val: string) => {
      if (!val) return '';
      if (/^[=+\-@]/.test(val)) val = "'" + val;
      if (val.includes(',') || val.includes('"') || val.includes('\n')) return '"' + val.replace(/"/g, '""') + '"';
      return val;
    };

    const header = 'name,username,email,twitter,instagram,tiktok,youtube,telegram,discord,status,joined_at';
    const rows = memberRecords.map(m => {
      const c = creatorsMap.get(m.creator_id);
      return [
        escCsv(c?.twitter_display_name || c?.username || ''),
        escCsv(c?.username || ''),
        escCsv(c?.email || ''),
        escCsv(c?.twitter_username || ''),
        escCsv(c?.username_instagram || ''),
        escCsv(c?.username_tiktok || ''),
        escCsv(c?.username_youtube || ''),
        escCsv(c?.username_telegram || ''),
        escCsv(c?.username_discord || ''),
        escCsv(m.status),
        m.requested_at?.toISOString() || ''
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  async exportAnalyticsCsv(communityId: string, hostId: string, campaignId: string): Promise<string> {
    await this.assertCommunityOwner(communityId, hostId);

    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign || campaign.community_id !== communityId) throw new Error('Campaign not found in this community');

    const { participants } = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, 10000);
    const userIds = participants.map(p => p.userId);
    const usersMap = await UserModel.findByIds(userIds);

    const escCsv = (val: string) => {
      if (!val) return '';
      if (/^[=+\-@]/.test(val)) val = "'" + val;
      if (val.includes(',') || val.includes('"') || val.includes('\n')) return '"' + val.replace(/"/g, '""') + '"';
      return val;
    };

    const header = 'creator,views,likes,replies,retweets,quotes,bookmarks,winner,rank';
    const rows = participants.map(p => {
      const u = usersMap.get(p.userId);
      const views = (p.views_twitter || 0) + (p.views_instagram || 0) + (p.views_tiktok || 0) + (p.views_youtube || 0);
      const likes = (p.likes_twitter || 0) + (p.likes_instagram || 0) + (p.likes_tiktok || 0) + (p.likes_youtube || 0);
      const replies = (p.replies_twitter || 0) + (p.replies_instagram || 0) + (p.replies_tiktok || 0) + (p.replies_youtube || 0);
      const retweets = (p.retweets_twitter || 0) + (p.retweets_instagram || 0) + (p.retweets_tiktok || 0) + (p.retweets_youtube || 0);
      const quotes = (p.quotes_twitter || 0) + (p.quotes_instagram || 0) + (p.quotes_tiktok || 0) + (p.quotes_youtube || 0);
      const bookmarks = (p.bookmarks_twitter || 0) + (p.bookmarks_instagram || 0) + (p.bookmarks_tiktok || 0) + (p.bookmarks_youtube || 0);
      return [
        escCsv(u?.username || p.userId),
        views, likes, replies, retweets, quotes, bookmarks,
        p.winner ? 'YES' : 'NO',
        p.rank ?? ''
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  // ── [HOST-03] Pin Announcement ───────────────────────────────────────────

  async togglePinAnnouncement(communityId: string, announcementId: string, hostId: string): Promise<CommunityAnnouncementResponse> {
    await this.assertCommunityOwner(communityId, hostId);

    const announcement = await CommunityAnnouncementModel.findById(announcementId);
    if (!announcement || announcement.community_id !== communityId) throw new Error('Announcement not found in this community');

    const isPinned = !!(announcement as any).pinned;

    if (!isPinned) {
      // Unpin any currently pinned announcement in this community
      const { announcements } = await CommunityAnnouncementModel.findByCommunityId(communityId, 1, 100);
      for (const a of announcements) {
        if ((a as any).pinned) {
          await CommunityAnnouncementModel.updateById(a._id!.toString(), { pinned: false, pinned_at: null } as any);
        }
      }
      // Pin this one
      await CommunityAnnouncementModel.updateById(announcementId, { pinned: true, pinned_at: new Date() } as any);
    } else {
      // Unpin
      await CommunityAnnouncementModel.updateById(announcementId, { pinned: false, pinned_at: null } as any);
    }

    const updated = await CommunityAnnouncementModel.findById(announcementId);
    if (!updated) throw new Error('Failed to update announcement');
    return this.formatAnnouncementResponse(updated);
  }

  // ── [CREATOR-02] Chat Search ─────────────────────────────────────────────

  async searchMessages(
    communityId: string,
    userId: string,
    userRole: string,
    query: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ messages: CommunityMessageResponse[]; total: number; page: number; totalPages: number }> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const isOwner = userRole === 'HOST' && community.host_id === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (userRole !== 'CREATOR') throw new Error('You do not have permission to search messages');
      await this.assertApprovedMember(communityId, userId);
    }

    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    const collection = db.collection('community_messages');

    const skip = (page - 1) * limit;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      community_id: communityId,
      message: { $regex: escaped, $options: 'i' }
    };

    const [messages, total] = await Promise.all([
      collection.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter)
    ]);

    const senderIds = [...new Set(messages.map((m: any) => m.sender_id))];
    const sendersMap = await UserModel.findByIds(senderIds);

    const formatted = messages.map((m: any) => {
      const sender = sendersMap.get(m.sender_id);
      const response: CommunityMessageResponse = {
        id: m._id.toString(),
        community_id: m.community_id,
        sender_id: m.sender_id,
        sender_role: m.sender_role,
        message: m.message,
        created_at: m.created_at,
      };
      if (sender) {
        response.sender = {
          username: sender.user_type === 'HOST' ? (sender.name_company || sender.username) : sender.username,
          twitter_profile_image: sender.user_type === 'HOST' ? (sender.logo_company || sender.twitter_profile_image) : sender.twitter_profile_image,
        };
      }
      return response;
    });

    return { messages: formatted, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ── [CREATOR-03] Public Member List ──────────────────────────────────────

  async getPublicMembers(
    communityId: string,
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ members: any[]; total: number; page: number; totalPages: number }> {
    const community = await CommunityModel.findById(communityId);
    if (!community) throw new Error('Community not found');

    const isOwner = userRole === 'HOST' && community.host_id === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (userRole !== 'CREATOR') throw new Error('You do not have permission to view members');
      await this.assertApprovedMember(communityId, userId);
    }

    const { members: memberRecords, total, totalPages } = await CommunityMemberModel.findByCommunityId(communityId, 'APPROVED', page, limit);
    const creatorIds = memberRecords.map(m => m.creator_id);
    const creatorsMap = await UserModel.findByIds(creatorIds);

    // Also check if host is in the list
    const host = await UserModel.findById(community.host_id);

    const members = memberRecords.map(m => {
      const c = creatorsMap.get(m.creator_id);
      return {
        id: m.creator_id,
        display_name: c?.username || '',
        avatar: c?.twitter_profile_image || null,
        platforms: [
          c?.twitter_username ? 'twitter' : null,
          c?.username_instagram ? 'instagram' : null,
          c?.username_tiktok ? 'tiktok' : null,
          c?.username_youtube ? 'youtube' : null,
          c?.username_telegram ? 'telegram' : null,
          c?.username_discord ? 'discord' : null,
        ].filter(Boolean),
        is_host: false,
      };
    });

    // Add host at position 0 if not already paginated away
    if (page === 1 && host) {
      members.unshift({
        id: community.host_id,
        display_name: host.name_company || host.username,
        avatar: host.logo_company || host.twitter_profile_image || null,
        platforms: [],
        is_host: true,
      });
    }

    return { members, total: total + 1, page, totalPages };
  }
}
