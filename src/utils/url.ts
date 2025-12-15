import type { UrlAnalysis } from '../types';

export function urlToPath(url: string, _baseDomain: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;

    if (path === '/') {
      return 'index.html';
    }

    path = path.replace(/^\//, '').replace(/\/$/, '');

    if (parsed.search) {
      const queryString = parsed.search
        .slice(1)
        .replace(/=/g, '=')
        .replace(/&/g, '_');
      path = `${path}_${queryString}`;
    }

    path = path.replace(/[:<>"|?*]/g, '_');

    if (!path.endsWith('.html')) {
      path = `${path}.html`;
    }

    return path;
  } catch {
    return 'invalid.html';
  }
}

export function shouldExcludeUrl(url: string, patterns: string[]): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();

    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();

      if (patternLower.includes('*')) {
        const regexPattern = patternLower
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*');
        const regex = new RegExp(regexPattern);
        if (regex.test(pathname) || regex.test(fullUrl)) {
          return true;
        }
      } else if (pathname.includes(patternLower) || fullUrl.includes(patternLower)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export function shouldExcludeHierarchically(url: string, patterns: string[]): boolean {
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname.toLowerCase();

    // normalize trailing slash
    if (pathname.endsWith('/') && pathname !== '/') {
      pathname = pathname.slice(0, -1);
    }

    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();

      if (!patternLower.includes('*')) {
        // no wildcard → exact match only (not hierarchical)
        if (pathname === patternLower || pathname === patternLower + '/') {
          return true;
        }
        continue;
      }

      // extract parent path (remove /*)
      let parentPath = patternLower.replace(/\/?\*+$/, '');

      // ensure parent path has leading slash
      if (!parentPath.startsWith('/')) {
        parentPath = '/' + parentPath;
      }

      // check if URL is the parent (KEEP)
      if (pathname === parentPath || pathname === parentPath + '/') {
        return false;
      }

      // check if URL is a child (EXCLUDE)
      if (parentPath === '/') {
        // for root pattern /*, exclude all non-root paths
        if (pathname !== '/') {
          return true;
        }
      } else if (pathname.startsWith(parentPath + '/')) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export function extractParentPaths(patterns: string[]): string[] {
  const parents: string[] = [];

  for (const pattern of patterns) {
    if (!pattern.includes('*')) continue;

    // extract parent path (remove /*)
    let parentPath = pattern.replace(/\/?\*+$/, '');

    // ensure leading slash
    if (!parentPath.startsWith('/')) {
      parentPath = '/' + parentPath;
    }

    // skip root pattern
    if (parentPath === '/') continue;

    parents.push(parentPath);
  }

  return parents;
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    parsed.hostname = parsed.hostname.toLowerCase();

    if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }

    if (parsed.pathname.endsWith('/') && parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // strip query params and hash for deduplication
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString();
  } catch {
    return url;
  }
}

export function isInternalUrl(url: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const base = baseDomain.toLowerCase();

    return hostname === base || hostname.endsWith(`.${base}`);
  } catch {
    return false;
  }
}

export function isDynamicUrl(url: string): UrlAnalysis {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter((s) => s.length > 0);
    const dynamicSegments: string[] = [];

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const objectIdRegex = /^[0-9a-f]{24}$/i;
    const numericRegex = /^\d+$/;

    for (const segment of segments) {
      if (uuidRegex.test(segment) || objectIdRegex.test(segment) || numericRegex.test(segment)) {
        dynamicSegments.push(segment);
      }
    }

    const params = new URLSearchParams(parsed.search);
    for (const [key, value] of params.entries()) {
      if (key.toLowerCase().includes('id') && numericRegex.test(value)) {
        dynamicSegments.push(`${key}=${value}`);
      }
    }

    if (dynamicSegments.length === 0) {
      return { isDynamic: false, dynamicSegments: [] };
    }

    const pattern = extractUrlPattern(url);
    return { isDynamic: true, pattern, dynamicSegments };
  } catch {
    return { isDynamic: false, dynamicSegments: [] };
  }
}

export function extractUrlPattern(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter((s) => s.length > 0);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const objectIdRegex = /^[0-9a-f]{24}$/i;
    const numericRegex = /^\d+$/;

    const patternSegments = segments.map((segment) => {
      if (uuidRegex.test(segment)) {
        return ':uuid';
      }
      if (objectIdRegex.test(segment)) {
        return ':objectId';
      }
      if (numericRegex.test(segment)) {
        return ':id';
      }
      return segment;
    });

    return `/${patternSegments.join('/')}`;
  } catch {
    return url;
  }
}
