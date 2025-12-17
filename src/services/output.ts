import { writeFile , mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { generateMermaidReport } from './visualize';

import type { VisualizationOptions } from '../types/config';
import type { CrawlResult, Platform } from '../types/crawl';

const ECOMMERCE_PLATFORMS: Platform[] = ['shopify', 'bigcommerce', 'woocommerce', 'magento'];

export interface OutputOptions {
  /** Pretty-print JSON (default: true) */
  pretty?: boolean;
  /** Create parent directories if needed (default: true) */
  createDirs?: boolean;
  /** Generate visualization files (default: false) */
  visualize?: boolean | VisualizationOptions;
}

const DEFAULT_OPTIONS: Required<Omit<OutputOptions, 'visualize'>> & { visualize: boolean } = {
  pretty: true,
  createDirs: true,
  visualize: false,
};

/**
 * Write CrawlResult to JSON file
 */
export async function writeOutput(
  result: CrawlResult,
  outputPath: string,
  options: OutputOptions = {},
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ensure parent directory exists
  if (opts.createDirs) {
    const dir = dirname(outputPath);
    await mkdir(dir, { recursive: true });
  }

  // serialize to JSON
  const json = opts.pretty
    ? JSON.stringify(result, null, 2)
    : JSON.stringify(result);

  // write to file
  await writeFile(outputPath, json, 'utf-8');

  // generate visualization if requested
  if (opts.visualize) {
    const vizOptions = typeof opts.visualize === 'boolean' ? void 0 : opts.visualize;
    const vizPath = outputPath.replace(/\.json$/, '.viz.md');
    const markdown = generateMermaidReport(result, vizOptions);
    await writeFile(vizPath, markdown, 'utf-8');
  }

  // auto-generate catalog for e-commerce platforms
  const platform = result.platform?.platform;
  if (platform && ECOMMERCE_PLATFORMS.includes(platform) && result.products?.length) {
    const catalogPath = outputPath.replace(/\.json$/, '.catalog.json');
    await writeCatalogOutput(result, catalogPath, { pretty: opts.pretty, createDirs: false });
  }
}

/**
 * Write product catalog as raw array JSON
 */
export async function writeCatalogOutput(
  result: CrawlResult,
  outputPath: string,
  options: Pick<OutputOptions, 'pretty' | 'createDirs'> = {},
): Promise<void> {
  const opts = { pretty: true, createDirs: true, ...options };

  if (opts.createDirs) {
    const dir = dirname(outputPath);
    await mkdir(dir, { recursive: true });
  }

  const products = result.products ?? [];
  const json = opts.pretty ? JSON.stringify(products, null, 2) : JSON.stringify(products);

  await writeFile(outputPath, json, 'utf-8');
}

/**
 * Generate default output filename from baseUrl and timestamp
 */
export function generateOutputPath(baseUrl: string, timestamp?: string, suffix?: string): string {
  const url = new URL(baseUrl);
  const hostname = url.hostname;
  const ts = timestamp ?? new Date().toISOString().replace(/[:.]/g, '-');
  const ext = suffix ? `.${suffix}.json` : '.json';
  return `output/${hostname}/${ts}${ext}`;
}
