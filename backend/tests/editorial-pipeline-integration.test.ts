import { describe, expect, it } from 'vitest';
import {
  assembleSystemMessages,
  buildPromptPipelineContext
} from '../src/services/agents/prompt/index.js';
import { EDITORIAL_PROMPTS } from '../src/services/editorial/editorialPrompts.js';
import { PromptRegistry } from '../src/services/agents/prompt/registry/PromptRegistry.js';
import { loadPromptAssetsFromDir } from '../src/services/agents/prompt/registry/FragmentLoader.js';
import type { AgentDefinition } from '../src/types/agent.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptsDir = path.join(__dirname, '..', 'src', 'prompts');

async function makeLoadedRegistry(): Promise<PromptRegistry> {
  const reg = new (class extends PromptRegistry {})();
  const assets = await loadPromptAssetsFromDir(promptsDir);
  for (const frag of assets.fragments) reg.registerFragment(frag);
  for (const tpl of assets.templates) reg.registerTemplate(tpl);
  return reg;
}

function makeAgent(prompt: AgentDefinition['systemPrompt']): AgentDefinition {
  return {
    id: 'test',
    name: 'Test',
    description: '',
    systemPrompt: prompt,
    providerId: 'OPENAI',
    model: 'gpt-4o',
    temperature: 0,
    toolIds: [],
    skillIds: [],
    mcpServerIds: []
  };
}

