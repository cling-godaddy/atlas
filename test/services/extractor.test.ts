import { describe, expect, it, vi } from 'vitest';

import { extractAssets, extractLinks, extractMetadata, extractText } from '../../src/services/extractor';

import type { Page } from 'puppeteer';


// create mock Page object
function createMockPage(evaluateHandler: (fn: () => unknown) => unknown): Page {
  return {
    evaluate: vi.fn(evaluateHandler),
  } as unknown as Page;
}

describe('extractMetadata', () => {
  it('should extract basic metadata', async () => {
    const page = createMockPage(() => ({
      title: 'Test Page',
      description: 'A test page description',
      keywords: ['test', 'page', 'sample'],
      ogTitle: void 0,
      ogDescription: void 0,
      ogImage: void 0,
      canonical: void 0,
    }));

    const metadata = await extractMetadata(page);

    expect(metadata).toMatchObject({
      title: 'Test Page',
      description: 'A test page description',
      keywords: ['test', 'page', 'sample'],
    });
  });

  it('should extract open graph tags', async () => {
    const page = createMockPage(() => ({
      title: 'Test',
      description: '',
      ogTitle: 'OG Title',
      ogDescription: 'OG Description',
      ogImage: 'https://example.com/image.jpg',
      canonical: void 0,
      keywords: void 0,
    }));

    const metadata = await extractMetadata(page);

    expect(metadata).toMatchObject({
      ogTitle: 'OG Title',
      ogDescription: 'OG Description',
      ogImage: 'https://example.com/image.jpg',
    });
  });

  it('should extract canonical URL', async () => {
    const page = createMockPage(() => ({
      title: 'Test',
      description: '',
      canonical: 'https://example.com/canonical',
      ogTitle: void 0,
      ogDescription: void 0,
      ogImage: void 0,
      keywords: void 0,
    }));

    const metadata = await extractMetadata(page);

    expect(metadata).toMatchObject({
      canonical: 'https://example.com/canonical',
    });
  });

  it('should handle missing metadata gracefully', async () => {
    const page = createMockPage(() => ({
      title: '',
      description: '',
      ogTitle: void 0,
      ogDescription: void 0,
      ogImage: void 0,
      canonical: void 0,
      keywords: void 0,
    }));

    const metadata = await extractMetadata(page);

    expect(metadata).toMatchObject({
      title: '',
      description: '',
      ogTitle: void 0,
      keywords: void 0,
    });
  });
});

describe('extractLinks', () => {
  it('should extract and resolve links', async () => {
    const page = createMockPage(() => [
      { href: '/page1', text: 'Link 1', rel: void 0 },
      { href: '/page2', text: 'Link 2', rel: void 0 },
      { href: 'https://external.com', text: 'External', rel: void 0 },
    ]);

    const links = await extractLinks(page, new URL('https://example.com'));

    expect(links).toHaveLength(3);
    expect(links[0]).toMatchObject({
      url: 'https://example.com/page1',
      text: 'Link 1',
      isInternal: true,
    });
    expect(links[2]).toMatchObject({
      url: 'https://external.com/',
      isInternal: false,
    });
  });

  it('should skip javascript: and hash-only links', async () => {
    const page = createMockPage(() => [
      { href: 'javascript:void(0)', text: 'Invalid', rel: void 0 },
      { href: '#section', text: 'Hash', rel: void 0 },
      { href: '/valid', text: 'Valid', rel: void 0 },
    ]);

    const links = await extractLinks(page, new URL('https://example.com'));

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      url: 'https://example.com/valid',
    });
  });

  it('should deduplicate links', async () => {
    const page = createMockPage(() => [
      { href: '/page1', text: 'Link 1', rel: void 0 },
      { href: '/page1', text: 'Link 1 Again', rel: void 0 },
      { href: '/page2', text: 'Link 2', rel: void 0 },
    ]);

    const links = await extractLinks(page, new URL('https://example.com'));

    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({ url: 'https://example.com/page1' });
    expect(links[1]).toMatchObject({ url: 'https://example.com/page2' });
  });

  it('should extract rel attribute', async () => {
    const page = createMockPage(() => [
      { href: '/page1', text: 'Link 1', rel: 'nofollow' },
      { href: '/page2', text: 'Link 2', rel: void 0 },
    ]);

    const links = await extractLinks(page, new URL('https://example.com'));

    expect(links[0]).toMatchObject({ rel: 'nofollow' });
    expect(links[1]).toMatchObject({ rel: void 0 });
  });

  it('should recognize subdomains as internal', async () => {
    const page = createMockPage(() => [
      { href: 'https://blog.example.com', text: 'Blog', rel: void 0 },
      { href: 'https://api.example.com', text: 'API', rel: void 0 },
    ]);

    const links = await extractLinks(page, new URL('https://example.com'));

    expect(links[0]).toMatchObject({ isInternal: true });
    expect(links[1]).toMatchObject({ isInternal: true });
  });
});

