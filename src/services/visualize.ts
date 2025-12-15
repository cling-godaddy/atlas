import type { CrawlResult, CrawlState, ManifestAsset, URLHierarchyNode } from '../types/crawl';

export interface VisualizationOptions {
  format?: 'mermaid' | 'html' | 'both';
  maxNodes?: number;
  maxDepth?: number;
  minReferences?: number;
  types?: ('hierarchy' | 'state' | 'assets' | 'links')[];
}

const DEFAULT_OPTIONS: Required<VisualizationOptions> = {
  format: 'mermaid',
  maxNodes: 2000,
  maxDepth: 5,
  minReferences: 3,
  types: ['hierarchy', 'state'],
};

/**
 * Generate Mermaid markdown report from crawl result
 */
export function generateMermaidReport(result: CrawlResult, options?: VisualizationOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sections: string[] = [];

  // header
  sections.push(`# Crawl Visualization: ${result.baseUrl}`);
  sections.push('');
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push(`Pages crawled: ${String(result.pages.length)}`);
  sections.push(`Assets found: ${String(result.assets.length)}`);
  sections.push(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
  if (result.platform) {
    sections.push(`Platform: ${result.platform.platform} (${result.platform.confidence} confidence)`);
    sections.push(`Signals: ${result.platform.signals.join(', ')}`);
    if (result.platform.platformId) {
      sections.push(`Platform ID: ${result.platform.platformId}`);
    }
  }
  sections.push('');

  // determine which diagrams to generate based on data size
  const types = selectDiagramTypes(result, opts);

  if (types.includes('hierarchy')) {
    sections.push('## Site Structure');
    sections.push('');
    sections.push('```mermaid');
    sections.push(generateHierarchyDiagram(result.structure.hierarchy, opts.maxDepth, opts.maxNodes));
    sections.push('```');
    sections.push('');
  }

  if (types.includes('state')) {
    sections.push('## Crawl Summary');
    sections.push('');
    sections.push('```mermaid');
    sections.push(generateStateDiagram(result.state));
    sections.push('```');
    sections.push('');
  }

  if (types.includes('assets')) {
    sections.push('## Top Assets');
    sections.push('');
    sections.push('```mermaid');
    sections.push(generateAssetDependencyDiagram(result.assets, opts.minReferences, 15));
    sections.push('```');
    sections.push('');
  }

  if (types.includes('links')) {
    sections.push('## Link Flow');
    sections.push('');
    sections.push('```mermaid');
    sections.push(generateLinkFlowDiagram(result.pages, 20));
    sections.push('```');
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Determine which diagram types to generate based on data size
 */
function selectDiagramTypes(result: CrawlResult, opts: VisualizationOptions): string[] {
  const pageCount = result.pages.length;
  const assetCount = result.assets.length;

  if (opts.types && opts.types.length > 0) {
    return opts.types;
  }

  // small crawls: show everything
  if (pageCount < 20 && assetCount < 200) {
    return ['hierarchy', 'state', 'assets', 'links'];
  }

  // medium crawls: skip expensive link graph
  if (pageCount < 50) {
    return ['hierarchy', 'state', 'assets'];
  }

  // large crawls: summary only
  return ['hierarchy', 'state'];
}

/**
 * Terminal leaf patterns that are typically noise (index pages, defaults)
 */
const TERMINAL_NOISE_PATTERNS = [
  /^index\./i,        // index.html, index.php, etc.
  /^default\./i,      // default.html, default.asp, etc.
  /^$/,               // empty segments
];

/**
 * Check if a segment matches common noise patterns
 */
function isNoiseSegment(segment: string): boolean {
  return TERMINAL_NOISE_PATTERNS.some((pattern) => pattern.test(segment));
}

/**
 * Generate Mermaid mindmap for URL hierarchy
 */
function generateHierarchyDiagram(
  hierarchy: URLHierarchyNode,
  maxDepth: number,
  maxNodes: number,
): string {
  const lines: string[] = ['mindmap'];
  let nodeCount = 0;

  function traverse(node: URLHierarchyNode, depth: number): void {
    if (depth > maxDepth || nodeCount >= maxNodes) {
      return;
    }

    nodeCount++;

    const label = node.segment || 'root';
    // clean label for mindmap (remove special chars)
    const cleanLabel = label.replace(/[()[\]{}]/g, '');

    // root node uses double parens syntax at base indentation
    if (depth === 0) {
      lines.push(`  root((${cleanLabel}))`);
    } else {
      // children need proper indentation (2 spaces per level, plus 2 base spaces)
      const indent = '  '.repeat(depth + 1);
      lines.push(`${indent}${cleanLabel}`);
    }

    // recurse into children, filtering out terminal noise nodes
    for (const child of node.children) {
      if (nodeCount >= maxNodes) break;

      // skip terminal leaf nodes that are noise (e.g., index.html)
      const isTerminalLeaf = child.children.length === 0;
      const isNoise = isNoiseSegment(child.segment);

      if (isTerminalLeaf && isNoise) {
        continue;
      }

      traverse(child, depth + 1);
    }
  }

  traverse(hierarchy, 0);

  if (nodeCount >= maxNodes) {
    lines.push('    ...and more');
  }

  return lines.join('\n');
}

/**
 * Generate Mermaid pie chart for crawl state
 */
function generateStateDiagram(state: CrawlState): string {
  const lines: string[] = ['pie title Crawl Results'];

  const visited = state.visited.length;
  const failed = state.failed.length;
  const redirected = state.redirects.length;
  const skipped = state.skipped.length;

  if (visited > 0) lines.push(`    "Visited" : ${String(visited)}`);
  if (failed > 0) lines.push(`    "Failed" : ${String(failed)}`);
  if (redirected > 0) lines.push(`    "Redirected" : ${String(redirected)}`);
  if (skipped > 0) lines.push(`    "Skipped" : ${String(skipped)}`);

  // if all zero, show at least visited
  if (lines.length === 1) {
    lines.push('    "Visited" : 0');
  }

  return lines.join('\n');
}

/**
 * Generate Mermaid graph for asset dependencies
 */
function generateAssetDependencyDiagram(
  assets: ManifestAsset[],
  minReferences: number,
  maxAssets: number,
): string {
  const lines: string[] = ['graph LR'];

  // filter to top assets by reference count
  const topAssets = assets
    .filter((a) => a.referencedBy.length >= minReferences)
    .sort((a, b) => b.referencedBy.length - a.referencedBy.length)
    .slice(0, maxAssets);

  if (topAssets.length === 0) {
    lines.push('    note["No assets with 3+ references"]');
    return lines.join('\n');
  }

  // group by type
  const byType = new Map<string, ManifestAsset[]>();
  for (const asset of topAssets) {
    const existing = byType.get(asset.type);
    if (existing) {
      existing.push(asset);
    } else {
      byType.set(asset.type, [asset]);
    }
  }

  let assetIdx = 0;
  for (const [type, assetsOfType] of byType) {
    for (const asset of assetsOfType) {
      const assetId = `a${String(assetIdx++)}`;
      const fileName = asset.url.split('/').pop() ?? asset.url;
      const escapedName = fileName.replace(/"/g, '\\"');
      const count = asset.referencedBy.length;

      lines.push(`    ${assetId}["${escapedName} (${type})"] --> pages["${String(count)} pages"]`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate Mermaid flowchart for link flow between pages
 */
function generateLinkFlowDiagram(pages: import('../types/crawl').CrawledPage[], maxPages: number): string {
  const lines: string[] = ['graph LR'];

  // calculate link counts between pages
  interface LinkCount {
    from: string;
    to: string;
    count: number;
  }

  const linkCounts = new Map<string, LinkCount>();

  for (const page of pages) {
    const fromUrl = page.url;

    for (const link of page.links) {
      if (!link.isInternal) continue;

      const key = `${fromUrl}→${link.url}`;
      const existing = linkCounts.get(key);

      if (existing) {
        existing.count++;
      } else {
        linkCounts.set(key, {
          from: fromUrl,
          to: link.url,
          count: 1,
        });
      }
    }
  }

  // get top links by count
  const topLinks = Array.from(linkCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, maxPages);

  if (topLinks.length === 0) {
    lines.push('    note["No internal links found"]');
    return lines.join('\n');
  }

  // generate nodes and edges
  const nodeIds = new Map<string, string>();
  let nodeIdx = 0;

  for (const link of topLinks) {
    let fromId = nodeIds.get(link.from);
    if (!fromId) {
      fromId = `p${String(nodeIdx++)}`;
      nodeIds.set(link.from, fromId);
      const fromPage = pages.find((p) => p.url === link.from);
      const fromLabel = (fromPage?.title ?? link.from.split('/').pop() ?? 'page').replace(/"/g, '\\"');
      lines.push(`    ${fromId}["${fromLabel}"]`);
    }

    let toId = nodeIds.get(link.to);
    if (!toId) {
      toId = `p${String(nodeIdx++)}`;
      nodeIds.set(link.to, toId);
      const toPage = pages.find((p) => p.url === link.to);
      const toLabel = (toPage?.title ?? link.to.split('/').pop() ?? 'page').replace(/"/g, '\\"');
      lines.push(`    ${toId}["${toLabel}"]`);
    }

    lines.push(`    ${fromId} -->|${String(link.count)}| ${toId}`);
  }

  return lines.join('\n');
}
