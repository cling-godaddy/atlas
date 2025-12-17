import { Configuration, PuppeteerCrawler } from 'crawlee';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { extractAssets, extractLinks, extractMetadata, extractStructuredData, extractText } from './extractor';
import { detectPlatform } from './platform-detector';
import { getSitemapUrl, parseSitemap } from './sitemap';
import {
  aggregateContactInfo,
  aggregateImages,
  aggregateProducts,
  aggregateServices,
  classifyPage,
  curatePageImages,
  extractContactFromJsonLd,
  extractContactFromPage,
  extractImagesFromPage,
  extractNavigation,
  extractProductsFromJsonLd,
  extractServicesFromJsonLd,
} from './ssm';
import { geoPresets } from '../config/geo';
import { resolveIncludeOptions } from '../config/output';
import { randomDelay, randomUserAgent, randomViewport, sleep } from '../config/stealth';
import { extractParentPaths, isDynamicUrl, normalizeUrl, shouldExcludeHierarchically, shouldExcludeUrl } from '../utils/url';

import type { RawContactData } from './ssm';
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
import type { ContactInfo, CuratedImage, ExtractedProduct, ExtractedService, Navigation } from '../types/ssm';
import type { PuppeteerCrawlingContext } from 'crawlee';
import type { Page } from 'puppeteer';

puppeteer.use(StealthPlugin());

async function scrollToBottom(page: Page, maxScrolls = 10): Promise<void> {
  let previousHeight = 0;
  for (let i = 0; i < maxScrolls; i++) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await sleep(1000);
  }
}

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
  /** URL patterns to exclude hierarchically (children only, keep parent) */
  hierarchicalExclude?: string[];
  /** Additional paths to seed the crawl (e.g., '/collections/all') */
  seedPaths?: string[];
  /** Geo preset for locale spoofing */
  geo?: GeoPreset;
  /** Output detail level */
  output?: OutputProfile;
  /** Override specific include options */
  include?: IncludeOptions;
  /** Logging verbosity during crawl */
  logLevel?: 'minimal' | 'standard' | 'verbose';
}

