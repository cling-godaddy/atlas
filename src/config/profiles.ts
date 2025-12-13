import type { CrawlProfile, CrawlProfileConfig } from '../types/index';

export const profiles: Record<CrawlProfile, CrawlProfileConfig> = {
  quick: {
    maxPages: 50,
    maxDepth: 2,
    concurrency: 5,
    includeAssets: false,
  },
  standard: {
    maxPages: 500,
    maxDepth: 5,
    concurrency: 10,
    includeAssets: true,
  },
  deep: {
    maxPages: 10000,
    maxDepth: 10,
    concurrency: 20,
    includeAssets: true,
    stealth: true,
  },
  full: {
    maxPages: Infinity,
    maxDepth: Infinity,
    concurrency: 30,
    includeAssets: true,
  },
};
