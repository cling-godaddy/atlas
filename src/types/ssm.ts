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
