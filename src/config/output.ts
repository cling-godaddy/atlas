import type { IncludeOptions, OutputProfile } from '../types/config';

export type ResolvedIncludeOptions = Required<IncludeOptions>;

const PROFILE_DEFAULTS: Record<OutputProfile, ResolvedIncludeOptions> = {
  minimal: { html: false, text: false, assets: false, structuredData: false },
  standard: { html: false, text: false, assets: true, structuredData: true },
  full: { html: true, text: true, assets: true, structuredData: true },
  catalog: { html: false, text: false, assets: false, structuredData: true },
};

export function resolveIncludeOptions(
  profile: OutputProfile = 'standard',
  overrides?: IncludeOptions,
): ResolvedIncludeOptions {
  return { ...PROFILE_DEFAULTS[profile], ...overrides };
}
