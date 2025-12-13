import { XMLParser } from 'fast-xml-parser';

import type { SitemapEntry, SitemapOptions, SitemapResult } from '../types';

const DEFAULT_OPTIONS: Required<SitemapOptions> = {
  maxDepth: 3,
  timeout: 10000,
  userAgent: 'Mozilla/5.0 (compatible; Atlas/2.0; +https://github.com/yourusername/atlas)',
};

/**
 * Fetch and parse a sitemap from a URL
 */
export async function parseSitemap(
  url: string,
  options: SitemapOptions = {},
): Promise<SitemapResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result: SitemapResult = {
    urls: [],
    sitemapsProcessed: 0,
    errors: [],
  };

  await fetchSitemapRecursive(url, opts, result, 0, opts.maxDepth);

  return result;
}

/**
 * Recursively fetch and parse sitemaps (handles sitemap indexes)
 */
async function fetchSitemapRecursive(
  url: string,
  options: Required<SitemapOptions>,
  result: SitemapResult,
  depth: number,
  maxDepth: number,
): Promise<void> {
  if (depth > maxDepth) {
    result.errors.push(`Max depth ${String(maxDepth)} exceeded for ${url}`);
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, options.timeout);

    const response = await fetch(url, {
      headers: { 'User-Agent': options.userAgent },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      result.errors.push(`HTTP ${String(response.status)} for ${url}`);
      return;
    }

    const xml = await response.text();
    const parsed = parseXml(xml);

    result.sitemapsProcessed++;

    // check if this is a sitemap index
    if (parsed.sitemapindex?.sitemap) {
      const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
        ? parsed.sitemapindex.sitemap
        : [parsed.sitemapindex.sitemap];

      for (const sm of sitemaps) {
        if (sm.loc) {
          await fetchSitemapRecursive(sm.loc, options, result, depth + 1, maxDepth);
        }
      }
    }
    // regular sitemap (with or without URLs)
    else if (parsed.urlset) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- urlset can exist without url property
      if (parsed.urlset.url) {
        const urls = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];

        for (const entry of urls) {
          if (entry.loc) {
            result.urls.push(entry.loc);
          }
        }
      }
      // empty urlset is valid, just no URLs to process
    } else {
      result.errors.push(`Invalid sitemap format for ${url}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Failed to fetch ${url}: ${message}`);
  }
}

/**
 * Parse XML string into sitemap structure
 */
function parseXml(xml: string): {
  sitemapindex?: { sitemap: { loc: string }[] | { loc: string } };
  urlset?: { url: SitemapEntry[] | SitemapEntry };
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
  });

  return parser.parse(xml) as {
    sitemapindex?: { sitemap: { loc: string }[] | { loc: string } };
    urlset?: { url: SitemapEntry[] | SitemapEntry };
  };
}

/**
 * Construct sitemap URL from base URL
 */
export function getSitemapUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    url.pathname = '/sitemap.xml';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return `${baseUrl}/sitemap.xml`;
  }
}
