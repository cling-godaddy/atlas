/* eslint-disable no-console */
import { readFile } from 'node:fs/promises';

import { generateMermaidReport } from '../src/index';

import type { CrawlResult } from '../src/index';

const jsonPath = process.argv[2];

if (!jsonPath) {
  console.error('Usage: npm run test:viz <path-to-json>');
  process.exit(1);
}

async function main() {
  if (!jsonPath) {
    throw new Error('No JSON path provided');
  }
  console.log(`Reading ${jsonPath}...`);
  const json = await readFile(jsonPath, 'utf-8');
  const result = JSON.parse(json) as CrawlResult;

  console.log('Generating Mermaid visualization...');
  const markdown = generateMermaidReport(result);

  console.log('\n' + '='.repeat(80));
  console.log(markdown);
  console.log('='.repeat(80));
}

main().catch((error: unknown) => {
  console.error('Error:', error);
  process.exit(1);
});
