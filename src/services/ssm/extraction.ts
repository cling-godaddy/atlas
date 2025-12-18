import type { SemanticElement } from '../../types/ssm';
import type { Page } from 'puppeteer';

/**
 * Raw image data extracted from page DOM
 */
export interface RawImageData {
  url: string;
  alt: string;
  width: number;
  height: number;
  inHeader: boolean;
  inFooter: boolean;
  inFirstSection: boolean;
  nearH1: boolean;
  classNames: string;
  parentClasses: string;
  element: SemanticElement;
  isFirstInContainer: boolean;
  linkedTo: string | null;
}

/**
 * Layout signals for page classification
 */
export interface LayoutSignals {
  imageCount: number;
  hasImageGrid: boolean;
  hasLinkedImages: boolean;
  hasLightbox: boolean;
  hasContactForm: boolean;
  hasPriceElements: boolean;
  hasPagination: boolean;
  hasDateElements: boolean;
}

/**
 * Content signals for page classification
 */
export interface ContentSignals {
  h1Text: string;
  hasAccordion: boolean;
  hasBreadcrumbs: boolean;
}

/**
 * Unified page signals extracted in a single DOM traversal
 */
export interface PageSignals {
  layout: LayoutSignals;
  content: ContentSignals;
  images: RawImageData[];
}

const SEMANTIC_ELEMENTS = ['nav', 'header', 'footer', 'aside', 'main', 'article', 'figure', 'section'] as const;

const LIGHTBOX_SELECTORS = [
  '[data-fancybox]',
  '[data-lightbox]',
  '.lightbox',
  '.fancybox',
  '.photoswipe',
  '.lg-item',
  '[data-gallery]',
  '.magnific-popup',
].join(',');

const GRID_CLASS_PATTERN = /\b(grid|masonry|gallery|mosaic|tiles|cards|portfolio)\b/i;

/**
 * Extract all page signals in a single DOM traversal
 */
