import { CampaignModel, ICampaign } from '../models/Campaign';
import { CampaignParticipantsModel, ICampaignParticipants } from '../models/CampaignParticipants';
import { CampaignSugestionBountiesRankModel } from '../models/CampaignSugestionBountiesRank';
import { TwitterService } from './social_medias/TwitterService';
import { InstagramService } from './social_medias/InstagramService';
import { TiktokService } from './social_medias/TiktokService';
import { YoutubeService } from './social_medias/YoutubeService';
import { TweetDTO } from '../dtos/twitter.dto';
import { UserModel } from '../models/User';
import { ShortURLModel } from '../models/EncurtadorURL';
import { campaignsCache } from '../utils/cache';
import { PaymentService } from './PaymentService';
import { buildFeedbackRank, buildDateSubmitRank } from '../utils/generateRanksJob';
import { JobLockModel } from '../models/JobLock';
import { API_DELAY_TWITTER_MS, API_DELAY_INSTAGRAM_MS, API_DELAY_TIKTOK_MS, API_DELAY_YOUTUBE_MS, API_DELAY_FOLLOWERS_MS } from '../utils/consts';
import { StellarService } from './StellarService';

export class JobService {
  /**
   * Executes a job with a distributed lock to prevent concurrent execution.
   * If the lock cannot be acquired, returns a skipped result.
   */
  private async withLock<T>(jobName: string, ttlMs: number, fn: () => Promise<T>, skippedResult: T): Promise<T> {
    const acquired = await JobLockModel.acquire(jobName, ttlMs);
    if (!acquired) {
      console.log(`Job "${jobName}" skipped — already running.`);
      return skippedResult;
    }
    try {
      return await fn();
    } finally {
      await JobLockModel.release(jobName);
    }
  }

  public async runExpiredCampaignsJob(): Promise<{ success: boolean; updatedCount: number; timestamp: Date; message: string }> {
    return this.withLock('expired-campaigns', 2 * 60 * 1000, async () => {
      try {
        const updatedCount = await this.checkAndUpdateExpiredCampaigns();

        return {
          success: true,
          updatedCount,
          timestamp: new Date(),
          message: `Job completed successfully. ${updatedCount} campaign(s) updated.`
        };
      } catch (error: any) {
        return {
          success: false,
          updatedCount: 0,
          timestamp: new Date(),
          message: `Job execution error: ${error.message}`
        };
      }
    }, { success: true, updatedCount: 0, timestamp: new Date(), message: 'Job skipped — already running.' });
  }

  private async checkAndUpdateExpiredCampaigns(): Promise<number> {
    try {
      const updatedCount = await CampaignModel.updateExpiredCampaigns();

      if (updatedCount > 0) {
        await campaignsCache.deleteByPrefix('campaigns:all');
      }

      return updatedCount;
    } catch (error: any) {
      console.error('Error checking expired campaigns:', error);
      throw new Error(`Error checking expired campaigns: ${error.message}`);
    }
  }

  public async runGetInfoPostX(): Promise<{ success: boolean; processedCount: number; timestamp: Date; message: string }> {
    return this.withLock('get-info-post-x', 5 * 60 * 1000, async () => {
      try {
        const processedCount = await this.processTwitterSubmissions();

        return {
          success: true,
          processedCount,
          timestamp: new Date(),
          message: `Job completed successfully. ${processedCount} participant(s) processed.`
        };
      } catch (error: any) {
        return {
          success: false,
          processedCount: 0,
          timestamp: new Date(),
          message: `Job execution error: ${error.message}`
        };
      }
    }, { success: true, processedCount: 0, timestamp: new Date(), message: 'Job skipped — already running.' });
  }

