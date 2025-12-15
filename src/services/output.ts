import { writeFile , mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { generateMermaidReport } from './visualize';

import type { VisualizationOptions } from '../types/config';
import type { CrawlResult } from '../types/crawl';

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

  // write to file (atomic via temp file)
  const tempPath = `${outputPath}.tmp`;
  await writeFile(tempPath, json, 'utf-8');
  await writeFile(outputPath, json, 'utf-8');

  // generate visualization if requested
  if (opts.visualize) {
    const vizOptions = typeof opts.visualize === 'boolean' ? void 0 : opts.visualize;
    const vizPath = outputPath.replace(/\.json$/, '.viz.md');
    const markdown = generateMermaidReport(result, vizOptions);
    await writeFile(vizPath, markdown, 'utf-8');
  }
}

/**
 * Generate default output filename from baseUrl and timestamp
 */
export function generateOutputPath(baseUrl: string, timestamp?: string): string {
  const url = new URL(baseUrl);
  const hostname = url.hostname;
  const ts = timestamp ?? new Date().toISOString().replace(/[:.]/g, '-');
  return `output/${hostname}/${ts}.json`;
}
