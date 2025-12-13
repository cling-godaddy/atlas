export interface AuthSignals {
  hasLoginForm: boolean;
  redirectedToAuth: boolean;
  statusCode: number;
  authKeywordsInTitle: boolean;
}

export interface Soft404Signals {
  titleIndicates404: boolean;
  contentIndicates404: boolean;
  suspiciouslyShort: boolean;
}

export interface UrlAnalysis {
  isDynamic: boolean;
  pattern?: string;
  dynamicSegments: string[];
}

export interface RedirectHop {
  url: string;
  status: number;
}

export interface RedirectChain {
  chain: RedirectHop[];
  hasLoop: boolean;
  excessive: boolean;
}
