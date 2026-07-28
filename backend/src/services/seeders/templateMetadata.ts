import { createHash } from 'crypto';

export type TemplateMetadata = {
  templateSource?: string;
  templateVersion?: number;
  templateHash?: string;
  customized?: boolean;
  updatedAt?: string;
  [key: string]: unknown;
};

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'metadata')
      .sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, val]) => [key, stableNormalize(val)]));
  }
  return value;
}

export function computeTemplateHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stableNormalize(value)))
    .digest('hex');
}

export function withTemplateMetadata<T extends Record<string, unknown>>(
  value: T,
  source: string,
  version = 1
): T & { metadata: TemplateMetadata } {
  return {
    ...value,
    metadata: {
      ...(value.metadata || {}),
      templateSource: source,
      templateVersion: version,
      templateHash: computeTemplateHash(value),
      customized: false
    }
  };
}

export function markCustomized<T extends Record<string, unknown>>(
  value: T
): T & { metadata: TemplateMetadata } {
  return {
    ...value,
    metadata: {
      ...(value.metadata || {}),
      customized: true,
      updatedAt: new Date().toISOString()
    }
  };
}
