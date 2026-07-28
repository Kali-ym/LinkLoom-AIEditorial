import { describe, expect, it } from 'vitest';
import { ModelContextRegistry, resolveContextProfile } from '../src/services/agents/context/ModelContextProfile.js';

describe('ModelContextRegistry', () => {
  it('resolves exact match', () => {
    const reg = new ModelContextRegistry();
    const p = reg.resolve('openai', 'gpt-4o');
    expect(p.theoreticalMax).toBe(128000);
    expect(p.encoding).toBe('o200k_base');
    expect(p.driftMultiplier).toBe(1.1);
  });

  it('falls back to global wildcard for unknown model under provider without wildcard', () => {
    const reg = new ModelContextRegistry();
    const p = reg.resolve('anthropic', 'unknown-claude');
    expect(p.providerId).toBe('*');
    expect(p.driftMultiplier).toBe(1.15);
  });

  it('uses provider wildcard when present', () => {
    const reg = new ModelContextRegistry([
      { providerId: 'anthropic', modelId: '*', theoreticalMax: 200000, maxOutput: 8192, encoding: 'cl100k_base', driftMultiplier: 1.25 },
      { providerId: '*', modelId: '*', theoreticalMax: 200000, maxOutput: 8192, encoding: 'o200k_base', driftMultiplier: 1.15 }
    ]);
    const p = reg.resolve('anthropic', 'unknown-claude');
    expect(p.providerId).toBe('anthropic');
    expect(p.driftMultiplier).toBe(1.25);
  });

  it('falls back to global wildcard for unknown provider', () => {
    const reg = new ModelContextRegistry();
    const p = reg.resolve('unknownprov', 'unknownmodel');
    expect(p.theoreticalMax).toBe(200000);
    expect(p.driftMultiplier).toBe(1.15);
  });

  it('applies maxContextWindow override', () => {
    const reg = new ModelContextRegistry();
    const p = reg.resolve('openai', 'gpt-4o', { maxContextWindow: 50000 });
    expect(p.theoreticalMax).toBe(50000);
  });

  it('applies maxOutput override', () => {
    const p = resolveContextProfile('openai', 'gpt-4o', { maxOutput: 4096 });
    expect(p.maxOutput).toBe(4096);
  });

  it('ignores non-positive overrides', () => {
    const p = resolveContextProfile('openai', 'gpt-4o', { maxContextWindow: 0, maxOutput: -1 });
    expect(p.theoreticalMax).toBe(128000);
    expect(p.maxOutput).toBe(16384);
  });
});
