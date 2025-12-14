/**
 * Entry from a sitemap.xml file
 */
export interface SitemapEntry {
  /** The URL location */
  loc: string;
  /** Last modification timestamp (ISO 8601) */
  lastmod?: string;
  /** How frequently the page is likely to change */
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  /** Priority of this URL relative to other URLs (0.0 to 1.0) */
  priority?: number;
}

/**
 * Result of parsing a sitemap or sitemap index
 */
export interface SitemapResult {
  /** List of URLs extracted from sitemap(s) */
  urls: string[];
  /** Total number of sitemaps processed (including indexes) */
  sitemapsProcessed: number;
  /** Any errors encountered during parsing (non-fatal) */
  errors: string[];
}

/**
 * Options for sitemap fetching and parsing
 */
export interface SitemapOptions {
  /** Maximum number of sitemap index files to follow (prevent infinite recursion) */
  maxDepth?: number;
  /** Timeout in milliseconds for HTTP requests */
  timeout?: number;
  /** User agent string for requests */
  userAgent?: string;
  /** Accept-Language header for requests (geo locale) */
  acceptLanguage?: string;
}
