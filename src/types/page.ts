import type { AuthSignals, RedirectChain, Soft404Signals, UrlAnalysis } from './detection.js';

export type AssetType = 'css' | 'image' | 'font' | 'script' | 'other';

export interface AssetRef {
  url: string;
  localPath: string;
  type: AssetType;
  hash: string;
}

export interface LinkInfo {
  url: string;
  text: string;
  isInternal: boolean;
  rel?: string;
}

export interface PageMetadata {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
  keywords?: string[];
}

export interface PageData {
  url: string;
  path: string;
  crawledAt: string;
  statusCode: number;
  depth: number;
  title: string;
  html: string;
  text: string;
  metadata: PageMetadata;
  links: LinkInfo[];
  assets: AssetRef[];
  requiresAuth?: boolean;
  authSignals?: AuthSignals;
  isSoft404?: boolean;
  soft404Signals?: Soft404Signals;
  urlAnalysis?: UrlAnalysis;
  canonicalMismatch?: boolean;
  redirectChain?: RedirectChain;
  contentHash?: string;
}
