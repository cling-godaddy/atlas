import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { generateOutputPath, writeOutput } from '../../src/services/output';

import type { CrawlResult } from '../../src/types/crawl';

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
