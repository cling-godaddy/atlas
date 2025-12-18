import type { RawImageData } from './extraction';
import type { StructuredData } from '../../types/crawl';
import type { PageMetadata } from '../../types/page';
import type { CuratedImage, ImageCategory } from '../../types/ssm';

export type { RawImageData };

function isHomeLink(linkedTo: string | null): boolean {
  if (!linkedTo) return false;
  try {
    const url = new URL(linkedTo);
    return url.pathname === '/' || url.pathname === '';
  } catch {
    return linkedTo === '/' || linkedTo === '';
  }
}

/**
 * Categorize an image based on context signals
 */
function categorizeImage(img: RawImageData): { category: ImageCategory; signals: string[] } {
  const signals: string[] = [];
  const classes = (img.classNames + ' ' + img.parentClasses).toLowerCase();

  // always track element context
  if (img.element !== 'other') {
    signals.push(`element:${img.element}`);
  }

  // track home link
  const linksHome = isHomeLink(img.linkedTo);
  if (linksHome) {
    signals.push('links-home');
  }

  // logo detection - enhanced with nav context and home link
  const logoByClass = classes.includes('logo');
  const logoByAlt = img.alt.toLowerCase().includes('logo');
  const logoByNavContext = img.element === 'nav' && img.width < 300 && img.isFirstInContainer;
  const logoByHeaderSmall = img.inHeader && img.width < 300 && img.height < 150;
  const logoByHomeLink = linksHome && img.width < 300 && (img.element === 'nav' || img.element === 'header');

  if (logoByClass || logoByAlt || logoByNavContext || logoByHeaderSmall || logoByHomeLink) {
    if (logoByClass) signals.push('class:logo');
    if (logoByAlt) signals.push('alt:logo');
    if (logoByNavContext) signals.push('nav:first-small');
    if (logoByHeaderSmall) signals.push('header:small');
    if (logoByHomeLink) signals.push('home-link:small');
    return { category: 'logo', signals };
  }

  // hero detection
  if (img.width > 800 && img.inFirstSection && img.nearH1) {
    signals.push('large', 'first-section', 'near-h1');
    return { category: 'hero', signals };
  }
  if (img.width > 1000 && img.height > 400) {
    signals.push('hero-size');
    return { category: 'hero', signals };
  }

  // icon detection
  if (img.width < 64 && img.height < 64) {
    signals.push('icon-size');
    return { category: 'icon', signals };
  }

  // gallery detection - enhanced with figure element
  if (
    img.element === 'figure' ||
    classes.includes('gallery') ||
    classes.includes('grid') ||
    classes.includes('carousel') ||
    classes.includes('slider')
  ) {
    if (img.element === 'figure') signals.push('figure-element');
    if (classes.includes('gallery') || classes.includes('grid') || classes.includes('carousel') || classes.includes('slider')) {
      signals.push('gallery-container');
    }
    return { category: 'gallery', signals };
  }

  // product detection - enhanced with article context
  if (
    classes.includes('product') ||
    classes.includes('item') ||
    img.alt.toLowerCase().includes('product') ||
    (img.element === 'article' && img.linkedTo)
  ) {
    if (classes.includes('product') || classes.includes('item') || img.alt.toLowerCase().includes('product')) {
      signals.push('product-context');
    }
    if (img.element === 'article' && img.linkedTo) {
      signals.push('article-linked');
    }
    return { category: 'product', signals };
  }

  return { category: 'other', signals };
}

/**
 * Calculate priority score for an image
 */
function calculatePriority(
  img: RawImageData,
  category: ImageCategory,
  isOgImage: boolean,
  isJsonLdImage: boolean,
  isHomePage: boolean,
): number {
  let priority = 0;

  // base category scores
  if (category === 'logo') priority += 5;
  if (category === 'hero') priority += 4;
  if (category === 'product') priority += 3;
  if (category === 'gallery') priority += 2;

  // bonus signals
  if (isOgImage) priority += 3;
  if (isHomePage) priority += 2;
  if (isJsonLdImage) priority += 2;
  if (img.width > 500) priority += 1;
  if (img.alt) priority += 1;

  return Math.min(priority, 10);
}

/**
 * Extract product images from JSON-LD
 */
function getJsonLdImages(structuredData?: StructuredData): Set<string> {
  const images = new Set<string>();
  if (!structuredData?.jsonLd) return images;

  for (const item of structuredData.jsonLd) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    // single image
    if (typeof obj.image === 'string') {
      images.add(obj.image);
    }

    // array of images
    if (Array.isArray(obj.image)) {
      for (const img of obj.image) {
        if (typeof img === 'string') images.add(img);
        if (img && typeof img === 'object' && 'url' in img) {
          const imgObj = img as Record<string, unknown>;
          if (typeof imgObj.url === 'string') images.add(imgObj.url);
        }
      }
    }
  }

  return images;
}

/**
 * Curate images from a single page
 */
export function curatePageImages(
  rawImages: RawImageData[],
  pageUrl: string,
  metadata: PageMetadata,
  structuredData?: StructuredData,
  isHomePage?: boolean,
): CuratedImage[] {
  const ogImage = metadata.ogImage;
  const jsonLdImages = getJsonLdImages(structuredData);

  return rawImages.map((img) => {
    const { category, signals } = categorizeImage(img);
    const isOgImage = ogImage === img.url;
    const isJsonLdImage = jsonLdImages.has(img.url);

    if (isOgImage) signals.push('og:image');
    if (isJsonLdImage) signals.push('jsonld:image');
    if (isHomePage) signals.push('home-page');

    const priority = calculatePriority(img, category, isOgImage, isJsonLdImage, isHomePage ?? false);

    // parse CSS classes into array
    const classes = img.classNames
      .split(/\s+/)
      .filter((c) => c.length > 0);

    return {
      url: img.url,
      alt: img.alt || void 0,
      category,
      priority,
      width: img.width || void 0,
      height: img.height || void 0,
      signals,
      sourceUrl: pageUrl,
      context: {
        element: img.element,
        isFirstInContainer: img.isFirstInContainer || void 0,
      },
      linkedTo: img.linkedTo ?? void 0,
      classes: classes.length > 0 ? classes : void 0,
    };
  });
}

/**
 * Aggregate and deduplicate images across pages
 */
export function aggregateImages(allImages: CuratedImage[]): CuratedImage[] {
  const imageMap = new Map<string, CuratedImage>();

  for (const img of allImages) {
    const existing = imageMap.get(img.url);
    if (existing) {
      // keep higher priority version, merge signals
      if (img.priority > existing.priority) {
        imageMap.set(img.url, {
          ...img,
          signals: [...new Set([...existing.signals, ...img.signals])],
        });
      } else {
        existing.signals = [...new Set([...existing.signals, ...img.signals])];
      }
    } else {
      imageMap.set(img.url, img);
    }
  }

  // sort by priority descending
  return Array.from(imageMap.values()).sort((a, b) => b.priority - a.priority);
}
