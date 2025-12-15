import { describe, expect, it } from 'vitest';

import { extractUrlPattern, isDynamicUrl, isInternalUrl, normalizeUrl, shouldExcludeHierarchically, shouldExcludeUrl, urlToPath } from '../../src/utils/url';

describe('urlToPath', () => {
  it('should convert basic path to filename', () => {
    expect(urlToPath('https://example.com/products', 'example.com')).toBe('products.html');
  });

  it('should handle nested paths', () => {
    expect(urlToPath('https://example.com/products/shoes', 'example.com')).toBe('products/shoes.html');
  });

  it('should handle root URL', () => {
    expect(urlToPath('https://example.com/', 'example.com')).toBe('index.html');
    expect(urlToPath('https://example.com', 'example.com')).toBe('index.html');
  });

  it('should handle query params', () => {
    expect(urlToPath('https://example.com/search?q=test', 'example.com')).toBe('search_q=test.html');
  });

  it('should handle multiple query params', () => {
    expect(urlToPath('https://example.com/search?q=test&page=2', 'example.com')).toBe('search_q=test_page=2.html');
  });

  it('should sanitize invalid filename characters', () => {
    expect(urlToPath('https://example.com/path:with:colons', 'example.com')).toBe('path_with_colons.html');
  });

  it('should handle trailing slashes', () => {
    expect(urlToPath('https://example.com/products/', 'example.com')).toBe('products.html');
  });

  it('should handle invalid URLs', () => {
    expect(urlToPath('not-a-url', 'example.com')).toBe('invalid.html');
  });
});

