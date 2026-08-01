import { describe, expect, it } from 'vitest';
import { assembleSystemMessages, buildPromptPipelineContext } from '../src/services/agents/prompt/assemble.js';
import { PromptRegistry } from '../src/services/agents/prompt/registry/PromptRegistry.js';
import type { AgentDefinition } from '../src/types/agent.js';

function makeAgentDef(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'test-agent',
    name: '测试Agent',
    description: '',
    systemPrompt: '',
    providerId: 'OPENAI',
    model: 'gpt-4o',
    temperature: 0,
    toolIds: [],
    skillIds: [],
    mcpServerIds: [],
    ...overrides
  } as AgentDefinition;
}

function makeCtxInput(overrides: Record<string, unknown> = {}) {
  return {
    agentDef: makeAgentDef(),
    providerId: 'OPENAI',
    model: 'gpt-4o',
    tools: [],
    skills: [],
    mcpTools: [],
    skillInstructions: '',
    registry: PromptRegistry.getInstance(),
    ...overrides
  };
}

describe('assembleSystemMessages — context providers 集成', () => {
  it('无 context 字段时,动态 date 进入 tailMessages,preUserMessages 为空', () => {
    const ctx = buildPromptPipelineContext(makeCtxInput({ date: '2026-06-26' }));
    const assembled = assembleSystemMessages(ctx);
    expect(assembled.preUserMessages).toEqual([]);
    const tailJoined = assembled.tailMessages.map((m) => m.content).join('\n');
    expect(tailJoined).toContain('2026-06-26');
    expect(tailJoined.includes('<retrieved_knowledge>')).toBe(false);
    expect(tailJoined.includes('<memory>')).toBe(false);
  });

  it('knowledgeContext 注入到 tailMessages,包裹 <retrieved_knowledge>', () => {
    const ctx = buildPromptPipelineContext(
      makeCtxInput({
        date: '2026-06-26',
        knowledgeContext: '[证据 1] [K1]\n文档内容A'
      })
    );
    const assembled = assembleSystemMessages(ctx);
    const knowledgeMsg = assembled.tailMessages.find((m) =>
      m.content.includes('<retrieved_knowledge>')
    );
    expect(knowledgeMsg).toBeDefined();
    expect(knowledgeMsg?.content).toContain('文档内容A');
  });

  it('memoryContext 注入到 tailMessages,包裹 <memory>', () => {
    const ctx = buildPromptPipelineContext(
      makeCtxInput({
        date: '2026-06-26',
        memoryContext: '[记忆 1]\n用户偏好A'
      })
    );
    const assembled = assembleSystemMessages(ctx);
    const memoryMsg = assembled.tailMessages.find((m) => m.content.includes('<memory>'));
    expect(memoryMsg).toBeDefined();
    expect(memoryMsg?.content).toContain('用户偏好A');
  });

  it('todoState 注入到 tailMessages,包裹 <todos>', () => {
    const ctx = buildPromptPipelineContext(
      makeCtxInput({
        date: '2026-06-26',
        todoState: {
          todos: [
            { id: 't1', content: '已完成', completed: true },
            { id: 't2', content: '待办', completed: false }
          ]
        }
      })
    );
    const assembled = assembleSystemMessages(ctx);
    expect(assembled.tailMessages.length).toBeGreaterThan(0);
    const todoMsg = assembled.tailMessages.find((m) => m.content.includes('<todos>'));
    expect(todoMsg).toBeDefined();
    expect(todoMsg?.content).toContain('- [x] 已完成');
    expect(todoMsg?.content).toContain('- [ ] 待办');
  });

  it('三个 context 同时注入时全部进入 tail,stable prefix 不含动态标签', () => {
    const ctx = buildPromptPipelineContext(
      makeCtxInput({
        date: '2026-06-26',
        knowledgeContext: '知识内容',
        memoryContext: '记忆内容',
        todoState: { todos: [{ id: 't1', content: '任务', completed: false }] }
      })
    );
    const assembled = assembleSystemMessages(ctx);
    expect(assembled.preUserMessages).toEqual([]);
    const tailJoined = assembled.tailMessages.map((m) => m.content).join('\n');
    expect(tailJoined).toContain('2026-06-26');
    expect(tailJoined).toContain('<retrieved_knowledge>知识内容</retrieved_knowledge>');
    expect(tailJoined).toContain('<memory>记忆内容</memory>');
    expect(tailJoined).toContain('<todos>');
    expect(assembled.systemMessage.content.includes('<retrieved_knowledge>')).toBe(false);
    expect(assembled.systemMessage.content.includes('<memory>')).toBe(false);
    expect(assembled.systemMessage.content.includes('2026-06-26')).toBe(false);
  });

  it('空字符串 context 字段被 skip(不产生空标签消息)', () => {
    const ctx = buildPromptPipelineContext(
      makeCtxInput({
        date: '2026-06-26',
        knowledgeContext: '   ',
        memoryContext: '',
        todoState: { todos: [] }
      })
    );
    const assembled = assembleSystemMessages(ctx);
    expect(assembled.tailMessages.some((m) => m.content.includes('<retrieved_knowledge>'))).toBe(
      false
    );
    expect(assembled.tailMessages.some((m) => m.content.includes('<memory>'))).toBe(false);
    expect(assembled.tailMessages.some((m) => m.content.includes('<todos>'))).toBe(false);
  });

  it('variables 透传到 ctx.variables', () => {
    const ctx = buildPromptPipelineContext(
      makeCtxInput({ variables: { agentId: 'x', agentName: 'Y' } })
    );
    expect(ctx.variables.agentId).toBe('x');
    expect(ctx.variables.agentName).toBe('Y');
  });
});
