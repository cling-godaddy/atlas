// main crawler
export { crawl } from './services/crawler';
export type { CrawlerOptions } from './services/crawler';

// output
export { writeOutput, generateOutputPath } from './services/output';
export type { OutputOptions } from './services/output';

// visualization
export { generateMermaidReport } from './services/visualize';
export type { VisualizationOptions } from './types/config';

// config
export { resolveConfig } from './config/resolver';
export type { CrawlConfig, ResolvedConfig } from './types/config';

// types
export type {
  CrawlResult,
  CrawledPage,
  CrawlState,
  ManifestAsset,
  StructuredData,
  URLHierarchyNode,
  SiteStructure,
  RedirectRecord,
} from './types/crawl';

export type {
  PageData,
  PageMetadata,
  LinkInfo,
  AssetRef,
  AssetType,
} from './types/page';

export type { SitemapResult, SitemapEntry } from './types/sitemap';

// utilities (if consumers need them)
export { normalizeUrl, isInternalUrl } from './utils/url';
export { hashContent } from './utils/hash';
