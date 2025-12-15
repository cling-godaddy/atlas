/* eslint-disable no-console, @typescript-eslint/restrict-template-expressions */
import { crawl, writeOutput, generateOutputPath } from '../src/index';

import type { OutputProfile } from '../src/types/config';

const args = process.argv.slice(2);
const urlArg = args.find((arg) => !arg.startsWith('--'));

if (!urlArg) {
  console.error('Usage: npm run test:manual <url> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --max-pages <number>            Maximum pages to crawl (default: 100)');
  console.error('  --max-depth <number>            Maximum depth to traverse (default: 5)');
  console.error('  --output <profile>              Output profile: minimal, standard, full (default: standard)');
  console.error('  --exclude <pattern>             Exclude pattern (can be used multiple times)');
  console.error('  --hierarchical-exclude <pattern> Hierarchical exclude pattern (can be used multiple times)');
  console.error('');
  console.error('Example:');
  console.error('  npm run test:manual https://example.com');
  console.error('  npm run test:manual https://books.toscrape.com --max-pages 1000 --max-depth 10');
  console.error('  npm run test:manual https://example.com --output full');
  console.error('  npm run test:manual https://shop.com --hierarchical-exclude /products/*');
  process.exit(1);
}

const url: string = urlArg;

interface CliOptions {
  url: string;
  maxPages: number;
  maxDepth: number;
  output: OutputProfile;
  excludePatterns: string[];
  hierarchicalExclude: string[];
}

function parseCliOptions(urlArg: string): CliOptions {
  let maxPages = 100;
  let maxDepth = 5;
  let output: OutputProfile = 'standard';
  const excludePatterns: string[] = [];
  const hierarchicalExclude: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--max-pages' && next) {
      maxPages = parseInt(next, 10);
      i++;
    } else if (arg === '--max-depth' && next) {
      maxDepth = parseInt(next, 10);
      i++;
    } else if (arg === '--output' && next) {
      if (next === 'minimal' || next === 'standard' || next === 'full') {
        output = next;
      }
      i++;
    } else if (arg === '--exclude' && next) {
      excludePatterns.push(next);
      i++;
    } else if (arg === '--hierarchical-exclude' && next) {
      hierarchicalExclude.push(next);
      i++;
    }
  }

  return { url: urlArg, maxPages, maxDepth, output, excludePatterns, hierarchicalExclude };
}

async function main() {
  const config = parseCliOptions(url);
  const startTime = Date.now();

  console.log('🚀 Atlas Manual Test Runner');
  console.log('============================\n');
  console.log(`📍 Testing: ${config.url}`);
  console.log(`   Settings: maxPages=${config.maxPages}, maxDepth=${config.maxDepth}, output=${config.output}`);
  if (config.excludePatterns.length > 0) {
    console.log(`   Exclude patterns: ${config.excludePatterns.join(', ')}`);
  }
  if (config.hierarchicalExclude.length > 0) {
    console.log(`   Hierarchical exclude: ${config.hierarchicalExclude.join(', ')}`);
  }
  console.log('');

  try {
    const result = await crawl({
      url: config.url,
      maxPages: config.maxPages,
      maxDepth: config.maxDepth,
      output: config.output,
      excludePatterns: config.excludePatterns,
      hierarchicalExclude: config.hierarchicalExclude,
      useSitemap: true,
      headless: true,
      timeout: 30000,
    });

    const duration = Date.now() - startTime;
    const outputPath = generateOutputPath(result.baseUrl);

    // save result to file
    await writeOutput(result, outputPath, { visualize: true });

    console.log('✅ Success!');
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📄 Pages: ${result.pages.length}`);
    console.log(`🖼️  Assets: ${result.assets.length}`);
    console.log(`📊 State: ${result.state.visited.length} visited, ${result.state.failed.length} failed`);
    console.log(`💾 Output: ${outputPath}\n`);

    // show sample page data
    const firstPage = result.pages[0];
    if (firstPage) {
      console.log(`Sample Page (${firstPage.url}):`);
      console.log(`- Title: ${firstPage.title}`);
      console.log(`- Links: ${firstPage.links.length} (${firstPage.links.filter((l) => l.isInternal).length} internal)`);
      if (firstPage.assets) console.log(`- Assets: ${firstPage.assets.length}`);
      if (firstPage.text) console.log(`- Text length: ${firstPage.text.length} chars`);
      if (firstPage.html) console.log(`- HTML length: ${firstPage.html.length} chars`);
      if (firstPage.structuredData) {
        console.log(`- Structured data: ${firstPage.structuredData.jsonLd.length} JSON-LD, ${firstPage.structuredData.microdata.length} microdata`);
      }
    }

    console.log('\n✨ Done!\n');
    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.log(`❌ Failed: ${errorMessage}`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s\n`);

    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
