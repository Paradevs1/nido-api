import { CampaignModel, ICampaign } from '../models/Campaign';
import { UserModel, UserAccountStatus } from '../models/User';
import { CampaignParticipantsModel, type ICampaignParticipants } from '../models/CampaignParticipants';
import { TwitterService } from './social_medias/TwitterService';
import { InstagramService } from './social_medias/InstagramService';
import { TiktokService } from './social_medias/TiktokService';
import { YoutubeService } from './social_medias/YoutubeService';
import { PaymentModel } from '../models/Payment';
import { PaymentHostModel } from '../models/PaymentHost';
import { PaymentRefundModel } from '../models/PaymentRefund';
import { PlanPaymentModel } from '../models/PlanPayment';
import { PlanModel } from '../models/Plan';
import { ShortURLModel } from '../models/EncurtadorURL';
import { CreateCampaignDto, UpdateCampaignDto, CampaignResponse, CampaignListResponse } from '../dtos/campaign.dto';
import { AdminPaymentsListResponse, AdminPaymentItem } from '../dtos/admin.dto';
import { calculateDeadline, calculateDetailedDeadline } from '../utils/dateUtils';
import { campaignsCache } from '../utils/cache';
import { MAX_PARTICIPANTS_LIMIT, MAX_EXPORT_LIMIT } from '../utils/consts';
import ExcelJS from 'exceljs';
import type { Document } from 'mongodb';

type AdminSocialPlatform = 'twitter' | 'tiktok' | 'instagram' | 'youtube';

function adminDetectUrlPlatform(url: string): AdminSocialPlatform | 'unknown' {
  const u = String(url).trim();
  if (!u) return 'unknown';
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
    /* invalid URL */
  }
  if (/twitter\.com|(^|\.)x\.com\b/i.test(lower)) return 'twitter';
  if (/instagram\.com|instagr\.am/i.test(lower)) return 'instagram';
  if (/tiktok\.com/i.test(lower)) return 'tiktok';
  if (/youtube\.com|youtu\.be/i.test(lower)) return 'youtube';
  return 'unknown';
}

/** Plataformas sociais da campanha (submission_format); se vazio no DB, assume todas. */
function adminNormalizeCampaignPlatforms(sf: { type: string }[] | undefined): AdminSocialPlatform[] {
  const allowed: AdminSocialPlatform[] = ['twitter', 'tiktok', 'instagram', 'youtube'];
  const types = (sf ?? [])
    .map((s) => s?.type)
    .filter((t): t is AdminSocialPlatform => typeof t === 'string' && (allowed as string[]).includes(t));
  const unique: AdminSocialPlatform[] = [];
  for (const t of types) {
    if (!unique.includes(t)) unique.push(t);
  }
  if (unique.length > 0) return unique;
  return [...allowed];
}