export async function extractPageSignals(page: Page, baseUrl: URL): Promise<PageSignals> {
  const result = await page.evaluate(
    (semanticSelector: string, lightboxSelectors: string, gridPattern: string) => {
      const gridRegex = new RegExp(gridPattern, 'i');

      // === Content Signals ===
      const h1 = document.querySelector('h1');
      const h1Text = h1 ? h1.textContent.trim() : '';
      const h1Rect = h1?.getBoundingClientRect();

      const hasAccordion =
        document.querySelector(
          '[class*="accordion"], [class*="faq"], details, [data-toggle="collapse"], [data-bs-toggle="collapse"]',
        ) !== null;

      const hasBreadcrumbs =
        document.querySelector('[class*="breadcrumb"], [itemtype*="BreadcrumbList"], nav[aria-label*="bread"]') !==
        null;

      // === Layout Signals ===
      const hasContactForm =
        document.querySelector(
          'form[action*="contact"], form[action*="mail"], form:has(input[type="email"]):has(textarea)',
        ) !== null;

      const hasPriceElements =
        document.querySelector('[class*="price"], [itemprop="price"], .currency, [data-price]') !== null;

      const hasPagination =
        document.querySelector('.pagination, [class*="pager"], nav[aria-label*="page"], [class*="page-numbers"]') !==
        null;

      const hasDateElements =
        document.querySelector('time, [datetime], [class*="publish"], [itemprop="datePublished"], .post-date') !== null;

      const hasLightbox = document.querySelector(lightboxSelectors) !== null;

      // === Image Extraction ===
      interface RawResult {
        url: string;
        alt: string;
        width: number;
        height: number;
        inHeader: boolean;
        inFooter: boolean;
        inFirstSection: boolean;
        nearH1: boolean;
        classNames: string;
        parentClasses: string;
        element: string;
        isFirstInContainer: boolean;
        linkedTo: string | null;
      }

      const images: RawResult[] = [];
      const seen = new Set<string>();
      const containerFirstImages = new Map<Element, string>();
      let linkedImageCount = 0;
      let gridImageCount = 0;

      // support lazy-loaded images
      const imgs = document.querySelectorAll('img[src], img[data-src], img[data-lazy-src], img[data-original]');
      const firstSection = document.querySelector('main > section, main > div, body > section, body > div');

      for (const img of imgs) {
        // try src first, then lazy-load attributes (use || to skip empty strings)
        const src =
          (img.getAttribute('src') ?? '') ||
          (img.getAttribute('data-src') ?? '') ||
          (img.getAttribute('data-lazy-src') ?? '') ||
          (img.getAttribute('data-original') ?? '');
        if (!src || seen.has(src)) continue;

        // skip data URIs and blobs
        if (src.startsWith('data:') || src.startsWith('blob:')) continue;

        seen.add(src);

        const rect = img.getBoundingClientRect();

        // skip tiny images (likely tracking pixels)
        if (rect.width < 20 || rect.height < 20) continue;

        // position context
        const inHeader = !!img.closest('header');
        const inFooter = !!img.closest('footer');
        const inFirstSection = firstSection ? firstSection.contains(img) : false;

        // near h1 check
        let nearH1 = false;
        if (h1Rect) {
          nearH1 = Math.abs(rect.top - h1Rect.top) < 300;
        }

        // semantic container
        const container = img.closest(semanticSelector);
        const element = container ? container.tagName.toLowerCase() : 'other';

        // first in container check
        let isFirstInContainer = false;
        if (container) {
          if (!containerFirstImages.has(container)) {
            containerFirstImages.set(container, src);
            isFirstInContainer = true;
          } else {
            isFirstInContainer = containerFirstImages.get(container) === src;
          }
        }

        // linked image check
        const anchor = img.closest('a');
        const linkedTo = anchor?.getAttribute('href') ?? null;
        if (linkedTo) linkedImageCount++;

        // grid container check (for layout signal)
        const parent = img.parentElement;
        if (parent) {
          const parentClass = parent.className || '';
          if (gridRegex.test(parentClass)) {
            gridImageCount++;
          }
        }

        images.push({
          url: src,
          alt: img.getAttribute('alt') ?? '',
          width: rect.width,
          height: rect.height,
          inHeader,
          inFooter,
          inFirstSection,
          nearH1,
          classNames: img.className,
          parentClasses: img.parentElement?.className ?? '',
          element,
          isFirstInContainer,
          linkedTo,
        });
      }

      // check for image grid layout (container with grid class/style containing multiple images)
      let hasImageGrid = gridImageCount >= 4;
      if (!hasImageGrid) {
        const containers = document.querySelectorAll(
          'main, article, section, .content, [class*="gallery"], [class*="grid"]',
        );
        for (const cont of containers) {
          const containerImages = cont.querySelectorAll('img[src], img[data-src]');
          if (containerImages.length >= 4) {
            const className = cont.className || '';
            if (gridRegex.test(className)) {
              hasImageGrid = true;
              break;
            }
            // check computed style for CSS grid/flexbox
            const style = window.getComputedStyle(cont);
            if (style.display === 'grid' || (style.display === 'flex' && style.flexWrap === 'wrap')) {
              hasImageGrid = true;
              break;
            }
          }
        }
      }

      return {
        layout: {
          imageCount: images.length,
          hasImageGrid,
          hasLinkedImages: linkedImageCount >= 3,
          hasLightbox,
          hasContactForm,
          hasPriceElements,
          hasPagination,
          hasDateElements,
        },
        content: {
          h1Text,
          hasAccordion,
          hasBreadcrumbs,
        },
        images,
      };
    },
    SEMANTIC_ELEMENTS.join(','),
    LIGHTBOX_SELECTORS,
    GRID_CLASS_PATTERN.source,
  );

  // resolve relative URLs
  const resolvedImages = result.images.map((img) => ({
    ...img,
    url: new URL(img.url, baseUrl).toString(),
    element: img.element as SemanticElement,
    linkedTo: img.linkedTo ? resolveUrl(img.linkedTo, baseUrl) : null,
  }));

  return {
    layout: result.layout,
    content: result.content,
    images: resolvedImages,
  };
}

function resolveUrl(href: string, baseUrl: URL): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}
