/* eslint-disable no-console */
import { readFile, writeFile } from 'node:fs/promises';

import { generateMermaidReport } from '../src/index';

import type { CrawlResult, VisualizationOptions } from '../src/index';

const args = process.argv.slice(2);
const jsonPath = args.find((arg) => !arg.startsWith('--'));

if (!jsonPath) {
  console.error('Usage: npm run visualize <path-to-json> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --max-nodes <number>     Maximum nodes to render (default: 50)');
  console.error('  --max-depth <number>     Maximum depth to traverse (default: 5)');
  console.error('  --min-references <number> Minimum asset references to show (default: 3)');
  console.error('  --types <types>          Comma-separated list: hierarchy,state,assets,links');
  console.error('  --output <path>          Write to file instead of stdout');
  console.error('');
  console.error('Example:');
  console.error('  npm run visualize output/example.json --max-nodes 200 --max-depth 10');
  console.error('  npm run visualize output/example.json --output output/example.viz.md');
  process.exit(1);
}

interface CliOptions {
  visualization: VisualizationOptions;
  outputPath?: string;
}

function parseCliOptions(): CliOptions {
  const visualization: VisualizationOptions = {};
  let outputPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--max-nodes' && next) {
      visualization.maxNodes = parseInt(next, 10);
      i++;
    } else if (arg === '--max-depth' && next) {
      visualization.maxDepth = parseInt(next, 10);
      i++;
    } else if (arg === '--min-references' && next) {
      visualization.minReferences = parseInt(next, 10);
      i++;
    } else if (arg === '--types' && next) {
      visualization.types = next.split(',') as ('hierarchy' | 'state' | 'assets' | 'links')[];
      i++;
    } else if (arg === '--output' && next) {
      outputPath = next;
      i++;
    }
  }

  return { visualization, outputPath };
}

async function main() {
  if (!jsonPath) {
    throw new Error('No JSON path provided');
  }

  const { visualization, outputPath } = parseCliOptions();

  console.log(`Reading ${jsonPath}...`);
  const json = await readFile(jsonPath, 'utf-8');
  const result = JSON.parse(json) as CrawlResult;

  console.log('Generating Mermaid visualization...');
  if (visualization.maxNodes) {
    console.log(`  maxNodes: ${String(visualization.maxNodes)}`);
  }
  if (visualization.maxDepth) {
    console.log(`  maxDepth: ${String(visualization.maxDepth)}`);
  }

  const markdown = generateMermaidReport(result, visualization);

  // default: write to .viz.md file next to .json
  const defaultOutputPath = jsonPath.replace(/\.json$/, '.viz.md');
  const finalOutputPath = outputPath ?? defaultOutputPath;

  await writeFile(finalOutputPath, markdown, 'utf-8');
  console.log(`\nWrote visualization to: ${finalOutputPath}`);
}

main().catch((error: unknown) => {
  console.error('Error:', error);
  process.exit(1);
});
