import { IUserCommentCampaign } from '../models/UserCommentCampaign';

export interface CreateCommentDto {
  campaignId: string;
  comment: string;
}

export interface UpdateCommentDto {
  comment: string;
}

export interface CommentResponse {
  id: string;
  userId: string;
  campaignId: string;
  comment: string;
  create_date: Date;
  is_fixed?: boolean;
  twitter_profile_image?: string;
  logo_company?: string;
  username: string;
  userIsEditOrDelete: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CommentListResponse {
  comments: CommentResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function formatCommentResponse(comment: IUserCommentCampaign, user: any, currentUserId?: string): CommentResponse {
  return {
    id: comment._id?.toString() || '',
    userId: comment.userId,
    campaignId: comment.campaignId,
    comment: comment.comment,
    create_date: comment.create_date,
    ...(comment.is_fixed !== undefined && { is_fixed: comment.is_fixed }),
    twitter_profile_image: user?.twitter_profile_image,
    logo_company: user?.logo_company,
    username: user?.username || 'Unknown User',
    userIsEditOrDelete: currentUserId ? comment.userId === currentUserId : false,
    created_at: comment.created_at,
    updated_at: comment.updated_at
  };
}
