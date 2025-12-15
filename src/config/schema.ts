import { z } from 'zod';

const urlSchema = z.string().min(1, 'url is required').refine(
  (val) => {
    try {
      const url = new URL(val);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'url must be a valid HTTP/HTTPS URL' },
);

const positiveOrInfinitySchema = z.union([z.number().positive(), z.literal(Infinity)]);

const crawlProfileSchema = z.enum(['quick', 'standard', 'deep', 'full']);

const geoPresetSchema = z.enum(['us', 'uk', 'eu', 'asia']);

export const crawlConfigSchema = z.object({
  url: urlSchema,
  profile: crawlProfileSchema.optional(),
  maxPages: positiveOrInfinitySchema.optional(),
  maxDepth: positiveOrInfinitySchema.optional(),
  concurrency: z.number().int().min(1).max(100).optional(),
  includeAssets: z.boolean().optional(),
  stealth: z.boolean().optional(),
  locale: z.string().min(1).optional(),
  geo: geoPresetSchema.optional(),
  output: z.string().min(1).optional(),
  sitemapOnly: z.boolean().optional(),
  excludePatterns: z.array(z.string()).optional(),
  hierarchicalExclude: z.array(z.string()).optional(),
});

export const resolvedConfigSchema = z.object({
  url: urlSchema,
  maxPages: positiveOrInfinitySchema,
  maxDepth: positiveOrInfinitySchema,
  concurrency: z.number().int().min(1).max(100),
  includeAssets: z.boolean(),
  stealth: z.boolean(),
  locale: z.string().min(1),
  geo: geoPresetSchema.optional(),
  output: z.string().min(1),
  sitemapOnly: z.boolean(),
  excludePatterns: z.array(z.string()),
  hierarchicalExclude: z.array(z.string()),
});
