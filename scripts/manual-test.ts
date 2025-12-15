/* eslint-disable no-console, @typescript-eslint/restrict-template-expressions */
import cac from 'cac';

import { crawl, writeOutput, generateOutputPath } from '../src/index';

import type { OutputProfile } from '../src/types/config';

interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  output: OutputProfile;
  exclude: string[];
  prune: string[];
}

const cli = cac('atlas');

cli
  .command('<url>', 'Crawl a website and generate structured output')
  .option('--max-pages <number>', 'Maximum pages to crawl', { default: 100 })
  .option('--max-depth <number>', 'Maximum depth to traverse', { default: 5 })
  .option('--output <profile>', 'Output profile: minimal, standard, full', { default: 'standard' })
  .option('-e, --exclude <pattern>', 'Exclude URL pattern (repeatable)')
  .option('-p, --prune <pattern>', 'Exclude children but keep parent (repeatable)')
  .example('  npm run test:manual https://example.com')
  .example('  npm run test:manual -- https://books.toscrape.com --max-pages 1000 --max-depth 10')
  .example('  npm run test:manual -- https://shop.com -p \'/products/*\'')
  .action(async (url: string, options: CrawlOptions) => {
    const startTime = Date.now();

    // normalize arrays (cac returns single value if used once, array if repeated)
    const excludePatterns = toArray(options.exclude);
    const prunePatterns = toArray(options.prune);

    console.log('🚀 Atlas Manual Test Runner');
    console.log('============================\n');
    console.log(`📍 Testing: ${url}`);
    console.log(`   Settings: maxPages=${options.maxPages}, maxDepth=${options.maxDepth}, output=${options.output}`);
    if (excludePatterns.length > 0) {
      console.log(`   Exclude patterns: ${excludePatterns.join(', ')}`);
    }
    if (prunePatterns.length > 0) {
      console.log(`   Prune patterns: ${prunePatterns.join(', ')}`);
    }
    console.log('');

    try {
      const result = await crawl({
        url,
        maxPages: options.maxPages,
        maxDepth: options.maxDepth,
        output: options.output,
        excludePatterns,
        hierarchicalExclude: prunePatterns,
        useSitemap: true,
        headless: true,
        timeout: 30000,
      });

      const duration = Date.now() - startTime;
      const outputPath = generateOutputPath(result.baseUrl);

      await writeOutput(result, outputPath, { visualize: true });

      console.log('✅ Success!');
      console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
      console.log(`📄 Pages: ${result.pages.length}`);
      console.log(`🖼️  Assets: ${result.assets.length}`);
      console.log(`📊 State: ${result.state.visited.length} visited, ${result.state.failed.length} failed`);
      console.log(`💾 Output: ${outputPath}\n`);

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
  });

cli.help();
cli.version('0.1.0');

cli.parse();

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === void 0) return [];
  return Array.isArray(value) ? value : [value];
}
