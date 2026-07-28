import { describe, expect, it } from 'vitest';
import { KnowledgeContextProvider } from '../src/services/agents/prompt/providers/KnowledgeContextProvider.js';
import { MemoryContextProvider } from '../src/services/agents/prompt/providers/MemoryContextProvider.js';
import { TodoHintProvider } from '../src/services/agents/prompt/providers/TodoHintProvider.js';
import { replaceMessageVariables } from '../src/services/agents/prompt/replaceMessageVariables.js';
import type { PromptBuildContext } from '../src/services/agents/prompt/types.js';

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

describe('KnowledgeContextProvider', () => {
  it('wraps knowledgeContext in <retrieved_knowledge> tag', () => {
    const p = new KnowledgeContextProvider();
    const r = p.build(makeCtx({ knowledgeContext: '[证据 1] [K1]\n内容A' }));
    expect(r?.content).toBe('<retrieved_knowledge>[证据 1] [K1]\n内容A</retrieved_knowledge>');
  });
  it('returns null when no knowledgeContext', () => {
    expect(new KnowledgeContextProvider().build(makeCtx({}))).toBeNull();
  });
  it('returns null for whitespace-only knowledgeContext', () => {
    expect(new KnowledgeContextProvider().build(makeCtx({ knowledgeContext: '   ' }))).toBeNull();
  });
  it('does NOT xml-escape internal content (preserve nested tags)', () => {
    const p = new KnowledgeContextProvider();
    const r = p.build(makeCtx({ knowledgeContext: '<inner>raw</inner>' }));
    expect(r?.content).toBe('<retrieved_knowledge><inner>raw</inner></retrieved_knowledge>');
  });
  it('has id knowledge_context, phase before_first_user, priority 20', () => {
    const p = new KnowledgeContextProvider();
    expect(p.id).toBe('knowledge_context');
    expect(p.phase).toBe('before_first_user');
    expect(p.priority).toBe(20);
  });
});

describe('MemoryContextProvider', () => {
  it('wraps memoryContext in <memory> tag', () => {
    const p = new MemoryContextProvider();
    const r = p.build(makeCtx({ memoryContext: '[记忆 1]\n历史记录A' }));
    expect(r?.content).toBe('<memory>[记忆 1]\n历史记录A</memory>');
  });
  it('returns null when no memoryContext', () => {
    expect(new MemoryContextProvider().build(makeCtx({}))).toBeNull();
  });
  it('returns null for whitespace-only memoryContext', () => {
    expect(new MemoryContextProvider().build(makeCtx({ memoryContext: '  ' }))).toBeNull();
  });
  it('does NOT xml-escape internal content', () => {
    const p = new MemoryContextProvider();
    const r = p.build(makeCtx({ memoryContext: '含 <tag> 的记忆' }));
    expect(r?.content).toBe('<memory>含 <tag> 的记忆</memory>');
  });
  it('has id memory_context, phase before_first_user, priority 30', () => {
    const p = new MemoryContextProvider();
    expect(p.id).toBe('memory_context');
    expect(p.phase).toBe('before_first_user');
    expect(p.priority).toBe(30);
  });
});

describe('TodoHintProvider', () => {
  it('renders todos with completed/incomplete marks inside <todos>', () => {
    const p = new TodoHintProvider();
    const r = p.build(
      makeCtx({
        todoState: {
          todos: [
            { id: 't1', content: '已完成项', completed: true },
            { id: 't2', content: '未完成项', completed: false }
          ]
        }
      })
    );
    expect(r?.content).toContain('<todos>');
    expect(r?.content).toContain('当前任务进度');
    expect(r?.content).toContain('- [x] 已完成项');
    expect(r?.content).toContain('- [ ] 未完成项');
    expect(r?.content).toContain('</todos>');
  });
  it('returns null when no todoState', () => {
    expect(new TodoHintProvider().build(makeCtx({}))).toBeNull();
  });
  it('returns null when todoState has no todos', () => {
    expect(new TodoHintProvider().build(makeCtx({ todoState: {} }))).toBeNull();
  });
  it('returns null when todos array is empty', () => {
    expect(new TodoHintProvider().build(makeCtx({ todoState: { todos: [] } }))).toBeNull();
  });
  it('has id todo_hint, phase tail_guidance, priority 10', () => {
    const p = new TodoHintProvider();
    expect(p.id).toBe('todo_hint');
    expect(p.phase).toBe('tail_guidance');
    expect(p.priority).toBe(10);
  });
});

describe('replaceMessageVariables', () => {
  it('replaces {{var}} occurrences', () => {
    expect(replaceMessageVariables('你好 {{agentName}}', { agentName: 'Copilot' })).toBe(
      '你好 Copilot'
    );
  });
  it('replaces {{ var }} (with spaces)', () => {
    expect(replaceMessageVariables('日期 {{ date }}', { date: '2026-06-26' })).toBe(
      '日期 2026-06-26'
    );
  });
  it('replaces multiple variables', () => {
    expect(
      replaceMessageVariables('{{agentId}}-{{sessionId}}', {
        agentId: 'a1',
        sessionId: 's2'
      })
    ).toBe('a1-s2');
  });
  it('leaves missing variables untouched', () => {
    expect(replaceMessageVariables('你好 {{unknown}}', { agentName: 'A' })).toBe('你好 {{unknown}}');
  });
  it('handles empty content', () => {
    expect(replaceMessageVariables('', { a: 'b' })).toBe('');
  });
  it('handles empty variables', () => {
    expect(replaceMessageVariables('无占位符', {})).toBe('无占位符');
  });
  it('skips non-string variable values', () => {
    expect(replaceMessageVariables('{{a}}', { a: 123 as unknown as string })).toBe('{{a}}');
  });
});
