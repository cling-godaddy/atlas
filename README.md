# Atlas

Web crawler and site mapper. Extracts structural data from websites for downstream processing.

## Features

- **Puppeteer-based crawling** with stealth plugin for anti-bot bypass
- **Sitemap.xml parsing** with recursive index support
- **Comprehensive extraction**:
  - Page metadata (title, description, Open Graph tags)
  - Links with internal/external classification
  - Assets (images, scripts, stylesheets, fonts) with usage tracking
  - Text content (cleaned, normalized)
  - Structured data (JSON-LD, microdata)
- **Crawl state tracking** - visited, failed, redirects, skipped URLs
- **URL hierarchy tree** - site structure visualization
- **Asset manifest** - deduplicated assets with page references
- **JSON output** - serialized CrawlResult IR

## Installation

```bash
npm install @cling/atlas
```

## Quick Start

```typescript
import { crawl, writeOutput, generateOutputPath } from '@cling/atlas';

// crawl a site
const result = await crawl({
  url: 'https://example.com',
  maxPages: 50,
  maxDepth: 3,
  useSitemap: true,
});

// save to JSON
const outputPath = generateOutputPath(result.baseUrl);
await writeOutput(result, outputPath);

console.log(`Crawled ${result.pages.length} pages`);
console.log(`Found ${result.assets.length} unique assets`);
```

## CLI Usage

### Manual Test Crawl

For development and testing, use the manual crawl script:

```bash
# basic crawl
npm run test:manual https://example.com

# large crawl with custom limits
npm run test:manual -- https://books.toscrape.com --max-pages 1000 --max-depth 10

# include HTML and text content
npm run test:manual -- https://example.com --output full
```

**Flags:**
- `--max-pages <number>` - Maximum pages to crawl (default: 100)
- `--max-depth <number>` - Maximum depth from seed URL (default: 5)
- `--output <profile>` - Output profile: `minimal`, `standard`, `full` (default: `standard`)

Results are saved to `output/<domain>/<timestamp>.json`

### Visualize Results

Generate Mermaid diagrams from crawl results:

```bash
# basic visualization
npm run visualize output/example.com/2025-01-01T00-00-00-000Z.json

# with options
npm run visualize output/example.com/file.json -- --max-nodes 200 --max-depth 10
```

## API Reference

### `crawl(options: CrawlerOptions): Promise<CrawlResult>`

Main crawler function.

**Options:**
```typescript
interface CrawlerOptions {
  url: string;              // base URL to crawl
  maxPages?: number;        // max pages (default: 100)
  maxDepth?: number;        // max depth from seed (default: 3)
  concurrency?: number;     // concurrent requests (default: 5)
  timeout?: number;         // request timeout ms (default: 30000)
  useSitemap?: boolean;     // use sitemap.xml for seeds (default: true)
  headless?: boolean;       // run browser headless (default: true)
  excludePatterns?: string[]; // URL patterns to exclude (default: [])
}
```

**Returns:**
```typescript
interface CrawlResult {
  baseUrl: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  config: ResolvedConfig;
  pages: CrawledPage[];
  assets: ManifestAsset[];
  state: CrawlState;
  structure: SiteStructure;
}
```

### `writeOutput(result: CrawlResult, outputPath: string, options?: OutputOptions): Promise<void>`

Write CrawlResult to JSON file.

**Options:**
```typescript
interface OutputOptions {
  pretty?: boolean;      // pretty-print JSON (default: true)
  createDirs?: boolean;  // create parent dirs (default: true)
}
```

### `generateOutputPath(baseUrl: string, timestamp?: string): string`

Generate output filename from base URL and timestamp.

```typescript
generateOutputPath('https://example.com')
// → 'output/example-com-2025-01-01T00-00-00-000Z.json'
```

## Configuration

### Exclude Patterns

Exclude URLs matching patterns:

```typescript
await crawl({
  url: 'https://example.com',
  excludePatterns: [
    '/admin/*',
    '/api/*',
    '*.pdf',
    'download',
  ],
});
```

### Sitemap-Only Mode

Use sitemap URLs as seeds without discovering links:

```typescript
await crawl({
  url: 'https://example.com',
  useSitemap: true,
  maxDepth: 0,  // don't follow links, only crawl sitemap URLs
});
```

## Output Format

CrawlResult IR structure:

```typescript
{
  "baseUrl": "https://example.com",
  "startedAt": "2025-01-01T00:00:00.000Z",
  "completedAt": "2025-01-01T00:05:00.000Z",
  "duration": 300000,
  "pages": [
    {
      "url": "https://example.com",
      "path": "index.html",
      "crawledAt": "2025-01-01T00:00:30.000Z",
      "statusCode": 200,
      "depth": 0,
      "title": "Example Site",
      "html": "...",
      "text": "...",
      "metadata": { "title": "...", "description": "..." },
      "links": [
        { "url": "https://example.com/about", "text": "About", "isInternal": true }
      ],
      "assets": [
        { "url": "https://example.com/style.css", "type": "css" }
      ],
      "structuredData": {
        "jsonLd": [...],
        "microdata": [...]
      }
    }
  ],
  "assets": [
    {
      "url": "https://example.com/style.css",
      "type": "css",
      "referencedBy": ["https://example.com", "https://example.com/about"]
    }
  ],
  "state": {
    "visited": ["https://example.com", "https://example.com/about"],
    "failed": [],
    "redirects": [],
    "skipped": []
  },
  "structure": {
    "sitemap": { "urls": [...], "sitemapsProcessed": 1, "errors": [] },
    "hierarchy": { "segment": "", "path": "/", "url": "...", "children": [...] }
  }
}
```

## Architecture

Atlas is a **site mapper** - it crawls websites and extracts structural data into an intermediate representation (IR). It does not:
- Download or store assets (only tracks URLs)
- Process or analyze content (downstream responsibility)
- Generate reports or insights (use Blippi or similar)

**Pipeline:**
```
URL → Crawler → Extractors → CrawlResult IR → JSON Output
                    ↓
            (sitemap parser)
```

## License

MIT
