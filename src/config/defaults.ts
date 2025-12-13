import type { ResolvedConfig } from '../types/index';

export const defaults: Omit<ResolvedConfig, 'url'> = {
  locale: 'en-US',
  output: './output',
  includeAssets: true,
  stealth: false,
  sitemapOnly: false,
  maxPages: 500,
  maxDepth: 5,
  concurrency: 10,
  excludePatterns: [],
};
