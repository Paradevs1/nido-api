import { ICampaign } from '../models/Campaign';
import { CampaignParticipantsModel } from '../models/CampaignParticipants';
import { IRankEntry } from '../models/CampaignSugestionBountiesRank';
import { UserModel } from '../models/User';
import { hasOffensiveWord, hasLink } from './rulesGenerateRankJob';
import { MAX_PARTICIPANTS_LIMIT } from './consts';

export function getMaxWinners(campaign: ICampaign): number {
  if (campaign.reward_tiers && campaign.reward_tiers.length > 0) {
    return Math.max(...campaign.reward_tiers.map(t => Number(t.position_final)));
  }
  return campaign.winner_count ?? 0;
}

export async function buildFeedbackRank(campaignId: string, campaign: ICampaign): Promise<IRankEntry[]> {
  const { participants } = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, MAX_PARTICIPANTS_LIMIT);
  const withFeedback = participants.filter(p => p.submission_feedback != null && String(p.submission_feedback).trim() !== '');
  const scored = withFeedback.map(p => {
    const text = String(p.submission_feedback).trim();
    if (hasOffensiveWord(text)) return { participant: p, points: 0, discarded: true };

    let points = 0;

    if (text.length >= 100) points += 10;

    if (hasLink(text)) points += 5;

    points += 10;

    return { participant: p, points, discarded: false };
  });

  const valid = scored.filter(s => !s.discarded && s.points > 0);

  valid.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return new Date(a.participant.date_submit).getTime() - new Date(b.participant.date_submit).getTime();
  });

  const maxWinners = getMaxWinners(campaign);
  const top = maxWinners > 0 ? valid.slice(0, maxWinners) : valid;

  const userIds = top.map(t => t.participant.userId);
  const usersMap = await UserModel.findByIds(userIds);

  const ranking: IRankEntry[] = top.map((item, index) => {
    const user = usersMap.get(item.participant.userId);
    const rank = index + 1;
    let amount_received = 0;

    if (campaign.reward_tiers && campaign.reward_tiers.length > 0) {
      const tier = campaign.reward_tiers.find(
        t => rank >= Number(t.position_initial) && rank <= Number(t.position_final)
      );
      if (tier) amount_received = Number(tier.payment_amount);
    } else if (campaign.total_prize_pool > 0 && top.length > 0) {
      amount_received = Math.round(campaign.total_prize_pool / top.length);
    }

    return {
      rank,
      username: user?.username ?? '',
      amount_received,
      submission_twitter: item.participant.submission_feedback ?? '',
      user_id: item.participant.userId,
      campaign_id: campaignId,
      mindshare_score: item.points,
      views_twitter: 0,
      likes_twitter: 0,
      retweets_twitter: 0,
      replies_twitter: 0,
      quotes_twitter: 0,
      bookmarks_twitter: 0,
      submission_instagram: '',
      views_instagram: 0,
      likes_instagram: 0,
      replies_instagram: 0,
      submission_tiktok: '',
      views_tiktok: 0,
      likes_tiktok: 0,
      replies_tiktok: 0,
      retweets_tiktok: 0,
      bookmarks_tiktok: 0,
      submission_youtube: '',
      views_youtube: 0,
      likes_youtube: 0,
      replies_youtube: 0,
    };
  });

  return ranking.filter(r => r.amount_received > 0);
}

export async function buildDateSubmitRank(campaignId: string, campaign: ICampaign): Promise<IRankEntry[]> {
  const { participants } = await CampaignParticipantsModel.findByCampaignId(campaignId, 1, MAX_PARTICIPANTS_LIMIT);
  const withSubmission = participants.filter(p => {
    const hasAny = (p.submission_instagram && p.submission_instagram.trim() !== '') ||
      (p.submission_tiktok && p.submission_tiktok.trim() !== '') ||
      (p.submission_youtube && p.submission_youtube.trim() !== '');
    return hasAny;
  });

  withSubmission.sort((a, b) => new Date(a.date_submit).getTime() - new Date(b.date_submit).getTime());

  const maxWinners = getMaxWinners(campaign);
  const top = maxWinners > 0 ? withSubmission.slice(0, maxWinners) : withSubmission;

  const userIds = top.map(p => p.userId);
  const usersMap = await UserModel.findByIds(userIds);

  const ranking: IRankEntry[] = top.map((p, index) => {
    const user = usersMap.get(p.userId);
    const rank = index + 1;
    let amount_received = 0;

    if (campaign.reward_tiers && campaign.reward_tiers.length > 0) {
      const tier = campaign.reward_tiers.find(
        t => rank >= Number(t.position_initial) && rank <= Number(t.position_final)
      );
      if (tier) amount_received = Number(tier.payment_amount);
    } else if (campaign.total_prize_pool > 0 && top.length > 0) {
      amount_received = Math.round(campaign.total_prize_pool / top.length);
    }

    return {
      rank,
      username: user?.username ?? '',
      amount_received,
      submission_twitter: p.submission_twitter || '',
      user_id: p.userId,
      campaign_id: campaignId,
      mindshare_score: 0,
      views_twitter: 0,
      likes_twitter: 0,
      retweets_twitter: 0,
      replies_twitter: 0,
      quotes_twitter: 0,
      bookmarks_twitter: 0,
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

  return ranking.filter(r => r.amount_received > 0);
}
