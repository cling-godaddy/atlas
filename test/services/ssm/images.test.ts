import { describe, expect, it } from 'vitest';

import { aggregateImages, curatePageImages } from '../../../src/services/ssm/images';

import type { RawImageData } from '../../../src/services/ssm/images';
import type { PageMetadata } from '../../../src/types/page';

const baseMetadata: PageMetadata = {
  title: 'Test Page',
  description: '',
};

function makeRawImage(overrides: Partial<RawImageData> = {}): RawImageData {
  return {
    url: 'https://example.com/image.jpg',
    alt: '',
    width: 400,
    height: 300,
    inHeader: false,
    inFooter: false,
    inFirstSection: false,
    nearH1: false,
    classNames: '',
    parentClasses: '',
    element: 'other',
    isFirstInContainer: false,
    linkedTo: null,
    ...overrides,
  };
}

describe('curatePageImages', () => {
  it('should categorize logo images', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({
        url: 'https://example.com/logo.png',
        alt: 'Company Logo',
        width: 200,
        height: 80,
        inHeader: true,
        classNames: 'logo',
        element: 'header',
      }),
    ];
    const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
    expect(result[0]!.category).toBe('logo');
    expect(result[0]!.signals).toContain('class:logo');
  });

  it('should categorize hero images', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({
        url: 'https://example.com/hero.jpg',
        alt: 'Hero banner',
        width: 1200,
        height: 600,
        inFirstSection: true,
        nearH1: true,
        element: 'main',
      }),
    ];
    const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
    expect(result[0]!.category).toBe('hero');
    expect(result[0]!.signals).toContain('large');
  });

  it('should categorize icon images', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({
        url: 'https://example.com/icon.svg',
        width: 24,
        height: 24,
      }),
    ];
    const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
    expect(result[0]!.category).toBe('icon');
    expect(result[0]!.signals).toContain('icon-size');
  });

  it('should categorize gallery images', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({
        url: 'https://example.com/gallery-1.jpg',
        alt: 'Gallery image',
        parentClasses: 'gallery-grid',
      }),
    ];
    const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
    expect(result[0]!.category).toBe('gallery');
    expect(result[0]!.signals).toContain('gallery-container');
  });

  it('should boost priority for og:image', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({
        url: 'https://example.com/share.jpg',
        width: 1200,
        height: 630,
      }),
    ];
    const metadata: PageMetadata = {
      ...baseMetadata,
      ogImage: 'https://example.com/share.jpg',
    };
    const result = curatePageImages(rawImages, 'https://example.com/', metadata);
    expect(result[0]!.signals).toContain('og:image');
    expect(result[0]!.priority).toBeGreaterThan(3);
  });

  it('should boost priority for home page', () => {
    const rawImages: RawImageData[] = [makeRawImage({ alt: 'Test' })];
    const homeResult = curatePageImages(rawImages, 'https://example.com/', baseMetadata, void 0, true);
    const otherResult = curatePageImages(rawImages, 'https://example.com/page', baseMetadata, void 0, false);
    expect(homeResult[0]!.priority).toBeGreaterThan(otherResult[0]!.priority);
  });

  describe('element context', () => {
    it('should detect image in nav element', () => {
      const rawImages: RawImageData[] = [
        makeRawImage({
          url: 'https://example.com/nav-logo.png',
          width: 150,
          height: 50,
          element: 'nav',
          isFirstInContainer: true,
        }),
      ];
      const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
      expect(result[0]!.context?.element).toBe('nav');
      expect(result[0]!.signals).toContain('element:nav');
      expect(result[0]!.category).toBe('logo');
      expect(result[0]!.signals).toContain('nav:first-small');
    });

    it('should detect image in figure element as gallery', () => {
      const rawImages: RawImageData[] = [
        makeRawImage({
          url: 'https://example.com/photo.jpg',
          element: 'figure',
        }),
      ];
      const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
      expect(result[0]!.context?.element).toBe('figure');
      expect(result[0]!.signals).toContain('element:figure');
      expect(result[0]!.category).toBe('gallery');
      expect(result[0]!.signals).toContain('figure-element');
    });

    it('should pass through isFirstInContainer', () => {
      const rawImages: RawImageData[] = [
        makeRawImage({
          element: 'header',
          isFirstInContainer: true,
        }),
        makeRawImage({
          url: 'https://example.com/second.jpg',
          element: 'header',
          isFirstInContainer: false,
        }),
      ];
      const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
      expect(result[0]!.context?.isFirstInContainer).toBe(true);
      expect(result[1]!.context?.isFirstInContainer).toBeUndefined();
    });
  });

  describe('linkedTo', () => {
    it('should detect image linked to home as logo signal', () => {
      const rawImages: RawImageData[] = [
        makeRawImage({
          url: 'https://example.com/logo.png',
          width: 180,
          height: 60,
          element: 'nav',
          linkedTo: 'https://example.com/',
        }),
      ];
      const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
      expect(result[0]!.linkedTo).toBe('https://example.com/');
      expect(result[0]!.signals).toContain('links-home');
      expect(result[0]!.category).toBe('logo');
      expect(result[0]!.signals).toContain('home-link:small');
    });

    it('should pass through linkedTo for non-home links', () => {
      const rawImages: RawImageData[] = [
        makeRawImage({
          url: 'https://example.com/product.jpg',
          element: 'article',
          linkedTo: 'https://example.com/products/widget',
        }),
      ];
      const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
      expect(result[0]!.linkedTo).toBe('https://example.com/products/widget');
      expect(result[0]!.category).toBe('product');
      expect(result[0]!.signals).toContain('article-linked');
    });

    it('should not include linkedTo when null', () => {
      const rawImages: RawImageData[] = [makeRawImage()];
      const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
      expect(result[0]!.linkedTo).toBeUndefined();
    });
  });

  describe('classes', () => {
    it('should parse CSS classes into array', () => {
      const rawImages: RawImageData[] = [
        makeRawImage({
          classNames: 'logo navbar-brand img-fluid',
        }),
      ];
      const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
      expect(result[0]!.classes).toEqual(['logo', 'navbar-brand', 'img-fluid']);
    });

    it('should not include classes when empty', () => {
      const rawImages: RawImageData[] = [makeRawImage({ classNames: '' })];
      const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
      expect(result[0]!.classes).toBeUndefined();
    });

    it('should handle whitespace in classNames', () => {
      const rawImages: RawImageData[] = [
        makeRawImage({
          classNames: '  hero-image   main-banner  ',
        }),
      ];
      const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
      expect(result[0]!.classes).toEqual(['hero-image', 'main-banner']);
    });
  });
});

