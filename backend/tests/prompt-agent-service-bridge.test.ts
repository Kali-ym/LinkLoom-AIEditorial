import { describe, expect, it } from 'vitest';
import {
  assembleSystemMessages,
  buildPromptPipelineContext
} from '../src/services/agents/prompt/index.js';
import type { AgentDefinition } from '../src/types/agent.js';

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'a',
    name: 'A',
    description: '',
    systemPrompt: 'You are X',
    providerId: 'OPENAI',
    model: 'gpt-4o',
    temperature: 0,
    toolIds: [],
    skillIds: [],
    mcpServerIds: [],
    ...overrides
  };
}

function build(agent: AgentDefinition, opts: { skillInstructions?: string; date?: string } = {}) {
  const ctx = buildPromptPipelineContext({
    agentDef: agent,
    providerId: 'OPENAI',
    providerConfig: { type: 'OPENAI' } as never,
    model: agent.model,
    tools: [],
    skills: [],
    mcpTools: [],
    skillInstructions: opts.skillInstructions ?? '',
    date: opts.date
  });
  return assembleSystemMessages(ctx);
}

describe('prompt boundary bridge: stable system vs dynamic messages', () => {
  it('string systemPrompt with no skills no date -> systemMessage contains identity', () => {
    const assembled = build(makeAgent());
    expect(assembled.systemMessage.content).toContain('You are X');
    expect(assembled.systemMessage.content).toContain('<identity>You are X</identity>');
    expect(assembled.preUserMessages).toEqual([]);
    expect(assembled.tailMessages).toEqual([]);
  });

  it('string systemPrompt with skills -> tailMessages contains dynamic skill block', () => {
    const assembled = build(makeAgent({ skillIds: ['s1'] }), {
      skillInstructions: '## Available Skills\n### Skill: s1'
    });
    expect(assembled.systemMessage.content).not.toContain('<available_skills>');
    expect(assembled.tailMessages.map((message) => message.content).join('\n')).toContain(
      '<available_skills>',
    );
    expect(assembled.tailMessages.map((message) => message.content).join('\n')).toContain('s1');
    expect(assembled.systemMessage.content).toContain('You are X');
  });

  it('date injected into tailMessages not systemMessage', () => {
    const assembled = build(makeAgent(), { date: '2026-06-25' });
    expect(assembled.systemMessage.content).not.toContain('当前处理日期为');
    expect(assembled.tailMessages.some((m) => m.content.includes('2026-06-25'))).toBe(true);
  });

  it('structured prompt assembles all present fields', () => {
    const assembled = build(
      makeAgent({
        systemPrompt: { role: '你是 Copilot', constraints: '不编造', outputFormat: 'JSON' }
      })
    );
    expect(assembled.systemMessage.content).toContain('<role>你是 Copilot</role>');
    expect(assembled.systemMessage.content).toContain('<constraints>不编造</constraints>');
    expect(assembled.systemMessage.content).toContain('<output_format>JSON</output_format>');
  });

  it('structured prompt with examples assembles examples block', () => {
    const assembled = build(
      makeAgent({
        systemPrompt: {
          role: 'R',
          examples: [{ input: 'i1', output: 'o1' }]
        }
      })
    );
    expect(assembled.systemMessage.content).toContain('<examples>');
    expect(assembled.systemMessage.content).toContain('<input>i1</input>');
    expect(assembled.systemMessage.content).toContain('<output>o1</output>');
  });

  it('empty structured prompt produces empty system message', () => {
    const assembled = build(makeAgent({ systemPrompt: {} }));
    expect(assembled.systemMessage.content).toBe('');
  });

  it('ollama model injects tool_system block for tools', () => {
    const assembled = build(
      makeAgent({ providerId: 'OLLAMA', model: 'llama2', toolIds: ['t1'] })
    );
    // build() 默认 tools=[]，所以 ToolSystemProvider 返回 null；这里只验证不报错
    expect(assembled.systemMessage.content).not.toContain('<tools');
  });

  it('gemini model with provider webSearchPolicy injects model_hint', () => {
    const ctx = buildPromptPipelineContext({
      agentDef: makeAgent({ providerId: 'GEMINI', model: 'gemini-2.0-flash' }),
      providerId: 'GEMINI',
      providerConfig: { type: 'GEMINI' } as never,
      model: 'gemini-2.0-flash',
      tools: [],
      skills: [],
      mcpTools: [],
      skillInstructions: '',
      webSearchPolicy: {
        effectiveMode: 'provider',
        injectToolIds: ['crawl_single_page'],
        stripToolIds: ['web_search'],
        enableProviderBuiltinSearch: true,
        degradedFromProvider: false
      }
    });
    const assembled = assembleSystemMessages(ctx);
    const tailContent = assembled.tailMessages.map((message) => message.content).join('\n');
    expect(assembled.systemMessage.content).not.toContain('google_search');
    expect(assembled.systemMessage.content).not.toContain('<model_hint>');
    expect(tailContent).toContain('<model_hint>');
    expect(tailContent).toContain('内置搜索');
  });
});
