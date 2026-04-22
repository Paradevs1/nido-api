import { ICampaignParticipants } from '../models/CampaignParticipants';

export interface CreateCampaignParticipantDto {
  userId: string;
  campaignId: string;
  date_submit: Date;
  amount_received: number;
  date_received?: Date;
  submission_twitter: string;
  submission_tiktok: string;
  submission_instagram: string;
  submission_youtube: string;
  submission_feedback: string;
}

export interface CreateCampaignWinnersDto {
  user_id: string;
  rank: number;
}

export interface UpdateCampaignParticipantDto {
  date_submit?: Date;
  amount_received?: number;
  date_received?: Date;
  submission_twitter?: string;
  submission_tiktok?: string;
  submission_instagram?: string;
  submission_youtube?: string;
  submission_feedback?: string;
}

export interface CampaignParticipantResponse {
  id: string;
  userId: string;
  campaignId: string;
  date_submit: Date;
  amount_received: number;
  date_received?: Date;
  submission_twitter: string;
  submission_tiktok: string;
  submission_instagram: string;
  submission_youtube: string;
  submission_feedback: string;
  submissions_kols?: string[];
  submissions_images?: string[]; // Base64 encoded images
  winner: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignParticipantListResponse {
  participants: CampaignParticipantResponse[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export interface CampaignParticipantFilters {
  userId?: string;
  campaignId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  hasReceived?: boolean;
  page?: number;
  limit?: number;
}

export interface CampaignParticipantStats {
  totalParticipants: number;
  totalAmountDistributed: number;
  averageAmount: number;
  participantsWithRewards: number;
}

export interface DetailedDeadline {
  days: number;
  hours: number;
  minutes: number;
  total_minutes: number;
  is_expired: boolean;
}

export interface SubmittedCampaignResponse {
  campaignId: string;
  title: string;
  about_project: string;
  status: string;
  total_prize_pool: number;
  deadline: number;
  deadline_detailed: DetailedDeadline;
  content_categories: Array<{
    slug: string;
    description?: string;
  }>;
  total_submissions: number;
  isPrivate?: boolean;
  is_cac?: boolean;
  user_amount?: number;
}

export function formatCampaignParticipantResponse(participant: ICampaignParticipants): CampaignParticipantResponse {
  return {
    id: participant._id?.toString() || '',
    userId: participant.userId,
    campaignId: participant.campaignId,
    date_submit: participant.date_submit,
    amount_received: participant.amount_received,
    submission_twitter: participant.submission_twitter,
    submission_tiktok: participant.submission_tiktok,
    submission_instagram: participant.submission_instagram,
    submission_youtube: participant.submission_youtube,
    submission_feedback: participant.submission_feedback ?? '',
    submissions_kols: participant.submissions_kols || [],
    submissions_images: participant.submissions_images || [],
    winner: participant.winner,
    created_at: participant.created_at,
    updated_at: participant.updated_at,
    ...(participant.date_received && { date_received: participant.date_received })
  };
}

// Função para formatar lista de participantes
export function formatCampaignParticipantListResponse(
  participants: ICampaignParticipants[],
  currentPage: number,
  totalPages: number,
  totalCount: number
): CampaignParticipantListResponse {
  return {
    participants: participants.map(formatCampaignParticipantResponse),
    currentPage,
    totalPages,
    totalCount
  };
}
