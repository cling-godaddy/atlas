import { describe, expect, it } from 'vitest';

import { aggregateImages, curatePageImages } from '../../../src/services/ssm/images';

import type { RawImageData } from '../../../src/services/ssm/images';
import type { PageMetadata } from '../../../src/types/page';

const baseMetadata: PageMetadata = {
  title: 'Test Page',
  description: '',
};

describe('curatePageImages', () => {
  it('should categorize logo images', () => {
    const rawImages: RawImageData[] = [
      {
        url: 'https://example.com/logo.png',
        alt: 'Company Logo',
        width: 200,
        height: 80,
        inHeader: true,
        inFooter: false,
        inFirstSection: false,
        nearH1: false,
        classNames: 'logo',
        parentClasses: '',
      },
    ];
    const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
    expect(result[0].category).toBe('logo');
    expect(result[0].signals).toContain('class:logo');
  });

  it('should categorize hero images', () => {
    const rawImages: RawImageData[] = [
      {
        url: 'https://example.com/hero.jpg',
        alt: 'Hero banner',
        width: 1200,
        height: 600,
        inHeader: false,
        inFooter: false,
        inFirstSection: true,
        nearH1: true,
        classNames: '',
        parentClasses: '',
      },
    ];
    const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
    expect(result[0].category).toBe('hero');
    expect(result[0].signals).toContain('large');
  });

  it('should categorize icon images', () => {
    const rawImages: RawImageData[] = [
      {
        url: 'https://example.com/icon.svg',
        alt: '',
        width: 24,
        height: 24,
        inHeader: false,
        inFooter: false,
        inFirstSection: false,
        nearH1: false,
        classNames: '',
        parentClasses: '',
      },
    ];
    const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
    expect(result[0].category).toBe('icon');
    expect(result[0].signals).toContain('icon-size');
  });

  it('should categorize gallery images', () => {
    const rawImages: RawImageData[] = [
      {
        url: 'https://example.com/gallery-1.jpg',
        alt: 'Gallery image',
        width: 400,
        height: 300,
        inHeader: false,
        inFooter: false,
        inFirstSection: false,
        nearH1: false,
        classNames: '',
        parentClasses: 'gallery-grid',
      },
    ];
    const result = curatePageImages(rawImages, 'https://example.com/', baseMetadata);
    expect(result[0].category).toBe('gallery');
    expect(result[0].signals).toContain('gallery-container');
  });

  it('should boost priority for og:image', () => {
    const rawImages: RawImageData[] = [
      {
        url: 'https://example.com/share.jpg',
        alt: '',
        width: 1200,
        height: 630,
        inHeader: false,
        inFooter: false,
        inFirstSection: false,
        nearH1: false,
        classNames: '',
        parentClasses: '',
      },
    ];
    const metadata: PageMetadata = {
      ...baseMetadata,
      ogImage: 'https://example.com/share.jpg',
    };
    const result = curatePageImages(rawImages, 'https://example.com/', metadata);
    expect(result[0].signals).toContain('og:image');
    expect(result[0].priority).toBeGreaterThan(3);
  });

  it('should boost priority for home page', () => {
    const rawImages: RawImageData[] = [
      {
        url: 'https://example.com/image.jpg',
        alt: 'Test',
        width: 400,
        height: 300,
        inHeader: false,
        inFooter: false,
        inFirstSection: false,
        nearH1: false,
        classNames: '',
        parentClasses: '',
      },
    ];
    const homeResult = curatePageImages(rawImages, 'https://example.com/', baseMetadata, void 0, true);
    const otherResult = curatePageImages(rawImages, 'https://example.com/page', baseMetadata, void 0, false);
    expect(homeResult[0].priority).toBeGreaterThan(otherResult[0].priority);
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
    expect(result[0].priority).toBe(5);
    expect(result[0].signals).toContain('a');
    expect(result[0].signals).toContain('b');
  });

  it('should sort by priority descending', () => {
    const images = [
      { url: 'https://example.com/low.jpg', category: 'other' as const, priority: 2, signals: [], sourceUrl: '/' },
      { url: 'https://example.com/high.jpg', category: 'logo' as const, priority: 8, signals: [], sourceUrl: '/' },
      { url: 'https://example.com/mid.jpg', category: 'hero' as const, priority: 5, signals: [], sourceUrl: '/' },
    ];
    const result = aggregateImages(images);
    expect(result[0].url).toBe('https://example.com/high.jpg');
    expect(result[1].url).toBe('https://example.com/mid.jpg');
    expect(result[2].url).toBe('https://example.com/low.jpg');
  });
});
