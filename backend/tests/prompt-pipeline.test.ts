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
  content: string
): PromptProvider {
  return {
    id,
    phase,
    priority,
    build: (): PromptContribution => ({ content })
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
    expect(result.preUserMessages).toEqual([]);
    expect(result.tailMessages).toEqual([]);
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

  it('collects before_first_user providers into preUserMessages', () => {
    const pipeline = new PromptPipeline([
      provider('date', 'before_first_user', 10, 'DATE'),
      provider('kb', 'before_first_user', 20, 'KB')
    ]);
    const result = pipeline.build(makeCtx());
    expect(result.systemMessage.content).toBe('');
    expect(result.preUserMessages).toEqual([
      { role: 'system', content: 'DATE' },
      { role: 'system', content: 'KB' }
    ]);
  });

  it('collects tail_guidance providers into tailMessages', () => {
    const pipeline = new PromptPipeline([
      provider('todo', 'tail_guidance', 10, 'TODO')
    ]);
    const result = pipeline.build(makeCtx());
    expect(result.tailMessages).toEqual([{ role: 'system', content: 'TODO' }]);
  });

  it('empty pipeline produces empty system message', () => {
    const pipeline = new PromptPipeline([]);
    const result = pipeline.build(makeCtx());
    expect(result.systemMessage.content).toBe('');
    expect(result.preUserMessages).toEqual([]);
    expect(result.tailMessages).toEqual([]);
  });

  it('filters providers by phase correctly', () => {
    const pipeline = new PromptPipeline([
      provider('role', 'system_accumulate', 10, 'ROLE'),
      provider('date', 'before_first_user', 10, 'DATE'),
      provider('todo', 'tail_guidance', 10, 'TODO')
    ]);
    const result = pipeline.build(makeCtx());
    expect(result.systemMessage.content).toBe('ROLE');
    expect(result.preUserMessages).toHaveLength(1);
    expect(result.tailMessages).toHaveLength(1);
  });
});
