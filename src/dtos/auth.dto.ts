
export interface RegisterData {
  username: string;
  email: string;
  password: string;
  user_type?: 'CREATOR' | 'HOST' | 'ADMIN';
}

export interface User {
  id: string;
  username: string;
  user_type: 'CREATOR' | 'HOST' | 'ADMIN';
  email: string;
  email_verified: boolean;
  isActive: boolean;
  status?: 'active' | 'inactive';
  discord_id?: string;
  google_id?: string;
  campaigns_created: number;
  twitter_id?: string;
  twitter_username?: string;
  twitter_display_name?: string;
  twitter_profile_image?: string;
  twitter_verified?: boolean;
  twitter_followers_count?: number;
  total_earnings?: number;
  position_company?: string;
  telegram_username?: string;
  name_company?: string;
  website_company?: string;
  social_media?: Array<{
    type: 'discord' | 'github' | 'youtube' | 'other';
    url: string;
  }>;
  introduction_company?: string;
  logo_company?: string;
  categories_atuation?: Array<{
    slug: string;
  }>;
  registerCompleted?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LoginUserResponse {
  id: string;
  username: string;
  user_type: 'CREATOR' | 'HOST' | 'ADMIN';
  email: string;
  isActive: boolean;
  registerCompleted: boolean;
  status?: 'active' | 'inactive';
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token: string;
}

export interface LoginResult {
  success: boolean;
  user: LoginUserResponse;
  token: string;
}

export interface UpdateProfileDto {
  username?: string;
  twitter_username?: string;
  twitter_profile_image?: string;
  position_company?: string;
  telegram_username?: string;
  name_company?: string;
  website_company?: string;
  social_media?: Array<{
    type: 'discord' | 'github' | 'youtube' | 'other';
    url: string;
  }>;
  introduction_company?: string;
  logo_company?: string;
  categories_atuation?: Array<{
    slug: string;
  }>;
}

export interface RegisterHostPartTwoDto {
  username: string;
  position_company: string;
  twitter_username?: string;
  telegram_username?: string;
  name_company: string;
  website_company?: string;
  social_media?: Array<{
    type: 'discord' | 'github' | 'youtube' | 'other';
    url: string;
  }>;
  introduction_company: string;
  logo_company?: string; // Base64 da imagem
  categories_atuation: Array<{
    slug: string;
    description?: string;
  }>;
}
