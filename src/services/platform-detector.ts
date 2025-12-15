import type { CrawledPage, ManifestAsset, Platform, PlatformDetection } from '../types/crawl';

interface PlatformSignals {
  platform: Platform;
  signals: string[];
  platformId?: string;
}

/**
 * Detect the hosting platform from crawl data
 */
export function detectPlatform(
  pages: CrawledPage[],
  assets: ManifestAsset[],
): PlatformDetection | undefined {
  const detectors: (() => PlatformSignals | undefined)[] = [
    () => detectShopify(pages, assets),
    () => detectWordPress(pages, assets),
    () => detectWix(pages, assets),
    () => detectSquarespace(pages, assets),
    () => detectGoDaddy(pages, assets),
    () => detectWebflow(pages, assets),
    () => detectBigCommerce(pages, assets),
    () => detectMagento(pages, assets),
  ];

  let bestMatch: PlatformSignals | undefined;

  for (const detect of detectors) {
    const result = detect();
    if (result && result.signals.length > 0) {
      if (!bestMatch || result.signals.length > bestMatch.signals.length) {
        bestMatch = result;
      }
    }
  }

  if (!bestMatch || bestMatch.signals.length === 0) {
    return void 0;
  }

  // WooCommerce is WordPress + WooCommerce plugin
  if (bestMatch.platform === 'woocommerce') {
    const wpSignals = detectWordPress(pages, assets);
    if (wpSignals) {
      bestMatch.signals = [...new Set([...bestMatch.signals, ...wpSignals.signals])];
    }
  }

  return {
    platform: bestMatch.platform,
    confidence: bestMatch.signals.length >= 3 ? 'high' : bestMatch.signals.length >= 2 ? 'medium' : 'low',
    signals: [...new Set(bestMatch.signals)],
    platformId: bestMatch.platformId,
  };
}

function detectShopify(pages: CrawledPage[], assets: ManifestAsset[]): PlatformSignals | undefined {
  const signals: string[] = [];
  let platformId: string | undefined;

  // CDN URL patterns
  const cdnPatterns = ['cdn.shopify.com', '/cdn/shopifycloud/', '/cdn/shop/'];
  for (const asset of assets) {
    for (const pattern of cdnPatterns) {
      if (asset.url.includes(pattern)) {
        signals.push('shopify_cdn');
        break;
      }
    }
    if (signals.includes('shopify_cdn')) break;
  }

  // "Powered by Shopify" link
  for (const page of pages) {
    for (const link of page.links) {
      if (link.url.includes('shopify.com') && link.url.includes('utm_campaign=poweredby')) {
        signals.push('powered_by_shopify');
        break;
      }
    }
    if (signals.includes('powered_by_shopify')) break;
  }

  // Shopify account URLs (extract store ID)
  for (const page of pages) {
    for (const link of page.links) {
      const match = /shopify\.com\/(\d+)\/account/.exec(link.url);
      if (match) {
        signals.push('shopify_account_url');
        platformId = match[1];
        break;
      }
    }
    if (platformId) break;
  }

  // URL structure patterns
  const hasProducts = pages.some((p) => p.url.includes('/products/'));
  const hasCollections = pages.some((p) => p.url.includes('/collections/'));
  const hasPolicies = pages.some((p) => p.url.includes('/policies/'));
  const hasCustomerAuth = pages.some((p) => p.url.includes('/customer_authentication/'));

  if (hasProducts && hasCollections && hasPolicies) {
    signals.push('shopify_url_structure');
  }
  if (hasCustomerAuth) {
    signals.push('shopify_customer_auth');
  }

  // Shopify extensions in assets
  for (const asset of assets) {
    if (asset.url.includes('cdn.shopify.com/extensions/')) {
      signals.push('shopify_extensions');
      break;
    }
  }

  if (signals.length === 0) return void 0;
  return { platform: 'shopify', signals, platformId };
}

function detectWordPress(pages: CrawledPage[], assets: ManifestAsset[]): PlatformSignals | undefined {
  const signals: string[] = [];

  // wp-content/wp-includes in asset URLs
  for (const asset of assets) {
    if (asset.url.includes('/wp-content/') || asset.url.includes('/wp-includes/')) {
      signals.push('wordpress_content');
      break;
    }
  }

  // wp-json API links
  for (const page of pages) {
    for (const link of page.links) {
      if (link.url.includes('/wp-json/')) {
        signals.push('wordpress_api');
        break;
      }
    }
    if (signals.includes('wordpress_api')) break;
  }

  // Check for WooCommerce (WordPress + e-commerce)
  const hasWooCommerce = assets.some((a) => a.url.includes('/woocommerce/'));
  if (hasWooCommerce && signals.length > 0) {
    return { platform: 'woocommerce', signals: [...signals, 'woocommerce_plugin'] };
  }

  if (signals.length === 0) return void 0;
  return { platform: 'wordpress', signals };
}

