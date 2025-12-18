import { extractAssets, extractLinks, extractMetadata, extractStructuredData, extractText } from './extractor';
import {
  classifyPage,
  curatePageImages,
  extractContactFromJsonLd,
  extractContactFromPage,
  extractNavigation,
  extractPageSignals,
  extractProductsFromJsonLd,
  extractServicesFromJsonLd,
} from './ssm';

import type { RawContactData } from './ssm';
import type { CrawledPage, StructuredData } from '../types/crawl';
import type { AssetRef, LinkInfo, PageMetadata } from '../types/page';
import type { ContactInfo, CuratedImage, ExtractedProduct, ExtractedService, Navigation } from '../types/ssm';
import type { Page } from 'puppeteer';

export interface IncludeOptions {
  html: boolean;
  text: boolean;
  assets: boolean;
  structuredData: boolean;
}

export interface PageExtractionResult {
  metadata: PageMetadata;
  links: LinkInfo[];
  assets?: AssetRef[];
  text?: string;
  html?: string;
  structuredData?: StructuredData;
}

export interface SSMExtractionResult {
  contact: RawContactData;
  ldContact: Partial<ContactInfo>;
  images: CuratedImage[];
  products: ExtractedProduct[];
  services: ExtractedService[];
  navigation?: Navigation;
}

export interface PageProcessingResult {
  page: CrawledPage;
  ssm: SSMExtractionResult;
}

/**
 * Convert URL to local path for page data
 */
function urlToPath(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;

    if (path.startsWith('/')) {
      path = path.slice(1);
    }

    if (!path || path === '') {
      path = 'index';
    }

    if (!path.includes('.')) {
      path = path.replace(/\/$/, '') + '.html';
    }

    return path;
  } catch {
    return 'unknown.html';
  }
}

/**
 * Extract all page data (metadata, links, optional content)
 */
export async function extractPageData(
  page: Page,
  baseUrl: URL,
  include: IncludeOptions,
): Promise<PageExtractionResult> {
  const [metadata, links] = await Promise.all([extractMetadata(page), extractLinks(page, baseUrl)]);

  const assets = include.assets ? await extractAssets(page, baseUrl) : void 0;
  const text = include.text ? await extractText(page) : void 0;
  const structuredData = include.structuredData ? await extractStructuredData(page) : void 0;
  const html = include.html ? await page.content() : void 0;

  return { metadata, links, assets, text, html, structuredData };
}

/**
 * Extract SSM (Site Semantic Model) data from page
 * pageSignals should be extracted once and passed in to avoid duplicate DOM traversal
 */
export async function extractSSMData(
  page: Page,
  baseUrl: URL,
  url: string,
  metadata: PageMetadata,
  pageSignals: Awaited<ReturnType<typeof extractPageSignals>>,
  structuredData?: StructuredData,
  isHomePage?: boolean,
  extractNav?: boolean,
): Promise<SSMExtractionResult> {
  // contact extraction
  const contact = await extractContactFromPage(page);
  const ldContact = structuredData ? extractContactFromJsonLd(structuredData) : {};

  // image curation (uses pre-extracted pageSignals.images)
  const images = curatePageImages(pageSignals.images, url, metadata, structuredData, isHomePage);

  // products and services from JSON-LD
  const products = structuredData ? extractProductsFromJsonLd(structuredData, url) : [];
  const services = structuredData ? extractServicesFromJsonLd(structuredData, url) : [];

  // navigation (home page only)
  const navigation = extractNav ? await extractNavigation(page, baseUrl) : void 0;

  return { contact, ldContact, images, products, services, navigation };
}

/**
 * Classify page and build CrawledPage object
 */
export function buildCrawledPage(
  url: string,
  depth: number,
  extraction: PageExtractionResult,
  structuredData?: StructuredData,
  pageSignals?: Awaited<ReturnType<typeof extractPageSignals>>,
): CrawledPage {
  const classification = classifyPage(url, extraction.metadata, structuredData, pageSignals);

  return {
    url,
    path: urlToPath(url),
    crawledAt: new Date().toISOString(),
    statusCode: 200,
    depth,
    title: extraction.metadata.title,
    metadata: extraction.metadata,
    links: extraction.links,
    classification,
    ...(extraction.html !== void 0 && { html: extraction.html }),
    ...(extraction.text !== void 0 && { text: extraction.text }),
    ...(extraction.assets !== void 0 && { assets: extraction.assets }),
    ...(structuredData !== void 0 && { structuredData }),
  };
}

/**
 * Process a single page: extract all data and build page object
 */
export async function processPage(
  page: Page,
  url: string,
  baseUrl: URL,
  depth: number,
  include: IncludeOptions,
  extractNav?: boolean,
): Promise<PageProcessingResult> {
  // extract page data
  const extraction = await extractPageData(page, baseUrl, include);

  // extract page signals for classification
  const pageSignals = await extractPageSignals(page, baseUrl);

  // extract SSM data
  const ssm = await extractSSMData(
    page,
    baseUrl,
    url,
    extraction.metadata,
    pageSignals,
    extraction.structuredData,
    depth === 0,
    extractNav,
  );

  // build page object
  const crawledPage = buildCrawledPage(url, depth, extraction, extraction.structuredData, pageSignals);

  return { page: crawledPage, ssm };
}
