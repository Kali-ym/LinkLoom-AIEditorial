import { describe, expect, it } from 'vitest';
import {
  buildGovernanceChip,
  buildQualityChip,
  buildRegressionChip,
  parsePlatformSection,
  summarizeLatestBatch
} from './platformStatusUtils';

describe('parsePlatformSection', () => {
  it('defaults to governance', () => {
    expect(parsePlatformSection(null)).toBe('governance');
    expect(parsePlatformSection('invalid')).toBe('governance');
  });

  it('accepts valid sections', () => {
    expect(parsePlatformSection('quality')).toBe('quality');
    expect(parsePlatformSection('regression')).toBe('regression');
  });
});

describe('buildGovernanceChip', () => {
  it('warns when pending permissions exist', () => {
    const chip = buildGovernanceChip(
      {
        policyVersion: 'v1',
        toolCount: 1,
        askCount: 1,
        denyCount: 0,
        allowCount: 0,
        pendingPermissions: 2,
        externalContentGuardEnabled: true,
        outputValidationEnabled: true,
        matrix: []
      },
      false
    );
    expect(chip.tone).toBe('warn');
    expect(chip.href).toBe('/ops?tab=inbox');
  });
});

describe('buildQualityChip', () => {
  it('warns when disabled', () => {
    const chip = buildQualityChip(
      {
        enabled: false,
        sourceBlacklist: [],
        sourceWhitelist: [],
        minAiScore: 0,
        blockedTiers: [],
        demoteLowTier: false
      },
      false
    );
    expect(chip.tone).toBe('warn');
  });
});

describe('buildRegressionChip', () => {
  it('warns on failed runs', () => {
    const chip = buildRegressionChip(
      [{ sampleId: '1', sampleName: 'a', agentId: 'x', runId: 'r', passed: false, outputPreview: '', mismatches: [], createdAt: new Date().toISOString() }],
      false
    );
    expect(chip.tone).toBe('warn');
  });
});

describe('summarizeLatestBatch', () => {
  it('groups runs within one minute', () => {
    const now = Date.now();
    const result = summarizeLatestBatch([
      { sampleId: '1', sampleName: 'a', agentId: 'x', runId: 'r1', passed: true, outputPreview: '', mismatches: [], createdAt: new Date(now).toISOString() },
      { sampleId: '2', sampleName: 'b', agentId: 'x', runId: 'r2', passed: false, outputPreview: '', mismatches: ['x'], createdAt: new Date(now + 1000).toISOString() }
    ]);
    expect(result).toEqual({ passed: 1, total: 2 });
  });
});
