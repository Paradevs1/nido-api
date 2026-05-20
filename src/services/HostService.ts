import { CampaignModel, ICampaign } from '../models/Campaign';
import { IRankEntry } from '../models/CampaignSugestionBountiesRank';
import { UserModel } from '../models/User';
import { CampaignParticipantsModel, ICampaignParticipants } from '../models/CampaignParticipants';
import { CreateCampaignDto, UpdateCampaignDto, CampaignResponse, CampaignListResponse } from '../dtos/campaign.dto';
import { CreateCampaignWinnersDto } from '../dtos/campaignParticipants.dto';
import { calculateDeadline, calculateDetailedDeadline } from '../utils/dateUtils';
import { UpdateProfileDto } from '../dtos/auth.dto';
import { EmailVerificationCodeModel } from '../models/EmailVerificationCode';
import { EmailService } from './EmailService';
import { generateVerificationCode } from '../utils/codeUtils';
import { UserCommentCampaignModel } from '../models/UserCommentCampaign';
import { PaymentModel } from '../models/Payment';
import { ShortURLModel } from '../models/EncurtadorURL';
import { campaignsCache } from '../utils/cache';
import { MAX_PARTICIPANTS_LIMIT } from '../utils/consts';

type HostSocialPlatform = 'twitter' | 'tiktok' | 'instagram' | 'youtube';
const HOST_PLATFORMS: HostSocialPlatform[] = ['twitter', 'tiktok', 'instagram', 'youtube'];

function normalizeCampaignPlatforms(sf: { type: string }[] | undefined): HostSocialPlatform[] {
  const types = (sf ?? [])
    .map((s) => s?.type)
    .filter((t): t is HostSocialPlatform => typeof t === 'string' && (HOST_PLATFORMS as string[]).includes(t));

  const unique: HostSocialPlatform[] = [];
  for (const t of types) {
    if (!unique.includes(t)) unique.push(t);
  }

  return unique.length > 0 ? unique : [...HOST_PLATFORMS];
}

