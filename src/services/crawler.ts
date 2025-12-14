import { Configuration, PuppeteerCrawler } from 'crawlee';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { extractAssets, extractLinks, extractMetadata, extractStructuredData, extractText } from './extractor';
import { getSitemapUrl, parseSitemap } from './sitemap';

import type { ResolvedConfig } from '../types/config';
import type {
  CrawlResult,
  CrawlState,
  CrawledPage,
  ManifestAsset,
  URLHierarchyNode,
} from '../types/crawl';
import type { AssetRef } from '../types/page';
import type { SitemapResult } from '../types/sitemap';
import type { PuppeteerCrawlingContext } from 'crawlee';

puppeteer.use(StealthPlugin());

/**
 * Options for crawling a site
 */
export interface CrawlerOptions {
  /** Base URL to crawl */
  url: string;
  /** Maximum pages to crawl */
  maxPages?: number;
  /** Maximum depth from seed URLs */
  maxDepth?: number;
  /** Concurrent requests */
  concurrency?: number;
  /** Request timeout in ms */
  timeout?: number;
  /** Use sitemap.xml for seed URLs */
  useSitemap?: boolean;
  /** Run browser in headless mode */
  headless?: boolean;
  /** URL patterns to exclude */
  excludePatterns?: string[];
}

const DEFAULT_OPTIONS: Required<Omit<CrawlerOptions, 'url'>> = {
  maxPages: 100,
  maxDepth: 3,
  concurrency: 5,
  timeout: 30000,
  useSitemap: true,
  headless: true,
  excludePatterns: [],
};

/**
 * Crawl a website and produce a CrawlResult
 */
export async function crawl(options: CrawlerOptions): Promise<CrawlResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const baseUrl = new URL(opts.url);
  const startedAt = new Date().toISOString();

  // state accumulation
  const pages: CrawledPage[] = [];
  const assetMap = new Map<string, ManifestAsset>();
  const state: CrawlState = {
    visited: [],
    failed: [],
    redirects: [],
    skipped: [],
  };

  // get seed URLs
  let seedUrls: string[] = [opts.url];
  let sitemapResult: SitemapResult | null = null;

  if (opts.useSitemap) {
    const sitemapUrl = getSitemapUrl(opts.url);
    sitemapResult = await parseSitemap(sitemapUrl).catch(() => null);

    if (sitemapResult && sitemapResult.urls.length > 0) {
      const filtered = filterUrls(sitemapResult.urls, opts.excludePatterns);
      seedUrls = filtered.slice(0, opts.maxPages);
    }
  }

  // disable crawlee's default storage
  Configuration.getGlobalConfig().set('persistStorage', false);

  const crawler = new PuppeteerCrawler({
    maxRequestsPerCrawl: opts.maxPages,
    maxConcurrency: opts.concurrency,
    requestHandlerTimeoutSecs: opts.timeout / 1000,
    navigationTimeoutSecs: opts.timeout / 1000,

    launchContext: {
      launcher: puppeteer,
      launchOptions: {
        headless: opts.headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      },
    },

    requestHandler: async (context: PuppeteerCrawlingContext) => {
      const { page, request } = context;
      const url = request.loadedUrl ?? request.url;
      const depth = (request.userData as { depth?: number } | undefined)?.depth ?? 0;

      // track redirects
      if (request.loadedUrl && request.loadedUrl !== request.url) {
        state.redirects.push({
          from: request.url,
          to: request.loadedUrl,
          status: 301,
        });
      }

      // wait for JS to settle
      try {
        await page.waitForNetworkIdle({ timeout: 5000 });
      } catch {
        // timeout is ok, continue with extraction
      }

      // extract page data
      const [metadata, links, assets, text, structuredData] = await Promise.all([
        extractMetadata(page),
        extractLinks(page, baseUrl),
        extractAssets(page, baseUrl),
        extractText(page),
        extractStructuredData(page),
      ]);

      // get raw HTML
      const html = await page.content();

      // build page data
      const pageData: CrawledPage = {
        url,
        path: urlToPath(url),
        crawledAt: new Date().toISOString(),
        statusCode: 200,
        depth,
        title: metadata.title,
        html,
        text,
        metadata,
        links,
        assets,
        structuredData,
      };

      pages.push(pageData);
      state.visited.push(url);

      // track assets with referencedBy
      trackAssets(assets, url, assetMap);

      // enqueue internal links
      if (depth < opts.maxDepth) {
        const internalUrls = links
          .filter((l) => l.isInternal)
          .filter((l) => !isExcluded(l.url, opts.excludePatterns))
          .map((l) => l.url);

        await context.enqueueLinks({
          urls: internalUrls,
          userData: { depth: depth + 1 },
        });
      }
    },

    failedRequestHandler: ({ request }, error) => {
      state.failed.push({
        url: request.url,
        error: error.message,
        attempts: request.retryCount + 1,
      });
    },
  });

  await crawler.run(seedUrls);

  const completedAt = new Date().toISOString();
  const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  // build URL hierarchy
  const hierarchy = buildUrlHierarchy(pages.map((p) => p.url), baseUrl);

  const result: CrawlResult = {
    baseUrl: baseUrl.origin,
    startedAt,
    completedAt,
    duration,
    config: opts as unknown as ResolvedConfig,
    pages,
    assets: Array.from(assetMap.values()),
    state,
    structure: {
      sitemap: sitemapResult,
      hierarchy,
    },
  };

  return result;
}

/**
 * Convert URL to local path
 */
function urlToPath(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;

    // remove leading slash
    if (path.startsWith('/')) {
      path = path.slice(1);
    }

    // handle root
    if (!path) {
      path = 'index';
    }

    // add .html if no extension
    if (!path.includes('.')) {
      path = path.replace(/\/$/, '') + '.html';
    }

    return path;
  } catch {
    return 'unknown.html';
  }
}

/**
 * Track assets with referencedBy
 */
function trackAssets(
  assets: AssetRef[],
  pageUrl: string,
  assetMap: Map<string, ManifestAsset>,
): void {
  for (const asset of assets) {
    const existing = assetMap.get(asset.url);
    if (existing) {
      existing.referencedBy.push(pageUrl);
    } else {
      assetMap.set(asset.url, {
        url: asset.url,
        localPath: asset.localPath,
        type: asset.type,
        hash: asset.hash,
        referencedBy: [pageUrl],
      });
    }
  }
}

/**
 * Filter URLs by exclude patterns
 */
function filterUrls(urls: string[], excludePatterns: string[]): string[] {
  return urls.filter((url) => !isExcluded(url, excludePatterns));
}

/**
 * Check if URL matches any exclude pattern
 */
function isExcluded(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => url.includes(pattern));
}

/**
 * Build URL hierarchy tree from list of URLs
 */
function buildUrlHierarchy(urls: string[], baseUrl: URL): URLHierarchyNode {
  const root: URLHierarchyNode = {
    segment: '',
    path: '/',
    url: baseUrl.origin + '/',
    children: [],
  };

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);

      let current = root;
      let currentPath = '/';

      for (const segment of segments) {
        currentPath += segment + '/';
        let child = current.children.find((c) => c.segment === segment);

        if (!child) {
          child = {
            segment,
            path: currentPath,
            children: [],
          };
          current.children.push(child);
        }

        current = child;
      }

      // set URL on the leaf node
      current.url = url;
    } catch {
      // invalid URL, skip
    }
  }

  return root;
}
