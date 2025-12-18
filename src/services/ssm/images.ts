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

// section pattern definitions
const SECTION_PATTERNS = {
  team: /\b(team|staff|people|employee|member|author|founder|leadership|management|executive|who-we-are)\b/i,
  testimonial: /\b(testimonial|review|quote|feedback|client-say|customer-say|endorsement|rating)\b/i,
  service: /\b(service|solution|feature|benefit|offering|capability|what-we-do)\b/i,
  partner: /\b(partner|client|sponsor|trusted|logo-?(?:strip|bar|cloud|grid)|brand|company)\b/i,
  gallery: /\b(gallery|portfolio|project|work|showcase|photo|image|media|lightbox)\b/i,
  product: /\b(product|item|shop|store|catalog|merchandise|sku)\b/i,
} as const;

/**
 * Check if any pattern matches the combined class string
 */
function matchesSectionPattern(classes: string, pattern: RegExp): boolean {
  return pattern.test(classes);
}

/**
 * Categorize an image based on context signals
 */
function categorizeImage(img: RawImageData): { category: ImageCategory; signals: string[] } {
  const signals: string[] = [];
  const classes = (img.classNames + ' ' + img.parentClasses).toLowerCase();
  const allClasses = (classes + ' ' + img.ancestorClasses).toLowerCase();
  const altLower = img.alt.toLowerCase();

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
  const logoByClass = allClasses.includes('logo') && !allClasses.includes('logo-grid') && !allClasses.includes('logo-strip');
  const logoByAlt = altLower.includes('logo') && img.width < 400;
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

  // partner/client logos section - check before gallery to catch logo grids
  if (matchesSectionPattern(allClasses, SECTION_PATTERNS.partner)) {
    signals.push('section:partner');
    return { category: 'partner', signals };
  }

  // team/people section detection
  if (matchesSectionPattern(allClasses, SECTION_PATTERNS.team)) {
    signals.push('section:team');
    return { category: 'team', signals };
  }

  // testimonial section detection
  if (matchesSectionPattern(allClasses, SECTION_PATTERNS.testimonial)) {
    signals.push('section:testimonial');
    return { category: 'testimonial', signals };
  }

  // service/feature section detection
  if (matchesSectionPattern(allClasses, SECTION_PATTERNS.service)) {
    signals.push('section:service');
    return { category: 'service', signals };
  }

  // product detection - class patterns and article context
  if (
    matchesSectionPattern(allClasses, SECTION_PATTERNS.product) ||
    altLower.includes('product') ||
    (img.element === 'article' && img.linkedTo)
  ) {
    if (matchesSectionPattern(allClasses, SECTION_PATTERNS.product)) signals.push('section:product');
    if (altLower.includes('product')) signals.push('alt:product');
    if (img.element === 'article' && img.linkedTo) signals.push('article-linked');
    return { category: 'product', signals };
  }

  // gallery detection - figure element and class patterns
  if (
    img.element === 'figure' ||
    matchesSectionPattern(allClasses, SECTION_PATTERNS.gallery) ||
    classes.includes('carousel') ||
    classes.includes('slider')
  ) {
    if (img.element === 'figure') signals.push('figure-element');
    if (matchesSectionPattern(allClasses, SECTION_PATTERNS.gallery)) signals.push('section:gallery');
    if (classes.includes('carousel') || classes.includes('slider')) signals.push('slider-context');
    return { category: 'gallery', signals };
  }

  // content image - medium sized image in main content area
  if (img.element === 'article' || img.element === 'main' || img.element === 'section') {
    if (img.width >= 200 && img.height >= 150) {
      signals.push('content-area');
      return { category: 'content', signals };
    }
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
  const categoryScores: Record<ImageCategory, number> = {
    logo: 5,
    hero: 4,
    product: 3,
    team: 3,
    testimonial: 3,
    service: 3,
    partner: 2,
    gallery: 2,
    content: 2,
    icon: 1,
    other: 0,
  };
  priority += categoryScores[category];

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