describe('wrapper architecture: base + agent_specific', () => {
  it('system message is wrapped as <base>...</base><agent_specific>...</agent_specific>', async () => {
    const registry = await makeLoadedRegistry();
    const ctx = buildPromptPipelineContext({
      agentDef: makeAgent(EDITORIAL_PROMPTS.topic_copilot),
      providerId: 'OPENAI',
      providerConfig: { type: 'OPENAI' } as never,
      model: 'gpt-4o',
      tools: [],
      skills: [],
      mcpTools: [],
      skillInstructions: '',
      registry
    });
    const assembled = assembleSystemMessages(ctx);
    const sys = assembled.systemMessage.content;

    // base 段在前
    expect(sys).toContain('<base>');
    expect(sys).toContain('</base>');
    // agent_specific 段在后,包裹应用字段
    expect(sys).toContain('<agent_specific>');
    expect(sys).toContain('</agent_specific>');
    // base 段在 agent_specific 段之前
    expect(sys.indexOf('<base>')).toBeLessThan(sys.indexOf('<agent_specific>'));
  });

  it('base layer contains universal discipline (tool_calling/fact_safety/react_loop)', async () => {
    const registry = await makeLoadedRegistry();
    const ctx = buildPromptPipelineContext({
      agentDef: makeAgent(EDITORIAL_PROMPTS.topic_copilot),
      providerId: 'OPENAI',
      providerConfig: { type: 'OPENAI' } as never,
      model: 'gpt-4o',
      tools: [],
      skills: [],
      mcpTools: [],
      skillInstructions: '',
      registry
    });
    const assembled = assembleSystemMessages(ctx);
    const baseIdx = assembled.systemMessage.content.indexOf('<base>');
    const baseCloseIdx = assembled.systemMessage.content.indexOf('</base>');
    const baseSegment = assembled.systemMessage.content.slice(baseIdx, baseCloseIdx);

    expect(baseSegment).toContain('工具调用纪律');
    expect(baseSegment).toContain('事实安全');
    expect(baseSegment).toContain('ReAct 循环纪律');
    expect(baseSegment).toContain('输出效率');
    expect(baseSegment).toContain('任务完成纪律');
    expect(baseSegment).toContain('格式规范');
  });

  it('agent_specific layer contains only application-specific content, no universal fragments', async () => {
    const registry = await makeLoadedRegistry();
    const ctx = buildPromptPipelineContext({
      agentDef: makeAgent(EDITORIAL_PROMPTS.topic_copilot),
      providerId: 'OPENAI',
      providerConfig: { type: 'OPENAI' } as never,
      model: 'gpt-4o',
      tools: [],
      skills: [],
      mcpTools: [],
      skillInstructions: '',
      registry
    });
    const assembled = assembleSystemMessages(ctx);
    const sys = assembled.systemMessage.content;
    // 真正的包裹标签:</base> 之后的 <agent_specific>...</agent_specific>
    const afterBaseClose = sys.slice(sys.indexOf('</base>') + '</base>'.length);
    const specOpenIdx = afterBaseClose.indexOf('<agent_specific>');
    const specCloseIdx = afterBaseClose.indexOf('</agent_specific>');
    expect(specOpenIdx).toBeGreaterThanOrEqual(0);
    expect(specCloseIdx).toBeGreaterThan(specOpenIdx);
    const specSegment = afterBaseClose.slice(specOpenIdx, specCloseIdx);

    // 应用专属内容存在
    expect(specSegment).toContain('选题 Copilot');
    expect(specSegment).toContain('选题专属约束');
    expect(specSegment).toContain('角度评估四维度');
    // 通用片段正文不应在 agent_specific 内(它们在 base 里)
    // 检查 base 的标志性具体规则,而非泛词(应用层可能提及"base"字样)
    expect(specSegment).not.toContain('一次回复中可调用多个工具');
    expect(specSegment).not.toContain('不要编造未检索到的事实');
    expect(specSegment).not.toContain('{{#fragment:');
  });

  it('editorial agents share the same base layer content', async () => {
    const registry = await makeLoadedRegistry();
    const bases: string[] = [];
    for (const prompt of Object.values(EDITORIAL_PROMPTS)) {
      const ctx = buildPromptPipelineContext({
        agentDef: makeAgent(prompt),
        providerId: 'OPENAI',
        providerConfig: { type: 'OPENAI' } as never,
        model: 'gpt-4o',
        tools: [],
        skills: [],
        mcpTools: [],
        skillInstructions: '',
        registry
      });
      const assembled = assembleSystemMessages(ctx);
      const sys = assembled.systemMessage.content;
      const baseSeg = sys.slice(sys.indexOf('<base>'), sys.indexOf('</base>'));
      bases.push(baseSeg);
    }
    expect(bases.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < bases.length; i++) {
      expect(bases[i]).toBe(bases[0]);
    }
  });

  it('legacy string systemPrompt also gets base layer wrapping', async () => {
    const registry = await makeLoadedRegistry();
    // 模拟用户自建 agent:旧式字符串 systemPrompt
    const ctx = buildPromptPipelineContext({
      agentDef: makeAgent('你是一个翻译助手'),
      providerId: 'OPENAI',
      providerConfig: { type: 'OPENAI' } as never,
      model: 'gpt-4o',
      tools: [],
      skills: [],
      mcpTools: [],
      skillInstructions: '',
      registry
    });
    const assembled = assembleSystemMessages(ctx);
    const sys = assembled.systemMessage.content;

    // 即使是旧字符串 prompt,也获得 base 层加持
    expect(sys).toContain('<base>');
    expect(sys).toContain('<agent_specific>');
    expect(sys).toContain('你是一个翻译助手');
  });

  it('graceful degradation when base_agent template missing', async () => {
    // 用空 registry(无 base_agent 模板),验证降级:无 base 段,应用字段原样输出
    const emptyReg = new (class extends PromptRegistry {})();
    const ctx = buildPromptPipelineContext({
      agentDef: makeAgent(EDITORIAL_PROMPTS.topic_copilot),
      providerId: 'OPENAI',
      providerConfig: { type: 'OPENAI' } as never,
      model: 'gpt-4o',
      tools: [],
      skills: [],
      mcpTools: [],
      skillInstructions: '',
      registry: emptyReg
    });
    const assembled = assembleSystemMessages(ctx);
    const sys = assembled.systemMessage.content;

    // 无 base 段(降级),但应用字段仍出现
    expect(sys).not.toContain('<base>');
    expect(sys).toContain('选题 Copilot');
  });
});
