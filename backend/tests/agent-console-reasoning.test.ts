import { describe, expect, it } from 'vitest';
import type { AgentDefinition } from '../src/types/agent.js';
import type { AIProviderConfig } from '../src/types/config.js';
import {
  resolveGeminiThinkingConfig,
  resolveReasoningEffort,
} from '../src/services/agents/managers/AgentGovernanceManager.js';
import { mergeAgentConsoleRuntimeMetadata } from '../src/services/agents/AgentService.js';

function agentWithConsole(chatConfig: Record<string, unknown>, params?: Record<string, unknown>): AgentDefinition {
  return {
    id: 'agent-1',
    name: 'Test',
    providerId: 'default-openai',
    model: 'gpt-5.5',
    metadata: {
      agentConsole: {
        chatConfig,
        params: params ?? {},
      },
    },
  } as AgentDefinition;
}

describe('agent console reasoning gates', () => {
  const providerWithEffort: AIProviderConfig = {
    id: 'default-openai',
    name: 'OpenAI',
    type: 'OPENAI',
    apiUrl: 'https://api.example.com',
    apiKey: 'sk-test',
    models: ['gpt-5.5'],
    enabled: true,
    useProxy: false,
    reasoningEffort: 'high',
  };

  it('does not inherit provider reasoningEffort when console disables reasoning', () => {
    const agent = agentWithConsole({
      enableReasoning: false,
      enableReasoningEffort: false,
    });

    expect(resolveReasoningEffort(agent, providerWithEffort)).toBeUndefined();
  });

  it('uses console reasoning effort when reasoning is enabled', () => {
    const agent = agentWithConsole({ enableReasoning: true }, { reasoning_effort: 'low' });

    expect(resolveReasoningEffort(agent, providerWithEffort)).toBe('low');
  });

  it('supports max reasoning effort', () => {
    const agent = agentWithConsole({ enableReasoning: true }, { reasoning_effort: 'max' });

    expect(resolveReasoningEffort(agent, providerWithEffort)).toBe('max');
  });

  it('falls back to provider reasoningEffort when no console chatConfig exists', () => {
    const agent = {
      id: 'agent-1',
      name: 'Test',
      providerId: 'default-openai',
      model: 'gpt-5.5',
    } as AgentDefinition;

    expect(resolveReasoningEffort(agent, providerWithEffort)).toBe('high');
  });

  it('does not auto-enable Gemini thinking when console reasoning is off', () => {
    const agent = agentWithConsole({
      enableReasoning: false,
      enableReasoningEffort: false,
      thinking: 'auto',
    });
    agent.model = 'gemini-2.5-flash';

    expect(resolveGeminiThinkingConfig(agent)).toBeUndefined();
  });

  it('strips persisted agentConsole when run omits runtime console metadata', () => {
    const agent = {
      id: 'agent-1',
      name: 'Test',
      metadata: {
        agentConsole: {
          chatConfig: { enableReasoning: true },
          params: { reasoning_effort: 'high' },
        },
      },
    } as AgentDefinition;

    const effective = mergeAgentConsoleRuntimeMetadata(agent, {});
    expect(effective.metadata?.agentConsole).toBeUndefined();
    expect(resolveReasoningEffort(effective, providerWithEffort)).toBe('high');
  });

  it('merges session runtime provider/model over stored agent defaults (resume path)', () => {
    const agent = {
      id: 'super_admin',
      name: '超级管理员',
      providerId: 'ahg-openai',
      model: 'gpt-5.5',
    } as AgentDefinition;

    const effective = mergeAgentConsoleRuntimeMetadata(agent, {
      agentId: 'super_admin',
      agentConsole: {
        provider: 'ai-eh811',
        model: 'deepseek-v4-flash',
        chatConfig: { enableReasoning: false },
        params: {},
      },
    });

    expect(effective.providerId).toBe('ai-eh811');
    expect(effective.model).toBe('deepseek-v4-flash');
  });

  it('merges runtime console metadata over persisted agent defaults', () => {
    const agent = {
      id: 'agent-1',
      name: 'Test',
      metadata: {
        agentConsole: {
          chatConfig: { enableReasoning: true },
          params: { reasoning_effort: 'high' },
        },
      },
    } as AgentDefinition;

    const effective = mergeAgentConsoleRuntimeMetadata(agent, {
      agentConsole: {
        chatConfig: { enableReasoning: false },
        params: { reasoning_effort: 'low' },
      },
    });

    expect(resolveReasoningEffort(effective, providerWithEffort)).toBeUndefined();
  });
});
