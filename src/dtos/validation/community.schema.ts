import { z } from 'zod';

const ALLOWED_IMAGE_PREFIXES = [
  'data:image/jpeg;base64,',
  'data:image/jpg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,'
];

const MAX_IMAGE_SIZE = 5_000_000; // ~3.7MB actual image

const base64ImageSchema = z.string()
  .max(MAX_IMAGE_SIZE, 'Image must be at most 5MB')
  .refine(
    (val) => ALLOWED_IMAGE_PREFIXES.some(prefix => val.startsWith(prefix)),
    'Image must be a valid base64 encoded image (jpg, jpeg, png, webp)'
  );

const VALID_REQUIRED_PLATFORMS = ['DISCORD', 'INSTAGRAM', 'TWITTER', 'TIKTOK', 'YOUTUBE', 'TELEGRAM'] as const;

export const createCommunitySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters'),
  description: z.string()
    .min(1, 'Description is required')
    .max(5000, 'Description must be at most 5000 characters'),
  rules: z.string()
    .min(1, 'Rules are required')
    .max(10000, 'Rules must be at most 10000 characters'),
  logo: base64ImageSchema.optional(),
  required_platforms: z.array(z.enum(VALID_REQUIRED_PLATFORMS))
    .min(1, 'At least one platform is required')
    .optional(),
  enrollment_start: z.string().datetime().nullable().optional(),
  enrollment_end: z.string().datetime().nullable().optional(),
}).refine(
  (data) => {
    if (data.enrollment_end && !data.enrollment_start) return false;
    return true;
  },
  { message: 'enrollment_start is required when enrollment_end is provided', path: ['enrollment_start'] }
);

export const updateCommunitySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters')
    .optional(),
  description: z.string()
    .min(1, 'Description is required')
    .max(5000, 'Description must be at most 5000 characters')
    .optional(),
  rules: z.string()
    .min(1, 'Rules are required')
    .max(10000, 'Rules must be at most 10000 characters')
    .optional(),
  logo: base64ImageSchema.optional(),
  required_platforms: z.array(z.enum(VALID_REQUIRED_PLATFORMS))
    .min(1, 'At least one platform is required')
    .optional(),
  enrollment_start: z.string().datetime().nullable().optional(),
  enrollment_end: z.string().datetime().nullable().optional(),
}).refine(
  (data) => {
    if (data.enrollment_end && !data.enrollment_start) return false;
    return true;
  },
  { message: 'enrollment_start is required when enrollment_end is provided', path: ['enrollment_start'] }
);

export const createAnnouncementSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(300, 'Title must be at most 300 characters'),
  description: z.string()
    .min(1, 'Description is required')
    .max(10000, 'Description must be at most 10000 characters'),
  image_url: base64ImageSchema.optional(),
  images: z.array(base64ImageSchema).max(5, 'Maximum 5 images allowed').optional(),
  link: z.string().max(2000, 'Link must be at most 2000 characters')
    .refine(v => v === '' || /^https?:\/\/.+/.test(v), 'Link must be a valid URL')
    .optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(300, 'Title must be at most 300 characters')
    .optional(),
  description: z.string()
    .min(1, 'Description is required')
    .max(10000, 'Description must be at most 10000 characters')
    .optional(),
  image_url: base64ImageSchema.optional(),
  images: z.array(base64ImageSchema).max(5, 'Maximum 5 images allowed').optional(),
  link: z.string().max(2000, 'Link must be at most 2000 characters')
    .refine(v => v === '' || /^https?:\/\/.+/.test(v), 'Link must be a valid URL')
    .optional(),
});

export const createMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(5000, 'Message must be at most 5000 characters'),
});

export const communityIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid community ID format'),
});

export const memberIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid community ID format'),
  memberId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid member ID format'),
});

export const announcementIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid community ID format'),
  announcementId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid announcement ID format'),
});

export const messageIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid community ID format'),
  messageId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid message ID format'),
});

export const membersQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const paginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const createCommunityCampaignSchema = z.object({}).passthrough();
