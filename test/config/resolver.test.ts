import { describe, expect, it } from 'vitest';

import { resolveConfig } from '../../src/config/resolver';

describe('resolveConfig', () => {
  describe('basic validation', () => {
    it('should reject invalid url', () => {
      expect(() => resolveConfig({ url: 'not-a-url' })).toThrow('url must be a valid HTTP/HTTPS URL');
    });

    it('should reject non-http(s) urls', () => {
      expect(() => resolveConfig({ url: 'ftp://example.com' })).toThrow('url must be a valid HTTP/HTTPS URL');
    });

    it('should accept valid http url', () => {
      const config = resolveConfig({ url: 'http://example.com' });
      expect(config.url).toBe('http://example.com');
    });

    it('should accept valid https url', () => {
      const config = resolveConfig({ url: 'https://example.com' });
      expect(config.url).toBe('https://example.com');
    });
  });

  describe('profile selection', () => {
    it('should apply quick profile', () => {
      const config = resolveConfig({ url: 'https://example.com', profile: 'quick' });
      expect(config.maxPages).toBe(50);
      expect(config.maxDepth).toBe(2);
      expect(config.concurrency).toBe(5);
      expect(config.includeAssets).toBe(false);
    });

    it('should apply standard profile', () => {
      const config = resolveConfig({ url: 'https://example.com', profile: 'standard' });
      expect(config.maxPages).toBe(500);
      expect(config.maxDepth).toBe(5);
      expect(config.concurrency).toBe(10);
      expect(config.includeAssets).toBe(true);
    });

    it('should apply deep profile', () => {
      const config = resolveConfig({ url: 'https://example.com', profile: 'deep' });
      expect(config.maxPages).toBe(10000);
      expect(config.maxDepth).toBe(10);
      expect(config.concurrency).toBe(20);
      expect(config.stealth).toBe(true);
    });

    it('should apply full profile', () => {
      const config = resolveConfig({ url: 'https://example.com', profile: 'full' });
      expect(config.maxPages).toBe(Infinity);
      expect(config.maxDepth).toBe(Infinity);
      expect(config.concurrency).toBe(30);
    });
  });

  describe('merge priority', () => {
    it('should use defaults when no profile or overrides', () => {
      const config = resolveConfig({ url: 'https://example.com' });
      expect(config.maxPages).toBe(500);
      expect(config.maxDepth).toBe(5);
      expect(config.concurrency).toBe(10);
      expect(config.locale).toBe('en-US');
      expect(config.output).toBe('./output');
    });

    it('should allow profile override with explicit values', () => {
      const config = resolveConfig({
        url: 'https://example.com',
        profile: 'quick',
        maxPages: 100,
      });
      expect(config.maxPages).toBe(100);
      expect(config.maxDepth).toBe(2);
    });

    it('should allow full custom config without profile', () => {
      const config = resolveConfig({
        url: 'https://example.com',
        maxPages: 200,
        maxDepth: 3,
        concurrency: 15,
      });
      expect(config.maxPages).toBe(200);
      expect(config.maxDepth).toBe(3);
      expect(config.concurrency).toBe(15);
    });
  });

  describe('numeric validation', () => {
    it('should reject negative maxPages', () => {
      expect(() => resolveConfig({ url: 'https://example.com', maxPages: -1 })).toThrow();
    });

    it('should reject zero maxPages', () => {
      expect(() => resolveConfig({ url: 'https://example.com', maxPages: 0 })).toThrow();
    });

    it('should accept Infinity for maxPages', () => {
      const config = resolveConfig({ url: 'https://example.com', maxPages: Infinity });
      expect(config.maxPages).toBe(Infinity);
    });

    it('should accept Infinity for maxDepth', () => {
      const config = resolveConfig({ url: 'https://example.com', maxDepth: Infinity });
      expect(config.maxDepth).toBe(Infinity);
    });

    it('should reject concurrency < 1', () => {
      expect(() => resolveConfig({ url: 'https://example.com', concurrency: 0 })).toThrow();
    });

    it('should reject concurrency > 100', () => {
      expect(() => resolveConfig({ url: 'https://example.com', concurrency: 101 })).toThrow();
    });

    it('should accept concurrency = 1', () => {
      const config = resolveConfig({ url: 'https://example.com', concurrency: 1 });
      expect(config.concurrency).toBe(1);
    });

    it('should accept concurrency = 100', () => {
      const config = resolveConfig({ url: 'https://example.com', concurrency: 100 });
      expect(config.concurrency).toBe(100);
    });
  });

  describe('optional fields', () => {
    it('should handle excludePatterns', () => {
      const config = resolveConfig({
        url: 'https://example.com',
        excludePatterns: ['/admin', '/api'],
      });
      expect(config.excludePatterns).toEqual(['/admin', '/api']);
    });

    it('should default to empty excludePatterns', () => {
      const config = resolveConfig({ url: 'https://example.com' });
      expect(config.excludePatterns).toEqual([]);
    });

    it('should handle geo preset', () => {
      const config = resolveConfig({ url: 'https://example.com', geo: 'us' });
      expect(config.geo).toBe('us');
    });

    it('should allow undefined geo', () => {
      const config = resolveConfig({ url: 'https://example.com' });
      expect(config.geo).toBeUndefined();
    });

    it('should handle custom locale', () => {
      const config = resolveConfig({ url: 'https://example.com', locale: 'fr-FR' });
      expect(config.locale).toBe('fr-FR');
    });

    it('should handle custom output path', () => {
      const config = resolveConfig({ url: 'https://example.com', output: './custom' });
      expect(config.output).toBe('./custom');
    });

    it('should handle sitemapOnly flag', () => {
      const config = resolveConfig({ url: 'https://example.com', sitemapOnly: true });
      expect(config.sitemapOnly).toBe(true);
    });

    it('should handle stealth flag', () => {
      const config = resolveConfig({ url: 'https://example.com', stealth: true });
      expect(config.stealth).toBe(true);
    });
  });
});
