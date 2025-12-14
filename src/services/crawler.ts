import { Configuration, PuppeteerCrawler } from 'crawlee';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { extractAssets, extractLinks, extractMetadata, extractStructuredData, extractText } from './extractor';
import { getSitemapUrl, parseSitemap } from './sitemap';
import { geoPresets } from '../config/geo';
import { resolveIncludeOptions } from '../config/output';
import { isDynamicUrl } from '../utils/url';

import type { GeoPreset, IncludeOptions, OutputProfile, ResolvedConfig } from '../types/config';
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
  /** Geo preset for locale spoofing */
  geo?: GeoPreset;
  /** Output detail level */
  output?: OutputProfile;
  /** Override specific include options */
  include?: IncludeOptions;
}

const DEFAULT_OPTIONS: Required<Omit<CrawlerOptions, 'url' | 'include'>> & { include?: IncludeOptions } = {
  maxPages: 100,
  maxDepth: 3,
  concurrency: 5,
  timeout: 30000,
  useSitemap: true,
  headless: true,
  excludePatterns: [],
  geo: 'us',
  output: 'standard',
};

/**
 * Crawl a website and produce a CrawlResult
 */
export async function crawl(options: CrawlerOptions): Promise<CrawlResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const baseUrl = new URL(opts.url);
  const startedAt = new Date().toISOString();
  const geoConfig = geoPresets[opts.geo];
  const includeOpts = resolveIncludeOptions(opts.output, opts.include);

  // state accumulation
  const pages: CrawledPage[] = [];
  const assetMap = new Map<string, ManifestAsset>();
  const state: CrawlState = {
    visited: [],
    failed: [],
    redirects: [],
    skipped: [],
  };

  // track seen dynamic URL patterns
  // TODO: make configurable via dynamicRoutes: 'skip' | 'once' | 'all'
  const seenPatterns = new Set<string>();

  // get seed URLs
  let seedUrls: string[] = [opts.url];
  let sitemapResult: SitemapResult | null = null;

  if (opts.useSitemap) {
    const sitemapUrl = getSitemapUrl(opts.url);
    sitemapResult = await parseSitemap(sitemapUrl, {
      acceptLanguage: geoConfig.acceptLanguage,
    }).catch(() => null);

    if (sitemapResult && sitemapResult.urls.length > 0) {
      // filter to base domain only (prevents geo-redirect sitemap issues)
      const sameDomain = sitemapResult.urls.filter((u) => isSameDomain(u, baseUrl));
      const filtered = filterUrls(sameDomain.length > 0 ? sameDomain : [opts.url], opts.excludePatterns);
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
          `--lang=${geoConfig.lang}`,
        ],
      },
    },

    preNavigationHooks: [
      async ({ page }) => {
        // set Accept-Language header
        await page.setExtraHTTPHeaders({
          'Accept-Language': geoConfig.acceptLanguage,
        });

        // set geolocation
        const context = page.browser().defaultBrowserContext();
        await context.overridePermissions(baseUrl.origin, ['geolocation']);
        await page.setGeolocation({
          latitude: geoConfig.latitude,
          longitude: geoConfig.longitude,
        });

        // set common locale cookies to prevent geo-redirect
        const domain = baseUrl.hostname;
        await context.setCookie(
          { name: 'locale', value: geoConfig.lang, domain },
          { name: 'lang', value: geoConfig.lang, domain },
          { name: 'language', value: geoConfig.lang, domain },
          { name: 'country', value: geoConfig.country, domain },
          { name: 'region', value: geoConfig.country, domain },
          { name: 'geo', value: geoConfig.country, domain },
        );
      },
    ],

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

      // extract page data (conditional based on output profile)
      const [metadata, links] = await Promise.all([
        extractMetadata(page),
        extractLinks(page, baseUrl),
      ]);

      const assets = includeOpts.assets ? await extractAssets(page, baseUrl) : void 0;
      const text = includeOpts.text ? await extractText(page) : void 0;
      const structuredData = includeOpts.structuredData ? await extractStructuredData(page) : void 0;
      const html = includeOpts.html ? await page.content() : void 0;

      // build page data
      const pageData: CrawledPage = {
        url,
        path: urlToPath(url),
        crawledAt: new Date().toISOString(),
        statusCode: 200,
        depth,
        title: metadata.title,
        metadata,
        links,
        ...(html !== void 0 && { html }),
        ...(text !== void 0 && { text }),
        ...(assets !== void 0 && { assets }),
        ...(structuredData !== void 0 && { structuredData }),
      };

      pages.push(pageData);
      state.visited.push(url);

      // track assets with referencedBy
      if (assets) {
        trackAssets(assets, url, assetMap);
      }

      // enqueue internal links
      if (depth < opts.maxDepth) {
        const internalUrls = links
          .filter((l) => l.isInternal)
          .filter((l) => !isExcluded(l.url, opts.excludePatterns));

        // crawl first occurrence per pattern, skip rest
        // TODO: make configurable via dynamicRoutes: 'skip' | 'once' | 'all'
        const urlsToEnqueue: string[] = [];
        for (const link of internalUrls) {
          const analysis = isDynamicUrl(link.url);
          if (analysis.isDynamic && analysis.pattern) {
            if (seenPatterns.has(analysis.pattern)) {
              state.skipped.push({ url: link.url, reason: `dynamic:${analysis.pattern}` });
              continue;
            }
            seenPatterns.add(analysis.pattern);
          }
          urlsToEnqueue.push(link.url);
        }

        await context.enqueueLinks({
          urls: urlsToEnqueue,
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
        type: asset.type,
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
 * Check if URL belongs to the same domain (handles www prefix)
 */
function isSameDomain(url: string, baseUrl: URL): boolean {
  try {
    const parsed = new URL(url);
    const baseHost = baseUrl.hostname.replace(/^www\./, '');
    const urlHost = parsed.hostname.replace(/^www\./, '');
    return urlHost === baseHost || urlHost.endsWith('.' + baseHost);
  } catch {
    return false;
  }
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