function adminPlatformSlice(p: ICampaignParticipants, pl: AdminSocialPlatform) {
  const raw = p[`submission_${pl}` as keyof ICampaignParticipants];
  const submission_url = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  const likesBase = Number(p[`likes_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
  const viewsBase = Number(p[`views_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
  const repliesBase = Number(p[`replies_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
  const retweetsBase = Number(p[`retweets_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
  // Instagram Story manual fica em `*_instagram_story` e precisa aparecer na visão "Instagram" da campanha.
  const likesStory = pl === 'instagram' ? Number(p.likes_instagram_story ?? 0) || 0 : 0;
  const viewsStory = pl === 'instagram' ? Number(p.views_instagram_story ?? 0) || 0 : 0;
  const repliesStory = pl === 'instagram' ? Number(p.replies_instagram_story ?? 0) || 0 : 0;
  const retweetsStory = pl === 'instagram' ? Number(p.retweets_instagram_story ?? 0) || 0 : 0;
  return {
    submission_url,
    likes: likesBase + likesStory,
    views: viewsBase + viewsStory,
    replies: repliesBase + repliesStory,
    retweets: retweetsBase + retweetsStory,
    bookmarks: Number(p[`bookmarks_${pl}` as keyof ICampaignParticipants] ?? 0) || 0,
    quotes: Number(p[`quotes_${pl}` as keyof ICampaignParticipants] ?? 0) || 0,
  };
}

function adminCountFilteredLinks(p: ICampaignParticipants, platforms: AdminSocialPlatform[]): number {
  let n = 0;
  for (const pl of platforms) {
    const raw = p[`submission_${pl}` as keyof ICampaignParticipants];
    if (typeof raw === 'string' && raw.trim()) n++;
  }
  for (const url of p.submissions_kols ?? []) {
    const d = adminDetectUrlPlatform(url);
    if (d !== 'unknown' && platforms.includes(d)) n++;
  }
  return n;
}

function adminSumMetricsFiltered(p: ICampaignParticipants, platforms: AdminSocialPlatform[]) {
  let likes = 0;
  let views = 0;
  let replies = 0;
  let retweets = 0;
  let bookmarks = 0;
  let quotes = 0;
  for (const pl of platforms) {
    let likesP = Number(p[`likes_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
    let viewsP = Number(p[`views_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
    let repliesP = Number(p[`replies_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
    let retweetsP = Number(p[`retweets_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
    if (pl === 'instagram') {
      likesP += Number(p.likes_instagram_story ?? 0) || 0;
      viewsP += Number(p.views_instagram_story ?? 0) || 0;
      repliesP += Number(p.replies_instagram_story ?? 0) || 0;
      retweetsP += Number(p.retweets_instagram_story ?? 0) || 0;
    }
    likes += likesP;
    views += viewsP;
    replies += repliesP;
    retweets += retweetsP;
    bookmarks += Number(p[`bookmarks_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
    quotes += Number(p[`quotes_${pl}` as keyof ICampaignParticipants] ?? 0) || 0;
  }
  return { likes, views, replies, retweets, bookmarks, quotes };
}

export class AdminService {
  public async toggleCampaignStatus(campaignId: string): Promise<CampaignResponse | null> {
    const existingCampaign = await CampaignModel.findById(campaignId);
    if (!existingCampaign) {
      throw new Error('Campaign not found');
    }
    
    if (existingCampaign.status === 'completed' || existingCampaign.status === 'waiting payment') 
      throw new Error('Cannot change status of completed or waiting payment campaign');
    
    const newStatus = 'active'; //existingCampaign.status === 'active' ? 'inactive' : 'active';
    const updatedCampaign = await CampaignModel.updateById(campaignId, { 
      status: newStatus,
      payment_received: true
    });
    if (!updatedCampaign) return null;

    await campaignsCache.deleteByPrefix('campaigns:all');

    return await this.formatCampaignResponse(updatedCampaign);
  }

  public async getCampaignStats(campaignId: string): Promise<{
    views_twitter: number;
    likes_twitter: number;
    retweets_twitter: number;
    replies_twitter: number;
    total_submissions: number;
    winners: Array<{ username: string; amount_received: number }>;
  }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Buscar todos os participantes da campanha
    const participantsResult = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, MAX_PARTICIPANTS_LIMIT);
    const participants = participantsResult.participants;

    // Contar total de submissões
    const total_submissions = await CampaignParticipantsModel.countByCampaignId(campaignId);

    // Agregar totais de métricas do Twitter
    const totals = participants.reduce((acc, participant) => {
      acc.views_twitter += participant.views_twitter || 0;
      acc.likes_twitter += participant.likes_twitter || 0;
      acc.retweets_twitter += participant.retweets_twitter || 0;
      acc.replies_twitter += participant.replies_twitter || 0;
      return acc;
    }, {
      views_twitter: 0,
      likes_twitter: 0,
      retweets_twitter: 0,
      replies_twitter: 0
    });

    // Buscar vencedores com username e amount_received
    const winners = await CampaignParticipantsModel.findWinnersByCampaignId(campaignId);
    const winnerUserIds = winners.map(w => w.userId);
    const winnerUsersMap = await UserModel.findByIds(winnerUserIds);

    const validWinners = winners
      .map(winner => {
        const user = winnerUsersMap.get(winner.userId);
        if (!user || !user.username) return null;
        return { username: user.username, amount_received: winner.amount_received || 0 };
      })
      .filter((w): w is { username: string; amount_received: number } => w !== null);

    return {
      views_twitter: totals.views_twitter,
      likes_twitter: totals.likes_twitter,
      retweets_twitter: totals.retweets_twitter,
      replies_twitter: totals.replies_twitter,
      total_submissions,
      winners: validWinners
    };
  }

  public async getCampaignMetrics(campaignId: string): Promise<Record<string, unknown>> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const campaign_platforms = adminNormalizeCampaignPlatforms(campaign.submission_format);

    const participantsResult = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, MAX_PARTICIPANTS_LIMIT);
    const participants = participantsResult.participants;

    let total_posts = 0;
    let total_likes = 0;
    let total_views = 0;
    let total_replies = 0;
    let total_retweets = 0;
    let total_quotes = 0;
    let total_bookmarks = 0;

    let filtered_posts = 0;
    let filtered_likes = 0;
    let filtered_views = 0;
    let filtered_replies = 0;
    let filtered_retweets = 0;
    let filtered_quotes = 0;
    let filtered_bookmarks = 0;

    for (const p of participants) {
      const submissionCount =
        [p.submission_twitter, p.submission_tiktok, p.submission_instagram, p.submission_youtube].filter(
          (s) => s && s.trim() !== ''
        ).length + (p.submissions_kols?.length || 0);
      total_posts += submissionCount;
      total_likes += (p.likes_twitter || 0) + (p.likes_tiktok || 0) + (p.likes_instagram || 0) + (p.likes_instagram_story || 0) + (p.likes_youtube || 0);
      total_views += (p.views_twitter || 0) + (p.views_tiktok || 0) + (p.views_instagram || 0) + (p.views_instagram_story || 0) + (p.views_youtube || 0);
      total_replies += (p.replies_twitter || 0) + (p.replies_tiktok || 0) + (p.replies_instagram || 0) + (p.replies_instagram_story || 0) + (p.replies_youtube || 0);
      total_retweets += (p.retweets_twitter || 0) + (p.retweets_tiktok || 0) + (p.retweets_instagram || 0) + (p.retweets_instagram_story || 0) + (p.retweets_youtube || 0);
      total_quotes += (p.quotes_twitter || 0) + (p.quotes_tiktok || 0) + (p.quotes_instagram || 0) + (p.quotes_youtube || 0);
      total_bookmarks += (p.bookmarks_twitter || 0) + (p.bookmarks_tiktok || 0) + (p.bookmarks_instagram || 0) + (p.bookmarks_youtube || 0);

      filtered_posts += adminCountFilteredLinks(p, campaign_platforms);
      const fm = adminSumMetricsFiltered(p, campaign_platforms);
      filtered_likes += fm.likes;
      filtered_views += fm.views;
      filtered_replies += fm.replies;
      filtered_retweets += fm.retweets;
      filtered_quotes += fm.quotes;
      filtered_bookmarks += fm.bookmarks;
    }

    const participantUserIds = participants.map((p) => p.userId);
    const participantUsersMap = await UserModel.findByIds(participantUserIds);

    const post_kols = participants.map((p) => {
      const user = participantUsersMap.get(p.userId);
      const submissions: string[] = [];
      if (p.submission_twitter) submissions.push(p.submission_twitter);
      if (p.submission_tiktok) submissions.push(p.submission_tiktok);
      if (p.submission_instagram) submissions.push(p.submission_instagram);
      if (p.submission_youtube) submissions.push(p.submission_youtube);
      if (p.submissions_kols?.length) submissions.push(...p.submissions_kols);

      const fm = adminSumMetricsFiltered(p, campaign_platforms);
      const kols_extra_links = (p.submissions_kols ?? []).map((url) => ({
        url,
        detected: adminDetectUrlPlatform(url),
      }));

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
        platform_metrics: {
          twitter: adminPlatformSlice(p, 'twitter'),
          tiktok: adminPlatformSlice(p, 'tiktok'),
          instagram: adminPlatformSlice(p, 'instagram'),
          youtube: adminPlatformSlice(p, 'youtube'),
        },
        kols_extra_links,
        filtered_row: {
          link_count: adminCountFilteredLinks(p, campaign_platforms),
          ...fm,
        },
      };
    });

    post_kols.sort((a, b) => b.total_views - a.total_views);

    const host = await UserModel.findById(campaign.host_id);

    return {
      title: campaign.title,
      host: host ? {
        id: host._id!.toString(),
        username: host.username,
        name_company: host.name_company,
        email: host.email,
      } : undefined,
      campaign_platforms,
      total_posts,
      total_submissions: participants.length,
      total_likes,
      total_views,
      total_replies,
      total_retweets,
      total_quotes,
      total_bookmarks,
      filtered_totals: {
        total_posts: filtered_posts,
        total_likes: filtered_likes,
        total_views: filtered_views,
        total_replies: filtered_replies,
        total_retweets: filtered_retweets,
        total_quotes: filtered_quotes,
        total_bookmarks: filtered_bookmarks,
      },
      post_kols,
    };
  }

  public async getCreatorsList(
    page: number = 1,
    limit: number = 50,
    twitterUsernameFilter?: string,
    sortBy?: 'followers' | 'earnings',
    sortOrder?: 'asc' | 'desc'
  ): Promise<{ creators: Array<{ id?: string; isActive?: boolean; twitter_username?: string; twitter_followers_count?: number; total_earnings?: number; wallet_evm?: string; wallet_sui?: string; wallet_sol?: string; wallet_stellar?: string }>; total: number; page: number; totalPages: number }> {
    let creatorListSort: 'followers_asc' | 'followers_desc' | 'earnings_asc' | 'earnings_desc' | undefined;
    if (sortBy === 'followers' && (sortOrder === 'asc' || sortOrder === 'desc')) {
      creatorListSort = sortOrder === 'asc' ? 'followers_asc' : 'followers_desc';
    } else if (sortBy === 'earnings' && (sortOrder === 'asc' || sortOrder === 'desc')) {
      creatorListSort = sortOrder === 'asc' ? 'earnings_asc' : 'earnings_desc';
    }
    const result = await UserModel.findByUserTypeWithPagination(
      'CREATOR',
      page,
      limit,
      twitterUsernameFilter,
      undefined,
      undefined,
      creatorListSort
    );
    const creators = result.users.map((u) => {
      const row: { id?: string; isActive?: boolean; twitter_username?: string; twitter_followers_count?: number; total_earnings?: number; wallet_evm?: string; wallet_sui?: string; wallet_sol?: string; wallet_stellar?: string } = {};
      if (u._id) row.id = u._id.toString();
      if (u.isActive !== undefined) row.isActive = u.isActive;
      if (u.twitter_username !== undefined) row.twitter_username = u.twitter_username;
      if (u.twitter_followers_count !== undefined) row.twitter_followers_count = u.twitter_followers_count;
      if (u.total_earnings !== undefined) row.total_earnings = u.total_earnings;
      if (u.wallet_evm !== undefined) row.wallet_evm = u.wallet_evm;
      if (u.wallet_sui !== undefined) row.wallet_sui = u.wallet_sui;
      if (u.wallet_sol !== undefined) row.wallet_sol = u.wallet_sol;
      if (u.wallet_stellar !== undefined) row.wallet_stellar = u.wallet_stellar;
      return row;
    });
    return { creators, total: result.total, page: result.page, totalPages: result.totalPages };
  }

  public async getCreatorsParticipationStats(
    page: number = 1,
    limit: number = 50,
    search?: string
  ): Promise<{
    creators: Array<{
      id: string;
      username?: string;
      twitter_username?: string;
      isActive?: boolean;
      campaigns_participated: number;
    }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const { rows, total } = await CampaignParticipantsModel.aggregateCreatorParticipationStats(skip, limit, search);
    const creators = rows.map((r) => ({
      id: r.userId,
      campaigns_participated: r.campaigns_participated,
      ...(r.username !== undefined && { username: r.username }),
      ...(r.twitter_username !== undefined && { twitter_username: r.twitter_username }),
      ...(r.isActive !== undefined && { isActive: r.isActive })
    }));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { creators, total, page, totalPages };
  }

  public async getRecurringCreatorsLastNCampaigns(
    page: number = 1,
    limit: number = 50,
    search?: string,
    lastN: number = 5,
    campaignType: 'public' | 'private' | 'all' = 'all'
  ): Promise<{
    creators: Array<{
      id: string;
      username?: string;
      twitter_username?: string;
      isActive?: boolean;
      campaigns_participated: number;
    }>;
    last_campaigns: Array<{ id: string; title: string; isPrivate: boolean; created_at: Date }>;
    window_campaigns: number;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const n = Math.min(50, Math.max(1, Math.floor(lastN)));
    const campaigns = await CampaignModel.findLastNByCreatedAt(n, campaignType);
    const last_campaigns = campaigns.map((c) => ({
      id: c._id!.toString(),
      title: c.title,
      isPrivate: !!c.isPrivate,
      created_at: c.created_at
    }));
    const campaignIds = campaigns.map((c) => c._id!.toString());
    const window_campaigns = campaignIds.length;
    const skip = (page - 1) * limit;
    const { rows, total } = await CampaignParticipantsModel.aggregateRecurringCreators(campaignIds, skip, limit, search);
    const creators = rows.map((r) => ({
      id: r.userId,
      campaigns_participated: r.campaigns_participated,
      ...(r.username !== undefined && { username: r.username }),
      ...(r.twitter_username !== undefined && { twitter_username: r.twitter_username }),
      ...(r.isActive !== undefined && { isActive: r.isActive })
    }));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { creators, last_campaigns, window_campaigns, total, page, totalPages };
  }

  public async getCreatorsInsightsList(
    page: number = 1,
    limit: number = 50,
    filters?: {
      search?: string;
      average_views_per_post?: string;
      primary_language?: string;
      fluent_language?: string;
      audience_region?: string;
      content_category_list?: string;
      content_formats?: string;
      crypto_experience?: string;
      trading_experience?: string;
      main_chains?: string;
    }
  ): Promise<{
    creators: Array<{
      id?: string;
      isActive?: boolean;
      twitter_username?: string;
      username_discord?: string;
      username_instagram?: string;
      username_telegram?: string;
      username_tiktok?: string;
      username_youtube?: string;
      average_views_per_post?: string;
    }>;
    profile_stats?: {
      total_creators: number;
      twitter: number;
      instagram: number;
      tiktok: number;
      youtube: number;
      telegram: number;
      discord: number;
    };
    total: number;
    page: number;
    totalPages: number;
  }> {
    const collection = await (UserModel as any)['getCollection']();

    const mongoFilter: any = { user_type: 'CREATOR' };
    const skip = (page - 1) * limit;

    const search = filters?.search?.trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      mongoFilter.$or = [
        { twitter_username: searchRegex },
        { username_discord: searchRegex },
        { username_instagram: searchRegex },
        { username_telegram: searchRegex },
        { username_tiktok: searchRegex },
        { username_youtube: searchRegex },
        { average_views_per_post: searchRegex },
        { audience_size: searchRegex },
        { audience_region: searchRegex },
        { content_category_list: searchRegex },
        { content_formats: searchRegex },
        { crypto_experience: searchRegex },
        { trading_experience: searchRegex },
        { main_chains: searchRegex },
        { primary_language: searchRegex },
        { fluent_language: searchRegex },
      ];
    }

    if (filters?.average_views_per_post?.trim()) {
      mongoFilter.average_views_per_post = filters.average_views_per_post.trim();
    }

    if (filters?.primary_language?.trim()) {
      mongoFilter.primary_language = filters.primary_language.trim();
    }

    if (filters?.fluent_language?.trim()) {
      const lang = filters.fluent_language.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      mongoFilter.fluent_language = new RegExp(`(^|,)\\s*${lang}\\s*(,|$)`, 'i');
    }

    if (filters?.audience_region?.trim()) {
      mongoFilter.audience_region = filters.audience_region.trim();
    }

    if (filters?.content_category_list?.trim()) {
      mongoFilter.content_category_list = filters.content_category_list.trim();
    }

    if (filters?.content_formats?.trim()) {
      mongoFilter.content_formats = filters.content_formats.trim();
    }

    if (filters?.crypto_experience?.trim()) {
      mongoFilter.crypto_experience = filters.crypto_experience.trim();
    }

    if (filters?.trading_experience?.trim()) {
      mongoFilter.trading_experience = filters.trading_experience.trim();
    }

    if (filters?.main_chains?.trim()) {
      mongoFilter.main_chains = filters.main_chains.trim();
    }

    const [users, total] = await Promise.all([
      collection
        .find(mongoFilter)
        .project({
          twitter_username: 1,
          username_discord: 1,
          username_instagram: 1,
          username_telegram: 1,
          username_tiktok: 1,
          username_youtube: 1,
          average_views_per_post: 1,
          isActive: 1,
          audience_size: 1,
          audience_region: 1,
          content_category_list: 1,
          content_formats: 1,
          crypto_experience: 1,
          trading_experience: 1,
          main_chains: 1,
          primary_language: 1,
          fluent_language: 1,
        })
        .sort({ username: 1, twitter_username: 1, google_name: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(mongoFilter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const creators = users.map((u: any) => ({
      id: u?._id ? u._id.toString() : undefined,
      isActive: u?.isActive,
      twitter_username: u?.twitter_username ?? undefined,
      username_discord: u?.username_discord ?? undefined,
      username_instagram: u?.username_instagram ?? undefined,
      username_telegram: u?.username_telegram ?? undefined,
      username_tiktok: u?.username_tiktok ?? undefined,
      username_youtube: u?.username_youtube ?? undefined,
      average_views_per_post: u?.average_views_per_post ?? undefined,
    }));

    // Count creators that have each platform configured
    const creatorsCollection = await (UserModel as any)['getCollection']();
    const notEmpty = (field: string) => ({ [field]: { $exists: true, $nin: [null, ''] } });
    const baseFilter = { user_type: 'CREATOR' };

    const [
      total_creators,
      twitter_count,
      instagram_count,
      tiktok_count,
      youtube_count,
      telegram_count,
      discord_count,
    ] = await Promise.all([
      creatorsCollection.countDocuments(baseFilter),
      creatorsCollection.countDocuments({ ...baseFilter, ...notEmpty('twitter_username') }),
      creatorsCollection.countDocuments({ ...baseFilter, ...notEmpty('username_instagram') }),
      creatorsCollection.countDocuments({ ...baseFilter, ...notEmpty('username_tiktok') }),
      creatorsCollection.countDocuments({ ...baseFilter, ...notEmpty('username_youtube') }),
      creatorsCollection.countDocuments({ ...baseFilter, ...notEmpty('username_telegram') }),
      creatorsCollection.countDocuments({ ...baseFilter, ...notEmpty('username_discord') }),
    ]);

    const profile_stats = {
      total_creators,
      twitter: twitter_count,
      instagram: instagram_count,
      tiktok: tiktok_count,
      youtube: youtube_count,
      telegram: telegram_count,
      discord: discord_count,
    };

    return { creators, profile_stats, total, page, totalPages };
  }

  public async getCreatorsInsightsFilterOptions(): Promise<{
    average_views_per_post: string[];
    primary_language: string[];
    fluent_language: string[];
    audience_region: string[];
    content_category_list: string[];
    content_formats: string[];
    crypto_experience: string[];
    trading_experience: string[];
    main_chains: string[];
  }> {
    const collection = await (UserModel as any)['getCollection']();
    const baseFilter: Document = { user_type: 'CREATOR' };

    const uniqSort = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b));

    /** Campo escalar (string) no documento. */
    const addScalar = (set: Set<string>, v: unknown) => {
      if (typeof v === 'string') {
        const t = v.trim();
        if (t) set.add(t);
      }
    };

    /**
     * Array de strings, string única, ou array com `{ slug }` (categorias).
     * Igual ao que o onboarding grava (ex.: audience_region string ou string[]).
     */
    const addArrayish = (set: Set<string>, v: unknown) => {
      if (v === null || v === undefined) return;
      if (typeof v === 'string') {
        const t = v.trim();
        if (t) set.add(t);
        return;
      }
      if (!Array.isArray(v)) return;
      for (const item of v) {
        if (typeof item === 'string') {
          const t = item.trim();
          if (t) set.add(t);
        } else if (item && typeof item === 'object') {
          const slug = (item as { slug?: unknown }).slug;
          if (typeof slug === 'string' && slug.trim()) set.add(slug.trim());
        }
      }
    };

    const projection: Document = {
      average_views_per_post: 1,
      primary_language: 1,
      fluent_language: 1,
      audience_region: 1,
      content_category_list: 1,
      content_formats: 1,
      crypto_experience: 1,
      trading_experience: 1,
      main_chains: 1,
    };

    let rows: Document[] = [];
    try {
      rows = await collection.find(baseFilter).project(projection).toArray();
    } catch (e) {
      console.error('[AdminService] getCreatorsInsightsFilterOptions find:', e);
    }

    const average_views_per_post = new Set<string>();
    const primary_language = new Set<string>();
    const fluent_language = new Set<string>();
    const audience_region = new Set<string>();
    const content_category_list = new Set<string>();
    const content_formats = new Set<string>();
    const crypto_experience = new Set<string>();
    const trading_experience = new Set<string>();
    const main_chains = new Set<string>();

    for (const row of rows) {
      addScalar(average_views_per_post, row['average_views_per_post']);
      addScalar(primary_language, row['primary_language']);
      const fluentRaw = row['fluent_language'];
      if (typeof fluentRaw === 'string' && fluentRaw.trim()) {
        fluentRaw
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
          .forEach((code: string) => fluent_language.add(code));
      }
      addArrayish(audience_region, row['audience_region']);
      addArrayish(content_category_list, row['content_category_list']);
      addArrayish(content_formats, row['content_formats']);
      addScalar(crypto_experience, row['crypto_experience']);
      addScalar(trading_experience, row['trading_experience']);
      addArrayish(main_chains, row['main_chains']);
    }

    return {
      average_views_per_post: uniqSort(average_views_per_post),
      primary_language: uniqSort(primary_language),
      fluent_language: uniqSort(fluent_language),
      audience_region: uniqSort(audience_region),
      content_category_list: uniqSort(content_category_list),
      content_formats: uniqSort(content_formats),
      crypto_experience: uniqSort(crypto_experience),
      trading_experience: uniqSort(trading_experience),
      main_chains: uniqSort(main_chains),
    };
  }

  public async getHostsList(
    page: number = 1,
    limit: number = 50,
    searchFilter?: string,
    /** Filtro por aprovação da conta host (`status`), não por `isActive`. */
    accountStatusFilter?: 'active' | 'inactive'
  ): Promise<{
    hosts: Array<{
      id: string;
      accountStatus: 'active' | 'inactive';
      name_company?: string;
      email?: string;
      campaigns_created: number;
      plan_name?: string;
      duration_plan?: Date | null;
    }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const result = await UserModel.findByUserTypeWithPagination(
      'HOST',
      page,
      limit,
      searchFilter,
      true,
      undefined,
      undefined,
      accountStatusFilter
    );
    await PlanModel.ensureDefaults();
    const plans = await PlanModel.listAll();
    const planMap = new Map(plans.map((p) => [p._id!.toString(), p.name]));

    const hosts = result.users.map((u) => {
      const row: {
        id: string;
        accountStatus: 'active' | 'inactive';
        name_company?: string;
        email?: string;
        campaigns_created: number;
        plan_name?: string;
        duration_plan?: Date | null;
      } = {
        id: u._id!.toString(),
        accountStatus: u.status === 'inactive' ? 'inactive' : 'active',
        campaigns_created: u.campaigns_created,
        duration_plan: u.duration_plan ?? null
      };
      if (u.name_company !== undefined) row.name_company = u.name_company;
      if (u.email !== undefined) row.email = u.email;
      const planIdStr = u.plan_id != null ? (typeof u.plan_id === 'string' ? u.plan_id : String((u.plan_id as any)?.toString?.() ?? u.plan_id)) : undefined;
      const planName = planIdStr ? planMap.get(planIdStr) : undefined;
      if (planName !== undefined) row.plan_name = planName;
      return row;
    });
    return { hosts, total: result.total, page: result.page, totalPages: result.totalPages };
  }

  public async getCampaignShortUrlsForAdmin(campaignId: string): Promise<{ campaignTitle: string; items: Array<{ twitter_username?: string; shortURL: string; clicks: number }> }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const urls = await ShortURLModel.findAllByCampaignId(campaignId);
    const urlUserIds = urls.map(u => u.userId).filter((id): id is string => !!id);
    const urlUsersMap = await UserModel.findByIds(urlUserIds);

    const items: Array<{ twitter_username?: string; shortURL: string; clicks: number }> = [];
    for (const url of urls) {
      if (!url.userId) continue;
      const user = urlUsersMap.get(url.userId);
      const item: { twitter_username?: string; shortURL: string; clicks: number } = { shortURL: url.shortURL, clicks: url.clicks ?? 0 };
      if (user?.twitter_username !== undefined) item.twitter_username = user.twitter_username;
      items.push(item);
    }
    return { campaignTitle: campaign.title, items };
  }

  public async getHostsCombo(): Promise<Array<{ host_id: string; name_company?: string }>> {
    const result = await UserModel.findByUserTypeWithPagination(
      'HOST',
      1,
      10000,
      undefined,
      true,
      undefined,
      undefined,
      'active'
    );
    return result.users.map((u) => ({
      host_id: u._id!.toString(),
      name_company: u.name_company ?? ''
    }));
  }

  public async getCampaignsCombo(): Promise<Array<{ id: string; name: string; isPrivate: boolean; country?: Array<{ name: string }>; host?: { id: string; username: string; name_company?: string | undefined; email?: string | undefined } | undefined }>> {
    const { campaigns } = await CampaignModel.findWithPaginationAllStatus(1, 1000, {});
    const hostIds = [...new Set(campaigns.map(c => c.host_id))];
    const hostsMap = await UserModel.findByIds(hostIds);
    return campaigns.map((c) => {
      const host = hostsMap.get(c.host_id);
      return {
        id: c._id!.toString(),
        name: c.title ?? '',
        isPrivate: !!c.isPrivate,
        country: (c as any).country,
        host: host ? {
          id: host._id!.toString(),
          username: host.username,
          name_company: host.name_company,
          email: host.email,
        } : undefined,
      };
    });
  }

  public async getCampaignCountsPrivatePublic(): Promise<{ private: number; public: number; total: number }> {
    const { private: privateCount, public: publicCount } = await CampaignModel.countByPrivateAndPublic();
    return { private: privateCount, public: publicCount, total: privateCount + publicCount };
  }

  public async updateHostPlan(hostId: string, planId: string): Promise<{ success: boolean; message?: string }> {
    const host = await UserModel.findById(hostId);
    if (!host) throw new Error('Host not found');
    if (host.user_type !== 'HOST') throw new Error('User is not a host');

    const plan = await PlanModel.findById(planId);
    if (!plan) throw new Error('Plan not found');

    let duration_plan: Date | null = null;
    if (plan.duration_months != null && plan.duration_months > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + plan.duration_months);
      duration_plan = d;
    }

    await UserModel.updateById(hostId, { plan_id: planId, duration_plan });
    return { success: true, message: 'Host plan updated' };
  }

  public async getUserDetail(userId: string): Promise<Record<string, unknown>> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    const payments = await PaymentModel.findByUserId(userId);
    const confirmedCount = payments.filter((p) => p.status === 'confirmed').length;
    const { password_hash: _, ...safeUser } = user;
    return {
      ...safeUser,
      id: (user._id as any)?.toString(),
      payments_count: payments.length,
      payments_confirmed_count: confirmedCount
    } as Record<string, unknown>;
  }

  public async setUserActive(userId: string, isActive: boolean): Promise<{ message: string; isActive: boolean }> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    await UserModel.updateById(userId, { isActive });
    return { message: isActive ? 'User activated' : 'User deactivated', isActive };
  }

  public async setHostAccountStatus(userId: string, status: UserAccountStatus): Promise<{ message: string; status: UserAccountStatus }> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.user_type !== 'HOST') throw new Error('Only HOST users have account status');

    await UserModel.updateById(userId, {
      status
    });
    return {
      message: 'Host account status updated',
      status
    };
  }

  public async getPaymentsList(
    page: number = 1,
    limit: number = 50,
    filters: { userId?: string; campaignId?: string; status?: string; search?: string; source?: string } = {}
  ): Promise<AdminPaymentsListResponse> {
    const searchTerm = filters.search?.trim();
    const sourceFilter = filters.source?.trim() as 'Winners' | 'Active Campaign' | 'Refunds' | 'Plans' | undefined;
    const hasCampaignId = filters.campaignId !== undefined && String(filters.campaignId).trim() !== '';
    /** Planos não têm campaignId no documento; não misturar com visão "por campanha". */
    const includePlanPayments = !hasCampaignId;
    const isNarrowFilter =
      hasCampaignId || (filters.userId !== undefined && String(filters.userId).trim() !== '');
    const needToFetch = searchTerm
      ? Math.min(3000, Math.max(page * limit, 500))
      : isNarrowFilter
        ? 25000
        : page * limit;

    const winnersFilters: { userId?: string; campaignId?: string; status?: string } = {};
    if (filters.userId !== undefined) winnersFilters.userId = filters.userId;
    if (filters.campaignId !== undefined) winnersFilters.campaignId = filters.campaignId;
    if (filters.status !== undefined) winnersFilters.status = filters.status;
    const hostsFilters: { campaignId?: string; status?: string } = {};
    if (filters.campaignId !== undefined) hostsFilters.campaignId = filters.campaignId;
    if (filters.status !== undefined) hostsFilters.status = filters.status;
    const refundsFilters: { campaignId?: string; status?: string } = {};
    if (filters.campaignId !== undefined) refundsFilters.campaignId = filters.campaignId;
    if (filters.status !== undefined) refundsFilters.status = filters.status;
    const plansFilters: { userId?: string; status?: string } = {};
    if (filters.userId !== undefined) plansFilters.userId = filters.userId;
    if (filters.status !== undefined) plansFilters.status = filters.status;

    const [winners, hosts, refunds, plans, totalWinners, totalHosts, totalRefunds, totalPlans] = await Promise.all([
      PaymentModel.findWithFilters(needToFetch, 0, winnersFilters),
      PaymentHostModel.findWithFilters(needToFetch, 0, hostsFilters),
      PaymentRefundModel.findWithFilters(needToFetch, 0, refundsFilters),
      includePlanPayments ? PlanPaymentModel.findWithFilters(needToFetch, 0, plansFilters) : Promise.resolve([]),
      PaymentModel.countWithFilters(winnersFilters),
      PaymentHostModel.countWithFilters(hostsFilters),
      PaymentRefundModel.countWithFilters(refundsFilters),
      includePlanPayments ? PlanPaymentModel.countWithFilters(plansFilters) : Promise.resolve(0)
    ]);

    const withSource = [
      ...winners.map((p) => ({ ...p, id: p._id!.toString(), source: 'Winners' as const })),
      ...hosts.map((p) => ({ ...p, id: p._id!.toString(), source: 'Active Campaign' as const })),
      ...refunds.map((p) => ({ ...p, id: p._id!.toString(), source: 'Refunds' as const })),
      ...plans.map((p) => ({ ...p, id: p._id!.toString(), source: 'Plans' as const }))
    ];

    withSource.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    let listToPage = withSource;
    if (sourceFilter) {
      listToPage = withSource.filter((p: any) => p.source === sourceFilter);
    }

    const start = (page - 1) * limit;
    const paymentsSlice = listToPage.slice(start, start + limit);

    // Coletar IDs únicos de usuários e campanhas (do slice ou da lista inteira se search)
    const userIds = new Set<string>();
    const campaignIds = new Set<string>();
    const refundToAddresses: string[] = [];
    const listToEnrich = searchTerm ? listToPage : paymentsSlice;

    const toStr = (v: any) => (v && typeof v === 'object' && v.toString) ? v.toString() : String(v ?? '');
    listToEnrich.forEach((payment: any) => {
      if (payment.userId) userIds.add(toStr(payment.userId));
      if (payment.user_id) userIds.add(toStr(payment.user_id));
      if (payment.hostId) userIds.add(toStr(payment.hostId));
      if (payment.campaignId) campaignIds.add(toStr(payment.campaignId));
      if (payment.campaign_id) campaignIds.add(toStr(payment.campaign_id));
      if (payment.source === 'Refunds' && !payment.user_id && !payment.userId && payment.to) refundToAddresses.push(payment.to);
    });

    // Buscar campanhas primeiro para obter host_id dos Refunds (reembolso vai para o host da campanha)
    const campaigns = campaignIds.size > 0 ? await Promise.all(Array.from(campaignIds).map(id => CampaignModel.findById(id))) : [];
    const campaignsMap = new Map<string, { title?: string; host_id?: string }>();
    campaigns.forEach(campaign => {
      if (campaign?._id) {
        const entry: { title?: string; host_id?: string } = { title: campaign.title };
        if (campaign.host_id) entry.host_id = campaign.host_id;
        campaignsMap.set(campaign._id.toString(), entry);
      }
    });

    // Refunds não têm user_id no documento; o destinatário é o host da campanha
    listToEnrich.forEach((payment: any) => {
      if (payment.source === 'Refunds' && (payment.campaign_id || payment.campaignId)) {
        const cid = toStr(payment.campaign_id ?? payment.campaignId);
        const hostId = campaignsMap.get(cid)?.host_id;
        if (hostId) userIds.add(hostId);
      }
    });

    const [users, refundCreatorsByWallet] = await Promise.all([
      userIds.size > 0 ? Promise.all(Array.from(userIds).map(id => UserModel.findById(id))) : Promise.resolve([]),
      refundToAddresses.length > 0 ? Promise.all(refundToAddresses.map(to => UserModel.findByWalletAddress(to))) : Promise.resolve([])
    ]);

    const usersMap = new Map<string, { username?: string; twitter_username?: string; name_company?: string; email?: string; user_type?: string }>();
    users.forEach(user => {
      if (user?._id) {
        const entry: { username?: string; twitter_username?: string; name_company?: string; email?: string; user_type?: string } = { username: user.username };
        if (user.twitter_username !== undefined) entry.twitter_username = user.twitter_username;
        if (user.name_company !== undefined) entry.name_company = user.name_company;
        if (user.email !== undefined) entry.email = user.email;
        if (user.user_type !== undefined) entry.user_type = user.user_type;
        usersMap.set(user._id.toString(), entry);
      }
    });

    // Fallback: reembolso por carteira (caso host não esteja no usersMap)
    const refundHostByTo = new Map<string, { user_name: string; company_name: string }>();
    refundToAddresses.forEach((to, i) => {
      const host = refundCreatorsByWallet[i];
      if (host) {
        const user_name = host.username ?? host.email ?? host.name_company ?? '';
        const company_name = host.name_company ?? '';
        refundHostByTo.set(to, { user_name, company_name });
      }
    });

    const enrich = (payment: any) => {
      const enrichedPayment = { ...payment };

      let userId: string | undefined;
      if (payment.userId) userId = payment.userId;
      else if (payment.user_id) userId = payment.user_id;
      else if (payment.hostId) userId = payment.hostId;
      // Refunds: host é o dono da campanha (campaign_id -> host_id)
      if (payment.source === 'Refunds' && !userId && (payment.campaign_id || payment.campaignId)) {
        const cid = toStr(payment.campaign_id ?? payment.campaignId);
        userId = campaignsMap.get(cid)?.host_id;
      }

      if (payment.source === 'Refunds') {
        // Reembolso = devolução ao host. user_name = username do host, company_name = nome da empresa.
        if (userId) {
          const userInfo = usersMap.get(toStr(userId));
          if (userInfo) {
            enrichedPayment.user_name = userInfo.username ?? userInfo.email ?? userInfo.name_company ?? '';
            enrichedPayment.company_name = userInfo.name_company ?? '';
          }
        }
        if (!enrichedPayment.user_name && payment.to) {
          const refInfo = refundHostByTo.get(payment.to);
          if (refInfo) {
            enrichedPayment.user_name = refInfo.user_name;
            enrichedPayment.company_name = refInfo.company_name;
          }
        }
      } else if (userId) {
        const userInfo = usersMap.get(toStr(userId));
        if (userInfo) {
          if (payment.source === 'Winners') {
            // Creator (Twitter): pagamento para quem ganhou a campanha
            enrichedPayment.user_name = userInfo.twitter_username ? `@${userInfo.twitter_username}` : (userInfo.username ?? '');
            enrichedPayment.company_name = undefined;
          } else {
            // Active Campaign / Plans: nome do usuário (email/nome) e empresa separados
            enrichedPayment.user_name = userInfo.email ?? userInfo.name_company ?? userInfo.username ?? '';
            enrichedPayment.company_name = userInfo.name_company;
          }
        }
      }

      let campaignId: string | undefined;
      if (payment.campaignId) campaignId = toStr(payment.campaignId);
      else if (payment.campaign_id) campaignId = toStr(payment.campaign_id);
      if (campaignId) {
        const campaignInfo = campaignsMap.get(campaignId);
        if (campaignInfo?.title) enrichedPayment.campaign_name = campaignInfo.title;
      }

      const taxFromDoc = (payment as { tax?: string; taxId?: string }).tax ?? (payment as { taxId?: string }).taxId;
      if (taxFromDoc && enrichedPayment.tax === undefined) {
        enrichedPayment.tax = typeof taxFromDoc === 'string' ? taxFromDoc : String(taxFromDoc);
      }

      return enrichedPayment;
    };

    const paymentsWithInfo = listToEnrich.map((p: any) => enrich(p));

    let total: number;
    let paymentsResult: AdminPaymentItem[];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const filtered = paymentsWithInfo.filter((p: any) => {
        const u = ((p.user_name ?? '') + (p.company_name ?? '') + (p.campaign_name ?? '')).toLowerCase();
        return u.includes(q);
      });
      total = filtered.length;
      paymentsResult = filtered.slice(start, start + limit) as AdminPaymentItem[];
    } else {
      total = sourceFilter ? listToPage.length : totalWinners + totalHosts + totalRefunds + totalPlans;
      paymentsResult = paymentsWithInfo as AdminPaymentItem[];
    }

    return {
      payments: paymentsResult,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async exportUsersWithSubmissions(campaignId?: string): Promise<ExcelJS.Buffer> {
    let participants;
    
    if (campaignId) {
      const result = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, MAX_EXPORT_LIMIT);
      participants = result.participants;
    } else {
      const { getBountiesDB } = await import('../config/database');
      const db = await getBountiesDB();
      const collection = db.collection('campaign_participants');
      participants = await collection.find({}).toArray();
    }

    const data = await Promise.all(
      participants.map(async (participant) => {
        const [user, campaign] = await Promise.all([
          UserModel.findById(participant.userId),
          CampaignModel.findById(participant.campaignId)
        ]);

        return {
          username: user?.username || 'N/A',
          campaign: campaign?.title || 'N/A'
        };
      })
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users with Submissions');

    worksheet.columns = [
      { header: 'Username', key: 'username', width: 30 },
      { header: 'Campaign', key: 'campaign', width: 50 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    data.forEach((row) => {
      worksheet.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ExcelJS.Buffer;
  }

  private static styleHeader(worksheet: ExcelJS.Worksheet): void {
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  }

  public async exportShortUrlsExcel(campaignId: string): Promise<ExcelJS.Buffer> {
    const { campaignTitle, items } = await this.getCampaignShortUrlsForAdmin(campaignId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Short URLs', { headerFooter: { firstHeader: campaignTitle } });
    sheet.columns = [
      { header: 'Twitter Username', key: 'twitter_username', width: 28 },
      { header: 'Short URL', key: 'shortURL', width: 50 },
      { header: 'Clicks', key: 'clicks', width: 12 }
    ];
    AdminService.styleHeader(sheet);
    items.forEach((row) => sheet.addRow(row));
    return (await workbook.xlsx.writeBuffer()) as ExcelJS.Buffer;
  }

  public async exportCreatorsExcel(twitterUsernameFilter?: string): Promise<ExcelJS.Buffer> {
    const { creators } = await this.getCreatorsList(1, 100000, twitterUsernameFilter);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Creators');
    sheet.columns = [
      { header: 'Twitter Username', key: 'twitter_username', width: 28 },
      { header: 'Twitter Followers', key: 'twitter_followers_count', width: 16 },
      { header: 'Total Earnings', key: 'total_earnings', width: 16 },
      { header: 'Wallet EVM', key: 'wallet_evm', width: 46 },
      { header: 'Wallet SUI', key: 'wallet_sui', width: 46 },
      { header: 'Wallet SOL', key: 'wallet_sol', width: 46 },
      { header: 'Wallet Stellar', key: 'wallet_stellar', width: 60 }
    ];
    AdminService.styleHeader(sheet);
    creators.forEach((row) => sheet.addRow(row));
    return (await workbook.xlsx.writeBuffer()) as ExcelJS.Buffer;
  }

  public async exportHostsExcel(
    searchFilter?: string,
    accountStatusFilter?: 'active' | 'inactive'
  ): Promise<ExcelJS.Buffer> {
    const { hosts } = await this.getHostsList(1, 100000, searchFilter, accountStatusFilter);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Hosts');
    sheet.columns = [
      { header: 'Company', key: 'name_company', width: 32 },
      { header: 'Email', key: 'email', width: 36 },
      { header: 'Campaigns Created', key: 'campaigns_created', width: 18 },
      { header: 'Plan', key: 'plan_name', width: 16 },
      { header: 'Duration Plan', key: 'duration_plan', width: 22 },
      { header: 'Host account', key: 'accountStatus', width: 14 }
    ];
    AdminService.styleHeader(sheet);
    hosts.forEach((row) => {
      const r = { ...row, duration_plan: row.duration_plan ? new Date(row.duration_plan).toISOString() : '' };
      sheet.addRow(r);
    });
    return (await workbook.xlsx.writeBuffer()) as ExcelJS.Buffer;
  }

  public async exportPaymentsExcel(filters: { userId?: string; campaignId?: string; status?: string } = {}): Promise<ExcelJS.Buffer> {
    const { payments } = await this.getPaymentsList(1, 100000, filters);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Payments');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 26 },
      { header: 'Source', key: 'source', width: 18 },
      { header: 'Created At', key: 'created_at', width: 24 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'User ID', key: 'userId', width: 26 },
      { header: 'Campaign ID', key: 'campaignId', width: 26 },
      { header: 'To / Wallet', key: 'to', width: 46 },
      { header: 'Signature', key: 'signature', width: 20 },
      { header: 'Symbol', key: 'symbol', width: 10 },
      { header: 'Chain', key: 'chain', width: 14 }
    ];
    AdminService.styleHeader(sheet);
    payments.forEach((p) => {
      const row: Record<string, unknown> = {
        id: p.id,
        source: p.source,
        created_at: p.created_at ? new Date(p.created_at).toISOString() : '',
        amount: p['amount'] ?? p['tax'] ?? '',
        status: p['status'] ?? '',
        userId: p['userId'] ?? p['user_id'] ?? '',
        campaignId: p['campaignId'] ?? p['campaign_id'] ?? '',
        to: p['to'] ?? p['walletAddressHost'] ?? '',
        signature: p['signature'] ?? '',
        symbol: p['symbol'] ?? '',
        chain: p['chain'] ?? ''
      };
      sheet.addRow(row);
    });
    return (await workbook.xlsx.writeBuffer()) as ExcelJS.Buffer;
  }

  // Private methods
  private async formatCampaignResponse(campaign: ICampaign): Promise<any> {
    const total_submissions = await CampaignParticipantsModel.countByCampaignId(campaign._id!.toString());
    
    return {
      id: campaign._id!.toString(),
      host_id: campaign.host_id,
      title: campaign.title,
      about_project: campaign.about_project,
      what_we_need: campaign.what_we_need,
      content_type: campaign.content_type,
      content_pillars: campaign.content_pillars,
      benefits: campaign.benefits,
      requirements: campaign.requirements,
      content_format: campaign.content_format,
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
      status: campaign.status,
      payment_received: campaign.payment_received,
      rewards_distributed: campaign.rewards_distributed,
      is_cac: campaign.is_cac,
      amount_convertion: campaign.amount_convertion,
      limit_amount_convertion: campaign.limit_amount_convertion,
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
      total_submissions
    };
  }

  public async upsertInstagramStoryMetrics(
    campaignId: string,
    userId: string,
    data: { likes: number; views: number; retweets: number; replies: number }
  ): Promise<any> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const participant = await CampaignParticipantsModel.findByUserAndCampaign(userId, campaignId);
    if (!participant) throw new Error('Participant not found in this campaign');

    const updated = await CampaignParticipantsModel.updateInstagramStoryData(participant._id!.toString(), {
      views_instagram_story: data.views,
      replies_instagram_story: data.replies,
      retweets_instagram_story: data.retweets,
      likes_instagram_story: data.likes,
    });

    return updated;
  }

  public async deleteInstagramStoryMetrics(campaignId: string, userId: string): Promise<any> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const participant = await CampaignParticipantsModel.findByUserAndCampaign(userId, campaignId);
    if (!participant) throw new Error('Participant not found in this campaign');

    const updated = await CampaignParticipantsModel.clearInstagramStoryData(participant._id!.toString());
    return updated;
  }

  public async runAllMetricsForCampaign(campaignId: string): Promise<{
    twitter: { processed: number; updated: number };
    instagram: { processed: number; updated: number };
    tiktok: { processed: number; updated: number };
    youtube: { processed: number; updated: number };
  }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const participantsResult = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, MAX_PARTICIPANTS_LIMIT);
    const participants = participantsResult.participants;

    const twitterService = new TwitterService();
    const instagramService = new InstagramService();
    const tiktokService = new TiktokService();
    const youtubeService = new YoutubeService();

    const results = {
      twitter: { processed: 0, updated: 0 },
      instagram: { processed: 0, updated: 0 },
      tiktok: { processed: 0, updated: 0 },
      youtube: { processed: 0, updated: 0 },
    };

    for (const participant of participants) {
      // Twitter
      if (participant.submission_twitter && participant.submission_twitter.trim() !== '') {
        results.twitter.processed++;
        try {
          if (twitterService.hasTweetIdInUrl(participant.submission_twitter)) {
            const response = await twitterService.getTweetsByIds(participant.submission_twitter);
            const tweet = response.tweets?.[0];
            if (tweet) {
              await CampaignParticipantsModel.updateTwitterData(participant._id!.toString(), {
                media_twitter: tweet.extendedEntities?.media?.[0]?.type || '',
                views_twitter: tweet.viewCount || 0,
                replies_twitter: tweet.replyCount || 0,
                retweets_twitter: tweet.retweetCount || 0,
                quotes_twitter: tweet.quoteCount || 0,
                bookmarks_twitter: tweet.bookmarkCount || 0,
                likes_twitter: tweet.likeCount || 0,
                content_length: (tweet.text || '').length,
              });
              results.twitter.updated++;
            }
          }
        } catch (e: any) {
          console.error(`Admin job: Twitter error for participant ${participant._id}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 100));
      }

      // Instagram
      if (participant.submission_instagram && participant.submission_instagram.trim() !== '') {
        results.instagram.processed++;
        try {
          if (instagramService.isInstagramUrl(participant.submission_instagram)) {
            const metrics = await instagramService.getPostMetrics(participant.submission_instagram);
            if (metrics) {
              await CampaignParticipantsModel.updateInstagramData(participant._id!.toString(), {
                media_instagram: metrics.media_type,
                views_instagram: metrics.views,
                replies_instagram: metrics.comments,
                likes_instagram: metrics.likes,
              });
              results.instagram.updated++;
            }
          }
        } catch (e: any) {
          console.error(`Admin job: Instagram error for participant ${participant._id}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 500));
      }

      // TikTok
      if (participant.submission_tiktok && participant.submission_tiktok.trim() !== '') {
        results.tiktok.processed++;
        try {
          if (tiktokService.isTiktokUrl(participant.submission_tiktok)) {
            const metrics = await tiktokService.getVideoMetrics(participant.submission_tiktok);
            if (metrics) {
              await CampaignParticipantsModel.updateTiktokData(participant._id!.toString(), {
                media_tiktok: 'video',
                views_tiktok: metrics.views,
                replies_tiktok: metrics.comments,
                retweets_tiktok: metrics.shares,
                bookmarks_tiktok: metrics.saves,
                likes_tiktok: metrics.likes,
              });
              results.tiktok.updated++;
            }
          }
        } catch (e: any) {
          console.error(`Admin job: TikTok error for participant ${participant._id}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 500));
      }

      // YouTube
      if (participant.submission_youtube && participant.submission_youtube.trim() !== '') {
        results.youtube.processed++;
        try {
          if (youtubeService.isYoutubeUrl(participant.submission_youtube)) {
            const metrics = await youtubeService.getVideoMetrics(participant.submission_youtube);
            if (metrics) {
              await CampaignParticipantsModel.updateYoutubeData(participant._id!.toString(), {
                media_youtube: 'video',
                views_youtube: metrics.views,
                replies_youtube: metrics.comments,
                likes_youtube: metrics.likes,
              });
              results.youtube.updated++;
            }
          }
        } catch (e: any) {
          console.error(`Admin job: YouTube error for participant ${participant._id}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return results;
  }
}
