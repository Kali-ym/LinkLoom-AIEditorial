import { describe, expect, it } from 'vitest';
import { PromptPipeline } from '../src/services/agents/prompt/PromptPipeline.js';
import type {
  PromptBuildContext,
  PromptContribution,
  PromptProvider
} from '../src/services/agents/prompt/types.js';

function makeCtx(overrides: Partial<PromptBuildContext> = {}): PromptBuildContext {
  return {
    agentDef: {
      id: 'a',
      name: 'A',
      description: '',
      systemPrompt: '',
      providerId: 'OPENAI',
      model: 'gpt-4o',
      temperature: 0,
      toolIds: [],
      skillIds: [],
      mcpServerIds: []
    } as never,
    structuredPrompt: {},
    tools: [],
    skills: [],
    mcpTools: [],
    providerId: 'OPENAI',
    model: 'gpt-4o',
    variables: {},
    ...overrides
  };
}

function provider(
  id: string,
  phase: PromptProvider['phase'],
  priority: number,
  content: string,
  cacheClass?: PromptContribution['cacheClass']
): PromptProvider {
  return {
    id,
    phase,
    priority,
    build: (): PromptContribution => ({ content, cacheClass })
  };
}

describe('PromptPipeline', () => {
  it('accumulates system_accumulate providers by priority with \\n\\n join', () => {
    const pipeline = new PromptPipeline([
      provider('b', 'system_accumulate', 20, 'B'),
      provider('a', 'system_accumulate', 10, 'A'),
      provider('c', 'system_accumulate', 30, 'C')
    ]);
    const result = pipeline.build(makeCtx());
    expect(result.systemMessage.content).toBe('A\n\nB\n\nC');
    expect(result.variantMessages).toEqual([]);
  });

  it('skips providers that return null', () => {
    const pipeline = new PromptPipeline([
      provider('a', 'system_accumulate', 10, 'A'),
      { id: 'skip', phase: 'system_accumulate', priority: 20, build: () => null },
      provider('c', 'system_accumulate', 30, 'C')
    ]);
    const result = pipeline.build(makeCtx());
    expect(result.systemMessage.content).toBe('A\n\nC');
  });

  it('skips providers that return empty content', () => {
    const pipeline = new PromptPipeline([
      provider('a', 'system_accumulate', 10, 'A'),
      provider('empty', 'system_accumulate', 20, ''),
      provider('c', 'system_accumulate', 30, 'C')
    ]);
    const result = pipeline.build(makeCtx());
    expect(result.systemMessage.content).toBe('A\n\nC');
  });

  it('collects variant_accumulate providers into variantMessages', () => {
    const pipeline = new PromptPipeline([
      provider('skill', 'variant_accumulate', 10, 'SKILL', 'variant'),
      provider('hint', 'variant_accumulate', 20, 'HINT', 'variant')
    ]);
    const result = pipeline.build(makeCtx());
    expect(result.systemMessage.content).toBe('');
    expect(result.variantMessages).toEqual([
      { role: 'system', content: 'SKILL' },
      { role: 'system', content: 'HINT' }
    ]);
  });

  it('rejects dynamic contributions', () => {
    expect(
      () =>
        new PromptPipeline([
          {
            id: 'invalid-dynamic',
            phase: 'variant_accumulate',
            priority: 1,
            build: () => ({ content: 'dynamic', cacheClass: 'dynamic' })
          }
        ]).build({} as PromptBuildContext)
    ).toThrow('dynamic_prompt_provider_not_allowed');
  });

  it('empty pipeline produces empty system message', () => {
    const pipeline = new PromptPipeline([]);
    const result = pipeline.build(makeCtx());
    expect(result.systemMessage.content).toBe('');
    expect(result.variantMessages).toEqual([]);
  });

  it('filters providers by phase correctly', () => {
    const pipeline = new PromptPipeline([
      provider('role', 'system_accumulate', 10, 'ROLE'),
      provider('skill', 'variant_accumulate', 10, 'SKILL', 'variant')
    ]);
    const result = pipeline.build(makeCtx());
    expect(result.systemMessage.content).toBe('ROLE');
    expect(result.variantMessages).toHaveLength(1);
  });

  it('preserves contribution metadata in priority order', () => {
    const pipeline = new PromptPipeline([
      provider('role', 'system_accumulate', 10, 'ROLE', 'stable'),
      provider('skill', 'variant_accumulate', 10, 'SKILL', 'variant')
    ]);
    const result = pipeline.build(makeCtx());
    expect(result.contributions).toEqual([
      {
        providerId: 'role',
        phase: 'system_accumulate',
        content: 'ROLE',
        cacheClass: 'stable'
      },
      {
        providerId: 'skill',
        phase: 'variant_accumulate',
        content: 'SKILL',
        cacheClass: 'variant'
      }
    ]);
  });
});
