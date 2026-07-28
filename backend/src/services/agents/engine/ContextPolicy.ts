export type ContextCompactionStrategy = 'none' | 'trim' | 'summarize' | 'hybrid';

export interface ContextArtifactPolicy {
  enabled: boolean;
  maxInlineBytes?: number;
  previewBytes?: number;
  includeSourceRefs?: boolean;
}

export interface ContextPolicy {
  maxMessages?: number;
  maxInputTokens?: number;
  reserveOutputTokens?: number;
  compactionBuffer?: number;
  compactionStrategy?: ContextCompactionStrategy;
  summarizeOlderThanMessages?: number;
  artifactPolicy?: ContextArtifactPolicy;
  memoryCategoryIds?: string[];
  memorySaveCategoryIds?: string[];
  knowledgeCategoryIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface ContextBuildResult {
  messages: unknown[];
  compacted: boolean;
  summary?: string;
  artifactIds?: string[];
  metadata?: Record<string, unknown>;
}