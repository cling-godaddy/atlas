/* eslint-disable no-console, @typescript-eslint/restrict-template-expressions */
import { crawl, writeOutput, generateOutputPath } from '../src/index';

// ============================================================================
// CONFIGURE YOUR TEST URLS HERE
// ============================================================================

const TEST_SITES = [
  // {
  //   name: 'Example.com',
  //   url: 'https://example.com',
  //   maxPages: 5,
  //   maxDepth: 1,
  // },
  {
    name: 'Starbucks',
    url: 'https://starbucks.com',
    maxPages: 10,
    maxDepth: 2,
  },
];

// ============================================================================
// TEST RUNNER
// ============================================================================

interface TestResult {
  name: string;
  url: string;
  success: boolean;
  duration: number;
  pagesCount?: number;
  assetsCount?: number;
  error?: string;
  outputPath?: string;
}

async function runTest(config: typeof TEST_SITES[0]): Promise<TestResult> {
  const startTime = Date.now();

  try {
    console.log(`\n📍 Testing: ${config.name} (${config.url})`);
    console.log(`   Settings: maxPages=${config.maxPages}, maxDepth=${config.maxDepth}`);

    const result = await crawl({
      url: config.url,
      maxPages: config.maxPages,
      maxDepth: config.maxDepth,
      useSitemap: true,
      headless: true,
      timeout: 30000,
    });

    const duration = Date.now() - startTime;
    const outputPath = generateOutputPath(result.baseUrl);

    // save result to file
    await writeOutput(result, outputPath, { visualize: true });

    console.log('   ✅ Success!');
    console.log(`   ⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`   📄 Pages: ${result.pages.length}`);
    console.log(`   🖼️  Assets: ${result.assets.length}`);
    console.log(`   📊 State: ${result.state.visited.length} visited, ${result.state.failed.length} failed`);
    console.log(`   💾 Output: ${outputPath}`);

    // show sample page data
    const firstPage = result.pages[0];
    if (firstPage) {
      console.log(`\n   Sample Page (${firstPage.url}):`);
      console.log(`   - Title: ${firstPage.title}`);
      console.log(`   - Links: ${firstPage.links.length} (${firstPage.links.filter((l) => l.isInternal).length} internal)`);
      if (firstPage.assets) console.log(`   - Assets: ${firstPage.assets.length}`);
      if (firstPage.text) console.log(`   - Text length: ${firstPage.text.length} chars`);
      if (firstPage.html) console.log(`   - HTML length: ${firstPage.html.length} chars`);
      if (firstPage.structuredData) {
        console.log(`   - Structured data: ${firstPage.structuredData.jsonLd.length} JSON-LD, ${firstPage.structuredData.microdata.length} microdata`);
      }
    }

    return {
      name: config.name,
      url: config.url,
      success: true,
      duration,
      pagesCount: result.pages.length,
      assetsCount: result.assets.length,
      outputPath,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.log(`   ❌ Failed: ${errorMessage}`);

    return {
      name: config.name,
      url: config.url,
      success: false,
      duration,
      error: errorMessage,
    };
  }
}

async function main() {
  console.log('🚀 Atlas Manual Test Runner');
  console.log('============================\n');
  console.log(`Testing ${TEST_SITES.length} site(s)...\n`);

  const results: TestResult[] = [];

  for (const site of TEST_SITES) {
    const result = await runTest(site);
    results.push(result);
  }

  // summary
  console.log('\n\n📊 SUMMARY');
  console.log('==========\n');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Total: ${results.length} tests`);
  console.log(`✅ Passed: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (successful.length > 0) {
    console.log('\nSuccessful tests:');
    successful.forEach((r) => {
      console.log(`  • ${r.name}: ${r.pagesCount} pages, ${r.assetsCount} assets (${(r.duration / 1000).toFixed(2)}s)`);
      console.log(`    Output: ${r.outputPath}`);
    });
  }

  if (failed.length > 0) {
    console.log('\nFailed tests:');
    failed.forEach((r) => {
      console.log(`  • ${r.name}: ${r.error}`);
    });
  }

  console.log('\n✨ Done!\n');

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
