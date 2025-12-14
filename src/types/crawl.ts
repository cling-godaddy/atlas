import type { ResolvedConfig } from './config';
import type { PageData } from './page';
import type { SitemapResult } from './sitemap';

/**
 * Structured data extracted from page (JSON-LD, RDFa, microdata)
 */
export interface StructuredData {
  jsonLd: unknown[];
  microdata: unknown[];
}

/**
 * Asset in the manifest with usage tracking
 */
export interface ManifestAsset {
  url: string;
  localPath: string;
  type: string;
  hash: string;
  /** URLs of pages that reference this asset */
  referencedBy: string[];
}

/**
 * Asset manifest - deduplicated by URL, tracks usage across pages
 */
export type AssetManifest = Map<string, ManifestAsset>;

/**
 * Redirect record
 */
export interface RedirectRecord {
  from: string;
  to: string;
  status: number;
}

/**
 * Node in the URL hierarchy tree
 */
export interface URLHierarchyNode {
  segment: string;
  path: string;
  url?: string;
  children: URLHierarchyNode[];
}

/**
 * Crawl state tracking
 */
export interface CrawlState {
  /** Successfully crawled URLs */
  visited: string[];
  /** Failed URLs with error details */
  failed: { url: string; error: string; attempts: number }[];
  /** Redirect mappings */
  redirects: RedirectRecord[];
  /** URLs that were skipped (robots.txt, out of scope, etc.) */
  skipped: { url: string; reason: string }[];
}

/**
 * Site structure derived from crawl
 */
export interface SiteStructure {
  /** Sitemap parse result */
  sitemap: SitemapResult | null;
  /** URL hierarchy tree */
  hierarchy: URLHierarchyNode;
}

/**
 * Extended page data with structured data
 */
export interface CrawledPage extends PageData {
  structuredData?: StructuredData;
}

/**
 * Crawl IR - the main output of Atlas
 *
 * This is the contract between Atlas and downstream consumers (e.g., Blippi).
 * Contains everything structurally extractable from a website.
 */
export interface CrawlResult {
  /** Base URL of the crawled site */
  baseUrl: string;

  /** When the crawl started */
  startedAt: string;

  /** When the crawl completed */
  completedAt: string;

  /** Duration in milliseconds */
  duration: number;

  /** Config used for this crawl */
  config: ResolvedConfig;

  /** All crawled pages */
  pages: CrawledPage[];

  /** Asset manifest - deduplicated, with usage tracking */
  assets: ManifestAsset[];

  /** Crawl state - visited, failed, redirects, skipped */
  state: CrawlState;

  /** Site structure - sitemap and URL hierarchy */
  structure: SiteStructure;
}