describe('aggregateImages', () => {
  it('should deduplicate images by URL', () => {
    const images = [
      { url: 'https://example.com/img.jpg', category: 'other' as const, priority: 5, signals: ['a'], sourceUrl: '/page1' },
      { url: 'https://example.com/img.jpg', category: 'other' as const, priority: 3, signals: ['b'], sourceUrl: '/page2' },
    ];
    const result = aggregateImages(images);
    expect(result).toHaveLength(1);
    expect(result[0]!.priority).toBe(5);
    expect(result[0]!.signals).toContain('a');
    expect(result[0]!.signals).toContain('b');
  });

  it('should sort by priority descending', () => {
    const images = [
      { url: 'https://example.com/low.jpg', category: 'other' as const, priority: 2, signals: [], sourceUrl: '/' },
      { url: 'https://example.com/high.jpg', category: 'logo' as const, priority: 8, signals: [], sourceUrl: '/' },
      { url: 'https://example.com/mid.jpg', category: 'hero' as const, priority: 5, signals: [], sourceUrl: '/' },
    ];
    const result = aggregateImages(images);
    expect(result[0]!.url).toBe('https://example.com/high.jpg');
    expect(result[1]!.url).toBe('https://example.com/mid.jpg');
    expect(result[2]!.url).toBe('https://example.com/low.jpg');
  });

  it('should preserve context from higher priority version', () => {
    const images = [
      {
        url: 'https://example.com/logo.jpg',
        category: 'logo' as const,
        priority: 8,
        signals: ['class:logo'],
        sourceUrl: '/',
        context: { element: 'nav' as const, isFirstInContainer: true },
        linkedTo: 'https://example.com/',
        classes: ['logo', 'brand'],
      },
      {
        url: 'https://example.com/logo.jpg',
        category: 'logo' as const,
        priority: 5,
        signals: ['header:small'],
        sourceUrl: '/about',
        context: { element: 'header' as const },
      },
    ];
    const result = aggregateImages(images);
    expect(result).toHaveLength(1);
    expect(result[0]!.context?.element).toBe('nav');
    expect(result[0]!.linkedTo).toBe('https://example.com/');
    expect(result[0]!.classes).toEqual(['logo', 'brand']);
    expect(result[0]!.signals).toContain('class:logo');
    expect(result[0]!.signals).toContain('header:small');
  });
});
