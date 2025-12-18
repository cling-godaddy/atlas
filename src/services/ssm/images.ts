import type { RawImageData } from './extraction';
import type { ExtractedImage } from '../../types/ssm';

export type { RawImageData };

/**
 * Convert raw image data to ExtractedImage format
 */
function toExtractedImage(img: RawImageData, sourceUrl: string): ExtractedImage {
  const classes = img.classNames.split(/\s+/).filter((c) => c.length > 0);

  return {
    url: img.url,
    alt: img.alt || void 0,
    width: img.width || void 0,
    height: img.height || void 0,
    sourceUrl,
    element: img.element,
    inHeader: img.inHeader,
    inFooter: img.inFooter,
    inFirstSection: img.inFirstSection,
    nearH1: img.nearH1,
    isFirstInContainer: img.isFirstInContainer,
    linkedTo: img.linkedTo ?? void 0,
    classes: classes.length > 0 ? classes : void 0,
    ancestorClasses: img.ancestorClasses || void 0,
    siblingText: img.siblingText || void 0,
  };
}

/**
 * Extract images from raw page data
 */
export function extractImages(rawImages: RawImageData[], sourceUrl: string): ExtractedImage[] {
  return rawImages.map((img) => toExtractedImage(img, sourceUrl));
}

/**
 * Aggregate and deduplicate images across pages
 */
export function aggregateImages(allImages: ExtractedImage[]): ExtractedImage[] {
  const imageMap = new Map<string, ExtractedImage>();

  for (const img of allImages) {
    if (!imageMap.has(img.url)) {
      imageMap.set(img.url, img);
    }
  }

  return Array.from(imageMap.values());
}
