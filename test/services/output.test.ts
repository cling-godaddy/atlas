import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { generateOutputPath, writeOutput } from '../../src/services/output';

import type { CrawlResult, PlatformDetection } from '../../src/types/crawl';
import type { ExtractedProduct } from '../../src/types/ssm';

const TEST_OUTPUT_DIR = 'test-output';

// minimal crawl result for testing
function createTestResult(): CrawlResult {
  return {
    baseUrl: 'https://example.com',
    startedAt: '2025-01-01T00:00:00.000Z',
    completedAt: '2025-01-01T00:01:00.000Z',
    duration: 60000,
    config: {} as CrawlResult['config'],
    pages: [
      {
        url: 'https://example.com',
        path: 'index.html',
        crawledAt: '2025-01-01T00:00:30.000Z',
        statusCode: 200,
        depth: 0,
        title: 'Test Page',
        html: '<html><body>Test</body></html>',
        text: 'Test',
        metadata: {
          title: 'Test Page',
          description: 'A test page',
        },
        links: [],
        assets: [],
      },
    ],
    assets: [],
    state: {
      visited: ['https://example.com'],
      failed: [],
      redirects: [],
      skipped: [],
    },
    structure: {
      sitemap: null,
      hierarchy: {
        segment: '',
        path: '/',
        url: 'https://example.com/',
        children: [],
      },
    },
  };
}

describe('writeOutput', () => {
  beforeEach(async () => {
    // ensure test output directory exists
    await mkdir(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterEach(async () => {
    // cleanup test output directory
    if (existsSync(TEST_OUTPUT_DIR)) {
      await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  it('should write pretty JSON by default', async () => {
    const result = createTestResult();
    const outputPath = `${TEST_OUTPUT_DIR}/test-pretty.json`;

    await writeOutput(result, outputPath);

    const content = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(content) as CrawlResult;

    expect(parsed).toMatchObject({
      baseUrl: 'https://example.com',
      pages: [{ title: 'Test Page' }],
    });

    // check it's pretty-printed (has indentation)
    expect(content).toContain('  "baseUrl"');
  });

  it('should write compact JSON when pretty: false', async () => {
    const result = createTestResult();
    const outputPath = `${TEST_OUTPUT_DIR}/test-compact.json`;

    await writeOutput(result, outputPath, { pretty: false });

    const content = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(content) as CrawlResult;

    expect(parsed).toMatchObject({
      baseUrl: 'https://example.com',
    });

    // check it's compact (no extra whitespace)
    expect(content).not.toContain('  ');
  });

  it('should create parent directories by default', async () => {
    const result = createTestResult();
    const outputPath = `${TEST_OUTPUT_DIR}/nested/deep/output.json`;

    await writeOutput(result, outputPath);

    expect(existsSync(outputPath)).toBe(true);
    const content = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(content) as CrawlResult;
    expect(parsed.baseUrl).toBe('https://example.com');
  });

  it('should preserve all CrawlResult fields', async () => {
    const result = createTestResult();
    const outputPath = `${TEST_OUTPUT_DIR}/test-fields.json`;

    await writeOutput(result, outputPath);

    const content = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(content) as CrawlResult;

    expect(parsed).toMatchObject({
      baseUrl: result.baseUrl,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      duration: result.duration,
      pages: result.pages,
      assets: result.assets,
      state: result.state,
      structure: result.structure,
    });
  });

  it('should auto-generate catalog.json for e-commerce platforms with products', async () => {
    const result = createTestResult();
    const platform: PlatformDetection = {
      platform: 'shopify',
      confidence: 'high',
      signals: ['shopify-cdn'],
    };
    const products: ExtractedProduct[] = [
      { name: 'Test Product', url: 'https://example.com/products/test', price: { amount: 99, currency: 'USD' } },
      { name: 'Another Product', url: 'https://example.com/products/another' },
    ];
    result.platform = platform;
    result.products = products;

    const outputPath = `${TEST_OUTPUT_DIR}/test-ecommerce.json`;
    const catalogPath = `${TEST_OUTPUT_DIR}/test-ecommerce.catalog.json`;

    await writeOutput(result, outputPath);

    // main output should exist
    expect(existsSync(outputPath)).toBe(true);

    // catalog should be auto-generated
    expect(existsSync(catalogPath)).toBe(true);
    const catalogContent = await readFile(catalogPath, 'utf-8');
    const catalog = JSON.parse(catalogContent) as ExtractedProduct[];

    expect(catalog).toHaveLength(2);
    expect(catalog[0]!.name).toBe('Test Product');
    expect(catalog[1]!.name).toBe('Another Product');
  });

  it('should not auto-generate catalog for non-ecommerce platforms', async () => {
    const result = createTestResult();
    const platform: PlatformDetection = {
      platform: 'wordpress',
      confidence: 'high',
      signals: ['wp-content'],
    };
    result.platform = platform;
    result.products = [{ name: 'Product', url: 'https://example.com/product' }];

    const outputPath = `${TEST_OUTPUT_DIR}/test-wordpress.json`;
    const catalogPath = `${TEST_OUTPUT_DIR}/test-wordpress.catalog.json`;

    await writeOutput(result, outputPath);

    expect(existsSync(outputPath)).toBe(true);
    expect(existsSync(catalogPath)).toBe(false);
  });

  it('should not auto-generate catalog when no products', async () => {
    const result = createTestResult();
    const platform: PlatformDetection = {
      platform: 'shopify',
      confidence: 'high',
      signals: ['shopify-cdn'],
    };
    result.platform = platform;
    result.products = [];

    const outputPath = `${TEST_OUTPUT_DIR}/test-no-products.json`;
    const catalogPath = `${TEST_OUTPUT_DIR}/test-no-products.catalog.json`;

    await writeOutput(result, outputPath);

    expect(existsSync(outputPath)).toBe(true);
    expect(existsSync(catalogPath)).toBe(false);
  });
});

describe('generateOutputPath', () => {
  it('should generate path with hostname and timestamp', () => {
    const path = generateOutputPath('https://example.com', '2025-01-01T00-00-00-000Z');

    expect(path).toBe('output/example.com/2025-01-01T00-00-00-000Z.json');
  });

  it('should organize files by domain subdirectories', () => {
    const path = generateOutputPath('https://api.example.com', '2025-01-01T00-00-00-000Z');

    expect(path).toBe('output/api.example.com/2025-01-01T00-00-00-000Z.json');
  });

  it('should handle URLs with paths', () => {
    const path = generateOutputPath('https://example.com/some/path', '2025-01-01T00-00-00-000Z');

    expect(path).toBe('output/example.com/2025-01-01T00-00-00-000Z.json');
  });

  it('should generate timestamp if not provided', () => {
    const path = generateOutputPath('https://example.com');

    expect(path).toMatch(/^output\/example\.com\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
  });
});
