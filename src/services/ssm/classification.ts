import type { PageSignals } from './extraction';
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
  gallery: [/\/gallery/i, /\/photos?/i, /\/pictures/i, /\/portfolio/i, /\/work/i, /\/projects/i, /\/media/i],
  blog: [/^\/blog\/?$/i, /^\/news\/?$/i, /^\/articles?\/?$/i, /^\/posts?\/?$/i],
  article: [
    /\/blog\/[^/]+/i,
    /\/news\/[^/]+/i,
    /\/posts?\/[^/]+/i,
    /\/article\/[^/]+/i,
    /\/\d{4}\/\d{2}\/[^/]+/i, // WordPress date permalinks: /2012/07/slug/
  ],
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
  gallery: [/gallery/i, /portfolio/i, /our\s*work/i, /photos?/i, /pictures/i],
  blog: [/^blog$/i, /^news$/i, /articles?/i],
  article: [],
  faq: [/faq/i, /frequently\s*asked/i, /help/i, /support/i],
  legal: [/privacy/i, /terms/i, /legal/i, /policy/i],
  other: [],
};

const H1_KEYWORDS: Partial<Record<PageType, RegExp[]>> = {
  contact: [/contact/i, /get\s*in\s*touch/i, /reach\s*(out|us)/i],
  about: [/about\s*(us)?/i, /who\s*we\s*are/i, /our\s*story/i, /our\s*team/i],
  services: [/services?/i, /what\s*we\s*do/i, /solutions?/i],
  gallery: [/gallery/i, /portfolio/i, /our\s*work/i, /photos?/i, /pictures/i],
  shop: [/shop/i, /products?/i, /store/i, /browse/i],
  blog: [/blog/i, /news/i, /articles?/i, /latest\s*posts?/i],
  faq: [/faq/i, /frequently\s*asked/i, /questions?/i, /help/i],
};

/**
 * Classify a page based on URL, metadata, structured data, and page signals
 */
export function classifyPage(
  url: string,
  metadata: PageMetadata,
  structuredData?: StructuredData,
  pageSignals?: PageSignals,
): PageClassification {
  const signals: string[] = [];
  const typeVotes: Record<PageType, number> = {} as Record<PageType, number>;

  try {
    const pathname = new URL(url).pathname;

    // check URL patterns
    // some URL patterns are highly specific and get extra weight
    const highConfidenceUrlTypes = new Set(['article', 'product', 'legal']);
    for (const [type, patterns] of Object.entries(URL_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(pathname)) {
          signals.push(`url:${type}`);
          const weight = highConfidenceUrlTypes.has(type) ? 2 : 1;
          typeVotes[type as PageType] = (typeVotes[type as PageType] || 0) + weight;
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

    // check h1 content keywords
    if (pageSignals?.content.h1Text) {
      const h1 = pageSignals.content.h1Text;
      for (const [type, patterns] of Object.entries(H1_KEYWORDS)) {
        for (const pattern of patterns) {
          if (pattern.test(h1)) {
            signals.push(`h1:${type}`);
            typeVotes[type as PageType] = (typeVotes[type as PageType] || 0) + 1;
            break;
          }
        }
      }
    }

    // check content structure signals
    if (pageSignals?.content.hasAccordion) {
      signals.push('layout:accordion');
      typeVotes.faq = (typeVotes.faq || 0) + 1;
    }

    if (pageSignals?.content.hasBreadcrumbs) {
      signals.push('layout:breadcrumbs');
      // breadcrumbs suggest deeper content pages (product, article, category)
    }

    // check layout signals - context-aware boosting
    if (pageSignals?.layout) {
      const layout = pageSignals.layout;

      // contact form is strong signal for contact page
      if (layout.hasContactForm) {
        signals.push('layout:contact-form');
        typeVotes.contact = (typeVotes.contact || 0) + 2;
      }

      // price elements suggest shop/product
      if (layout.hasPriceElements) {
        signals.push('layout:price-elements');
        typeVotes.shop = (typeVotes.shop || 0) + 1;
        typeVotes.product = (typeVotes.product || 0) + 1;
      }

      // pagination suggests listing pages
      if (layout.hasPagination) {
        signals.push('layout:pagination');
        // boost existing listing type signals
        if (typeVotes.shop) typeVotes.shop += 1;
        if (typeVotes.blog) typeVotes.blog += 1;
        if (typeVotes.category) typeVotes.category += 1;
      }

      // date elements with blog context
      if (layout.hasDateElements && typeVotes.blog) {
        signals.push('layout:date-elements');
        typeVotes.blog += 1;
      }

      // high image count - context-aware
      if (layout.imageCount >= 10) {
        signals.push('layout:high-image-count');
        // boost based on existing context
        if (typeVotes.shop || typeVotes.category) {
          typeVotes.shop = (typeVotes.shop || 0) + 1;
        } else {
          typeVotes.gallery = (typeVotes.gallery || 0) + 1;
        }
      }

      // image grid - context-aware (product grid vs photo gallery)
      if (layout.hasImageGrid) {
        if (typeVotes.shop || typeVotes.category || layout.hasPriceElements) {
          signals.push('layout:product-grid');
          typeVotes.shop = (typeVotes.shop || 0) + 1;
        } else if (typeVotes.blog) {
          signals.push('layout:article-grid');
          typeVotes.blog += 1;
        } else {
          signals.push('layout:image-grid');
          typeVotes.gallery = (typeVotes.gallery || 0) + 1;
        }
      }

      // linked images - often gallery or shop
      if (layout.hasLinkedImages) {
        signals.push('layout:linked-images');
        if (typeVotes.shop || layout.hasPriceElements) {
          typeVotes.shop = (typeVotes.shop || 0) + 1;
        } else {
          typeVotes.gallery = (typeVotes.gallery || 0) + 1;
        }
      }

      // lightbox is strong gallery signal
      if (layout.hasLightbox) {
        signals.push('layout:lightbox');
        typeVotes.gallery = (typeVotes.gallery || 0) + 2;
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