function detectUrlPlatform(url: string): HostSocialPlatform | null {
  const u = String(url ?? '').trim();
  if (!u) return null;

  const lower = u.toLowerCase();
  try {
    const href = u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`;
    const parsed = new URL(href);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com')) return 'twitter';
    if (host.includes('instagram.com') || host === 'instagr.am') return 'instagram';
    if (host.includes('tiktok.com')) return 'tiktok';
    if (host === 'youtu.be' || host.includes('youtube.com')) return 'youtube';
  } catch {
    // ignore
  }

  if (/twitter\.com|(^|\.)x\.com\b/i.test(lower)) return 'twitter';
  if (/instagram\.com|instagr\.am/i.test(lower)) return 'instagram';
  if (/tiktok\.com/i.test(lower)) return 'tiktok';
  if (/youtube\.com|youtu\.be/i.test(lower)) return 'youtube';

  return null;
}

function getPlatformValue(p: ICampaignParticipants, pl: HostSocialPlatform): {
  likes: number;
  views: number;
  replies: number;
  retweets: number;
  bookmarks: number;
  quotes: number;
} {
  const likesBase = Number(p[`likes_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
  const viewsBase = Number(p[`views_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
  const repliesBase = Number(p[`replies_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
  const retweetsBase = Number(p[`retweets_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
  const bookmarks = Number(p[`bookmarks_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
  const quotes = Number(p[`quotes_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;

  // Instagram Story manual: fields live under *_instagram_story and must count in Instagram view.
  const likesStory = pl === 'instagram' ? Number(p.likes_instagram_story ?? 0) || 0 : 0;
  const viewsStory = pl === 'instagram' ? Number(p.views_instagram_story ?? 0) || 0 : 0;
  const repliesStory = pl === 'instagram' ? Number(p.replies_instagram_story ?? 0) || 0 : 0;
  const retweetsStory = pl === 'instagram' ? Number(p.retweets_instagram_story ?? 0) || 0 : 0;

  return {
    likes: likesBase + likesStory,
    views: viewsBase + viewsStory,
    replies: repliesBase + repliesStory,
    retweets: retweetsBase + retweetsStory,
    bookmarks,
    quotes,
  };
}

export class HostService {
  public async getCampaignById(campaignId: string, userId?: string, userRole?: string): Promise<CampaignResponse | null> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) return null;

    const isPrivate = campaign.isPrivate || (campaign.list_kols && campaign.list_kols.length > 0);
    
    if (isPrivate) {
      if (!userId || !userRole) throw new Error('You do not have permission to view this private campaign');

      if (userRole === 'HOST') {
        if (campaign.host_id !== userId) 
          throw new Error('You do not have permission to view this private campaign');
      } else if (userRole === 'CREATOR') {
        const isInKolList = campaign.list_kols && campaign.list_kols.some(kol => kol.userId === userId);
        if (!isInKolList) 
          throw new Error('You do not have permission to view this private campaign');
      } else if (userRole === 'ADMIN') {
        // Permitir acesso
      } else {
        throw new Error('You do not have permission to view this private campaign');
      }
    }

    return await this.formatCampaignResponse(campaign, userId);
  }

  public async getCampaignsByHost(hostId: string, page: number = 1, limit: number = 10, filters: any = {}): Promise<CampaignListResponse> {
    const mongoFilters: any = { host_id: hostId };

    if (filters.type && !['All', 'Other', 'all', 'other'].includes(String(filters.type))) {
      mongoFilters.content_categories = { $elemMatch: { slug: String(filters.type) } };
    }
    
    const result = await CampaignModel.findWithPaginationAllStatus(page, limit, mongoFilters);
    
    const statusOrder: { [key: string]: number } = {
      'active': 1,
      'waiting payment': 2,
      'completed': 3,
      'inactive': 4,
      'cancelled': 5
    };
    
    const campaigns = await Promise.all(result.campaigns.map(campaign => this.formatCampaignListResponse(campaign)));
    campaigns.sort((a, b) => {
      const orderA = statusOrder[a.status] || 99;
      const orderB = statusOrder[b.status] || 99;
      return orderA - orderB;
    });
    
    return {
      campaigns,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    };
  }

  public async createCampaign(hostId: string, campaignData: CreateCampaignDto): Promise<CampaignResponse> {
    const host = await UserModel.findById(hostId);
    
    if (!host) 
      throw new Error('Host not found')

    const { PlanService } = await import('./PlanService');
    const planService = new PlanService();
    const planInfo = await planService.getHostPlan(hostId);

    if ((planInfo.plan.name === 'CORE' || planInfo.plan.name === 'ENTERPRISE') && !planInfo.is_active) {
      throw new Error('Your CORE plan has expired. Renew the plan to create new campaigns.');
    }

    if (campaignData.list_kols && campaignData.list_kols.length === 0 && campaignData.total_prize_pool && campaignData.total_prize_pool < 50) {
      throw new Error(`The total_prize_pool must be at least $50. Total: $${campaignData.total_prize_pool}`);
    }

    if (campaignData.list_kols && campaignData.list_kols.length > 0) {
      for (const kol of campaignData.list_kols) {
        if (!kol.userId) {
          throw new Error('Each KOL must have a valid userId');
        }
        
        if (!campaignData.is_cac && (!kol.amount || kol.amount <= 0)) {
          throw new Error('Each KOL must have a valid amount greater than 0 when is_cac is false');
        }
      }
    }
    
    const isParabuilders = await this.isParabuildersHost(hostId);

    const campaign = await CampaignModel.create({
      ...campaignData,
      host_id: hostId,
      status: (isParabuilders && campaignData.is_cac ? 'active' : 'inactive'),
      payment_received: (isParabuilders && campaignData.is_cac ? true : false),
      isPrivate: campaignData.list_kols && campaignData.list_kols.length > 0 ? true : false
    } as Omit<ICampaign, '_id' | 'created_at' | 'updated_at' | 'rewards_distributed'>);

    await campaignsCache.deleteByPrefix('campaigns:all');

    return await this.formatCampaignResponse(campaign);
  }


  public async getAllCampaigns(page: number = 1, limit: number = 10, filters: any = {}, userId?: string, userRole?: string): Promise<CampaignListResponse> {
    try {
      const cacheKey = campaignsCache.generateCampaignsKey(page, limit, { ...filters, userId, userRole });
      
      const cachedResult = await campaignsCache.get<CampaignListResponse>(cacheKey);
      if (cachedResult) {
        if (cachedResult.campaigns && Array.isArray(cachedResult.campaigns)) {
          const hasInvalidIds = cachedResult.campaigns.some((c: any) => !c.id || c.id.length !== 24);
          if (hasInvalidIds) {
            console.warn('Cache has invalid IDs, clearing cache and fetching from DB');
            await campaignsCache.delete(cacheKey);
          } else {
            return cachedResult;
          }
        } else {
          console.warn('Cache data structure invalid, clearing cache');
          await campaignsCache.delete(cacheKey);
        }
      }
      
      const mongoFilters: Partial<ICampaign> = {};
      
      if (filters.type && !['All', 'Other', 'all', 'other'].includes(String(filters.type))) {
        const filterType = String(filters.type).trim();
        if (filterType && 
            filterType.length > 0 && 
            filterType.length !== 24 && 
            !/^[0-9a-fA-F]{24}$/.test(filterType)) {
          mongoFilters.content_categories = [{ slug: filterType }];
        } else {
          console.warn('Invalid filter type, skipping content_categories filter:', filterType);
        }
      }

      const result = await CampaignModel.findWithPagination(page, limit, mongoFilters);
    
      const statusOrder: { [key: string]: number } = {
        'active': 1,
        'waiting payment': 2,
        'completed': 3
      };
      
      const campaigns = await Promise.all(
        result.campaigns.map(async (campaign) => {
          try {
            return await this.formatCampaignListResponse(campaign, userId);
          } catch (error: any) {
            console.error(`Error formatting campaign:`, {
              error: error.message,
              campaignId: campaign._id,
              campaignTitle: campaign.title
            });
          }
        })
      );
    
      let filteredCampaigns = campaigns;
      if (!userId || !userRole) {
        filteredCampaigns = campaigns.filter(campaign => {
          const originalCampaign = result.campaigns.find(c => {
            const cId = c._id?.toString?.() || String(c._id);
            return cId === campaign.id;
          });

          if (!originalCampaign) return false;

          return !originalCampaign.list_kols || originalCampaign.list_kols.length === 0;
        });
      } else {
        filteredCampaigns = campaigns.filter(campaign => {
          const originalCampaign = result.campaigns.find(c => {
            const cId = c._id?.toString?.() || String(c._id);
            return cId === campaign.id;
          });

          if (!originalCampaign) return false;

          if (originalCampaign.list_kols && originalCampaign.list_kols.length > 0) {
            if (userRole === 'HOST') {
              return originalCampaign.host_id === userId;
            } else if (userRole === 'CREATOR') {
              return originalCampaign.list_kols.some(kol => kol.userId === userId);
            } else if (userRole === 'ADMIN') {
              return true;
            }
            return false;
          }
          
          return true;
        });
      }
    
      filteredCampaigns.sort((a, b) => {
        const orderA = statusOrder[a.status] || 99;
        const orderB = statusOrder[b.status] || 99;
        
        if (orderA !== orderB) 
          return orderA - orderB;

        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
      
      const validCampaigns = filteredCampaigns.filter(c => c.id && c.id.length === 24 && /^[0-9a-fA-F]{24}$/.test(c.id));
      if (validCampaigns.length !== filteredCampaigns.length) {
        console.warn(`Some campaigns have invalid IDs. Valid: ${validCampaigns.length}, Total: ${filteredCampaigns.length}`);
      }
      
      const response: CampaignListResponse = {
        campaigns: validCampaigns,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages
      };

      if (validCampaigns.length === filteredCampaigns.length) {
        await campaignsCache.set(cacheKey, response);
      }

      return response;
    } catch (error: any) {
      console.error('Error in getAllCampaigns:', {
        error: error.message,
        stack: error.stack,
        page,
        limit,
        filters
      });
      
      const cacheKey = campaignsCache.generateCampaignsKey(page, limit, filters);
      await campaignsCache.delete(cacheKey);
      
      throw error;
    }
  }

  public async updateCampaign(campaignId: string, hostId: string, updateData: UpdateCampaignDto): Promise<CampaignResponse | null> {
    const existingCampaign = await CampaignModel.findById(campaignId);
    if (!existingCampaign || existingCampaign.host_id !== hostId) {
      throw new Error('Campaign not found or you do not have permission to edit it');
    }

    if (existingCampaign.status !== 'inactive') {
      throw new Error('Only inactive campaigns can be edited');
    }

    if (updateData.list_kols && updateData.list_kols.length === 0 && updateData.total_prize_pool && updateData.total_prize_pool < 50) {
      throw new Error(`The total_prize_pool must be at least $50. Total: $${updateData.total_prize_pool}`);
    }

    if (updateData.list_kols && updateData.list_kols.length > 0) {
      for (const kol of updateData.list_kols) {
        if (!kol.userId) {
          throw new Error('Each KOL must have a valid userId');
        }
        
        if (!updateData.is_cac && (!kol.amount || kol.amount <= 0)) {
          throw new Error('Each KOL must have a valid amount greater than 0 when is_cac is false');
        }
      }
    }

    const updateDataWithPrivate: any = {
      ...updateData
    };

    if (updateData.list_kols !== undefined) {
      updateDataWithPrivate.isPrivate = updateData.list_kols && updateData.list_kols.length > 0 ? true : false;
    }

    const updatedCampaign = await CampaignModel.updateById(campaignId, updateDataWithPrivate);
    if (!updatedCampaign) return null;

    await campaignsCache.deleteByPrefix('campaigns:all');

    return await this.formatCampaignResponse(updatedCampaign);
  }

  public async deleteCampaign(campaignId: string, hostId: string): Promise<boolean> {
    const existingCampaign = await CampaignModel.findById(campaignId);
    if (!existingCampaign || existingCampaign.host_id !== hostId) {
      throw new Error('Campaign not found or you do not have permission to delete it');
    }

    if (existingCampaign.status !== 'inactive') {
      throw new Error('Only inactive campaigns can be deleted');
    }

    const deleted = await CampaignModel.deleteById(campaignId);
    
    if (deleted) {
      //await UserModel.decrementCampaignsCreated(hostId);
      //await campaignsCache.deleteByPrefix('campaigns:all');
    }

    return deleted;
  }

  private async formatCampaignResponse(campaign: ICampaign, userId?: string): Promise<any> {
    const total_submissions = await CampaignParticipantsModel.countByCampaignId(campaign._id!.toString());
    
    const host = await UserModel.findById(campaign.host_id);
    
    let submissions_kols: string[] = [];
    let submissions_images: string[] = [];
    if (userId) {
      const participant = await CampaignParticipantsModel.findByUserAndCampaign(userId, campaign._id!.toString());
      if (participant) {
        if (participant.submissions_kols) {
          submissions_kols = participant.submissions_kols;
        }
        if (participant.submissions_images) {
          submissions_images = participant.submissions_images;
        }
      }
    }

    const isPrivate = campaign.isPrivate || (campaign.list_kols && campaign.list_kols.length > 0);
    let user_amount: number | undefined;
    if (isPrivate && userId && campaign.list_kols && campaign.list_kols.length > 0) {
      const kol = campaign.list_kols.find(k => k.userId === userId);
      user_amount = kol?.amount;
    }

    let list_kols: Array<{ userId: string; amount: number; username: string }> = (campaign.list_kols || []).map(kol => ({ ...kol, username: '' }));
    if (userId)
      list_kols = list_kols.filter(kol => kol.userId === userId);
    else
      list_kols = [];

    if (list_kols.length > 0) {
      const kolUserIds = list_kols.map(kol => kol.userId);
      const kolUsersMap = await UserModel.findByIds(kolUserIds);
      list_kols = list_kols.map(kol => ({
        ...kol,
        username: kolUsersMap.get(kol.userId)?.username ?? ''
      }));
    }

    let talent_stellar_wallet: string | null = null;
    if (campaign.list_kols && campaign.list_kols.length === 1) {
      const firstKol = campaign.list_kols[0];
      if (firstKol) {
        const talentUser = await UserModel.findById(firstKol.userId);
        talent_stellar_wallet = talentUser?.wallet_stellar ?? null;
      }
    }

    return {
      id: campaign._id!.toString(),
      host_id: campaign.host_id,
      host_username: host?.name_company || null,
      logo_company: host?.logo_company || null,
      host_categories_atuation: host?.categories_atuation || null,
      title: campaign.title,
      about_project: campaign.about_project,
      what_we_need: campaign.what_we_need,
      content_type: campaign.content_type,
      content_pillars: campaign.content_pillars,
      benefits: campaign.benefits,
      requirements: campaign.requirements,
      content_format: campaign.content_format,
      submission_format: campaign.submission_format,
      content_categories: campaign.content_categories,
      target_blockchain: campaign.target_blockchain,
      official_links: campaign.official_links,
      support_contact: campaign.support_contact,
      country: campaign.country,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      deadline: calculateDeadline(campaign.start_date, campaign.end_date),
      deadline_detailed: calculateDetailedDeadline(campaign.start_date, campaign.end_date),
      payment_chain: campaign.payment_chain,
      payment_token: campaign.payment_token,
      max_participants: campaign.max_participants,
      winner_count: campaign.winner_count,
      reward_tiers: campaign.reward_tiers,
      total_prize_pool: campaign.total_prize_pool,
      links_officials: campaign.links_officials || [],
      original_url_shortener: campaign.original_url_shortener,
      qtd_min_links: campaign.qtd_min_links,
      qtd_max_links: campaign.qtd_max_links,
      status: campaign.status,
      payment_received: campaign.payment_received,
      rewards_distributed: campaign.rewards_distributed,
      isPrivate: campaign.isPrivate || false,
      is_cac: campaign.is_cac,
      format_cac: campaign.format_cac,
      quantity_conversion: campaign.quantity_conversion,
      amount_convertion: campaign.amount_convertion,
      limit_amount_convertion: campaign.limit_amount_convertion,
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
      total_submissions,
      submissions_kols,
      submissions_images,
      list_kols,
      talent_stellar_wallet,
      ...(user_amount !== undefined && { user_amount }),
      ...(campaign.community_id && { community_id: campaign.community_id })
    };
  }

  public async toggleCampaignStatus(campaignId: string, hostId: string): Promise<CampaignResponse | null> {
    const existingCampaign = await CampaignModel.findById(campaignId);
    if (!existingCampaign || existingCampaign.host_id !== hostId) {
      throw new Error('Campaign not found or you do not have permission to change it');
    }
    
    const newStatus = existingCampaign.status === 'active' ? 'inactive' : 'active';
    
    const updatedCampaign = await CampaignModel.updateById(campaignId, { status: newStatus });
    if (!updatedCampaign) return null;

    await campaignsCache.deleteByPrefix('campaigns:all');

    return await this.formatCampaignResponse(updatedCampaign);
  }

  public async getLeaderboardSubmits(campaignId: string, hostId: string, page: number = 1, limit: number = 10): Promise<{ leaderboard: any[], format_cac?: string | undefined, total: number, page: number, limit: number, totalPages: number, chain?: string }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    
    if (campaign.host_id !== hostId) throw new Error('You do not have permission to view this campaign leaderboard');

    const totalCount = await CampaignParticipantsModel.countByCampaignId(campaignId);
    const adjustedLimit = (page === 1 && totalCount <= 20 && limit === 10) ? totalCount : limit;
    const participantsResult = await CampaignParticipantsModel.findByCampaignId(campaignId, page, adjustedLimit);
    
    const kolsByUserId = new Map<string, number>();
    if (campaign.list_kols && campaign.list_kols.length > 0) {
      campaign.list_kols.forEach(kol => {
        kolsByUserId.set(kol.userId, kol.amount || 0);
      });
    }

    const isPrivate = campaign.isPrivate || (campaign.list_kols && campaign.list_kols.length > 0);
    
    const leaderboard = [];
    const startOrder = (page - 1) * limit + 1;
    let validIndex = 0;
    
    for (let i = 0; i < participantsResult.participants.length; i++) {
      const participant = participantsResult.participants[i];
      if (participant) {
        const user = await UserModel.findById(participant.userId);
        
        if (user) {
          const kolAmount = kolsByUserId.get(participant.userId);
          const displayAmount = kolAmount !== undefined ? kolAmount : participant.amount_received;

          let paymentSignature: string | null = null;
          if (isPrivate) {
            const payments = await PaymentModel.getPaymentsByUserAndCampaign(participant.userId, campaignId);
            const confirmedPayment = payments.find(p => p.status === 'confirmed') || payments[0];
            paymentSignature = confirmedPayment?.signature ?? null;
          }
          
          const shortUrl = await ShortURLModel.findByCampaignIdAndUserId(campaignId, participant.userId);

          const entry: Record<string, any> = {
            ordem: startOrder + validIndex,
            user_id: participant.userId,
            username: user.username,
            submissions_kols: participant.submissions_kols || [],
            submission_twitter: participant.submission_twitter,
            submission_tiktok: participant.submission_tiktok,
            submission_instagram: participant.submission_instagram,
            submission_youtube: participant.submission_youtube,
            submission_feedback: participant.submission_feedback ?? '',
            amount: displayAmount || 0,
            amount_received: participant.amount_received,
            date_submit: participant.date_submit,
            views_twitter: participant?.views_twitter || 0,
            likes_twitter: participant?.likes_twitter || 0,
            retweets_twitter: participant?.retweets_twitter || 0,
            views_tiktok: participant?.views_tiktok || 0,
            views_instagram: (participant?.views_instagram || 0) + (participant?.views_instagram_story || 0),
            views_youtube: participant?.views_youtube || 0,
            clicks: shortUrl?.clicks || 0,
            chain: campaign.payment_chain ?? "",
            isPrivate: isPrivate
          };

          if (participant.submissions_images?.length) {
            entry['submissions_images'] = participant.submissions_images;
          }

          if (isPrivate) 
            entry['signature'] = paymentSignature;
          
          if (isPrivate) 
            entry['winner'] = participant.winner ?? false;

          leaderboard.push(entry);
          validIndex++;
        }
      }
    }

    return {
      leaderboard,
      format_cac: campaign.format_cac,
      total: participantsResult.total,
      page: participantsResult.page,
      limit: participantsResult.limit,
      totalPages: participantsResult.totalPages
    };
  }

  public async getUsersCampaignWinners(campaignId: string, hostId: string): Promise<{ winners: any[] }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    
    if (campaign.host_id !== hostId) throw new Error('You do not have permission to view this campaign winners');

    const collection = await CampaignParticipantsModel['getCollection']();
    const winners = await collection.find({ 
      campaignId: campaignId,
      winner: true 
    }).sort({ rank: 1 }).toArray();

    const winnerUserIds = winners.map(w => w.userId);
    const winnerUsersMap = await UserModel.findByIds(winnerUserIds);

    const winnersWithUserInfo = [];
    for (const winner of winners) {
      const user = winnerUsersMap.get(winner.userId);
      if (user) {
        const payments = await PaymentModel.getPaymentsByUserAndCampaign(winner.userId, campaignId);
        const confirmedPayment = payments.find(p => p.status === 'confirmed') || payments[0];
        const signature = confirmedPayment?.signature || null;

        winnersWithUserInfo.push({
          rank: winner.rank,
          username: user.username,
          amount_received: winner.amount_received,
          submissions_kols: winner.submissions_kols || [],
          submission_twitter: winner.submission_twitter,
          submission_tiktok: winner.submission_tiktok,
          submission_instagram: winner.submission_instagram,
          submission_youtube: winner.submission_youtube,
          submission_feedback: winner.submission_feedback ?? '',
          date_received: winner.date_received,
          signature: signature,
          chain: campaign.payment_chain
        });
      }
    }

    return { winners: winnersWithUserInfo };
  }

  public async getCampaignTiers(campaignId: string): Promise<{ reward_tiers: any[], total_prize_pool: number }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    return {
      reward_tiers: campaign.reward_tiers,
      total_prize_pool: campaign.total_prize_pool
    };
  }

  public async createCampaignWinners(campaignId: string, hostId: string, winnersData: CreateCampaignWinnersDto[]): Promise<{ message: string, winners: any[] }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    
    if (campaign.host_id !== hostId) throw new Error('You do not have permission to create winners for this campaign');

    if (campaign.winner_count != null && winnersData.length > campaign.winner_count) {
      return {
        message: 'The number of winners exceeds the winner_count of the campaign',
        winners: [] as any[]
      };
    }
    if (winnersData.length === 0)
      throw new Error('Winners data must be a non-empty array');

    const updatedWinners = [];
    for (const winnerData of winnersData) {
      const participant = await CampaignParticipantsModel.findByUserAndCampaign(winnerData.user_id, campaignId);
      if (!participant) {
        throw new Error(`Participant with user_id ${winnerData.user_id} not found in this campaign`);
      }

      let amount_received = 0;

      if (campaign.reward_tiers && campaign.reward_tiers.length > 0) {
        const rewardTier = campaign.reward_tiers.find(tier => winnerData.rank >= tier.position_initial && winnerData.rank <= tier.position_final );
        
        if (rewardTier) amount_received = rewardTier.payment_amount;
        else throw new Error(`No reward tier found for rank ${winnerData.rank}`);
      } 
      else {
        if (!campaign.total_prize_pool || campaign.total_prize_pool <= 0) {
          throw new Error('Campaign total_prize_pool is invalid or not set');
        }
        amount_received = campaign.total_prize_pool / winnersData.length;
      }

      const updatedParticipant = await CampaignParticipantsModel.updateWinnerData(
        winnerData.user_id,
        campaignId,
        {
          amount_received,
          winner: true,
          rank: winnerData.rank
        }
      );

      if (updatedParticipant) {
        const user = await UserModel.findById(winnerData.user_id);
        if (user) {
          updatedWinners.push({
            user_id: winnerData.user_id,
            username: user.username,
            rank: winnerData.rank,
            amount_received
          });
        }
      }
    }

    return {
      message: 'Campaign winners created successfully',
      winners: updatedWinners
    };
  }

  public async getProfile(hostId: string): Promise<any> {
    const user = await UserModel.findById(hostId);
    if (!user) throw new Error('User not found');
    
    if (user.user_type !== 'HOST') throw new Error('Only HOST users can access this profile');

    const campaignsResult = await CampaignModel.findWithPagination(1, 1000, { host_id: hostId });
    const campanhasFinalizadas = campaignsResult.campaigns.filter(campaign => campaign.status === 'completed' && campaign.rewards_distributed == true);
    
    const totalDistribuido = campanhasFinalizadas.reduce((total, campaign) => {
      return total + (campaign.total_prize_pool || 0);
    }, 0);

    return {
      id: user._id!.toString(),
      username: user.username,
      user_type: user.user_type,
      email: user.email,
      isActive: user.isActive,
      campaigns_created: user.campaigns_created,
      totalDistribuido,
      ...(user.discord_id && { discord_id: user.discord_id }),
      ...(user.twitter_username && { twitter_username: user.twitter_username }),
      ...(user.twitter_profile_image && { twitter_profile_image: user.twitter_profile_image }),
      ...(user.position_company && { position_company: user.position_company }),
      ...(user.telegram_username && { telegram_username: user.telegram_username }),
      ...(user.name_company && { name_company: user.name_company }),
      ...(user.website_company && { website_company: user.website_company }),
      ...(user.social_media && { social_media: user.social_media }),
      ...(user.introduction_company && { introduction_company: user.introduction_company }),
      ...(user.logo_company && { logo_company: user.logo_company }),
      ...(user.categories_atuation && { categories_atuation: user.categories_atuation })
    };
  }

  public async updateProfile(hostId: string, updateData: UpdateProfileDto): Promise<any> {
    const user = await UserModel.findById(hostId);
    if (!user) throw new Error('User not found');
    
    if (user.user_type !== 'HOST') throw new Error('Only HOST users can update this profile')
    if (updateData.logo_company && !this.isValidBase64(updateData.logo_company)) throw new Error('Company logo must be a valid base64');

    const updatedUser = await UserModel.updateHostData(hostId, updateData);
    if (!updatedUser) throw new Error('Error updating user data');

    const campaignsResult = await CampaignModel.findWithPagination(1, 1000, { host_id: hostId });
    const campanhasFinalizadas = campaignsResult.campaigns.filter(campaign => campaign.status === 'completed' && campaign.rewards_distributed == true);
    
    const totalDistribuido = campanhasFinalizadas.reduce((total, campaign) => {
      return total + (campaign.total_prize_pool || 0);
    }, 0);

    return {
      id: updatedUser._id!.toString(),
      username: updatedUser.username,
      user_type: updatedUser.user_type,
      email: updatedUser.email,
      isActive: updatedUser.isActive,
      campaigns_created: updatedUser.campaigns_created,
      totalDistribuido,
      ...(updatedUser.discord_id && { discord_id: updatedUser.discord_id }),
      ...(updatedUser.twitter_username && { twitter_username: updatedUser.twitter_username }),
      ...(updatedUser.twitter_profile_image && { twitter_profile_image: updatedUser.twitter_profile_image }),
      ...(updatedUser.position_company && { position_company: updatedUser.position_company }),
      ...(updatedUser.telegram_username && { telegram_username: updatedUser.telegram_username }),
      ...(updatedUser.name_company && { name_company: updatedUser.name_company }),
      ...(updatedUser.website_company && { website_company: updatedUser.website_company }),
      ...(updatedUser.social_media && { social_media: updatedUser.social_media }),
      ...(updatedUser.introduction_company && { introduction_company: updatedUser.introduction_company }),
      ...(updatedUser.logo_company && { logo_company: updatedUser.logo_company }),
      ...(updatedUser.categories_atuation && { categories_atuation: updatedUser.categories_atuation }),
    };
  }

  public async getCountCampaignsByHost(hostId: string): Promise<{ campaigns_progress: number, campaigns_completed: number, total_user_submiteds: number }> {
    const user = await UserModel.findById(hostId);
    if (!user) throw new Error('User not found');
    
    if (user.user_type !== 'HOST') throw new Error('Only HOST users can access this data');

    const campaignsResult = await CampaignModel.findWithPagination(1, 1000, { host_id: hostId });
    const campaigns = campaignsResult.campaigns;

    const campaigns_progress = campaigns.filter(campaign => campaign.status === 'active').length;
    const campaigns_completed = campaigns.filter(campaign => campaign.status === 'completed').length;

    let total_user_submiteds = 0;
    for (const campaign of campaigns) {
      const submissionsCount = await CampaignParticipantsModel.countByCampaignId(campaign._id!.toString());
      total_user_submiteds += submissionsCount;
    }

    return {
      campaigns_progress,
      campaigns_completed,
      total_user_submiteds
    };
  }

  // Private
  private async formatCampaignListResponse(campaign: ICampaign | any, userId?: string): Promise<any> {
    if (campaign.id && !campaign._id) return campaign;
    if (!campaign._id) throw new Error('Campaign ID is missing');

    let campaignId: string;
    try {
      if (typeof campaign._id === 'string') {
        campaignId = campaign._id;
      } else if (campaign._id && typeof campaign._id.toString === 'function') {
        campaignId = campaign._id.toString();
      } else if (campaign._id && typeof campaign._id === 'object') {
        campaignId = (campaign._id as any)?.$oid || 
                     (campaign._id as any)?.toString?.() || 
                     String(campaign._id);
      } else {
        campaignId = String(campaign._id);
      }
      
      campaignId = campaignId.trim();
      
      if (!campaignId || campaignId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(campaignId)) {
        throw new Error(`Invalid campaign ID format: ${campaignId}`);
      }
    } catch (error: any) {
      throw new Error(`Error converting campaign ID: ${error.message}`);
    }

    let total_submissions = 0;
    try {
      total_submissions = await CampaignParticipantsModel.countByCampaignId(campaignId);
    } catch (error: any) {
      total_submissions = 0;
    }

    const host = await UserModel.findById(campaign.host_id);

    const isPrivate = campaign.isPrivate || (campaign.list_kols && campaign.list_kols.length > 0);
    let user_amount: number | undefined;
    if (isPrivate && userId && campaign.list_kols && campaign.list_kols.length > 0) {
      const kol = campaign.list_kols.find((k: { userId: string }) => k.userId === userId);
      user_amount = kol?.amount;
    }
    
    return {
      id: campaignId,
      title: campaign.title,
      about_project: campaign.about_project,
      status: campaign.status,
      total_prize_pool: campaign.total_prize_pool,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      deadline: calculateDeadline(campaign.start_date, campaign.end_date),
      deadline_detailed: calculateDetailedDeadline(campaign.start_date, campaign.end_date),
      content_categories: campaign.content_categories,
      total_submissions,
      created_at: campaign.created_at,
      country: campaign.country,
      name_company: host?.name_company || "",
      logo_company: host?.logo_company || "",
      isPrivate: campaign.isPrivate || (campaign.list_kols && campaign.list_kols.length > 0) || false,
      is_cac: campaign.is_cac,
      payment_token: campaign.payment_token ?? '',
      ...(user_amount !== undefined && { user_amount }),
    };
  }

  private isValidBase64(str: string): boolean {
    try {
      const base64Regex = /^data:image\/(png|jpg|jpeg);base64,/;
      if (base64Regex.test(str)) {
        const base64Data = str.split(',')[1];
        if (!base64Data) return false;
        return btoa(atob(base64Data)) === base64Data;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async finishCampaign(campaignId: string, hostId: string): Promise<void> {
    const existingCampaign = await CampaignModel.findById(campaignId);
    if (!existingCampaign || existingCampaign.host_id !== hostId)
      throw new Error('Campaign not found or you do not have permission to finish it');
    
    if (existingCampaign.status === 'completed' || existingCampaign.status === 'waiting payment') 
      throw new Error('Campaign is already completed or waiting for payment');
    
    await CampaignModel.updateById(campaignId, { status: 'completed' });
    
    await campaignsCache.deleteByPrefix('campaigns:all');
  }

  public async generateMindshare(campaignId: string, hostId: string): Promise<IRankEntry[]> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.host_id !== hostId) throw new Error('You do not have permission to access this campaign');

    // Generate ranking using TwitterService (includes all metrics)
    const { TwitterService } = await import('./social_medias/TwitterService');
    const twitterService = new TwitterService();
    const generatedRanking = await twitterService.generateMindshare(campaignId, hostId);
    //Twitter service retorna as infos necessárias para o ranking
    //Antes ele só gerava o ranking, e nessa função havia um for que passava por todos creators e fazia um refetch para pegar as infos e Ids (gerando um O(n^2))
    // Save to suggestion model
    const { CampaignSugestionBountiesRankModel } = await import('../models/CampaignSugestionBountiesRank');
    await CampaignSugestionBountiesRankModel.updateByCampaignId(campaignId, generatedRanking);

    return generatedRanking;
  }

  public async getInfoPostTwitterCreator(userId: string, campaignId?: string): Promise<{
    views_twitter: number;
    replies_twitter: number;
    retweets_twitter: number;
    quotes_twitter: number;
    bookmarks_twitter: number;
    likes_twitter: number;
    submission_twitter: string;
    submission_feedback: string;
  }> {
    const collection = await CampaignParticipantsModel['getCollection']();
    const query: any = {
      userId: userId,
      submission_twitter: { $exists: true, $ne: '' }
    };

    if (campaignId) {
      query.campaignId = campaignId;
    }

    const participants = await collection.find(query).toArray();

    let submissionTwitterLink = '';
    let submissionFeedbackLink = '';
    const aggregatedMetrics = participants.reduce((acc, participant) => {
      if (!submissionTwitterLink && participant.submission_twitter && participant.submission_twitter.trim() !== '') {
        submissionTwitterLink = participant.submission_twitter;
      }
      if (!submissionFeedbackLink && participant.submission_feedback && participant.submission_feedback.trim() !== '') {
        submissionFeedbackLink = participant.submission_feedback;
      }
      acc.views_twitter += participant.views_twitter || 0;
      acc.replies_twitter += participant.replies_twitter || 0;
      acc.retweets_twitter += participant.retweets_twitter || 0;
      acc.quotes_twitter += participant.quotes_twitter || 0;
      acc.bookmarks_twitter += participant.bookmarks_twitter || 0;
      acc.likes_twitter += participant.likes_twitter || 0;
      return acc;
    }, {
      views_twitter: 0,
      replies_twitter: 0,
      retweets_twitter: 0,
      quotes_twitter: 0,
      bookmarks_twitter: 0,
      likes_twitter: 0
    });

    return {
      ...aggregatedMetrics,
      submission_twitter: submissionTwitterLink,
      submission_feedback: submissionFeedbackLink
    };
  }

  public async getActiveAccountHost(hostId: string): Promise<{ active_account_host: boolean }> {
    const user = await UserModel.findById(hostId);
    if (!user) throw new Error('User not found');
    
    return {
      active_account_host: user.active_account_host || false
    };
  }

  public async resendVerificationCode(email: string): Promise<{ message: string }> {
    const user = await UserModel.findByEmail(email);
    if (!user) throw new Error('User not found');
    
    if (user.user_type !== 'HOST') throw new Error('Only HOST users can resend verification codes');
    
    if (!user.email) throw new Error('User email not found');
    
    if (user.email_verified) throw new Error('Email is already verified');

    const code = generateVerificationCode();
    
    await EmailVerificationCodeModel.invalidateEmailCodes(email);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    await EmailVerificationCodeModel.create({
      user_id: user._id!.toString(),
      email: email.toLowerCase(),
      code: code,
      expires_at: expiresAt,
      verified: false
    });
    
    const emailService = new EmailService();
    await emailService.sendVerificationCode(email.toLowerCase(), code);
    
    return {
      message: 'Verification code sent successfully'
    };
  }

  public async validateEmailCode(email: string, code: string): Promise<{ message: string; email_verified: boolean }> {
    const user = await UserModel.findByEmail(email);
    if (!user) throw new Error('User not found');
    
    if (user.user_type !== 'HOST') throw new Error('Only HOST users can validate email codes');
    
    if (!user.email) throw new Error('User email not found');
    
    if (user.email_verified) {
      return {
        message: 'Email is already verified',
        email_verified: true
      };
    }

    const verificationCode = await EmailVerificationCodeModel.findByEmailAndCode(email, code);
    
    if (!verificationCode) {
      throw new Error('Invalid or expired verification code');
    }
    
    await EmailVerificationCodeModel.markAsVerifiedByEmail(email, code);
    
    await UserModel.updateById(user._id!.toString(), { email_verified: true, active_account_host: true, isActive: true });
    
    return {
      message: 'Email verified successfully',
      email_verified: true
    };
  }

  public async fixedCommentHost(commentId: string, hostId: string, is_fixed: boolean): Promise<{ message: string }> {
    const comment = await UserCommentCampaignModel.findById(commentId);
    if (!comment) throw new Error('Comment not found');

    const campaign = await CampaignModel.findById(comment.campaignId);
    if (!campaign) throw new Error('Campaign not found');

    if (campaign.host_id !== hostId) {
      throw new Error('You do not have permission to update this comment');
    }

    await UserCommentCampaignModel.updateById(commentId, { is_fixed });

    return {
      message: 'Comment fixed status updated successfully'
    };
  }

  public async isParabuildersHost(hostId: string): Promise<boolean> {
    const PARABUILDERS_HOST_ID = '691f8e7b70fa2866f6ec97e7';
    return hostId === PARABUILDERS_HOST_ID;
  }

  public async getKols(
    usernameFilter?: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    kols: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10;

    const result = await UserModel.findByUserTypeWithPagination(
      'CREATOR',
      page,
      limit,
      usernameFilter
    );

    const kols = result.users.map(user => ({
      id: user._id!.toString(),
      username: user.username || user.twitter_username || user.google_name || '',
      twitter_profile_image: user.twitter_profile_image || null
    }));

    return {
      kols,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages
      }
    };
  }

  public async getCampaignMetricsSummary(campaignId: string, hostId: string): Promise<{
    title: string;
    campaign_platforms: HostSocialPlatform[];
    total_posts: number;
    total_submissions: number; // creators count
    total_likes: number;
    total_views: number;
    total_replies: number;
    total_retweets: number;
    total_quotes: number;
    total_bookmarks: number;
    post_kols: Array<{
      user_id: string;
      username: string;
      total_submissions: number; // links count (for platforms involved)
      total_likes: number;
      total_views: number;
      total_replies: number;
      total_retweets: number;
      total_bookmarks: number;
      instagram_story: {
        views: number;
        likes: number;
        retweets: number;
        replies: number;
      };
    }>;
  }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.host_id !== hostId) throw new Error('You do not have permission to view this campaign');

    const campaignPlatforms = normalizeCampaignPlatforms(campaign.submission_format);
    const platformSet = new Set(campaignPlatforms);

    const participantsResult = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, MAX_PARTICIPANTS_LIMIT);
    const participants = participantsResult.participants;

    let total_posts = 0;
    let total_likes = 0;
    let total_views = 0;
    let total_replies = 0;
    let total_retweets = 0;
    let total_quotes = 0;
    let total_bookmarks = 0;

    const metricsUserIds = participants.map((p) => p.userId);
    const metricsUsersMap = await UserModel.findByIds(metricsUserIds);

    const post_kols = participants.map((p) => {
      const user = metricsUsersMap.get(p.userId);

      const linksByPlatform: Record<HostSocialPlatform, number> = {
        twitter: 0,
        tiktok: 0,
        instagram: 0,
        youtube: 0,
      };

      const submissionsByPl = (pl: HostSocialPlatform) => {
        const raw = (p as any)[`submission_${pl}`];
        if (typeof raw === 'string' && raw.trim()) linksByPlatform[pl] += 1;
      };

      for (const pl of campaignPlatforms) submissionsByPl(pl);

      let unknownLinks = 0;
      for (const url of p.submissions_kols ?? []) {
        const detected = detectUrlPlatform(url);
        if (detected && platformSet.has(detected)) linksByPlatform[detected] += 1;
        else if (!detected) unknownLinks += 1;
      }

      const total_submissions = campaignPlatforms.reduce((acc, pl) => acc + linksByPlatform[pl], 0) + unknownLinks;

      let total_likesCreator = 0;
      let total_viewsCreator = 0;
      let total_repliesCreator = 0;
      let total_retweetsCreator = 0;
      let total_quotesCreator = 0;
      let total_bookmarksCreator = 0;

      for (const pl of campaignPlatforms) {
        const pv = getPlatformValue(p, pl);
        total_likesCreator += pv.likes;
        total_viewsCreator += pv.views;
        total_repliesCreator += pv.replies;
        total_retweetsCreator += pv.retweets;
        total_quotesCreator += pv.quotes;
        total_bookmarksCreator += pv.bookmarks;
      }

      total_posts += total_submissions;
      total_likes += total_likesCreator;
      total_views += total_viewsCreator;
      total_replies += total_repliesCreator;
      total_retweets += total_retweetsCreator;
      total_quotes += total_quotesCreator;
      total_bookmarks += total_bookmarksCreator;

      return {
        user_id: p.userId,
        username: user?.username || '',
        total_submissions,
        total_likes: total_likesCreator,
        total_views: total_viewsCreator,
        total_replies: total_repliesCreator,
        total_retweets: total_retweetsCreator,
        total_bookmarks: total_bookmarksCreator,
        instagram_story: {
          views: p.views_instagram_story ?? 0,
          likes: p.likes_instagram_story ?? 0,
          retweets: p.retweets_instagram_story ?? 0,
          replies: p.replies_instagram_story ?? 0,
        },
      };
    });

    return {
      title: campaign.title,
      campaign_platforms: campaignPlatforms,
      total_posts,
      total_submissions: participants.length,
      total_likes,
      total_views,
      total_replies,
      total_retweets,
      total_quotes,
      total_bookmarks,
      post_kols,
    };
  }

  public async getCampaignMetricsPlatforms(campaignId: string, hostId: string): Promise<{
    title: string;
    campaign_platforms: HostSocialPlatform[];
    total_posts: number;
    total_submissions: number; // creators count
    total_likes: number;
    total_views: number;
    total_replies: number;
    total_retweets: number;
    total_quotes: number;
    total_bookmarks: number;
    post_kols: Array<{
      user_id: string;
      username: string;
      total_submissions: number; // links count (for platforms involved)
      total_likes: number;
      total_views: number;
      total_replies: number;
      total_retweets: number;
      total_bookmarks: number;
      instagram_story: {
        views: number;
        likes: number;
        retweets: number;
        replies: number;
      };
      platform_metrics: Partial<
        Record<
          HostSocialPlatform,
          {
            link_count: number;
            likes: number;
            views: number;
            replies: number;
            retweets: number;
            bookmarks: number;
            quotes: number;
          }
        >
      >;
    }>;
  }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.host_id !== hostId) throw new Error('You do not have permission to view this campaign');

    const campaignPlatforms = normalizeCampaignPlatforms(campaign.submission_format);
    const platformSet = new Set(campaignPlatforms);

    const participantsResult = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, MAX_PARTICIPANTS_LIMIT);
    const participants = participantsResult.participants;

    let total_posts = 0;
    let total_likes = 0;
    let total_views = 0;
    let total_replies = 0;
    let total_retweets = 0;
    let total_quotes = 0;
    let total_bookmarks = 0;

    const metricsUserIds = participants.map((p) => p.userId);
    const metricsUsersMap = await UserModel.findByIds(metricsUserIds);

    const post_kols = participants.map((p) => {
      const user = metricsUsersMap.get(p.userId);

      const linksByPlatform: Record<HostSocialPlatform, number> = {
        twitter: 0,
        tiktok: 0,
        instagram: 0,
        youtube: 0,
      };

      for (const pl of campaignPlatforms) {
        const raw = (p as any)[`submission_${pl}`];
        if (typeof raw === 'string' && raw.trim()) linksByPlatform[pl] += 1;
      }

      let unknownLinks = 0;
      for (const url of p.submissions_kols ?? []) {
        const detected = detectUrlPlatform(url);
        if (detected && platformSet.has(detected)) linksByPlatform[detected] += 1;
        else if (!detected) unknownLinks += 1;
      }

      const total_submissions =
        campaignPlatforms.reduce((acc, pl) => acc + linksByPlatform[pl], 0) + unknownLinks;

      const platform_metrics: Partial<
        Record<
          HostSocialPlatform,
          {
            link_count: number;
            likes: number;
            views: number;
            replies: number;
            retweets: number;
            bookmarks: number;
            quotes: number;
          }
        >
      > = {};

      let total_likesCreator = 0;
      let total_viewsCreator = 0;
      let total_repliesCreator = 0;
      let total_retweetsCreator = 0;
      let total_quotesCreator = 0;
      let total_bookmarksCreator = 0;

      for (const pl of campaignPlatforms) {
        const pv = getPlatformValue(p, pl);
        platform_metrics[pl] = {
          link_count: linksByPlatform[pl],
          likes: pv.likes,
          views: pv.views,
          replies: pv.replies,
          retweets: pv.retweets,
          bookmarks: pv.bookmarks,
          quotes: pv.quotes,
        };

        total_likesCreator += pv.likes;
        total_viewsCreator += pv.views;
        total_repliesCreator += pv.replies;
        total_retweetsCreator += pv.retweets;
        total_quotesCreator += pv.quotes;
        total_bookmarksCreator += pv.bookmarks;
      }

      total_posts += total_submissions;
      total_likes += total_likesCreator;
      total_views += total_viewsCreator;
      total_replies += total_repliesCreator;
      total_retweets += total_retweetsCreator;
      total_quotes += total_quotesCreator;
      total_bookmarks += total_bookmarksCreator;

      return {
        user_id: p.userId,
        username: user?.username || '',
        total_submissions,
        total_likes: total_likesCreator,
        total_views: total_viewsCreator,
        total_replies: total_repliesCreator,
        total_retweets: total_retweetsCreator,
        total_bookmarks: total_bookmarksCreator,
        instagram_story: {
          views: p.views_instagram_story ?? 0,
          likes: p.likes_instagram_story ?? 0,
          retweets: p.retweets_instagram_story ?? 0,
          replies: p.replies_instagram_story ?? 0,
        },
        platform_metrics,
      };
    });

    return {
      title: campaign.title,
      campaign_platforms: campaignPlatforms,
      total_posts,
      total_submissions: participants.length,
      total_likes,
      total_views,
      total_replies,
      total_retweets,
      total_quotes,
      total_bookmarks,
      post_kols,
    };
  }

  public async getCampaignMetrics(campaignId: string, hostId: string): Promise<{
    title: string;
    total_posts: number;
    total_submissions: number;
    total_likes: number;
    total_views: number;
    total_replies: number;
    total_retweets: number;
    total_quotes: number;
    total_bookmarks: number;
    post_kols: Array<{
      user_id: string;
      username: string;
      total_submissions: number;
      total_likes: number;
      total_views: number;
      total_replies: number;
      total_retweets: number;
      total_bookmarks: number;
      submissions: string[];
      submissions_images?: string[];
      instagram_story: {
        views: number;
        likes: number;
        retweets: number;
        replies: number;
      };
    }>;
  }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    if (campaign.host_id !== hostId) {
      throw new Error('You do not have permission to view this campaign');
    }

    const participantsResult = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, MAX_PARTICIPANTS_LIMIT);
    const participants = participantsResult.participants;

    let total_posts = 0;
    let total_likes = 0;
    let total_views = 0;
    let total_replies = 0;
    let total_retweets = 0;
    let total_quotes = 0;
    let total_bookmarks = 0;

    for (const p of participants) {
      const submissionCount = [p.submission_twitter, p.submission_tiktok, p.submission_instagram, p.submission_youtube]
        .filter(s => s && s.trim() !== '').length
        + (p.submissions_kols?.length || 0);
      total_posts += submissionCount;
      // Incluir métricas manuais de Instagram Story no consolidado do Instagram
      total_likes +=
        (p.likes_twitter || 0) +
        (p.likes_tiktok || 0) +
        (p.likes_instagram || 0) +
        (p.likes_instagram_story || 0) +
        (p.likes_youtube || 0);
      total_views +=
        (p.views_twitter || 0) +
        (p.views_tiktok || 0) +
        (p.views_instagram || 0) +
        (p.views_instagram_story || 0) +
        (p.views_youtube || 0);
      total_replies +=
        (p.replies_twitter || 0) +
        (p.replies_tiktok || 0) +
        (p.replies_instagram || 0) +
        (p.replies_instagram_story || 0) +
        (p.replies_youtube || 0);
      total_retweets +=
        (p.retweets_twitter || 0) +
        (p.retweets_tiktok || 0) +
        (p.retweets_instagram || 0) +
        (p.retweets_instagram_story || 0) +
        (p.retweets_youtube || 0);
      total_quotes += (p.quotes_twitter || 0) + (p.quotes_tiktok || 0) + (p.quotes_instagram || 0) + (p.quotes_youtube || 0);
      total_bookmarks += (p.bookmarks_twitter || 0) + (p.bookmarks_tiktok || 0) + (p.bookmarks_instagram || 0) + (p.bookmarks_youtube || 0);
    }

    const metricsUserIds = participants.map(p => p.userId);
    const metricsUsersMap = await UserModel.findByIds(metricsUserIds);

    const post_kols = participants.map(p => {
      const user = metricsUsersMap.get(p.userId);
      const submissions: string[] = [];
      if (p.submission_twitter) submissions.push(p.submission_twitter);
      if (p.submission_tiktok) submissions.push(p.submission_tiktok);
      if (p.submission_instagram) submissions.push(p.submission_instagram);
      if (p.submission_youtube) submissions.push(p.submission_youtube);
      if (p.submissions_kols?.length) submissions.push(...p.submissions_kols);

      return {
        user_id: p.userId,
        username: user?.username || '',
        total_submissions: submissions.length,
        total_likes:
          (p.likes_twitter || 0) +
          (p.likes_tiktok || 0) +
          (p.likes_instagram || 0) +
          (p.likes_instagram_story || 0) +
          (p.likes_youtube || 0),
        total_views:
          (p.views_twitter || 0) +
          (p.views_tiktok || 0) +
          (p.views_instagram || 0) +
          (p.views_instagram_story || 0) +
          (p.views_youtube || 0),
        total_replies:
          (p.replies_twitter || 0) +
          (p.replies_tiktok || 0) +
          (p.replies_instagram || 0) +
          (p.replies_instagram_story || 0) +
          (p.replies_youtube || 0),
        total_retweets:
          (p.retweets_twitter || 0) +
          (p.retweets_tiktok || 0) +
          (p.retweets_instagram || 0) +
          (p.retweets_instagram_story || 0) +
          (p.retweets_youtube || 0),
        total_bookmarks: (p.bookmarks_twitter || 0) + (p.bookmarks_tiktok || 0) + (p.bookmarks_instagram || 0) + (p.bookmarks_youtube || 0),
        submissions,
        ...(p.submissions_images?.length ? { submissions_images: p.submissions_images } : {}),
        instagram_story: {
          views: p.views_instagram_story ?? 0,
          likes: p.likes_instagram_story ?? 0,
          retweets: p.retweets_instagram_story ?? 0,
          replies: p.replies_instagram_story ?? 0,
        },
      };
    });

    post_kols.sort((a, b) => b.total_views - a.total_views);

    return {
      title: campaign.title,
      total_posts,
      total_submissions: participants.length,
      total_likes,
      total_views,
      total_replies,
      total_retweets,
      total_quotes,
      total_bookmarks,
      post_kols,
    };
  }
}
