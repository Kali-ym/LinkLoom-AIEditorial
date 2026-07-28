import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  AssembledMessages,
  FewShotExample,
  PromptPhase,
  PromptProvider,
  StructuredPrompt
} from '../src/services/agents/prompt/types.js';

describe('prompt types', () => {
  it('StructuredPrompt accepts all seven optional fields', () => {
    const p: StructuredPrompt = {
      role: 'r',
      identity: 'i',
      capabilities: 'c',
      constraints: 'cn',
      outputFormat: 'o',
      examples: [{ input: 'a', output: 'b' }],
      modelHints: { google: 'g' }
    };
    expectTypeOf(p).toMatchTypeOf<StructuredPrompt>();
  });

  it('StructuredPrompt accepts empty object', () => {
    const p: StructuredPrompt = {};
    expectTypeOf(p).toMatchTypeOf<StructuredPrompt>();
  });

  it('identity accepts string or docRef object', () => {
    const a: StructuredPrompt = { identity: 'text' };
    const b: StructuredPrompt = { identity: { docRef: 'path.md' } };
    expectTypeOf(a.identity).toEqualTypeOf<string | { docRef: string } | undefined>();
    expectTypeOf(b.identity).toEqualTypeOf<string | { docRef: string } | undefined>();
  });

  it('PromptPhase has 4 values', () => {
    const phases: PromptPhase[] = [
      'system_accumulate',
      'before_first_user',
      'tail_guidance',
      'message_transform'
    ];
    expect(phases).toHaveLength(4);
  });

  it('PromptProvider shape is structurally sound', () => {
    const provider: PromptProvider = {
      id: 'role',
      phase: 'system_accumulate',
      priority: 10,
      build: () => ({ content: '<role>x</role>' })
    };
    expect(provider.id).toBe('role');
    expect(provider.priority).toBe(10);
  });

  it('AssembledMessages has the three message buckets', () => {
    const a: AssembledMessages = {
      systemMessage: { role: 'system', content: 's' },
      preUserMessages: [{ role: 'system', content: 'p' }],
      tailMessages: [{ role: 'system', content: 't' }]
    };
    expect(a.systemMessage.role).toBe('system');
    expect(a.preUserMessages).toHaveLength(1);
    expect(a.tailMessages).toHaveLength(1);
  });

  it('FewShotExample supports optional tags', () => {
    const ex: FewShotExample = { input: 'i', output: 'o', tags: ['daily'] };
    expect(ex.tags).toEqual(['daily']);
  });
});