const DEFAULT_OPTIONS: Required<Omit<CrawlerOptions, 'url' | 'include'>> & { include?: IncludeOptions } = {
  maxPages: 100,
  maxDepth: 3,
  concurrency: 5,
  timeout: 30000,
  useSitemap: true,
  headless: true,
  excludePatterns: [],
  hierarchicalExclude: [],
  seedPaths: [],
  geo: 'us',
  output: 'standard',
  logLevel: 'standard',
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

  // stealth config (picked once per session)
  const viewport = randomViewport();
  const userAgent = randomUserAgent();

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

  // SSM: track site navigation (extracted from home page)
  let siteNavigation: Navigation | undefined;

  // SSM: track contact info (aggregated from all pages)
  const pageContacts: RawContactData[] = [];
  let jsonLdContact: Partial<ContactInfo> = {};

  // SSM: track images, products, services (aggregated from all pages)
  const allImages: CuratedImage[] = [];
  const allProducts: ExtractedProduct[] = [];
  const allServices: ExtractedService[] = [];

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
      const filtered = filterUrls(
        sameDomain.length > 0 ? sameDomain : [opts.url],
        opts.excludePatterns
      );
      seedUrls = filtered.slice(0, opts.maxPages);
    }
  }

  // auto-include parent paths from hierarchical exclude patterns
  if (opts.hierarchicalExclude.length > 0) {
    const parentPaths = extractParentPaths(opts.hierarchicalExclude);
    const parentUrls = parentPaths.map((path) => new URL(path, baseUrl).toString());

    for (const parentUrl of parentUrls) {
      const normalized = normalizeUrl(parentUrl);
      if (!seedUrls.some((u) => normalizeUrl(u) === normalized)) {
        seedUrls.push(parentUrl);
      }
    }
  }

  // add user-specified seed paths AT THE FRONT for priority crawling
  const seedUrlSet = new Set<string>();
  if (opts.seedPaths.length > 0) {
    const seedPathUrls: string[] = [];
    for (const seedPath of opts.seedPaths) {
      const seedUrl = new URL(seedPath, baseUrl).toString();
      const normalized = normalizeUrl(seedUrl);
      seedUrlSet.add(normalized);
      if (!seedUrls.some((u) => normalizeUrl(u) === normalized)) {
        seedPathUrls.push(seedUrl);
      }
    }
    seedUrls = [...seedPathUrls, ...seedUrls];
  }

  // disable crawlee's default storage
  Configuration.getGlobalConfig().set('persistStorage', false);

  const crawler = new PuppeteerCrawler({
    maxRequestsPerCrawl: opts.maxPages,
    maxConcurrency: opts.concurrency,
    requestHandlerTimeoutSecs: opts.timeout / 1000,
    navigationTimeoutSecs: opts.timeout / 1000,

    statisticsOptions: {
      logIntervalSecs: opts.logLevel === 'minimal' ? 30 : 15,
    },

    launchContext: {
      launcher: puppeteer,
      launchOptions: {
        headless: opts.headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          `--lang=${geoConfig.lang}`,
          `--window-size=${String(viewport.width)},${String(viewport.height)}`,
        ],
      },
    },

    preNavigationHooks: [
      async ({ page }) => {
        // stealth: set viewport and user agent
        await page.setViewport(viewport);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        await page.setUserAgent(userAgent);

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
      const { page, request, log } = context;
      const url = request.loadedUrl ?? request.url;
      const depth = (request.userData as { depth?: number } | undefined)?.depth ?? 0;

      // stealth: random delay between requests
      await sleep(randomDelay());

      // log page start (standard/verbose only)
      if (opts.logLevel !== 'minimal') {
        const progress = `${String(state.visited.length + 1)}/${String(opts.maxPages)}`;
        log.info(`[${progress}] Crawling: ${url} (depth: ${String(depth)})`);
      }

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

      // for seed URLs, scroll to bottom to trigger lazy loading (e.g., collection pages)
      const isSeedUrl = seedUrlSet.has(normalizeUrl(url));
      if (isSeedUrl) {
        await scrollToBottom(page);
      } else {
        // stealth: random scroll to mimic human behavior
        await page.evaluate(() => {
          const scrollHeight = document.body.scrollHeight;
          const scrollTo = Math.random() * Math.min(scrollHeight, 2000);
          window.scrollTo(0, scrollTo);
        });
        await sleep(200 + Math.random() * 300);
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

      // SSM: classify page type
      const classification = classifyPage(url, metadata, structuredData);

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
        classification,
        ...(html !== void 0 && { html }),
        ...(text !== void 0 && { text }),
        ...(assets !== void 0 && { assets }),
        ...(structuredData !== void 0 && { structuredData }),
      };

      pages.push(pageData);
      state.visited.push(url);

      // SSM: extract navigation from home page
      if (depth === 0 && !siteNavigation) {
        siteNavigation = await extractNavigation(page, baseUrl);
      }

      // SSM: extract contact info from page
      const rawContact = await extractContactFromPage(page);
      pageContacts.push(rawContact);

      // SSM: extract contact from JSON-LD (merge into running aggregate)
      if (structuredData) {
        const ldContact = extractContactFromJsonLd(structuredData);
        jsonLdContact = { ...jsonLdContact, ...ldContact };
      }

      // SSM: extract and curate images
      const rawImages = await extractImagesFromPage(page, baseUrl);
      const curatedImages = curatePageImages(rawImages, url, metadata, structuredData, depth === 0);
      allImages.push(...curatedImages);

      // SSM: extract products and services from JSON-LD
      if (structuredData) {
        const products = extractProductsFromJsonLd(structuredData, url);
        const services = extractServicesFromJsonLd(structuredData, url);
        allProducts.push(...products);
        allServices.push(...services);
      }

      // log page completion (standard/verbose only)
      if (opts.logLevel !== 'minimal') {
        const internalLinks = links.filter((l) => l.isInternal).length;
        const externalLinks = links.length - internalLinks;
        const logParts = [`✓ ${url}`, `links: ${String(internalLinks)} internal, ${String(externalLinks)} external`];

        if (opts.logLevel === 'verbose') {
          if (assets) logParts.push(`assets: ${String(assets.length)}`);
          if (text) logParts.push(`text: ${String(text.length)} chars`);
        }

        log.info(logParts.join(' | '));
      }

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
        let skippedDynamic = 0;
        for (const link of internalUrls) {
          const normalized = normalizeUrl(link.url);
          const analysis = isDynamicUrl(normalized);
          if (analysis.isDynamic && analysis.pattern) {
            if (seenPatterns.has(analysis.pattern)) {
              state.skipped.push({ url: normalized, reason: `dynamic:${analysis.pattern}` });
              skippedDynamic++;
              continue;
            }
            seenPatterns.add(analysis.pattern);
          }
          urlsToEnqueue.push(normalized);
        }

        await context.enqueueLinks({
          urls: urlsToEnqueue,
          userData: { depth: depth + 1 },
        });

        // log enqueueing results (verbose only)
        if (opts.logLevel === 'verbose' && urlsToEnqueue.length > 0) {
          log.info(
            `Enqueued ${String(urlsToEnqueue.length)} URLs at depth ${String(depth + 1)}` +
              (skippedDynamic > 0 ? ` (skipped ${String(skippedDynamic)} dynamic duplicates)` : ''),
          );
        }
      }
    },

    failedRequestHandler: ({ request, log }, error) => {
      state.failed.push({
        url: request.url,
        error: error.message,
        attempts: request.retryCount + 1,
      });

      // always log failures regardless of logLevel
      log.error(`Failed to crawl ${request.url} after ${String(request.retryCount + 1)} attempts: ${error.message}`);
    },
  });

  await crawler.run(seedUrls);

  const completedAt = new Date().toISOString();
  const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  // log final summary (all log levels)
  /* eslint-disable no-console */
  console.log('\n📊 Crawl Summary:');
  console.log(`   Pages crawled: ${String(pages.length)}`);
  console.log(`   Failed: ${String(state.failed.length)}`);
  console.log(`   Redirects: ${String(state.redirects.length)}`);
  console.log(`   Skipped (dynamic duplicates): ${String(state.skipped.length)}`);
  console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`   Rate: ${(pages.length / (duration / 1000 / 60)).toFixed(2)} pages/min\n`);
  /* eslint-enable no-console */

  // build URL hierarchy (prune patterns only affect visualization, not crawling)
  const hierarchy = buildUrlHierarchy(pages.map((p) => p.url), baseUrl, opts.hierarchicalExclude);

  // detect hosting platform
  const assets = Array.from(assetMap.values());
  const platform = detectPlatform(pages, assets);

  // SSM: aggregate contact info
  const contact = aggregateContactInfo(pageContacts, jsonLdContact);

  // SSM: aggregate images, products, services
  const curatedImages = aggregateImages(allImages);
  const products = aggregateProducts(allProducts);
  const services = aggregateServices(allServices);

  const result: CrawlResult = {
    baseUrl: baseUrl.origin,
    startedAt,
    completedAt,
    duration,
    config: opts as unknown as ResolvedConfig,
    pages,
    assets,
    state,
    structure: {
      sitemap: sitemapResult,
      hierarchy,
    },
    platform,
    navigation: siteNavigation,
    contact,
    images: curatedImages.length > 0 ? curatedImages : void 0,
    products: products.length > 0 ? products : void 0,
    services: services.length > 0 ? services : void 0,
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
  return shouldExcludeUrl(url, patterns);
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
 * @param hierarchicalExclude - patterns to exclude from hierarchy (URLs still crawled, just not shown)
 */
function buildUrlHierarchy(urls: string[], baseUrl: URL, hierarchicalExclude: string[] = []): URLHierarchyNode {
  // filter out pruned URLs from hierarchy visualization (they're still crawled)
  const filteredUrls = urls.filter((url) => !shouldExcludeHierarchically(url, hierarchicalExclude));

  const root: URLHierarchyNode = {
    segment: '',
    path: '/',
    url: baseUrl.origin + '/',
    children: [],
  };

  for (const url of filteredUrls) {
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
