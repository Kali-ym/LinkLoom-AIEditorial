export type RagModeId = 'fts' | 'hybrid' | 'hybrid-rerank' | 'custom';

export type RagModePresetPatch = {
  hybridEnabled: boolean;
  rerankEnabled: boolean;
  embedOnIngest: boolean;
  jsonbVectorFallbackEnabled?: boolean;
};

export function detectRagMode(config: Record<string, unknown>): RagModeId {
  const hybrid = config.hybridEnabled === true;
  const rerank = config.rerankEnabled === true;
  const embedOnIngest = config.embedOnIngest === true;

  if (!hybrid && !rerank) return 'fts';
  if (hybrid && !rerank && embedOnIngest) return 'hybrid';
  if (hybrid && rerank && embedOnIngest) return 'hybrid-rerank';
  return 'custom';
}

export function applyModePreset(mode: Exclude<RagModeId, 'custom'>): RagModePresetPatch {
  if (mode === 'fts') {
    return { hybridEnabled: false, rerankEnabled: false, embedOnIngest: false };
  }
  if (mode === 'hybrid') {
    return {
      hybridEnabled: true,
      rerankEnabled: false,
      embedOnIngest: true,
      jsonbVectorFallbackEnabled: true
    };
  }
  return {
    hybridEnabled: true,
    rerankEnabled: true,
    embedOnIngest: true,
    jsonbVectorFallbackEnabled: true
  };
}

export function modeLabel(mode: RagModeId): string {
  if (mode === 'fts') return '全文检索';
  if (mode === 'hybrid') return '混合检索';
  if (mode === 'hybrid-rerank') return '混合检索 + 精排';
  return '自定义组合';
}
