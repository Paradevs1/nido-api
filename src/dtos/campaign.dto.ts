import { ICampaign, OfficialLink, SupportContact, RewardTier, ContentFormat, SubmissionFormat, ContentCategory, Country, KolReward } from '../models/Campaign';

export interface CreateCampaignDto {
  title: string;
  about_project: string;
  what_we_need: string;
  content_type: string;
  content_pillars: string;
  benefits: string;
  requirements: string;
  submission_format: SubmissionFormat[];
  content_format: ContentFormat[];
  content_categories: ContentCategory[];
  target_blockchain: string;
  official_links: OfficialLink[];
  support_contact: SupportContact[];
  country: Country[];
  start_date: Date;
  end_date: Date;
  payment_chain: string;
  payment_token: string; // [USDT, USDC, HONEY]
  max_participants: number;
  winner_count: number | null; // null when using mindshare scoring (no reward tiers)
  reward_tiers: RewardTier[];
  total_prize_pool: number;
  links_officials: string[];
  original_url_shortener?: string;
  list_kols?: KolReward[];
  qtd_min_links?: number;
  qtd_max_links?: number;
  isPrivate?: boolean;
  is_cac?: boolean;
  format_cac?: 'clicks' | 'view';
  quantity_conversion?: number;
  amount_convertion?: number;
  limit_amount_convertion?: number;
  community_id?: string;

}

export interface UpdateCampaignDto {
    title: string;
    about_project: string;
    what_we_need: string;
    content_type: string;
    content_pillars: string;
    benefits: string;
    requirements: string;
    submission_format: SubmissionFormat[];
    content_format: ContentFormat[];
    content_categories: ContentCategory[];
    target_blockchain: string;
    official_links: OfficialLink[];
    support_contact: SupportContact[];
    country: Country[];
    start_date: Date;
    end_date: Date;
    payment_chain: string;
    payment_token: string; // [USDT, USDC, HONEY]
    max_participants: number;
    winner_count: number | null; // null when using mindshare scoring (no reward tiers)
    reward_tiers: RewardTier[];
    total_prize_pool: number;
  links_officials: string[];
  original_url_shortener?: string;
  list_kols?: KolReward[];
  qtdMinLinks?: number;
  qtdMaxLinks?: number;
  isPrivate?: boolean;
  is_cac?: boolean;
  format_cac?: 'clicks' | 'view';
  quantity_conversion?: number;
  amount_convertion?: number;
  limit_amount_convertion?: number;
  community_id?: string;

}

export interface DetailedDeadline {
  days: number;
  hours: number;
  minutes: number;
  total_minutes: number;
  is_expired: boolean;
}

export interface CampaignResponse {
  id: string;
  host_id: string;
  title: string;
  about_project: string;
  what_we_need: string;
  content_type: string;
  content_pillars: string;
  benefits: string;
  requirements: string;
  submission_format: SubmissionFormat[];
  content_format: ContentFormat[];
  content_categories: ContentCategory[];
  target_blockchain: string;
  official_links: OfficialLink[];
  support_contact: SupportContact[];
  country: Country[];
  start_date: Date;
  end_date: Date;
  deadline: number;
  deadline_detailed: DetailedDeadline;
  payment_chain: string;
  payment_token: string;
  max_participants: number;
  winner_count: number | null; // null when using mindshare scoring (no reward tiers)
  reward_tiers: RewardTier[];
  total_prize_pool: number;
  links_officials: string[];
  original_url_shortener?: string;
  list_kols?: KolReward[];
  submissions_kols?: string[];
  submissions_images?: string[]; // Base64 encoded images
  qtd_min_links?: number;
  qtd_max_links?: number;
  status: ICampaign['status'];
  payment_received: boolean;
  rewards_distributed: boolean;
  isPrivate?: boolean;
  is_cac?: boolean;
  format_cac?: 'clicks' | 'view';
  quantity_conversion?: number;
  amount_convertion?: number;
  limit_amount_convertion?: number;
  community_id?: string;

  created_at: Date;
  updated_at: Date;
}

export interface CampaignListResponse {
  campaigns: CampaignResponse[];
  total: number;
  page: number;
  totalPages: number;
}
