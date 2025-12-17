export type CrawlProfile = 'quick' | 'standard' | 'deep' | 'full';

export type GeoPreset = 'us' | 'uk' | 'eu' | 'asia';

export type OutputProfile = 'minimal' | 'standard' | 'full' | 'catalog';

export interface IncludeOptions {
  html?: boolean;
  text?: boolean;
  assets?: boolean;
  structuredData?: boolean;
}

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
  hierarchicalExclude?: string[];
}

export interface ResolvedConfig extends Required<Omit<CrawlConfig, 'profile' | 'geo' | 'excludePatterns' | 'hierarchicalExclude'>> {
  geo?: GeoPreset;
  excludePatterns: string[];
  hierarchicalExclude: string[];
}

export interface VisualizationOptions {
  format?: 'mermaid' | 'html' | 'both';
  maxNodes?: number;
  maxDepth?: number;
  minReferences?: number;
  types?: ('hierarchy' | 'state' | 'assets' | 'links')[];
}
