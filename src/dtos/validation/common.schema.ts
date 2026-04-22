import { z } from 'zod';

export const mongoIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}).passthrough();

export const campaignIdParam = z.object({
  campaignId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid campaign ID format'),
});

export const walletsSchema = z.object({
  wallet_evm: z.string().max(100).optional().nullable(),
  wallet_sol: z.string().max(100).optional().nullable(),
  wallet_sui: z.string().max(200).optional().nullable(),
  wallet_stellar: z.string().max(100).optional().nullable(),
}).refine(data => data.wallet_evm !== undefined || data.wallet_sol !== undefined || data.wallet_sui !== undefined || data.wallet_stellar !== undefined, {
  message: 'At least one wallet address is required'
});

export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email format'),
});

export const commentSchema = z.object({
  campaignId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid campaign ID format'),
  comment: z.string().min(1, 'Comment is required').max(2000, 'Comment must be at most 2000 characters'),
});

export const updateCommentSchema = z.object({
  comment: z.string().min(1, 'Comment is required').max(2000, 'Comment must be at most 2000 characters'),
});
