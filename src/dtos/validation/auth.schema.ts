import { z } from 'zod';

export const registerHostSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_.\-@]+$/, 'Username can only contain letters, numbers, underscores, dots, hyphens and @'),
  email: z.string()
    .trim()
    .toLowerCase()
    .max(255, 'Email must be at most 255 characters')
    .refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export const registerHostPartTwoSchema = z.object({
  name_company: z.string().min(1).max(200).optional(),
  position_company: z.string().max(200).optional(),
  website_company: z.string().max(500).refine(v => v === '' || /^https?:\/\/.+/.test(v), 'Invalid URL').optional().or(z.literal('')),
  telegram_username: z.string().max(100).optional(),
  introduction_company: z.string().max(5000).optional(),
  logo_company: z.string().max(5_000_000).optional(), // base64 ~3.7MB image
  categories_atuation: z.array(z.object({ slug: z.string().max(100) })).optional(),
  social_media: z.array(z.object({
    type: z.enum(['discord', 'github', 'youtube', 'other']),
    url: z.string().max(500).refine(v => /^https?:\/\/.+/.test(v), 'Invalid URL')
  })).optional(),
}).passthrough();

export const loginHostSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .max(255)
    .refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email format'),
  password: z.string()
    .min(1, 'Password is required')
    .max(128),
});

export const loginCreatorSchema = z.object({
  user: z.object({}).passthrough(),
  loginMethod: z.enum(['twitter', 'google', 'tiktok', 'instagram']),
}).passthrough();

export const userExistSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email format').optional(),
  username: z.string().max(100).optional(),
  twitter_id: z.string().max(100).optional(),
  tiktok_id: z.string().max(100).optional(),
  google_id: z.string().max(100).optional(),
}).refine(data => Object.values(data).some(v => v), {
  message: 'At least one identifier is required'
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export const mongoIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

export const hostIdParamSchema = z.object({
  host_id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid host ID format'),
});