  private async processTwitterSubmissions(): Promise<number> {
    try {
      const participants = await CampaignParticipantsModel.findPendingTwitterJobParticipants();

      if (participants.length === 0) return 0;

      const twitterService = new TwitterService();
      let processedCount = 0;
      const processedCampaignIds = new Set<string>();
      const failedCampaignIds = new Set<string>();

      for (const participant of participants) {
        try {
          if (!participant.submission_twitter || participant.submission_twitter.trim() === '') {
            continue;
          }

          const campaign = await CampaignModel.findById(participant.campaignId);
          if (!campaign) {
            continue;
          }

          if (!twitterService.hasTweetIdInUrl(participant.submission_twitter)) {
            console.warn(
              `Skipping participant ${participant._id}: submission_twitter is not a tweet URL (use .../status/<id>): ${participant.submission_twitter}`
            );
            continue;
          }

          const response = await twitterService.getTweetsByIds(participant.submission_twitter);

          if (!response.tweets || response.tweets.length === 0) {
            console.warn(`[TwitterJob] Participante ${participant._id}: API não retornou tweets para URL: ${participant.submission_twitter}`);
            failedCampaignIds.add(participant.campaignId);
            continue;
          }

          const tweet = response.tweets[0];
          if (!tweet) {
            console.warn(`[TwitterJob] Participante ${participant._id}: objeto tweet veio vazio`);
            failedCampaignIds.add(participant.campaignId);
            continue;
          }

          const user = await UserModel.findById(participant.userId);
          if (!user) {
            continue;
          }

          if (!user.twitter_id) {
            continue;
          }

          if (tweet.author?.id !== user.twitter_id) {
            continue;
          }

          const { mentions, hashtags } = this.extractRequiredMentionsAndHashtags(campaign.requirements);

          if (mentions.length > 0 || hashtags.length > 0) {
            const isValid = this.validateTweetRequirements(tweet, mentions, hashtags);

            if (!isValid) {
              continue;
            }
          }

          console.log('🌐 Media Type:', 'passou de mentions');

          let mediaType = '';
          if (tweet.extendedEntities?.media && tweet.extendedEntities.media.length > 0 && tweet.extendedEntities.media[0]) {
            mediaType = tweet.extendedEntities.media[0].type || '';
          }

          const twitterData = {
            media_twitter: mediaType,
            views_twitter: tweet.viewCount || 0,
            replies_twitter: tweet.replyCount || 0,
            retweets_twitter: tweet.retweetCount || 0,
            quotes_twitter: tweet.quoteCount || 0,
            bookmarks_twitter: tweet.bookmarkCount || 0,
            likes_twitter: tweet.likeCount || 0,
            content_length: (tweet.text || '').length
          };

          await CampaignParticipantsModel.updateTwitterData(participant._id!.toString(), twitterData);

          processedCount++;
          if (!processedCampaignIds.has(participant.campaignId)) {
            processedCampaignIds.add(participant.campaignId);
          }

          await new Promise(resolve => setTimeout(resolve, API_DELAY_TWITTER_MS));
        } catch (error: any) {
          console.error(`[TwitterJob] Erro ao processar participante ${participant._id} (URL: ${participant.submission_twitter}):`, error.message);
          failedCampaignIds.add(participant.campaignId);
        }
      }

      for (const campaignId of processedCampaignIds) {
        if (failedCampaignIds.has(campaignId)) {
          console.warn(`[TwitterJob] Campanha ${campaignId}: NÃO marcada como executada — alguns participantes falharam e serão reprocessados`);
          continue;
        }

        try {
          const campaign = await CampaignModel.findById(campaignId);
          if (campaign) {
            await CampaignModel.updateById(campaignId, { is_job_twitter_executed: true });

            try {
              const ranking = await twitterService.generateMindshare(campaignId, campaign.host_id);
              await CampaignSugestionBountiesRankModel.updateByCampaignId(campaignId, ranking);
            } catch (error: any) {
              console.error(`[TwitterJob] Erro ao gerar ranking para campanha ${campaignId}:`, error.message);
            }
          }
        } catch (error: any) {
          console.error(`[TwitterJob] Erro ao finalizar campanha ${campaignId}:`, error.message);
        }
      }

      return processedCount;
    } catch (error: any) {
      console.error('Error processing Twitter submissions:', error);
      throw new Error(`Error processing Twitter submissions: ${error.message}`);
    }
  }

