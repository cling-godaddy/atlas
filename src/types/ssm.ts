/**
 * SSM (Semantic Site Model) types for enhanced extraction
 */

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
 * Extracted image with raw contextual data (no inference)
 */
export interface ExtractedImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  sourceUrl: string;
  /** Semantic container element */
  element: SemanticElement;
  /** Position flags */
  inHeader: boolean;
  inFooter: boolean;
  inFirstSection: boolean;
  nearH1: boolean;
  /** First image in its semantic container */
  isFirstInContainer: boolean;
  /** Where image links to (if wrapped in anchor) */
  linkedTo?: string;
  /** CSS classes on the image element */
  classes?: string[];
  /** CSS classes on ancestor elements (up to 5 levels) */
  ancestorClasses?: string;
  /** Text content of sibling elements */
  siblingText?: string;
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
