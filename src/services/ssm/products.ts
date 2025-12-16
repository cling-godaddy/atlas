import type { StructuredData } from '../../types/crawl';
import type { ExtractedProduct, ExtractedService, PriceInfo } from '../../types/ssm';

/**
 * Safely convert unknown to string (only if primitive)
 */
function safeString(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return void 0;
}

/**
 * Parse price from JSON-LD offers
 */
function parsePrice(offers: unknown): PriceInfo | undefined {
  if (!offers || typeof offers !== 'object') return void 0;

  // handle array of offers (take first)
  const offer = Array.isArray(offers) ? (offers as unknown[])[0] : offers;
  if (!offer || typeof offer !== 'object') return void 0;

  const obj = offer as Record<string, unknown>;
  const price = obj.price;
  const currency = safeString(obj.priceCurrency);

  if (typeof price === 'number' && currency) {
    return { amount: price, currency };
  }
  if (typeof price === 'string' && currency) {
    const amount = parseFloat(price);
    if (!isNaN(amount)) {
      return { amount, currency };
    }
  }

  return void 0;
}

/**
 * Extract images from JSON-LD image field
 */
function parseImages(image: unknown): string[] | undefined {
  if (!image) return void 0;

  if (typeof image === 'string') {
    return [image];
  }

  if (Array.isArray(image)) {
    const urls: string[] = [];
    for (const img of image) {
      if (typeof img === 'string') {
        urls.push(img);
      } else if (img && typeof img === 'object' && 'url' in img) {
        const imgObj = img as Record<string, unknown>;
        const url = safeString(imgObj.url);
        if (url) urls.push(url);
      }
    }
    return urls.length > 0 ? urls : void 0;
  }

  if (typeof image === 'object' && 'url' in image) {
    const imgObj = image as Record<string, unknown>;
    const url = safeString(imgObj.url);
    if (url) return [url];
  }

  return void 0;
}

/**
 * Extract products from JSON-LD structured data
 */
export function extractProductsFromJsonLd(
  structuredData: StructuredData | undefined,
  pageUrl: string,
): ExtractedProduct[] {
  if (!structuredData?.jsonLd) return [];

  const products: ExtractedProduct[] = [];

  for (const item of structuredData.jsonLd) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    if (obj['@type'] !== 'Product') continue;

    const name = safeString(obj.name);
    if (!name) continue;

    const product: ExtractedProduct = {
      name,
      url: safeString(obj.url) ?? pageUrl,
      price: parsePrice(obj.offers),
      images: parseImages(obj.image),
      description: safeString(obj.description),
      sku: safeString(obj.sku),
      brand: extractBrand(obj.brand),
    };

    products.push(product);
  }

  return products;
}

/**
 * Extract brand name from JSON-LD brand field
 */
function extractBrand(brand: unknown): string | undefined {
  if (!brand) return void 0;
  if (typeof brand === 'string') return brand;
  if (typeof brand === 'object' && 'name' in brand) {
    return safeString((brand as Record<string, unknown>).name);
  }
  return void 0;
}

/**
 * Extract services from JSON-LD structured data
 */
export function extractServicesFromJsonLd(
  structuredData: StructuredData | undefined,
  pageUrl: string,
): ExtractedService[] {
  if (!structuredData?.jsonLd) return [];

  const services: ExtractedService[] = [];

  for (const item of structuredData.jsonLd) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    if (obj['@type'] !== 'Service') continue;

    const name = safeString(obj.name);
    if (!name) continue;

    const service: ExtractedService = {
      name,
      url: safeString(obj.url) ?? pageUrl,
      description: safeString(obj.description),
      price: parsePrice(obj.offers),
    };

    services.push(service);
  }

  return services;
}

/**
 * Aggregate products across pages (dedupe by URL)
 */
export function aggregateProducts(allProducts: ExtractedProduct[]): ExtractedProduct[] {
  const productMap = new Map<string, ExtractedProduct>();

  for (const product of allProducts) {
    if (!productMap.has(product.url)) {
      productMap.set(product.url, product);
    }
  }

  return Array.from(productMap.values());
}

/**
 * Aggregate services across pages (dedupe by URL)
 */
export function aggregateServices(allServices: ExtractedService[]): ExtractedService[] {
  const serviceMap = new Map<string, ExtractedService>();

  for (const service of allServices) {
    if (!serviceMap.has(service.url)) {
      serviceMap.set(service.url, service);
    }
  }

  return Array.from(serviceMap.values());
}
