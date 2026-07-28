import { describe, expect, it } from 'vitest';
import { applyModePreset, detectRagMode } from './retrieveModeUtils';

describe('retrieveModeUtils', () => {
  it('detects fts mode', () => {
    expect(detectRagMode({ hybridEnabled: false, rerankEnabled: false })).toBe('fts');
  });

  it('detects hybrid mode', () => {
    expect(detectRagMode({ hybridEnabled: true, rerankEnabled: false, embedOnIngest: true })).toBe(
      'hybrid'
    );
  });

  it('detects hybrid-rerank mode', () => {
    expect(
      detectRagMode({ hybridEnabled: true, rerankEnabled: true, embedOnIngest: true })
    ).toBe('hybrid-rerank');
  });

  it('detects custom when embedOnIngest diverges', () => {
    expect(
      detectRagMode({ hybridEnabled: true, rerankEnabled: false, embedOnIngest: false })
    ).toBe('custom');
  });

  it('applyModePreset writes expected fields for hybrid-rerank', () => {
    expect(applyModePreset('hybrid-rerank')).toEqual({
      hybridEnabled: true,
      rerankEnabled: true,
      embedOnIngest: true,
      jsonbVectorFallbackEnabled: true
    });
  });
});
