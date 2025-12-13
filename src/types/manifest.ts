import type { ResolvedConfig } from './config';

export interface PageSummary {
  url: string;
  path: string;
  title: string;
}

export interface AssetSummary {
  type: string;
  url: string;
  localPath: string;
}

export interface CrawlError {
  url: string;
  message: string;
  retriedCount: number;
}

export interface SitemapNode {
  url: string;
  children?: SitemapNode[];
}

export interface CrawlManifest {
  baseUrl: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  config: ResolvedConfig;
  sitemap: SitemapNode[];
  pages: PageSummary[];
  assets: AssetSummary[];
  errors: CrawlError[];
}

export interface DiscoveredUrl {
  url: string;
  source: 'sitemap' | 'crawl';
  depth?: number;
  discoveredAt: string;
  requiresAuth?: boolean;
}

export interface DiscoveryResult {
  urls: DiscoveredUrl[];
  skippedDynamic: SkippedPattern[];
  authPages: string[];
}

export interface SkippedPattern {
  pattern: string;
  count: number;
  sampleUrls: string[];
}