describe('shouldExcludeUrl', () => {
  it('should match exact patterns', () => {
    expect(shouldExcludeUrl('https://example.com/admin', ['/admin'])).toBe(true);
  });

  it('should match wildcard patterns', () => {
    expect(shouldExcludeUrl('https://example.com/admin/users', ['/admin/*'])).toBe(true);
    expect(shouldExcludeUrl('https://example.com/docs/guide.pdf', ['*.pdf'])).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(shouldExcludeUrl('https://example.com/ADMIN', ['/admin'])).toBe(true);
  });

  it('should handle partial matches', () => {
    expect(shouldExcludeUrl('https://example.com/admin/users', ['/admin'])).toBe(true);
  });

  it('should return false for non-matching patterns', () => {
    expect(shouldExcludeUrl('https://example.com/products', ['/admin', '*.pdf'])).toBe(false);
  });

  it('should handle empty patterns', () => {
    expect(shouldExcludeUrl('https://example.com/anything', [])).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('should lowercase hostname', () => {
    expect(normalizeUrl('https://Example.COM/path')).toBe('https://example.com/path');
  });

  it('should remove trailing slash from path', () => {
    expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
  });

  it('should keep root trailing slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('should strip query params', () => {
    expect(normalizeUrl('https://example.com/search?z=3&a=1&m=2')).toBe('https://example.com/search');
  });

  it('should remove hash fragments', () => {
    expect(normalizeUrl('https://example.com/path#section')).toBe('https://example.com/path');
  });

  it('should remove default ports', () => {
    expect(normalizeUrl('https://example.com:443/path')).toBe('https://example.com/path');
    expect(normalizeUrl('http://example.com:80/path')).toBe('http://example.com/path');
  });

  it('should keep non-default ports', () => {
    expect(normalizeUrl('https://example.com:8080/path')).toBe('https://example.com:8080/path');
  });

  it('should handle invalid URLs gracefully', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('isInternalUrl', () => {
  it('should recognize same domain as internal', () => {
    expect(isInternalUrl('https://example.com/page', 'example.com')).toBe(true);
  });

  it('should recognize subdomains as internal', () => {
    expect(isInternalUrl('https://blog.example.com/page', 'example.com')).toBe(true);
    expect(isInternalUrl('https://api.example.com/endpoint', 'example.com')).toBe(true);
  });

  it('should reject external domains', () => {
    expect(isInternalUrl('https://other.com/page', 'example.com')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isInternalUrl('https://EXAMPLE.COM/page', 'example.com')).toBe(true);
  });

  it('should handle invalid URLs', () => {
    expect(isInternalUrl('not-a-url', 'example.com')).toBe(false);
  });
});

describe('isDynamicUrl', () => {
  it('should detect numeric IDs', () => {
    const result = isDynamicUrl('https://example.com/product/123');
    expect(result.isDynamic).toBe(true);
    expect(result.dynamicSegments).toEqual(['123']);
  });

  it('should detect UUIDs', () => {
    const result = isDynamicUrl('https://example.com/order/550e8400-e29b-41d4-a716-446655440000');
    expect(result.isDynamic).toBe(true);
    expect(result.dynamicSegments).toEqual(['550e8400-e29b-41d4-a716-446655440000']);
  });

  it('should detect MongoDB ObjectIDs', () => {
    const result = isDynamicUrl('https://example.com/post/507f1f77bcf86cd799439011');
    expect(result.isDynamic).toBe(true);
    expect(result.dynamicSegments).toEqual(['507f1f77bcf86cd799439011']);
  });

  it('should detect query param IDs', () => {
    const result = isDynamicUrl('https://example.com/search?id=123');
    expect(result.isDynamic).toBe(true);
    expect(result.dynamicSegments).toEqual(['id=123']);
  });

  it('should detect multiple dynamic segments', () => {
    const result = isDynamicUrl('https://example.com/user/456/posts/789');
    expect(result.isDynamic).toBe(true);
    expect(result.dynamicSegments).toEqual(['456', '789']);
  });

  it('should return false for static URLs', () => {
    const result = isDynamicUrl('https://example.com/products');
    expect(result.isDynamic).toBe(false);
    expect(result.dynamicSegments).toEqual([]);
  });

  it('should return pattern for dynamic URLs', () => {
    const result = isDynamicUrl('https://example.com/product/123');
    expect(result.pattern).toBe('/product/:id');
  });

  it('should handle invalid URLs', () => {
    const result = isDynamicUrl('not-a-url');
    expect(result.isDynamic).toBe(false);
  });
});

describe('extractUrlPattern', () => {
  it('should replace numeric IDs with :id', () => {
    expect(extractUrlPattern('https://example.com/product/123')).toBe('/product/:id');
  });

  it('should replace UUIDs with :uuid', () => {
    expect(extractUrlPattern('https://example.com/order/550e8400-e29b-41d4-a716-446655440000')).toBe('/order/:uuid');
  });

  it('should replace MongoDB ObjectIDs with :objectId', () => {
    expect(extractUrlPattern('https://example.com/post/507f1f77bcf86cd799439011')).toBe('/post/:objectId');
  });

  it('should handle multiple dynamic segments', () => {
    expect(extractUrlPattern('https://example.com/user/456/posts/789')).toBe('/user/:id/posts/:id');
  });

  it('should preserve static segments', () => {
    expect(extractUrlPattern('https://example.com/products/category/shoes')).toBe('/products/category/shoes');
  });

  it('should handle mixed static and dynamic', () => {
    expect(extractUrlPattern('https://example.com/products/123/reviews')).toBe('/products/:id/reviews');
  });

  it('should handle invalid URLs', () => {
    expect(extractUrlPattern('not-a-url')).toBe('not-a-url');
  });
});

describe('shouldExcludeHierarchically', () => {
  describe('parent page preservation', () => {
    it('should keep parent page without trailing slash', () => {
      expect(shouldExcludeHierarchically('https://example.com/products', ['/products/*'])).toBe(false);
    });

    it('should keep parent page with trailing slash', () => {
      expect(shouldExcludeHierarchically('https://example.com/products/', ['/products/*'])).toBe(false);
    });

    it('should keep parent with query params', () => {
      expect(shouldExcludeHierarchically('https://example.com/products?page=1', ['/products/*'])).toBe(false);
    });
  });

  describe('child page exclusion', () => {
    it('should exclude direct children', () => {
      expect(shouldExcludeHierarchically('https://example.com/products/item-1', ['/products/*'])).toBe(true);
    });

    it('should exclude grandchildren', () => {
      expect(shouldExcludeHierarchically('https://example.com/products/shoes/nike', ['/products/*'])).toBe(true);
    });

    it('should exclude deeply nested paths', () => {
      expect(shouldExcludeHierarchically('https://example.com/products/a/b/c/d', ['/products/*'])).toBe(true);
    });

    it('should exclude children with query params', () => {
      expect(shouldExcludeHierarchically('https://example.com/products/item-1?id=123', ['/products/*'])).toBe(true);
    });
  });

  describe('multiple patterns', () => {
    it('should handle multiple patterns', () => {
      const patterns = ['/products/*', '/blog/*', '/categories/*'];
      expect(shouldExcludeHierarchically('https://example.com/blog/post-1', patterns)).toBe(true);
      expect(shouldExcludeHierarchically('https://example.com/blog', patterns)).toBe(false);
      expect(shouldExcludeHierarchically('https://example.com/categories/electronics', patterns)).toBe(true);
      expect(shouldExcludeHierarchically('https://example.com/categories', patterns)).toBe(false);
    });
  });

  describe('patterns without wildcards', () => {
    it('should match exact path without wildcard', () => {
      expect(shouldExcludeHierarchically('https://example.com/about', ['/about'])).toBe(true);
    });

    it('should not match children when no wildcard', () => {
      expect(shouldExcludeHierarchically('https://example.com/about/team', ['/about'])).toBe(false);
    });
  });

  describe('case sensitivity', () => {
    it('should be case-insensitive for URLs', () => {
      expect(shouldExcludeHierarchically('https://example.com/Products/Item', ['/products/*'])).toBe(true);
    });

    it('should be case-insensitive for parent', () => {
      expect(shouldExcludeHierarchically('https://example.com/PRODUCTS/', ['/products/*'])).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty patterns', () => {
      expect(shouldExcludeHierarchically('https://example.com/anything', [])).toBe(false);
    });

    it('should handle root path pattern', () => {
      expect(shouldExcludeHierarchically('https://example.com/', ['/*'])).toBe(false);
      expect(shouldExcludeHierarchically('https://example.com/page', ['/*'])).toBe(true);
    });

    it('should handle pattern without leading slash', () => {
      expect(shouldExcludeHierarchically('https://example.com/products/item', ['products/*'])).toBe(true);
    });

    it('should not exclude unrelated paths', () => {
      expect(shouldExcludeHierarchically('https://example.com/about', ['/products/*'])).toBe(false);
      expect(shouldExcludeHierarchically('https://example.com/product-info', ['/products/*'])).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(shouldExcludeHierarchically('not-a-url', ['/products/*'])).toBe(false);
    });

    it('should handle pattern with multiple wildcards', () => {
      expect(shouldExcludeHierarchically('https://example.com/products/item', ['/products/**'])).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle commerce product pages', () => {
      const patterns = ['/products/*'];
      expect(shouldExcludeHierarchically('https://shop.com/products', patterns)).toBe(false);
      expect(shouldExcludeHierarchically('https://shop.com/products/tshirt-123', patterns)).toBe(true);
      expect(shouldExcludeHierarchically('https://shop.com/products/category/shoes', patterns)).toBe(true);
    });

    it('should handle blog posts', () => {
      const patterns = ['/blog/*'];
      expect(shouldExcludeHierarchically('https://site.com/blog', patterns)).toBe(false);
      expect(shouldExcludeHierarchically('https://site.com/blog/2024/01/post-slug', patterns)).toBe(true);
    });

    it('should handle documentation pages', () => {
      const patterns = ['/docs/*'];
      expect(shouldExcludeHierarchically('https://site.com/docs', patterns)).toBe(false);
      expect(shouldExcludeHierarchically('https://site.com/docs/', patterns)).toBe(false);
      expect(shouldExcludeHierarchically('https://site.com/docs/guide', patterns)).toBe(true);
      expect(shouldExcludeHierarchically('https://site.com/docs/api/reference', patterns)).toBe(true);
    });
  });
});