function detectWix(pages: CrawledPage[], assets: ManifestAsset[]): PlatformSignals | undefined {
  const signals: string[] = [];

  // Wix CDN patterns
  const wixCdnPatterns = ['static.wixstatic.com', 'static.parastorage.com', 'siteassets.parastorage.com'];
  for (const asset of assets) {
    for (const pattern of wixCdnPatterns) {
      if (asset.url.includes(pattern)) {
        signals.push('wix_cdn');
        break;
      }
    }
    if (signals.includes('wix_cdn')) break;
  }

  // Wix domain in links
  for (const page of pages) {
    for (const link of page.links) {
      if (link.url.includes('wix.com') || link.url.includes('wixsite.com')) {
        signals.push('wix_domain');
        break;
      }
    }
    if (signals.includes('wix_domain')) break;
  }

  if (signals.length === 0) return void 0;
  return { platform: 'wix', signals };
}

function detectSquarespace(_pages: CrawledPage[], assets: ManifestAsset[]): PlatformSignals | undefined {
  const signals: string[] = [];

  // Squarespace CDN
  const sqspPatterns = ['static1.squarespace.com', 'images.squarespace-cdn.com', 'static.squarespace.com'];
  for (const asset of assets) {
    for (const pattern of sqspPatterns) {
      if (asset.url.includes(pattern)) {
        signals.push('squarespace_cdn');
        break;
      }
    }
    if (signals.includes('squarespace_cdn')) break;
  }

  // Squarespace /s/ asset paths
  for (const asset of assets) {
    if (/\/s\/[a-f0-9]+\//.exec(asset.url)) {
      signals.push('squarespace_asset_path');
      break;
    }
  }

  if (signals.length === 0) return void 0;
  return { platform: 'squarespace', signals };
}

function detectGoDaddy(pages: CrawledPage[], assets: ManifestAsset[]): PlatformSignals | undefined {
  const signals: string[] = [];

  // GoDaddy CDN patterns
  const gdPatterns = ['img1.wsimg.com', 'img4.wsimg.com', 'godaddysites.com'];
  for (const asset of assets) {
    for (const pattern of gdPatterns) {
      if (asset.url.includes(pattern)) {
        signals.push('godaddy_cdn');
        break;
      }
    }
    if (signals.includes('godaddy_cdn')) break;
  }

  // GoDaddy domain in links
  for (const page of pages) {
    for (const link of page.links) {
      if (link.url.includes('godaddysites.com')) {
        signals.push('godaddy_domain');
        break;
      }
    }
    if (signals.includes('godaddy_domain')) break;
  }

  if (signals.length === 0) return void 0;
  return { platform: 'godaddy', signals };
}

function detectWebflow(_pages: CrawledPage[], assets: ManifestAsset[]): PlatformSignals | undefined {
  const signals: string[] = [];

  // Webflow CDN
  const wfPatterns = ['assets.website-files.com', 'uploads-ssl.webflow.com', 'assets-global.website-files.com'];
  for (const asset of assets) {
    for (const pattern of wfPatterns) {
      if (asset.url.includes(pattern)) {
        signals.push('webflow_cdn');
        break;
      }
    }
    if (signals.includes('webflow_cdn')) break;
  }

  // Webflow script references
  for (const asset of assets) {
    if (asset.url.includes('webflow') && asset.type === 'js') {
      signals.push('webflow_script');
      break;
    }
  }

  if (signals.length === 0) return void 0;
  return { platform: 'webflow', signals };
}

function detectBigCommerce(_pages: CrawledPage[], assets: ManifestAsset[]): PlatformSignals | undefined {
  const signals: string[] = [];

  // BigCommerce CDN
  const bcPatterns = ['cdn.bcapp.dev', 'bigcommerce.com/s-'];
  for (const asset of assets) {
    for (const pattern of bcPatterns) {
      if (asset.url.includes(pattern)) {
        signals.push('bigcommerce_cdn');
        break;
      }
    }
    if (signals.includes('bigcommerce_cdn')) break;
  }

  // BigCommerce product images path
  for (const asset of assets) {
    if (asset.url.includes('/product_images/')) {
      signals.push('bigcommerce_product_images');
      break;
    }
  }

  if (signals.length === 0) return void 0;
  return { platform: 'bigcommerce', signals };
}

function detectMagento(_pages: CrawledPage[], assets: ManifestAsset[]): PlatformSignals | undefined {
  const signals: string[] = [];

  // Magento paths
  for (const asset of assets) {
    if (asset.url.includes('/media/catalog/') || asset.url.includes('/static/frontend/')) {
      signals.push('magento_paths');
      break;
    }
  }

  // Mage scripts
  for (const asset of assets) {
    if (asset.url.includes('/mage/') || asset.url.includes('requirejs/require')) {
      signals.push('magento_scripts');
      break;
    }
  }

  if (signals.length === 0) return void 0;
  return { platform: 'magento', signals };
}
