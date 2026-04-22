import type { ContentCategoryUser, AudienceSize } from '../models/User';

/** Campos permitidos em PUT /api/creator/update-profile (não altera first_login) */
export interface UpdateProfileDto {
  description?: string;
  username_twitter?: string;
  username_youtube?: string;
  username_tiktok?: string;
  username_instagram?: string;
  username_telegram?: string;
  username_discord?: string;
  primary_language?: string;
  fluent_language?: string;
  fluent_language_others?: string;
  audience_region?: string[];
  average_views_per_post?: string;
  content_category_list?: ContentCategoryUser[];
  content_formats?: string[];
  example_content_links?: string;
  audience_size?: AudienceSize;
  wallet_evm?: string;
  wallet_sol?: string;
  wallet_sui?: string;
  wallet_stellar?: string;
  crypto_experience?: string;
  trading_experience?: string;
  main_chains?: string[];
  main_chains_other?: string;
  crypto_content_specialization?: string[];
  favorite_protocols_projects?: string;
  investment_participation_style?: string;
}

/** Lista de chaves de UpdateProfileDto para iteração */
export const UPDATE_PROFILE_KEYS: (keyof UpdateProfileDto)[] = [
  'description',
  'username_twitter',
  'username_youtube',
  'username_tiktok',
  'username_instagram',
  'username_telegram',
  'username_discord',
  'primary_language',
  'fluent_language',
  'fluent_language_others',
  'audience_region',
  'average_views_per_post',
  'content_category_list',
  'content_formats',
  'example_content_links',
  'audience_size',
  'wallet_evm',
  'wallet_sol',
  'wallet_sui',
  'wallet_stellar',
  'crypto_experience',
  'trading_experience',
  'main_chains',
  'main_chains_other',
  'crypto_content_specialization',
  'favorite_protocols_projects',
  'investment_participation_style'
];

/** Campos permitidos em PUT /api/creator/update-profile-after-login (ao finalizar define first_login = false) */
export interface UpdateProfileAfterLoginDto {
  username_twitter?: string;
  username_youtube?: string;
  username_tiktok?: string;
  username_instagram?: string;
  username_telegram?: string;
  username_discord?: string;
  primary_language?: string;
  fluent_language?: string;
  fluent_language_others?: string;
  audience_region?: string[];
  average_views_per_post?: string;
  content_category_list?: ContentCategoryUser[];
  content_formats?: string[];
  example_content_links?: string;
  audience_size?: AudienceSize;
  wallet_evm?: string;
  wallet_sol?: string;
  wallet_sui?: string;
  wallet_stellar?: string;
  crypto_experience?: string;
  trading_experience?: string;
  main_chains?: string[];
  main_chains_other?: string;
  crypto_content_specialization?: string[];
  favorite_protocols_projects?: string;
  investment_participation_style?: string;
}

/** Lista de chaves de UpdateProfileAfterLoginDto para iteração */
export const UPDATE_PROFILE_AFTER_LOGIN_KEYS: (keyof UpdateProfileAfterLoginDto)[] = [
  'username_twitter',
  'username_youtube',
  'username_tiktok',
  'username_instagram',
  'username_telegram',
  'username_discord',
  'primary_language',
  'fluent_language',
  'fluent_language_others',
  'audience_region',
  'average_views_per_post',
  'content_category_list',
  'content_formats',
  'example_content_links',
  'audience_size',
  'wallet_evm',
  'wallet_sol',
  'wallet_sui',
  'wallet_stellar',
  'crypto_experience',
  'trading_experience',
  'main_chains',
  'main_chains_other',
  'crypto_content_specialization',
  'favorite_protocols_projects',
  'investment_participation_style'
];
