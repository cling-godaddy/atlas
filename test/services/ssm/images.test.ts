import { describe, expect, it } from 'vitest';

import { aggregateImages, extractImages } from '../../../src/services/ssm/images';

import type { RawImageData } from '../../../src/services/ssm/images';

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
    ancestorClasses: '',
    element: 'other',
    isFirstInContainer: false,
    linkedTo: null,
    siblingText: '',
    ...overrides,
  };
}

describe('extractImages', () => {
  it('should convert raw images to extracted images', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({
        url: 'https://example.com/logo.png',
        alt: 'Company Logo',
        width: 200,
        height: 80,
        inHeader: true,
        classNames: 'logo navbar-brand',
        element: 'header',
      }),
    ];
    const result = extractImages(rawImages, 'https://example.com/');

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe('https://example.com/logo.png');
    expect(result[0]!.alt).toBe('Company Logo');
    expect(result[0]!.width).toBe(200);
    expect(result[0]!.height).toBe(80);
    expect(result[0]!.sourceUrl).toBe('https://example.com/');
    expect(result[0]!.element).toBe('header');
    expect(result[0]!.inHeader).toBe(true);
    expect(result[0]!.classes).toEqual(['logo', 'navbar-brand']);
  });

  it('should set sourceUrl from parameter', () => {
    const rawImages: RawImageData[] = [makeRawImage()];
    const result = extractImages(rawImages, 'https://example.com/about');
    expect(result[0]!.sourceUrl).toBe('https://example.com/about');
  });

  it('should preserve layout context', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({
        inHeader: true,
        inFooter: false,
        inFirstSection: true,
        nearH1: true,
        isFirstInContainer: true,
      }),
    ];
    const result = extractImages(rawImages, 'https://example.com/');

    expect(result[0]!.inHeader).toBe(true);
    expect(result[0]!.inFooter).toBe(false);
    expect(result[0]!.inFirstSection).toBe(true);
    expect(result[0]!.nearH1).toBe(true);
    expect(result[0]!.isFirstInContainer).toBe(true);
  });

  it('should pass through linkedTo', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({ linkedTo: 'https://example.com/' }),
    ];
    const result = extractImages(rawImages, 'https://example.com/about');
    expect(result[0]!.linkedTo).toBe('https://example.com/');
  });

  it('should exclude linkedTo when null', () => {
    const rawImages: RawImageData[] = [makeRawImage({ linkedTo: null })];
    const result = extractImages(rawImages, 'https://example.com/');
    expect(result[0]!.linkedTo).toBeUndefined();
  });

  it('should parse CSS classes into array', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({ classNames: 'logo navbar-brand img-fluid' }),
    ];
    const result = extractImages(rawImages, 'https://example.com/');
    expect(result[0]!.classes).toEqual(['logo', 'navbar-brand', 'img-fluid']);
  });

  it('should exclude classes when empty', () => {
    const rawImages: RawImageData[] = [makeRawImage({ classNames: '' })];
    const result = extractImages(rawImages, 'https://example.com/');
    expect(result[0]!.classes).toBeUndefined();
  });

  it('should handle whitespace in classNames', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({ classNames: '  hero-image   main-banner  ' }),
    ];
    const result = extractImages(rawImages, 'https://example.com/');
    expect(result[0]!.classes).toEqual(['hero-image', 'main-banner']);
  });

  it('should preserve ancestorClasses and siblingText', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({
        ancestorClasses: 'team-section card-wrapper flex-container',
        siblingText: 'John Smith, CEO',
      }),
    ];
    const result = extractImages(rawImages, 'https://example.com/');
    expect(result[0]!.ancestorClasses).toBe('team-section card-wrapper flex-container');
    expect(result[0]!.siblingText).toBe('John Smith, CEO');
  });

  it('should exclude empty strings from optional fields', () => {
    const rawImages: RawImageData[] = [
      makeRawImage({
        alt: '',
        ancestorClasses: '',
        siblingText: '',
      }),
    ];
    const result = extractImages(rawImages, 'https://example.com/');
    expect(result[0]!.alt).toBeUndefined();
    expect(result[0]!.ancestorClasses).toBeUndefined();
    expect(result[0]!.siblingText).toBeUndefined();
  });
});

describe('aggregateImages', () => {
  it('should deduplicate images by URL', () => {
    const images = [
      {
        url: 'https://example.com/img.jpg',
        sourceUrl: '/page1',
        element: 'main' as const,
        inHeader: false,
        inFooter: false,
        inFirstSection: false,
        nearH1: false,
        isFirstInContainer: false,
      },
      {
        url: 'https://example.com/img.jpg',
        sourceUrl: '/page2',
        element: 'article' as const,
        inHeader: false,
        inFooter: false,
        inFirstSection: false,
        nearH1: false,
        isFirstInContainer: false,
      },
    ];
    const result = aggregateImages(images);
    expect(result).toHaveLength(1);
    expect(result[0]!.sourceUrl).toBe('/page1');
  });

  it('should preserve first occurrence', () => {
    const images = [
      {
        url: 'https://example.com/logo.jpg',
        sourceUrl: '/',
        element: 'nav' as const,
        inHeader: true,
        inFooter: false,
        inFirstSection: true,
        nearH1: false,
        isFirstInContainer: true,
        linkedTo: 'https://example.com/',
        classes: ['logo', 'brand'],
      },
      {
        url: 'https://example.com/logo.jpg',
        sourceUrl: '/about',
        element: 'header' as const,
        inHeader: true,
        inFooter: false,
        inFirstSection: false,
        nearH1: false,
        isFirstInContainer: false,
      },
    ];
    const result = aggregateImages(images);

    expect(result).toHaveLength(1);
    expect(result[0]!.element).toBe('nav');
    expect(result[0]!.linkedTo).toBe('https://example.com/');
    expect(result[0]!.classes).toEqual(['logo', 'brand']);
  });

  it('should keep unique images', () => {
    const images = [
      {
        url: 'https://example.com/a.jpg',
        sourceUrl: '/',
        element: 'main' as const,
        inHeader: false,
        inFooter: false,
        inFirstSection: false,
        nearH1: false,
        isFirstInContainer: false,
      },
      {
        url: 'https://example.com/b.jpg',
        sourceUrl: '/',
        element: 'main' as const,
        inHeader: false,
        inFooter: false,
        inFirstSection: false,
        nearH1: false,
        isFirstInContainer: false,
      },
    ];
    const result = aggregateImages(images);
    expect(result).toHaveLength(2);
  });
});