  private extractRequiredMentionsAndHashtags(requirements: string): { mentions: string[]; hashtags: string[] } {
    const mentions: string[] = [];
    const hashtags: string[] = [];

    if (!requirements || requirements.trim() === '')
      return { mentions, hashtags };

    // Regex para encontrar menções "@username"
    const mentionRegex = /@(\w+)/gi;
    const foundMentions = requirements.match(mentionRegex);
    if (foundMentions)
      mentions.push(...foundMentions.map(m => m.toLowerCase()));

    // Regex para encontrar hashtags "#..."
    const hashtagRegex = /#(\w+)/gi;
    const foundHashtags = requirements.match(hashtagRegex);
    if (foundHashtags)
      hashtags.push(...foundHashtags.map(h => h.toLowerCase()));

    return { mentions, hashtags };
  }

  private validateTweetRequirements(tweet: TweetDTO, requiredMentions: string[], requiredHashtags: string[]): boolean {
    const tweetText = (tweet.text || '').toLowerCase();

    if (requiredMentions.length > 0) {
      const hasAnyMention = requiredMentions.some(m => tweetText.includes(m.toLowerCase()));
      if (!hasAnyMention) return false;
    }

    if (requiredHashtags.length > 0) {
      const hasAnyHashtag = requiredHashtags.some(h => tweetText.includes(h.toLowerCase()));
      if (!hasAnyHashtag) return false;
    }

    return true;
  }

  public async runGetClicksJob(): Promise<{ success: boolean; updatedCount: number; totalUrls: number; timestamp: Date; message: string }> {
    return this.withLock('get-clicks', 5 * 60 * 1000, async () => {
      try {
        const result = await this.getClicks();

        return {
          success: true,
          updatedCount: result.updatedCount,
          totalUrls: result.totalUrls,
          timestamp: new Date(),
          message: `Job completed successfully. ${result.updatedCount} URL(s) updated out of ${result.totalUrls} total.`
        };
      } catch (error: any) {
        return {
          success: false,
          updatedCount: 0,
          totalUrls: 0,
          timestamp: new Date(),
          message: `Job execution error: ${error.message}`
        };
      }
    }, { success: true, updatedCount: 0, totalUrls: 0, timestamp: new Date(), message: 'Job skipped — already running.' });
  }