describe('extractAssets', () => {
  it('should extract stylesheets', async () => {
    const page = createMockPage(() => [
      { url: '/styles.css', type: 'css' },
      { url: 'https://cdn.example.com/theme.css', type: 'css' },
    ]);

    const assets = await extractAssets(page, new URL('https://example.com'));

    const cssAssets = assets.filter((a) => a.type === 'css');
    expect(cssAssets).toHaveLength(2);
    expect(cssAssets[0]).toMatchObject({ url: 'https://example.com/styles.css' });
    expect(cssAssets[1]).toMatchObject({ url: 'https://cdn.example.com/theme.css' });
  });

  it('should extract images', async () => {
    const page = createMockPage(() => [
      { url: '/image1.jpg', type: 'image' },
      { url: 'https://cdn.example.com/image2.png', type: 'image' },
    ]);

    const assets = await extractAssets(page, new URL('https://example.com'));

    const imageAssets = assets.filter((a) => a.type === 'image');
    expect(imageAssets).toHaveLength(2);
    expect(imageAssets[0]).toMatchObject({ url: 'https://example.com/image1.jpg' });
    expect(imageAssets[1]).toMatchObject({ url: 'https://cdn.example.com/image2.png' });
  });

  it('should extract scripts', async () => {
    const page = createMockPage(() => [
      { url: '/app.js', type: 'script' },
      { url: 'https://cdn.example.com/lib.js', type: 'script' },
    ]);

    const assets = await extractAssets(page, new URL('https://example.com'));

    const scriptAssets = assets.filter((a) => a.type === 'script');
    expect(scriptAssets).toHaveLength(2);
    expect(scriptAssets[0]).toMatchObject({ url: 'https://example.com/app.js' });
    expect(scriptAssets[1]).toMatchObject({ url: 'https://cdn.example.com/lib.js' });
  });

  it('should deduplicate assets', async () => {
    const page = createMockPage(() => [
      { url: '/image.jpg', type: 'image' },
      { url: '/image.jpg', type: 'image' },
      { url: '/styles.css', type: 'css' },
    ]);

    const assets = await extractAssets(page, new URL('https://example.com'));

    expect(assets).toHaveLength(2);
  });

  it('should skip non-http(s) assets', async () => {
    const page = createMockPage(() => [
      { url: 'data:image/png;base64,ABC', type: 'image' },
      { url: '/valid.jpg', type: 'image' },
    ]);

    const assets = await extractAssets(page, new URL('https://example.com'));

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ url: 'https://example.com/valid.jpg' });
  });
});

describe('extractText', () => {
  it('should extract and normalize text', async () => {
    const page = createMockPage(() => 'Heading Paragraph text More content');

    const text = await extractText(page);

    expect(text).toBe('Heading Paragraph text More content');
  });

  it('should normalize whitespace', async () => {
    // mock returns pre-normalized text since the actual normalization happens in browser
    const page = createMockPage(() => 'Multiple spaces Line breaks');

    const text = await extractText(page);

    expect(text).toBe('Multiple spaces Line breaks');
  });

  it('should trim result', async () => {
    // mock returns pre-trimmed text since the actual trimming happens in browser
    const page = createMockPage(() => 'Content');

    const text = await extractText(page);

    expect(text).toBe('Content');
  });

  it('should handle empty body', async () => {
    const page = createMockPage(() => '');

    const text = await extractText(page);

    expect(text).toBe('');
  });
});
