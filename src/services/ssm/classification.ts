import type { StructuredData } from '../../types/crawl';
import type { PageMetadata } from '../../types/page';
import type { Confidence, PageClassification, PageType } from '../../types/ssm';

const URL_PATTERNS: Record<PageType, RegExp[]> = {
  home: [/^\/?$/, /^\/home\/?$/i, /^\/index\.html?$/i],
  about: [/\/about/i, /\/company/i, /\/who-we-are/i, /\/our-story/i, /\/team/i],
  contact: [/\/contact/i, /\/get-in-touch/i, /\/reach-us/i, /\/location/i],
  shop: [/^\/shop\/?$/i, /^\/store\/?$/i, /^\/products?\/?$/i, /^\/collections?\/?$/i],
  product: [/\/products?\/[^/]+/i, /\/item\/[^/]+/i, /\/p\/[^/]+/i],
  category: [/\/collections?\/[^/]+/i, /\/category\/[^/]+/i, /\/categories\/[^/]+/i],
  services: [/\/services?/i, /\/solutions?/i, /\/what-we-do/i],
  gallery: [/\/gallery/i, /\/photos?/i, /\/portfolio/i, /\/work/i, /\/projects/i],
  blog: [/^\/blog\/?$/i, /^\/news\/?$/i, /^\/articles?\/?$/i, /^\/posts?\/?$/i],
  article: [/\/blog\/[^/]+/i, /\/news\/[^/]+/i, /\/posts?\/[^/]+/i, /\/article\/[^/]+/i],
  faq: [/\/faq/i, /\/help/i, /\/support/i, /\/questions/i],
  legal: [/\/privacy/i, /\/terms/i, /\/legal/i, /\/policy/i, /\/disclaimer/i, /\/tos/i],
  other: [],
};

const JSONLD_TYPE_MAP: Record<string, PageType> = {
  Product: 'product',
  Article: 'article',
  BlogPosting: 'article',
  NewsArticle: 'article',
  FAQPage: 'faq',
  ContactPage: 'contact',
  AboutPage: 'about',
  CollectionPage: 'category',
  ItemList: 'category',
  WebPage: 'other',
  Organization: 'about',
  LocalBusiness: 'contact',
  Service: 'services',
  ImageGallery: 'gallery',
};

const TITLE_KEYWORDS: Record<PageType, RegExp[]> = {
  home: [/^home$/i, /welcome/i],
  about: [/about\s*(us)?/i, /our\s*story/i, /who\s*we\s*are/i, /our\s*team/i],
  contact: [/contact/i, /get\s*in\s*touch/i, /reach\s*us/i],
  shop: [/^shop$/i, /^store$/i, /all\s*products/i],
  product: [],
  category: [/collection/i, /category/i],
  services: [/services?/i, /solutions?/i, /what\s*we\s*do/i],
  gallery: [/gallery/i, /portfolio/i, /our\s*work/i, /photos?/i],
  blog: [/^blog$/i, /^news$/i, /articles?/i],
  article: [],
  faq: [/faq/i, /frequently\s*asked/i, /help/i, /support/i],
  legal: [/privacy/i, /terms/i, /legal/i, /policy/i],
  other: [],
};

/**
 * Classify a page based on URL, metadata, and structured data
 */
export function classifyPage(
  url: string,
  metadata: PageMetadata,
  structuredData?: StructuredData,
): PageClassification {
  const signals: string[] = [];
  const typeVotes: Record<PageType, number> = {} as Record<PageType, number>;

  try {
    const pathname = new URL(url).pathname;

    // check URL patterns
    for (const [type, patterns] of Object.entries(URL_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(pathname)) {
          signals.push(`url:${type}`);
          typeVotes[type as PageType] = (typeVotes[type as PageType] || 0) + 1;
          break;
        }
      }
    }

    // check JSON-LD types
    if (structuredData?.jsonLd) {
      for (const item of structuredData.jsonLd) {
        if (item && typeof item === 'object' && '@type' in item) {
          const ldType = String((item as Record<string, unknown>)['@type']);
          const mappedType = JSONLD_TYPE_MAP[ldType];
          if (mappedType) {
            signals.push(`jsonld:${ldType}`);
            // JSON-LD is a strong signal, weight it more
            typeVotes[mappedType] = (typeVotes[mappedType] || 0) + 2;
          }
        }
      }
    }

    // check title keywords
    const title = metadata.title || '';
    for (const [type, patterns] of Object.entries(TITLE_KEYWORDS)) {
      for (const pattern of patterns) {
        if (pattern.test(title)) {
          signals.push(`title:${type}`);
          typeVotes[type as PageType] = (typeVotes[type as PageType] || 0) + 1;
          break;
        }
      }
    }

    // determine best type
    let bestType: PageType = 'other';
    let bestScore = 0;

    for (const [type, score] of Object.entries(typeVotes)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type as PageType;
      }
    }

    // determine confidence
    let confidence: Confidence = 'low';
    if (bestScore >= 3 || signals.some((s) => s.startsWith('jsonld:'))) {
      confidence = 'high';
    } else if (bestScore >= 2) {
      confidence = 'medium';
    } else if (bestScore === 1) {
      confidence = 'low';
    }

    return {
      type: bestType,
      confidence,
      signals,
    };
  } catch {
    return {
      type: 'other',
      confidence: 'low',
      signals: [],
    };
  }
}
