export type CrawlProfile = 'quick' | 'standard' | 'deep' | 'full';

export type GeoPreset = 'us' | 'uk' | 'eu' | 'asia';

export interface CrawlProfileConfig {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  includeAssets?: boolean;
  stealth?: boolean;
}

export interface CrawlConfig {
  url: string;
  profile?: CrawlProfile;
  maxPages?: number;
  maxDepth?: number;
  concurrency?: number;
  includeAssets?: boolean;
  stealth?: boolean;
  locale?: string;
  geo?: GeoPreset;
  output?: string;
  sitemapOnly?: boolean;
  excludePatterns?: string[];
}

export interface ResolvedConfig extends Required<Omit<CrawlConfig, 'profile' | 'geo' | 'excludePatterns'>> {
  geo?: GeoPreset;
  excludePatterns: string[];
}
