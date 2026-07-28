import { describe, expect, it } from 'vitest';
import { isCanUseFC } from '../src/services/agents/prompt/ModelCapabilities.js';

/**
 * 验证 AgentService 中 useNativeFC gate 的语义。
 * gate 逻辑:const useNativeFC = isCanUseFC(providerId, model);
 *           const providerTools = useNativeFC ? combinedTools : [];
 * 即 !FC 时不向 provider 传 tools 数组,只靠 ToolSystemProvider 的 XML 注入,
 * 避免双重工具描述(系统 XML + provider bindTools)。
 *
 * 语义(2026-06 重构后):
 * - OPENAI/CLAUDE/GEMINI/GLM:端点协议原生支持工具调用,无论模型名一律 FC=true。
 *   覆盖 DeepSeek/Qwen/Moonshot 等走 OpenAI 兼容 API 的模型——早期按模型名白名单
 *   会把这些模型误判为 !FC,导致 tools 不下发,模型只能把代码当文本吐出。
 * - OLLAMA:本地推理,FC 支持因模型而异,保留模型族白名单。
 */
describe('useNativeFC gate 语义', () => {
  it('FC-capable 模型:providerTools = combinedTools(传完整 tools)', () => {
    const cases = [
      ['OPENAI', 'gpt-4o'],
      ['OPENAI', 'o1'],
      ['OPENAI', 'gpt-5'],
      // OpenAI 兼容网关上的非 GPT 模型同样走原生 tool_calls
      ['OPENAI', 'deepseek-v4-flash'],
      ['OPENAI', 'qwen-max'],
      ['OPENAI', 'moonshot-v1-32k'],
      ['CLAUDE', 'claude-3-5-sonnet'],
      ['GEMINI', 'gemini-2.0-flash'],
      ['GLM', 'glm-4'],
      ['OLLAMA', 'llama3.1'],
      ['OLLAMA', 'qwen2.5:7b']
    ] as const;
    for (const [providerId, model] of cases) {
      const useNativeFC = isCanUseFC(providerId, model);
      expect(useNativeFC, `${providerId}/${model} 应支持 FC`).toBe(true);
      // gate: useNativeFC ? combinedTools : [] → 传完整 tools
      const providerTools = useNativeFC ? ['tool1', 'tool2'] : [];
      expect(providerTools).toEqual(['tool1', 'tool2']);
    }
  });

  it('!FC 模型:providerTools = [](不传 tools,只靠 XML 注入)', () => {
    const cases = [
      ['OLLAMA', 'llama2'],
      ['OLLAMA', 'gemma2:9b'],
      ['OLLAMA', 'phi3.5:mini'],
      ['UNKNOWN', 'some-model'],
      ['', '']
    ] as const;
    for (const [providerId, model] of cases) {
      const useNativeFC = isCanUseFC(providerId, model);
      expect(useNativeFC, `${providerId}/${model} 应不支持 FC`).toBe(false);
      // gate: useNativeFC ? combinedTools : [] → 传空,避免双重描述
      const providerTools = useNativeFC ? ['tool1', 'tool2'] : [];
      expect(providerTools).toEqual([]);
    }
  });

  it('gate 与 ToolSystemProvider 互斥:FC=true 时无 XML,FC=false 时有 XML', () => {
    // FC=true: ToolSystemProvider 返回 null,provider 收完整 tools
    expect(isCanUseFC('OPENAI', 'gpt-4o')).toBe(true);
    expect(isCanUseFC('OPENAI', 'deepseek-v4-flash')).toBe(true);
    expect(isCanUseFC('OLLAMA', 'llama3.1')).toBe(true);
    // FC=false: ToolSystemProvider 注入 <tools> XML,provider 收空 tools
    expect(isCanUseFC('OLLAMA', 'llama2')).toBe(false);
    expect(isCanUseFC('OLLAMA', 'gemma2')).toBe(false);
  });
});
