import { CommunityMemberStatus } from '../models/CommunityMember';
import { CommunityMessageSenderRole } from '../models/CommunityMessage';
import { RequiredPlatform } from '../models/Campaign';

export interface CreateCommunityDto {
  name: string;
  description: string;
  rules: string;
  logo?: string | undefined;
  required_platforms?: RequiredPlatform[] | undefined;
  enrollment_start?: string | null | undefined;
  enrollment_end?: string | null | undefined;
}

export interface UpdateCommunityDto {
  name?: string | undefined;
  description?: string | undefined;
  rules?: string | undefined;
  logo?: string | undefined;
  required_platforms?: RequiredPlatform[] | undefined;
  enrollment_start?: string | null | undefined;
  enrollment_end?: string | null | undefined;
}

export interface CommunityResponse {
  id: string;
  name: string;
  description: string;
  rules: string;
  logo?: string | undefined;
  required_platforms?: RequiredPlatform[] | undefined;
  enrollment_start?: Date | null | undefined;
  enrollment_end?: Date | null | undefined;
  host_id: string;
  members_count?: number | undefined;
  member_status?: CommunityMemberStatus | undefined;
  created_at: Date;
  updated_at: Date;
}

export interface CommunityDetailResponse extends CommunityResponse {
  members?: CommunityMemberResponse[] | undefined;
  campaigns?: any[] | undefined;
  announcements?: CommunityAnnouncementResponse[] | undefined;
}

export interface CommunityMemberResponse {
  id: string;
  community_id: string;
  creator_id: string;
  status: CommunityMemberStatus;
  requested_at: Date;
  reviewed_at?: Date | undefined;
  reviewed_by?: string | undefined;
  creator?: {
    username: string;
    twitter_username?: string | undefined;
    username_instagram?: string | undefined;
    username_tiktok?: string | undefined;
    username_youtube?: string | undefined;
    username_telegram?: string | undefined;
    username_discord?: string | undefined;
    twitter_profile_image?: string | undefined;
  } | undefined;
}

export interface CreateAnnouncementDto {
  title: string;
  description: string;
  image_url?: string | undefined;
  images?: string[] | undefined;
  link?: string | undefined;
}

export interface UpdateAnnouncementDto {
  title?: string | undefined;
  description?: string | undefined;
  image_url?: string | undefined;
  images?: string[] | undefined;
  link?: string | undefined;
}

export interface CommunityAnnouncementResponse {
  id: string;
  community_id: string;
  title: string;
  description: string;
  image_url?: string | undefined;
  images?: string[] | undefined;
  link?: string | undefined;
  created_by: string;
  pinned: boolean;
  pinned_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMessageDto {
  message: string;
}

export interface CommunityMessageResponse {
  id: string;
  community_id: string;
  sender_id: string;
  sender_role: CommunityMessageSenderRole;
  message: string;
  created_at: Date;
  sender?: {
    username: string;
    twitter_profile_image?: string | undefined;
  } | undefined;
}
