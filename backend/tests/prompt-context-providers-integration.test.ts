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

describe('assembleSystemMessages — static/variant boundary', () => {
  it('默认组装不包含自动检索标签', () => {
    const ctx = buildPromptPipelineContext(makeCtxInput());
    const assembled = assembleSystemMessages(ctx);
    const variantJoined = assembled.variantMessages.map((message) => message.content).join('\n');
    expect(variantJoined.includes('<retrieved_knowledge>')).toBe(false);
    expect(variantJoined.includes('<memory>')).toBe(false);
    expect(variantJoined.includes('<todos>')).toBe(false);
    expect(assembled.systemMessage.content.includes('<retrieved_knowledge>')).toBe(false);
    expect(assembled.systemMessage.content.includes('<memory>')).toBe(false);
  });

  it('skill instructions 进入 variantMessages 而非 systemMessage', () => {
    const ctx = buildPromptPipelineContext(
      makeCtxInput({
        agentDef: makeAgentDef({ skillIds: ['s1'] }),
        skillInstructions: '## Available Skills\n### Skill: s1'
      })
    );
    const assembled = assembleSystemMessages(ctx);
    expect(assembled.systemMessage.content).not.toContain('<available_skills>');
    expect(assembled.variantMessages.map((message) => message.content).join('\n')).toContain(
      '<available_skills>'
    );
  });

  it('variables 透传到 ctx.variables', () => {
    const ctx = buildPromptPipelineContext(
      makeCtxInput({ variables: { agentId: 'x', agentName: 'Y' } })
    );
    expect(ctx.variables.agentId).toBe('x');
    expect(ctx.variables.agentName).toBe('Y');
  });
});
