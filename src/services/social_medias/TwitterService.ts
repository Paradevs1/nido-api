import { TwitterApiResponseDTO, TweetDTO } from '../../dtos/twitter.dto';
import { CampaignModel } from '../../models/Campaign';
import { CampaignParticipantsModel } from '../../models/CampaignParticipants';
import { IRankEntry } from '../../models/CampaignSugestionBountiesRank';
import { UserModel } from '../../models/User';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { EXTERNAL_API_TIMEOUT_MS, MAX_PARTICIPANTS_LIMIT } from '../../utils/consts';
import { getMaxWinners } from '../../utils/generateRanksJob';

export class TwitterService {
    private readonly base_url = 'https://api.twitterapi.io';
    private readonly api_key: string;

    constructor() {
        this.api_key = process.env['TWITTER_API_KEY_TO_JOBS'] || '';
        if (!this.api_key) console.warn('TWITTER_API_KEY_TO_JOBS not set in environment variables');
    }

    async getTweetsByIds(twitterUrl: string): Promise<TwitterApiResponseDTO> {
        const tweetId = this.extractTweetId(twitterUrl);

        if (!tweetId) throw new Error(`Could not extract tweet ID from URL: ${twitterUrl}`);

        try {
            const response = await fetchWithTimeout(`${this.base_url}/twitter/tweets?tweet_ids=${tweetId}`, {
                method: 'GET',
                headers: {
                    'X-API-Key': this.api_key,
                    'Content-Type': 'application/json'
                },
                timeoutMs: EXTERNAL_API_TIMEOUT_MS
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error fetching tweets: ${response.status} - ${errorText}`);
            }

            const data = await response.json() as TwitterApiResponseDTO;
            
            if (data.status === 'error') throw new Error(data.msg || 'Error fetching tweets');

            return data;
        } catch (error) {
            if (error instanceof Error) throw error;
            throw new Error('Unknown error fetching tweets');
        }
    }

    async getUserInfoByUsername(userName: string): Promise<{ followers: number } | null> {
        if (!userName || userName.trim() === '') return null;
        const cleanName = userName.replace(/^@/, '').trim();
        if (!cleanName) return null;

        try {
            const url = new URL(`${this.base_url}/twitter/user/info`);
            url.searchParams.set('userName', cleanName);
            const response = await fetchWithTimeout(url.toString(), {
                method: 'GET',
                headers: {
                    'X-API-Key': this.api_key,
                    'Content-Type': 'application/json'
                },
                timeoutMs: EXTERNAL_API_TIMEOUT_MS
            });

            if (!response.ok) return null;
            const data = await response.json() as { status?: string; data?: { followers?: number } };
            if (data.status !== 'success' || !data.data) return null;
            const followers = typeof data.data.followers === 'number' ? data.data.followers : 0;
            return { followers };
        } catch {
            return null;
        }
    }

    private extractTweetId(twitterUrl: string): string | null {
        if (!twitterUrl) return null;

        const cleanUrl = twitterUrl.trim();

        // Padrões possíveis:
        // https://x.com/username/status/1234567890
        // https://twitter.com/username/status/1234567890
        // x.com/username/status/1234567890
        // twitter.com/username/status/1234567890
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)/i,
            /\/status\/(\d+)/i
        ];

        for (const pattern of patterns) {
            const match = cleanUrl.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        if (/^\d+$/.test(cleanUrl)) {
            return cleanUrl;
        }

        return null;
    }

    public hasTweetIdInUrl(twitterUrl: string): boolean {
        return this.extractTweetId(twitterUrl) !== null;
    }

    public calculateWeightedEngagement(tweet: { replies_twitter?: number; retweets_twitter?: number; quotes_twitter?: number; bookmarks_twitter?: number; likes_twitter?: number }): number {
        // Engagement Weighting (Kaito-inspired)
        // Like: 1, Bookmark: 2, Repost: 3, Reply: 4, Quote: 5
        const likes = (tweet.likes_twitter || 0) * 1;
        const bookmarks = (tweet.bookmarks_twitter || 0) * 2;
        const reposts = (tweet.retweets_twitter || 0) * 3;
        const replies = (tweet.replies_twitter || 0) * 4;
        const quotes = (tweet.quotes_twitter || 0) * 5;

        return likes + bookmarks + reposts + replies + quotes;
    }

    public calculateInstagramEngagement(participant: { views_instagram?: number; likes_instagram?: number; replies_instagram?: number }): number {
        // Like: 1, Reply/Comment: 4
        const likes = (participant.likes_instagram || 0) * 1;
        const replies = (participant.replies_instagram || 0) * 4;
        return likes + replies;
    }

    public calculateTiktokEngagement(participant: { likes_tiktok?: number; replies_tiktok?: number; retweets_tiktok?: number; bookmarks_tiktok?: number }): number {
        // Like: 1, Bookmark/Save: 2, Share: 3, Comment: 4
        const likes = (participant.likes_tiktok || 0) * 1;
        const bookmarks = (participant.bookmarks_tiktok || 0) * 2;
        const shares = (participant.retweets_tiktok || 0) * 3;
        const replies = (participant.replies_tiktok || 0) * 4;
        return likes + bookmarks + shares + replies;
    }

    public calculateYoutubeEngagement(participant: { likes_youtube?: number; replies_youtube?: number }): number {
        // Like: 1, Comment: 4
        const likes = (participant.likes_youtube || 0) * 1;
        const replies = (participant.replies_youtube || 0) * 4;
        return likes + replies;
    }

    public calculateEffortMultiplier(tweet: { content_length?: number; media_twitter?: string }): number {
        const contentLength = tweet.content_length || 0;

        // Media-based adjustments
        if (tweet.media_twitter === 'video') {
            // Video always gets the higher multiplier, independent of length
            return 1.25;
        }

        if (tweet.media_twitter === 'image') {
            // Preserve behavior: long image tweets (threads) get 1.1, shorter image tweets get 1.0
            if (contentLength > 280) {
                return 1.1;
            }
            return 1.0;
        }

        // Text-only (or unsupported media) adjustments based on length
        if (contentLength <= 120) {
            return 0.9;
        }

        if (contentLength <= 280) {
            return 1.0;
        }

        // Thread: long text without media
        return 1.1;
    }

    public async generateMindshare(campaignId: string, hostId: string): Promise<IRankEntry[]> {
        const campaign = await CampaignModel.findById(campaignId);
        if (!campaign) throw new Error('Campaign not found');
        if (campaign.host_id !== hostId) throw new Error('You do not have permission to access this campaign');

        const result = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, MAX_PARTICIPANTS_LIMIT);
        const participants = result.participants;

        console.log('🏆 Generating ranking...');
        console.log(`📊 Data: ${participants.length > 0 ? 'OK' : 'empty'}`);

        // Calcula engagement de todas as plataformas que o participante tiver link
        const participantsWithMetrics = participants.map((participant) => {
            let totalEngagement = 0;

            // Twitter
            if (participant.submission_twitter && participant.submission_twitter.trim() !== '') {
                const twitterEngagement = this.calculateWeightedEngagement({
                    replies_twitter: participant.replies_twitter,
                    retweets_twitter: participant.retweets_twitter,
                    quotes_twitter: participant.quotes_twitter,
                    bookmarks_twitter: participant.bookmarks_twitter,
                    likes_twitter: participant.likes_twitter
                });

                const effortMultiplier = this.calculateEffortMultiplier({
                    content_length: participant.content_length,
                    media_twitter: participant.media_twitter
                });

                totalEngagement += twitterEngagement * effortMultiplier;
            }

            // Instagram
            if (participant.submission_instagram && participant.submission_instagram.trim() !== '') {
                totalEngagement += this.calculateInstagramEngagement({
                    views_instagram: participant.views_instagram,
                    likes_instagram: participant.likes_instagram,
                    replies_instagram: participant.replies_instagram
                });
            }

            // TikTok
            if (participant.submission_tiktok && participant.submission_tiktok.trim() !== '') {
                totalEngagement += this.calculateTiktokEngagement({
                    likes_tiktok: participant.likes_tiktok,
                    replies_tiktok: participant.replies_tiktok,
                    retweets_tiktok: participant.retweets_tiktok,
                    bookmarks_tiktok: participant.bookmarks_tiktok
                });
            }

            // YouTube
            if (participant.submission_youtube && participant.submission_youtube.trim() !== '') {
                totalEngagement += this.calculateYoutubeEngagement({
                    likes_youtube: participant.likes_youtube,
                    replies_youtube: participant.replies_youtube
                });
            }

            return {
                participant,
                finalEngagement: totalEngagement
            };
        });

        const totalFinalEngagement = participantsWithMetrics.reduce((sum, item) => sum + item.finalEngagement, 0);

        // Calcula a share do engage
        const participantsWithShare = participantsWithMetrics.map(item => {
            //razão entre engage do user e o total de engage ( ex 500/1000 = 50%)
            const engagementShare = totalFinalEngagement > 0 ? item.finalEngagement / totalFinalEngagement : 0;

            return {
                participant: item.participant,
                finalEngagement: item.finalEngagement,
                engagementShare
            };
        });

        // Sort dos resultados
        participantsWithShare.sort((a, b) => b.finalEngagement - a.finalEngagement);

        const maxWinners = getMaxWinners(campaign);
        const top = maxWinners > 0 ? participantsWithShare.slice(0, maxWinners) : participantsWithShare;

        const userIds = top.map(p => p.participant.userId);
        const users = await Promise.all(userIds.map(userId => UserModel.findById(userId)));

        //Rankeia baseado nos tiers da campanha
        const rankedParticipants = top.map((item, index) => {
            const user = users.find(u => u && u._id?.toString() === item.participant.userId);
            const rank = index + 1;

            let amount_received = 0;

            if (campaign.reward_tiers && campaign.reward_tiers.length > 0) {
                const rewardTier = campaign.reward_tiers.find(
                    tier => {
                        const positionInitial = Number(tier.position_initial);
                        const positionFinal = Number(tier.position_final);
                        return rank >= positionInitial && rank <= positionFinal;
                    }
                );

                if (rewardTier) {
                    amount_received = Number(rewardTier.payment_amount);
                }
            //Reward baseado no share de engajamento
            } else if (campaign.total_prize_pool > 0) {
                const totalParticipants = participantsWithShare.length;
                if (totalParticipants > 0) {
                    //pool total mult pelo share do user, arredondado
                    amount_received = Math.round(campaign.total_prize_pool * item.engagementShare);
                }
            }

            const p = item.participant;
            return {
                rank,
                username: user?.username || '',
                amount_received,
                submission_twitter: p.submission_twitter,
                user_id: p.userId,
                campaign_id: campaignId,
                mindshare_score: item.engagementShare * 100,
                views_twitter: p.views_twitter || 0,
                likes_twitter: p.likes_twitter || 0,
                retweets_twitter: p.retweets_twitter || 0,
                replies_twitter: p.replies_twitter || 0,
                quotes_twitter: p.quotes_twitter || 0,
                bookmarks_twitter: p.bookmarks_twitter || 0,
                submission_instagram: p.submission_instagram || '',
                views_instagram: p.views_instagram || 0,
                likes_instagram: p.likes_instagram || 0,
                replies_instagram: p.replies_instagram || 0,
                submission_tiktok: p.submission_tiktok || '',
                views_tiktok: p.views_tiktok || 0,
                likes_tiktok: p.likes_tiktok || 0,
                replies_tiktok: p.replies_tiktok || 0,
                retweets_tiktok: p.retweets_tiktok || 0,
                bookmarks_tiktok: p.bookmarks_tiktok || 0,
                submission_youtube: p.submission_youtube || '',
                views_youtube: p.views_youtube || 0,
                likes_youtube: p.likes_youtube || 0,
                replies_youtube: p.replies_youtube || 0,
            };
        });

        return rankedParticipants.filter(p => p.amount_received > 0);
    }
}
