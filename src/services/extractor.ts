import type { AssetRef, AssetType, LinkInfo, PageMetadata } from '../types';
import type { StructuredData } from '../types/crawl';
import type { Page } from 'puppeteer';

/**
 * Extract metadata from page using browser DOM
 */
export async function extractMetadata(page: Page): Promise<PageMetadata> {
  return page.evaluate(() => {
    const getMeta = (name: string): string | undefined => {
      const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      return el?.getAttribute('content') ?? void 0;
    };

    // using || instead of ?? to fall back on empty strings
    /* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
    const title = document.title || '';
    const description = getMeta('description') || '';
    /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */
    const ogTitle = getMeta('og:title');
    const ogDescription = getMeta('og:description');
    const ogImage = getMeta('og:image');
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? void 0;
    const keywordsMeta = getMeta('keywords');
    const keywords = keywordsMeta ? keywordsMeta.split(',').map((k) => k.trim()) : void 0;

    return {
      title,
      description,
      ogTitle,
      ogDescription,
      ogImage,
      canonical,
      keywords,
    };
  });
}

/**
 * Extract all links from page using browser DOM
 */
export async function extractLinks(page: Page, baseUrl: URL): Promise<LinkInfo[]> {
  const rawLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    /* eslint-disable @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unnecessary-condition */
    return anchors.map((a) => ({
      href: a.getAttribute('href') || '',
      text: a.textContent?.trim() || '',
      rel: a.getAttribute('rel') || void 0,
    }));
    /* eslint-enable @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unnecessary-condition */
  });

  const links: LinkInfo[] = [];
  const seen = new Set<string>();

  for (const link of rawLinks) {
    if (!link.href || link.href.startsWith('#') || link.href.startsWith('javascript:')) {
      continue;
    }

    try {
      const resolved = new URL(link.href, baseUrl);

      // only include http/https URLs
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        continue;
      }

      resolved.hash = '';
      const normalized = resolved.href;

      if (seen.has(normalized)) continue;
      seen.add(normalized);

      // check if subdomain of base domain
      const baseDomain = baseUrl.hostname;
      const isInternal =
        resolved.hostname === baseDomain ||
        resolved.hostname.endsWith(`.${baseDomain}`);

      links.push({
        url: normalized,
        text: link.text,
        isInternal,
        rel: link.rel,
      });
    } catch {
      // invalid url, skip
    }
  }

  return links;
}

/**
 * Extract all assets from page using browser DOM
 */
export async function extractAssets(page: Page, baseUrl: URL): Promise<AssetRef[]> {
  const rawAssets = await page.evaluate(() => {
    const assets: { url: string; type: string }[] = [];

    // stylesheets
    document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
      const href = el.getAttribute('href');
      if (href) {
        assets.push({ url: href, type: 'css' });
      }
    });

    // images
    document.querySelectorAll('img[src]').forEach((el) => {
      const src = el.getAttribute('src');
      if (src) {
        assets.push({ url: src, type: 'image' });
      }
    });

    // srcset for responsive images
    document.querySelectorAll('img[srcset]').forEach((el) => {
      const srcset = el.getAttribute('srcset');
      if (srcset) {
        srcset.split(',').forEach((entry) => {
          const url = entry.trim().split(/\s+/)[0];
          if (url) {
            assets.push({ url, type: 'image' });
          }
        });
      }
    });

    // scripts
    document.querySelectorAll('script[src]').forEach((el) => {
      const src = el.getAttribute('src');
      if (src) {
        assets.push({ url: src, type: 'script' });
      }
    });

    // fonts (preload hints)
    document.querySelectorAll('link[rel="preload"][as="font"]').forEach((el) => {
      const href = el.getAttribute('href');
      if (href) {
        assets.push({ url: href, type: 'font' });
      }
    });

    return assets;
  });

  const assets: AssetRef[] = [];
  const seen = new Set<string>();

  for (const asset of rawAssets) {
    try {
      const resolved = new URL(asset.url, baseUrl);

      // only include http/https URLs
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        continue;
      }

      const absoluteUrl = resolved.toString();
      if (seen.has(absoluteUrl)) continue;
      seen.add(absoluteUrl);

      // placeholder values - actual hash and localPath will be set during download
      assets.push({
        url: absoluteUrl,
        localPath: '',
        type: asset.type as AssetType,
        hash: '',
      });
    } catch {
      // invalid URL, skip
    }
  }

  return assets;
}

/**
 * Extract text content from page using browser DOM
 */
export async function extractText(page: Page): Promise<string> {
  return page.evaluate(() => {
    // remove script and style elements
    const clonedBody = document.body.cloneNode(true) as HTMLElement;
    clonedBody.querySelectorAll('script, style, noscript').forEach((el) => {
      el.remove();
    });

    // get text and normalize whitespace
    const text = clonedBody.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  });
}

/**
 * Extract structured data from page (JSON-LD, microdata)
 */
export async function extractStructuredData(page: Page): Promise<StructuredData> {
  return page.evaluate(() => {
    const jsonLd: unknown[] = [];
    const microdata: unknown[] = [];

    // extract JSON-LD
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach((script) => {
      try {
        const content = script.textContent;
        if (content) {
          const parsed = JSON.parse(content) as unknown;
          jsonLd.push(parsed);
        }
      } catch {
        // invalid JSON, skip
      }
    });

    // extract microdata (itemscope elements)
    const microdataElements = document.querySelectorAll('[itemscope]');
    microdataElements.forEach((el) => {
      try {
        const item: Record<string, unknown> = {};
        const itemtype = el.getAttribute('itemtype');
        if (itemtype) {
          item['@type'] = itemtype;
        }

        // extract properties
        const props = el.querySelectorAll('[itemprop]');
        props.forEach((prop) => {
          const name = prop.getAttribute('itemprop');
          if (name) {
            /* eslint-disable @typescript-eslint/no-unnecessary-condition */
            const content = prop.getAttribute('content') ?? prop.textContent?.trim() ?? '';
            /* eslint-enable @typescript-eslint/no-unnecessary-condition */
            if (content) {
              item[name] = content;
            }
          }
        });

        if (Object.keys(item).length > 0) {
          microdata.push(item);
        }
      } catch {
        // invalid microdata, skip
      }
    });

    return { jsonLd, microdata };
  });
}
