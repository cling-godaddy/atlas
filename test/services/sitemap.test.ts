import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSitemapUrl, parseSitemap } from '../../src/services/sitemap';

// mock fetch globally
global.fetch = vi.fn();

describe('getSitemapUrl', () => {
  it('should construct sitemap URL from base URL', () => {
    expect(getSitemapUrl('https://example.com')).toBe('https://example.com/sitemap.xml');
  });

  it('should replace existing pathname', () => {
    expect(getSitemapUrl('https://example.com/about')).toBe('https://example.com/sitemap.xml');
  });

  it('should remove query params and hash', () => {
    expect(getSitemapUrl('https://example.com?foo=bar#section')).toBe('https://example.com/sitemap.xml');
  });

  it('should handle trailing slash', () => {
    expect(getSitemapUrl('https://example.com/')).toBe('https://example.com/sitemap.xml');
  });

  it('should handle invalid URLs gracefully', () => {
    expect(getSitemapUrl('not-a-url')).toBe('not-a-url/sitemap.xml');
  });
});

describe('parseSitemap', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
  });

  it('should parse basic sitemap with single URL', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/page1</loc>
        </url>
      </urlset>`;

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(xml),
    });

    const result = await parseSitemap('https://example.com/sitemap.xml');

    expect(result.urls).toEqual(['https://example.com/page1']);
    expect(result.sitemapsProcessed).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('should parse sitemap with multiple URLs', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/page1</loc>
          <lastmod>2024-01-01</lastmod>
          <priority>0.8</priority>
        </url>
        <url>
          <loc>https://example.com/page2</loc>
          <changefreq>weekly</changefreq>
        </url>
        <url>
          <loc>https://example.com/page3</loc>
        </url>
      </urlset>`;

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(xml),
    });

    const result = await parseSitemap('https://example.com/sitemap.xml');

    expect(result.urls).toEqual([
      'https://example.com/page1',
      'https://example.com/page2',
      'https://example.com/page3',
    ]);
    expect(result.sitemapsProcessed).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('should handle sitemap index with nested sitemaps', async () => {
    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
          <loc>https://example.com/sitemap1.xml</loc>
        </sitemap>
        <sitemap>
          <loc>https://example.com/sitemap2.xml</loc>
        </sitemap>
      </sitemapindex>`;

    const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page1</loc></url>
        <url><loc>https://example.com/page2</loc></url>
      </urlset>`;

    const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page3</loc></url>
      </urlset>`;

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(indexXml) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(sitemap1Xml) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(sitemap2Xml) });

    const result = await parseSitemap('https://example.com/sitemap.xml');

    expect(result.urls).toEqual([
      'https://example.com/page1',
      'https://example.com/page2',
      'https://example.com/page3',
    ]);
    expect(result.sitemapsProcessed).toBe(3);
    expect(result.errors).toEqual([]);
  });

  it('should handle HTTP errors gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await parseSitemap('https://example.com/sitemap.xml');

    expect(result.urls).toEqual([]);
    expect(result.sitemapsProcessed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('HTTP 404');
  });

  it('should handle network errors gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    const result = await parseSitemap('https://example.com/sitemap.xml');

    expect(result.urls).toEqual([]);
    expect(result.sitemapsProcessed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Network error');
  });

  it('should handle invalid XML format', async () => {
    const invalidXml = '<invalid>not a sitemap</invalid>';

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(invalidXml),
    });

    const result = await parseSitemap('https://example.com/sitemap.xml');

    expect(result.urls).toEqual([]);
    expect(result.sitemapsProcessed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Invalid sitemap format');
  });

  it('should respect maxDepth option', async () => {
    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
      </sitemapindex>`;

    const nestedIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
      </sitemapindex>`;

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page1</loc></url>
      </urlset>`;

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(indexXml) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(nestedIndexXml) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(sitemapXml) });

    const result = await parseSitemap('https://example.com/sitemap.xml', { maxDepth: 1 });

    // should stop after first nested level
    expect(result.sitemapsProcessed).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Max depth');
  });

  it('should use custom user agent', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page1</loc></url>
      </urlset>`;

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(xml),
    });

    await parseSitemap('https://example.com/sitemap.xml', {
      userAgent: 'CustomBot/1.0',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/sitemap.xml',
      expect.objectContaining({
        headers: {
          'User-Agent': 'CustomBot/1.0',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }),
    );
  });

  it('should handle sitemap with no URLs', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      </urlset>`;

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(xml),
    });

    const result = await parseSitemap('https://example.com/sitemap.xml');

    expect(result.urls).toEqual([]);
    expect(result.sitemapsProcessed).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('should continue processing after partial failures', async () => {
    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
      </sitemapindex>`;

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page1</loc></url>
      </urlset>`;

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(indexXml) })
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(sitemapXml) });

    const result = await parseSitemap('https://example.com/sitemap.xml');

    expect(result.urls).toEqual(['https://example.com/page1']);
    expect(result.sitemapsProcessed).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('HTTP 404');
  });
});
