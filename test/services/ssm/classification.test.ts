import { describe, expect, it } from 'vitest';

import { classifyPage } from '../../../src/services/ssm/classification';

import type { StructuredData } from '../../../src/types/crawl';
import type { PageMetadata } from '../../../src/types/page';

const baseMetadata: PageMetadata = {
  title: '',
  description: '',
};

describe('classifyPage', () => {
  describe('URL pattern detection', () => {
    it('should classify home page', () => {
      const result = classifyPage('https://example.com/', baseMetadata);
      expect(result.type).toBe('home');
      expect(result.signals).toContain('url:home');
    });

    it('should classify about page', () => {
      const result = classifyPage('https://example.com/about', baseMetadata);
      expect(result.type).toBe('about');
      expect(result.signals).toContain('url:about');
    });

    it('should classify contact page', () => {
      const result = classifyPage('https://example.com/contact', baseMetadata);
      expect(result.type).toBe('contact');
      expect(result.signals).toContain('url:contact');
    });

    it('should classify shop page', () => {
      const result = classifyPage('https://example.com/shop', baseMetadata);
      expect(result.type).toBe('shop');
      expect(result.signals).toContain('url:shop');
    });

    it('should classify product page', () => {
      const result = classifyPage('https://example.com/products/widget-123', baseMetadata);
      expect(result.type).toBe('product');
      expect(result.signals).toContain('url:product');
    });

    it('should classify category page', () => {
      const result = classifyPage('https://example.com/collections/electronics', baseMetadata);
      expect(result.type).toBe('category');
      expect(result.signals).toContain('url:category');
    });

    it('should classify blog page', () => {
      const result = classifyPage('https://example.com/blog', baseMetadata);
      expect(result.type).toBe('blog');
      expect(result.signals).toContain('url:blog');
    });

    it('should classify article page', () => {
      const result = classifyPage('https://example.com/blog/my-first-post', baseMetadata);
      expect(result.type).toBe('article');
      expect(result.signals).toContain('url:article');
    });

    it('should classify FAQ page', () => {
      const result = classifyPage('https://example.com/faq', baseMetadata);
      expect(result.type).toBe('faq');
      expect(result.signals).toContain('url:faq');
    });

    it('should classify legal page', () => {
      const result = classifyPage('https://example.com/privacy-policy', baseMetadata);
      expect(result.type).toBe('legal');
      expect(result.signals).toContain('url:legal');
    });
  });

  describe('JSON-LD type detection', () => {
    it('should classify Product from JSON-LD', () => {
      const structuredData: StructuredData = {
        jsonLd: [{ '@type': 'Product', name: 'Widget' }],
        microdata: [],
      };
      const result = classifyPage('https://example.com/item/123', baseMetadata, structuredData);
      expect(result.type).toBe('product');
      expect(result.signals).toContain('jsonld:Product');
      expect(result.confidence).toBe('high');
    });

    it('should classify Article from JSON-LD', () => {
      const structuredData: StructuredData = {
        jsonLd: [{ '@type': 'Article', headline: 'News' }],
        microdata: [],
      };
      const result = classifyPage('https://example.com/post/123', baseMetadata, structuredData);
      expect(result.type).toBe('article');
      expect(result.signals).toContain('jsonld:Article');
      expect(result.confidence).toBe('high');
    });

    it('should classify FAQPage from JSON-LD', () => {
      const structuredData: StructuredData = {
        jsonLd: [{ '@type': 'FAQPage' }],
        microdata: [],
      };
      const result = classifyPage('https://example.com/help', baseMetadata, structuredData);
      expect(result.type).toBe('faq');
      expect(result.signals).toContain('jsonld:FAQPage');
    });
  });

  describe('title keyword detection', () => {
    it('should classify from title keywords', () => {
      const metadata: PageMetadata = {
        title: 'About Us - Our Company Story',
        description: '',
      };
      const result = classifyPage('https://example.com/page', metadata);
      expect(result.type).toBe('about');
      expect(result.signals).toContain('title:about');
    });

    it('should classify contact from title', () => {
      const metadata: PageMetadata = {
        title: 'Contact Us Today',
        description: '',
      };
      const result = classifyPage('https://example.com/page', metadata);
      expect(result.type).toBe('contact');
      expect(result.signals).toContain('title:contact');
    });
  });

  describe('confidence scoring', () => {
    it('should have high confidence with multiple signals', () => {
      const metadata: PageMetadata = {
        title: 'About Us',
        description: '',
      };
      const result = classifyPage('https://example.com/about', metadata);
      expect(result.confidence).toBe('medium');
      expect(result.signals.length).toBeGreaterThanOrEqual(2);
    });

    it('should have high confidence with JSON-LD', () => {
      const structuredData: StructuredData = {
        jsonLd: [{ '@type': 'Product' }],
        microdata: [],
      };
      const result = classifyPage('https://example.com/item', baseMetadata, structuredData);
      expect(result.confidence).toBe('high');
    });

    it('should have low confidence with single URL signal', () => {
      const result = classifyPage('https://example.com/gallery', baseMetadata);
      expect(result.confidence).toBe('low');
    });

    it('should classify unknown pages as other', () => {
      const result = classifyPage('https://example.com/random-page', baseMetadata);
      expect(result.type).toBe('other');
    });
  });

  describe('edge cases', () => {
    it('should handle invalid URL gracefully', () => {
      const result = classifyPage('not-a-url', baseMetadata);
      expect(result.type).toBe('other');
      expect(result.confidence).toBe('low');
    });

    it('should handle empty structured data', () => {
      const structuredData: StructuredData = {
        jsonLd: [],
        microdata: [],
      };
      const result = classifyPage('https://example.com/about', baseMetadata, structuredData);
      expect(result.type).toBe('about');
    });
  });
});
