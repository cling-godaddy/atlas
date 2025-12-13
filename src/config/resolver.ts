import { defaults } from './defaults';
import { profiles } from './profiles';
import { crawlConfigSchema, resolvedConfigSchema } from './schema';

import type { CrawlConfig, ResolvedConfig } from '../types/index';

export function resolveConfig(input: CrawlConfig): ResolvedConfig {
  const validatedInput = crawlConfigSchema.parse(input);

  const profileConfig = validatedInput.profile ? profiles[validatedInput.profile] : {};

  const resolved = {
    ...defaults,
    ...profileConfig,
    ...validatedInput,
  };

  return resolvedConfigSchema.parse(resolved) as ResolvedConfig;
}
