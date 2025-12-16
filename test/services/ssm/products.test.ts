import { describe, expect, it } from 'vitest';

import { aggregateProducts, aggregateServices, extractProductsFromJsonLd, extractServicesFromJsonLd } from '../../../src/services/ssm/products';

import type { StructuredData } from '../../../src/types/crawl';

describe('extractProductsFromJsonLd', () => {
  it('should extract basic product info', () => {
    const structuredData: StructuredData = {
      jsonLd: [
        {
          '@type': 'Product',
          name: 'Test Product',
          description: 'A great product',
          sku: 'SKU123',
        },
      ],
      microdata: [],
    };
    const result = extractProductsFromJsonLd(structuredData, 'https://example.com/product/123');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Product');
    expect(result[0].description).toBe('A great product');
    expect(result[0].sku).toBe('SKU123');
    expect(result[0].url).toBe('https://example.com/product/123');
  });

  it('should extract product with price', () => {
    const structuredData: StructuredData = {
      jsonLd: [
        {
          '@type': 'Product',
          name: 'Priced Product',
          offers: {
            '@type': 'Offer',
            price: 29.99,
            priceCurrency: 'USD',
          },
        },
      ],
      microdata: [],
    };
    const result = extractProductsFromJsonLd(structuredData, 'https://example.com/');
    expect(result[0].price).toEqual({ amount: 29.99, currency: 'USD' });
  });

  it('should extract product with string price', () => {
    const structuredData: StructuredData = {
      jsonLd: [
        {
          '@type': 'Product',
          name: 'String Price Product',
          offers: {
            price: '49.99',
            priceCurrency: 'EUR',
          },
        },
      ],
      microdata: [],
    };
    const result = extractProductsFromJsonLd(structuredData, 'https://example.com/');
    expect(result[0].price).toEqual({ amount: 49.99, currency: 'EUR' });
  });

  it('should extract product images', () => {
    const structuredData: StructuredData = {
      jsonLd: [
        {
          '@type': 'Product',
          name: 'Image Product',
          image: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        },
      ],
      microdata: [],
    };
    const result = extractProductsFromJsonLd(structuredData, 'https://example.com/');
    expect(result[0].images).toEqual(['https://example.com/img1.jpg', 'https://example.com/img2.jpg']);
  });

  it('should extract brand name', () => {
    const structuredData: StructuredData = {
      jsonLd: [
        {
          '@type': 'Product',
          name: 'Branded Product',
          brand: { '@type': 'Brand', name: 'Acme' },
        },
      ],
      microdata: [],
    };
    const result = extractProductsFromJsonLd(structuredData, 'https://example.com/');
    expect(result[0].brand).toBe('Acme');
  });

  it('should return empty array for no products', () => {
    const structuredData: StructuredData = {
      jsonLd: [{ '@type': 'Organization', name: 'Test' }],
      microdata: [],
    };
    const result = extractProductsFromJsonLd(structuredData, 'https://example.com/');
    expect(result).toHaveLength(0);
  });

  it('should handle undefined structuredData', () => {
    const result = extractProductsFromJsonLd(void 0, 'https://example.com/');
    expect(result).toHaveLength(0);
  });
});

describe('extractServicesFromJsonLd', () => {
  it('should extract service info', () => {
    const structuredData: StructuredData = {
      jsonLd: [
        {
          '@type': 'Service',
          name: 'Consulting',
          description: 'Expert consulting services',
        },
      ],
      microdata: [],
    };
    const result = extractServicesFromJsonLd(structuredData, 'https://example.com/services');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Consulting');
    expect(result[0].description).toBe('Expert consulting services');
  });

  it('should extract service with price', () => {
    const structuredData: StructuredData = {
      jsonLd: [
        {
          '@type': 'Service',
          name: 'Premium Support',
          offers: { price: 199, priceCurrency: 'USD' },
        },
      ],
      microdata: [],
    };
    const result = extractServicesFromJsonLd(structuredData, 'https://example.com/');
    expect(result[0].price).toEqual({ amount: 199, currency: 'USD' });
  });
});

describe('aggregateProducts', () => {
  it('should deduplicate products by URL', () => {
    const products = [
      { name: 'Product 1', url: 'https://example.com/p/1' },
      { name: 'Product 1 (duplicate)', url: 'https://example.com/p/1' },
      { name: 'Product 2', url: 'https://example.com/p/2' },
    ];
    const result = aggregateProducts(products);
    expect(result).toHaveLength(2);
  });
});

describe('aggregateServices', () => {
  it('should deduplicate services by URL', () => {
    const services = [
      { name: 'Service 1', url: 'https://example.com/s/1' },
      { name: 'Service 1 (duplicate)', url: 'https://example.com/s/1' },
    ];
    const result = aggregateServices(services);
    expect(result).toHaveLength(1);
  });
});
