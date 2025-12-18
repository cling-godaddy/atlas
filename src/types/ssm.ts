/**
 * SSM (Semantic Site Model) types for enhanced extraction
 */

/**
 * Confidence level for SSM extractions
 */
export type Confidence = 'high' | 'medium' | 'low';

/**
 * Page type classification
 */
export type PageType =
  | 'home'
  | 'about'
  | 'contact'
  | 'shop'
  | 'product'
  | 'category'
  | 'services'
  | 'gallery'
  | 'blog'
  | 'article'
  | 'faq'
  | 'legal'
  | 'other';

/**
 * Page classification result
 */
export interface PageClassification {
  type: PageType;
  confidence: Confidence;
  signals: string[];
}

/**
 * Navigation item
 */
export interface NavItem {
  text: string;
  url: string;
  children?: NavItem[];
}

/**
 * Extracted navigation structure
 */
export interface Navigation {
  primary?: NavItem[];
  footer?: NavItem[];
}

/**
 * Phone number with optional type
 */
export interface PhoneInfo {
  number: string;
  type?: string;
}

/**
 * Email address with optional type
 */
export interface EmailInfo {
  address: string;
  type?: string;
}

/**
 * Physical address
 */
export interface AddressInfo {
  formatted: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

/**
 * Business hours for a day
 */
export interface HoursInfo {
  day: string;
  open: string;
  close: string;
}

/**
 * Social media link
 */
export interface SocialLink {
  platform: string;
  url: string;
}

/**
 * Aggregated contact information for a site
 */
export interface ContactInfo {
  phones?: PhoneInfo[];
  emails?: EmailInfo[];
  addresses?: AddressInfo[];
  hours?: HoursInfo[];
  social?: SocialLink[];
}

/**
 * Image category for curation
 */
export type ImageCategory =
  | 'logo'
  | 'hero'
  | 'product'
  | 'gallery'
  | 'icon'
  | 'team'
  | 'testimonial'
  | 'service'
  | 'partner'
  | 'content'
  | 'other';

/**
 * Semantic HTML element container for images
 */
export type SemanticElement =
  | 'nav'
  | 'header'
  | 'footer'
  | 'aside'
  | 'main'
  | 'article'
  | 'figure'
  | 'section'
  | 'other';

/**
 * DOM context for an image
 */
export interface ImageContext {
  element: SemanticElement;
  isFirstInContainer?: boolean;
}

/**
 * Curated image with categorization and priority
 */
export interface CuratedImage {
  url: string;
  alt?: string;
  category: ImageCategory;
  priority: number;
  width?: number;
  height?: number;
  signals: string[];
  sourceUrl: string;
  context?: ImageContext;
  linkedTo?: string;
  classes?: string[];
}

/**
 * Price information
 */
export interface PriceInfo {
  amount: number;
  currency: string;
}

/**
 * Extracted product from JSON-LD
 */
export interface ExtractedProduct {
  name: string;
  url: string;
  price?: PriceInfo;
  images?: string[];
  description?: string;
  sku?: string;
  brand?: string;
}

/**
 * Extracted service from JSON-LD
 */
export interface ExtractedService {
  name: string;
  url: string;
  description?: string;
  price?: PriceInfo;
}
