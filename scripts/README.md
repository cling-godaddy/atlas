# Manual Test Script

Run Atlas crawler against real websites to validate functionality and stealth plugin effectiveness.

## Usage

### 1. Configure Test URLs

Edit `scripts/manual-test.ts` and add your target sites to the `TEST_SITES` array:

```typescript
const TEST_SITES = [
  {
    name: 'Example.com',
    url: 'https://example.com',
    maxPages: 5,
    maxDepth: 1,
  },
  {
    name: 'Your Site',
    url: 'https://your-site.com',
    maxPages: 10,
    maxDepth: 2,
  },
];
```

### 2. Run the Test

```bash
npm run test:manual
```

### 3. Review Results

The script will:
- ✅ Crawl each site sequentially
- 📊 Print detailed statistics for each crawl
- 💾 Save results to `output/` directory as JSON
- 📈 Display a summary at the end

## Output Example

```
🚀 Atlas Manual Test Runner
============================

Testing 2 site(s)...

📍 Testing: Example.com (https://example.com)
   Settings: maxPages=5, maxDepth=1
   ✅ Success!
   ⏱️  Duration: 12.34s
   📄 Pages: 3
   🖼️  Assets: 12
   📊 State: 3 visited, 0 failed
   💾 Output: output/example-com-2025-12-14T18-30-00-000Z.json

   Sample Page (https://example.com):
   - Title: Example Domain
   - Links: 2 (1 internal)
   - Assets: 4
   - Text length: 1256 chars
   - HTML length: 8432 chars
   - Structured data: 1 JSON-LD, 0 microdata

📊 SUMMARY
==========

Total: 2 tests
✅ Passed: 2
❌ Failed: 0

Successful tests:
  • Example.com: 3 pages, 12 assets (12.34s)
    Output: output/example-com-2025-12-14T18-30-00-000Z.json
  • Your Site: 8 pages, 45 assets (23.45s)
    Output: output/your-site-com-2025-12-14T18-30-01-000Z.json

✨ Done!
```

## What to Look For

### Success Indicators
- ✅ Crawl completes without errors
- ✅ Pages extracted (count > 0)
- ✅ HTML and text content populated
- ✅ Metadata extracted (title, description)
- ✅ Links discovered
- ✅ Assets found
- ✅ No bot detection errors

### Common Issues
- ❌ "Navigation timeout" - Site too slow or blocking
- ❌ "Access denied" - Bot detection triggered
- ❌ "SSL certificate error" - Invalid HTTPS cert
- ❌ "Cannot navigate to invalid URL" - Bad URL format

## Tips

- **Start small**: Test with `maxPages: 5` first
- **Increase gradually**: If successful, try larger crawls
- **Monitor output**: Check JSON files for data quality
- **Test your own sites**: Validate against sites you control
- **Avoid rate limits**: Don't crawl the same site repeatedly in short intervals

## Configuration Options

Each test site supports these options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | - | Friendly name for output |
| `url` | string | - | Target URL to crawl |
| `maxPages` | number | 100 | Max pages to crawl |
| `maxDepth` | number | 3 | Max depth from seed |
| `timeout` | number | 30000 | Request timeout (ms) |

## Troubleshooting

**Script crashes immediately**
- Check URL format (must be `https://` or `http://`)
- Ensure site is accessible in browser first

**No pages crawled**
- Site may be blocking headless browsers
- Try `headless: false` in script to debug
- Check if site has robots.txt restrictions

**Slow performance**
- Lower `concurrency` if site rate-limits
- Increase `timeout` for slow sites
- Reduce `maxPages` to test faster

**Memory issues**
- Lower `maxPages` to reduce memory usage
- Run tests one at a time (comment out others)
- Close other applications