  private async getClicks(): Promise<{ updatedCount: number; totalUrls: number }> {
    const apiKey = process.env['SHORT_API_KEY'] || '';
    const domain = process.env['SHORT_DOMAIN_ID'] || '';

    if (!apiKey || !domain) {
      throw new Error('SHORT_API_KEY or SHORT_DOMAIN_ID not configured');
    }

    try {
      const allUrls = await ShortURLModel.findAllUrls();

      if (allUrls.length === 0) return { updatedCount: 0, totalUrls: 0 };

      const idStrings = allUrls
        .map(url => url.idString)
        .filter((id): id is string => !!id);

      if (idStrings.length === 0) return { updatedCount: 0, totalUrls: allUrls.length };

      const idsParam = idStrings.join(',');

      const apiUrl = new URL(`https://statistics.short.io/statistics/domain/1583932/link_clicks`);
      apiUrl.searchParams.append('ids', idsParam);

      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Accept': '*/*'
        }
      });

      if (!response.ok) return { updatedCount: 0, totalUrls: allUrls.length };

      const data = await response.json() as any;

      const clicksMap = new Map<string, number>();

      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        for (const [idString, clicks] of Object.entries(data)) {
          if (idString && typeof clicks === 'number') {
            clicksMap.set(idString, clicks);
          }
        }
      } else if (Array.isArray(data)) {
        for (const item of data) {
          if (item && typeof item === 'object' && 'idString' in item && 'clicks' in item) {
            clicksMap.set(item['idString'] as string, (item['clicks'] as number) || 0);
          }
        }
      }

      let updatedCount = 0;
      for (const url of allUrls) {
        if (url.idString && clicksMap.has(url.idString)) {
          const clicks = clicksMap.get(url.idString) || 0;
          await ShortURLModel.updateClicks(url.idString, clicks);
          updatedCount++;
        }
      }

      return { updatedCount, totalUrls: allUrls.length };
    } catch (error: any) {
      console.error('Error getting clicks:', error);
      throw new Error(`Error getting clicks: ${error.message}`);
    }
  }

  public async runUpdateTwitterFollowersJob(): Promise<{ success: boolean; updatedCount: number; processedCount: number; timestamp: Date; message: string }> {
    return this.withLock('update-twitter-followers', 10 * 60 * 1000, async () => {
      try {
        const result = await this.updateCreatorsTwitterFollowers();
        return {
          success: true,
          updatedCount: result.updatedCount,
          processedCount: result.processedCount,
          timestamp: new Date(),
          message: `Job completed successfully. ${result.updatedCount} creator(s) updated out of ${result.processedCount} processed.`
        };
      } catch (error: any) {
        return {
          success: false,
          updatedCount: 0,
          processedCount: 0,
          timestamp: new Date(),
          message: `Job execution error: ${error.message}`
        };
      }
    }, { success: true, updatedCount: 0, processedCount: 0, timestamp: new Date(), message: 'Job skipped — already running.' });
  }

  private async updateCreatorsTwitterFollowers(): Promise<{ updatedCount: number; processedCount: number }> {
    const creators = await UserModel.findByUserType('CREATOR');
    const withUsername = creators.filter((c) => c.twitter_username && c.twitter_username.trim() !== '');
    const twitterService = new TwitterService();
    let updatedCount = 0;

    for (const creator of withUsername) {
      try {
        const info = await twitterService.getUserInfoByUsername(creator.twitter_username!);
        if (info !== null && creator._id) {
          await UserModel.updateById(creator._id.toString(), { twitter_followers_count: info.followers });
          updatedCount++;
        }
        await new Promise((r) => setTimeout(r, API_DELAY_FOLLOWERS_MS));
      } catch (err) {
        // skip on error, continue with next creator
      }
    }

    return { updatedCount, processedCount: withUsername.length };
  }

  /**
   * Cron: campanhas em "waiting payment" >= 7 dias, públicas.
   * Por tipo de submission: Twitter (rank automático), Feedback (rank interno por pontos), Instagram/Tiktok/YouTube (rank por date_submit).
   */
  public async runAutoPayWaitingPaymentCampaignsJob(): Promise<{
    success: boolean;
    processedCount: number;
    paidCampaigns: string[];
    errors: string[];
    timestamp: Date;
    message: string;
  }> {
    return this.withLock('auto-pay-waiting-payment', 10 * 60 * 1000, async () => {
      return this._executeAutoPayJob();
    }, { success: true, processedCount: 0, paidCampaigns: [], errors: [], timestamp: new Date(), message: 'Job skipped — already running.' });
  }

  private async _executeAutoPayJob(): Promise<{
    success: boolean;
    processedCount: number;
    paidCampaigns: string[];
    errors: string[];
    timestamp: Date;
    message: string;
  }> {
    const errors: string[] = [];
    const paidCampaigns: string[] = [];
    const paymentService = new PaymentService();

    try {
      const campaigns = await CampaignModel.findWaitingPaymentPublicOlderThan(14);
      if (campaigns.length === 0) {
        return {
          success: true,
          processedCount: 0,
          paidCampaigns: [],
          errors: [],
          timestamp: new Date(),
          message: 'No campaigns eligible for automatic payment.'
        };
      }

      for (const campaign of campaigns) {
        const campaignId = campaign._id!.toString();
        const formats = campaign.submission_format || [];
        const hasTwitter = formats.some((f: { type: string }) => f.type === 'twitter');
        const hasFeedback = formats.some((f: { type: string }) => f.type === 'feedback');
        const hasSocial = formats.some((f: { type: string }) => ['instagram', 'tiktok', 'youtube'].includes(f.type));

        try {
          if (hasTwitter) {
            const winners = await CampaignParticipantsModel.findWinnersByCampaignId(campaignId);
            if (winners && winners.length > 0) {
              await paymentService.sendTokenWinners(campaignId, false);
              paidCampaigns.push(campaignId);
              continue;
            }
            
            const rankData = await CampaignSugestionBountiesRankModel.findByCampaignId(campaignId);
            if (rankData && rankData.ranking && rankData.ranking.length > 0) {
              await paymentService.sendTokenWinners(campaignId, true);
              paidCampaigns.push(campaignId);
              continue;
            }

            errors.push(`Campaign ${campaignId}: Twitter rank not generated.`);
          } else if (hasFeedback) {
            const winners = await CampaignParticipantsModel.findWinnersByCampaignId(campaignId);
            if (winners && winners.length > 0) {
              await paymentService.sendTokenWinners(campaignId, false);
              paidCampaigns.push(campaignId);
              continue;
            }

            const ranking = await buildFeedbackRank(campaignId, campaign);
            if (ranking.length > 0) {
              await CampaignSugestionBountiesRankModel.updateByCampaignId(campaignId, ranking);
              await paymentService.sendTokenWinners(campaignId, true);
              paidCampaigns.push(campaignId);
              continue;
            }

            errors.push(`Campaign ${campaignId}: Feedback has no eligible winners for automatic rank.`);
          } else if (hasSocial) {
            const winners = await CampaignParticipantsModel.findWinnersByCampaignId(campaignId);
            if (winners && winners.length > 0) {
              await paymentService.sendTokenWinners(campaignId, false);
              paidCampaigns.push(campaignId);
              continue;
            }

            const ranking = await buildDateSubmitRank(campaignId, campaign);
            if (ranking.length > 0) {
              await CampaignSugestionBountiesRankModel.updateByCampaignId(campaignId, ranking);
              await paymentService.sendTokenWinners(campaignId, true);
              paidCampaigns.push(campaignId);
              continue;
            }

            errors.push(`Campaign ${campaignId}: No participants for date-based automatic rank.`);
          } else {
            errors.push(`Campaign ${campaignId}: submission_format not supported for automatic payment.`);
          }
        } catch (err: any) {
          errors.push(`Campaign ${campaignId}: ${err.message || String(err)}`);
        }
      }

      return {
        success: errors.length === 0,
        processedCount: campaigns.length,
        paidCampaigns,
        errors,
        timestamp: new Date(),
        message: paidCampaigns.length > 0
          ? `${paidCampaigns.length} campaign(s) paid. ${errors.length} error(s).`
          : errors.length > 0
            ? `No campaigns paid. ${errors.length} error(s).`
            : 'No eligible campaigns processed.'
      };
    } catch (error: any) {
      return {
        success: false,
        processedCount: 0,
        paidCampaigns: [],
        errors: [error.message || String(error)],
        timestamp: new Date(),
        message: `Job error: ${error.message}`
      };
    }
  }

  public async runCleanupInactiveHosts(): Promise<{
    success: boolean;
    deletedCount: number;
    timestamp: Date;
    message: string;
  }> {
    return this.withLock('cleanup-inactive-hosts', 2 * 60 * 1000, async () => {
      try {
        const deletedCount = await UserModel.deleteInactiveHostsOlderThan(14);
        return {
          success: true,
          deletedCount,
          timestamp: new Date(),
          message: deletedCount > 0
            ? `${deletedCount} inactive HOST(s) removed.`
            : 'No inactive HOST users to remove.'
        };
      } catch (error: any) {
        return {
          success: false,
          deletedCount: 0,
          timestamp: new Date(),
          message: `Job error: ${error.message}`
        };
      }
    }, { success: true, deletedCount: 0, timestamp: new Date(), message: 'Job skipped — already running.' });
  }

  public async runGetMetricsSubmissions(): Promise<{
    success: boolean;
    instagram: { processed: number; updated: number };
    tiktok: { processed: number; updated: number };
    youtube: { processed: number; updated: number };
    timestamp: Date;
    message: string;
  }> {
    const zero = { processed: 0, updated: 0 };
    return this.withLock('get-metrics-submissions', 5 * 60 * 1000, async () => {
      try {
        const [igResult, ttResult, ytResult] = await Promise.all([
          this.processInstagramSubmissions(),
          this.processTiktokSubmissions(),
          this.processYoutubeSubmissions(),
        ]);

        return {
          success: true,
          instagram: igResult,
          tiktok: ttResult,
          youtube: ytResult,
          timestamp: new Date(),
          message: `Job completed. Instagram: ${igResult.updated}/${igResult.processed}, TikTok: ${ttResult.updated}/${ttResult.processed}, YouTube: ${ytResult.updated}/${ytResult.processed}`,
        };
      } catch (error: any) {
        return {
          success: false,
          instagram: zero,
          tiktok: zero,
          youtube: zero,
          timestamp: new Date(),
          message: `Job execution error: ${error.message}`,
        };
      }
    }, { success: true, instagram: zero, tiktok: zero, youtube: zero, timestamp: new Date(), message: 'Job skipped — already running.' });
  }

  private async processInstagramSubmissions(): Promise<{ processed: number; updated: number }> {
    const instagramService = new InstagramService();
    const participants = await CampaignParticipantsModel.findPendingInstagramJobParticipants();
    let updated = 0;
    const processedCampaignIds = new Set<string>();

    for (const participant of participants) {
      try {
        if (!participant.submission_instagram || !instagramService.isInstagramUrl(participant.submission_instagram)) {
          continue;
        }

        const metrics = await instagramService.getPostMetrics(participant.submission_instagram);
        if (!metrics) continue;

        await CampaignParticipantsModel.updateInstagramData(participant._id!.toString(), {
          media_instagram: metrics.media_type,
          views_instagram: metrics.views,
          replies_instagram: metrics.comments,
          likes_instagram: metrics.likes,
        });

        updated++;
        processedCampaignIds.add(participant.campaignId);
        await new Promise(resolve => setTimeout(resolve, API_DELAY_INSTAGRAM_MS));
      } catch (error: any) {
        console.error(`Error processing Instagram participant ${participant._id}:`, error.message);
      }
    }

    const twitterService = new TwitterService();
    for (const campaignId of processedCampaignIds) {
      try {
        const campaign = await CampaignModel.findById(campaignId);
        if (campaign) {
          await CampaignModel.updateById(campaignId, { is_job_instagram_executed: true });
          try {
            const ranking = await twitterService.generateMindshare(campaignId, campaign.host_id);
            await CampaignSugestionBountiesRankModel.updateByCampaignId(campaignId, ranking);
          } catch (error: any) {
            console.error(`[InstagramJob] Erro ao gerar ranking para campanha ${campaignId}:`, error.message);
          }
        }
      } catch (error: any) {
        console.error(`Error finalizing Instagram job for campaign ${campaignId}:`, error.message);
      }
    }

    return { processed: participants.length, updated };
  }

  private async processTiktokSubmissions(): Promise<{ processed: number; updated: number }> {
    const tiktokService = new TiktokService();
    const participants = await CampaignParticipantsModel.findPendingTiktokJobParticipants();
    let updated = 0;
    const processedCampaignIds = new Set<string>();

    for (const participant of participants) {
      try {
        if (!participant.submission_tiktok || !tiktokService.isTiktokUrl(participant.submission_tiktok)) {
          continue;
        }

        const metrics = await tiktokService.getVideoMetrics(participant.submission_tiktok);
        if (!metrics) continue;

        await CampaignParticipantsModel.updateTiktokData(participant._id!.toString(), {
          media_tiktok: 'video',
          views_tiktok: metrics.views,
          replies_tiktok: metrics.comments,
          retweets_tiktok: metrics.shares,
          bookmarks_tiktok: metrics.saves,
          likes_tiktok: metrics.likes,
        });

        updated++;
        processedCampaignIds.add(participant.campaignId);
        await new Promise(resolve => setTimeout(resolve, API_DELAY_TIKTOK_MS));
      } catch (error: any) {
        console.error(`Error processing TikTok participant ${participant._id}:`, error.message);
      }
    }

    const twitterServiceTT = new TwitterService();
    for (const campaignId of processedCampaignIds) {
      try {
        const campaign = await CampaignModel.findById(campaignId);
        if (campaign) {
          await CampaignModel.updateById(campaignId, { is_job_tiktok_executed: true });
          try {
            const ranking = await twitterServiceTT.generateMindshare(campaignId, campaign.host_id);
            await CampaignSugestionBountiesRankModel.updateByCampaignId(campaignId, ranking);
          } catch (error: any) {
            console.error(`[TiktokJob] Erro ao gerar ranking para campanha ${campaignId}:`, error.message);
          }
        }
      } catch (error: any) {
        console.error(`Error finalizing TikTok job for campaign ${campaignId}:`, error.message);
      }
    }

    return { processed: participants.length, updated };
  }

  private async processYoutubeSubmissions(): Promise<{ processed: number; updated: number }> {
    const youtubeService = new YoutubeService();
    const participants = await CampaignParticipantsModel.findPendingYoutubeJobParticipants();
    let updated = 0;
    const processedCampaignIds = new Set<string>();

    for (const participant of participants) {
      try {
        if (!participant.submission_youtube || !youtubeService.isYoutubeUrl(participant.submission_youtube)) {
          continue;
        }

        const metrics = await youtubeService.getVideoMetrics(participant.submission_youtube);
        if (!metrics) continue;

        await CampaignParticipantsModel.updateYoutubeData(participant._id!.toString(), {
          media_youtube: 'video',
          views_youtube: metrics.views,
          replies_youtube: metrics.comments,
          likes_youtube: metrics.likes,
        });

        updated++;
        processedCampaignIds.add(participant.campaignId);
        await new Promise(resolve => setTimeout(resolve, API_DELAY_YOUTUBE_MS));
      } catch (error: any) {
        console.error(`Error processing YouTube participant ${participant._id}:`, error.message);
      }
    }

    const twitterServiceYT = new TwitterService();
    for (const campaignId of processedCampaignIds) {
      try {
        const campaign = await CampaignModel.findById(campaignId);
        if (campaign) {
          await CampaignModel.updateById(campaignId, { is_job_youtube_executed: true });
          try {
            const ranking = await twitterServiceYT.generateMindshare(campaignId, campaign.host_id);
            await CampaignSugestionBountiesRankModel.updateByCampaignId(campaignId, ranking);
          } catch (error: any) {
            console.error(`[YoutubeJob] Erro ao gerar ranking para campanha ${campaignId}:`, error.message);
          }
        }
      } catch (error: any) {
        console.error(`Error finalizing YouTube job for campaign ${campaignId}:`, error.message);
      }
    }

    return { processed: participants.length, updated };
  }

  public async runExpiredStellarEscrowsJob(): Promise<{
    success: boolean;
    processed: number;
    failed: number;
    results: Array<{ jobId: string; status: 'refunded' | 'error'; txHash?: string; error?: string }>;
    timestamp: Date;
    message: string;
  }> {
    return this.withLock('expired-stellar-escrows', 5 * 60 * 1000, async () => {
      try {
        const stellarService = new StellarService();
        const { processed, failed, results } = await stellarService.runExpiredEscrows();
        return {
          success: true,
          processed,
          failed,
          results,
          timestamp: new Date(),
          message: `Job completed. ${processed} escrow(s) refunded, ${failed} failed.`,
        };
      } catch (error: any) {
        return {
          success: false,
          processed: 0,
          failed: 0,
          results: [],
          timestamp: new Date(),
          message: `Job execution error: ${error.message}`,
        };
      }
    }, {
      success: false,
      processed: 0,
      failed: 0,
      results: [],
      timestamp: new Date(),
      message: 'Job skipped — already running.',
    });
  }
}
