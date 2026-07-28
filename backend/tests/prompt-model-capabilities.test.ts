import { describe, expect, it } from 'vitest';
import { isCanUseFC, isCanUseVision } from '../src/services/agents/prompt/ModelCapabilities.js';

describe('isCanUseFC', () => {
  it('returns true for OPENAI gpt-4 family', () => {
    expect(isCanUseFC('OPENAI', 'gpt-4o')).toBe(true);
    expect(isCanUseFC('OPENAI', 'gpt-4-turbo')).toBe(true);
    expect(isCanUseFC('OPENAI', 'gpt-3.5-turbo')).toBe(true);
  });
  it('returns true for OPENAI o-series reasoning models', () => {
    expect(isCanUseFC('OPENAI', 'o1')).toBe(true);
    expect(isCanUseFC('OPENAI', 'o1-preview')).toBe(true);
    expect(isCanUseFC('OPENAI', 'o3')).toBe(true);
    expect(isCanUseFC('OPENAI', 'o3-mini')).toBe(true);
    expect(isCanUseFC('OPENAI', 'o4-mini')).toBe(true);
  });
  it('returns true for OPENAI gpt-5 family', () => {
    expect(isCanUseFC('OPENAI', 'gpt-5')).toBe(true);
    expect(isCanUseFC('OPENAI', 'gpt-5-mini')).toBe(true);
    expect(isCanUseFC('OPENAI', 'gpt-5.4')).toBe(true);
  });

  // 回归:OpenAI 兼容网关上的非 GPT 模型也必须走原生 tool_calls
  it('returns true for OpenAI-compatible gateway models (DeepSeek/Qwen/Moonshot/etc.)', () => {
    expect(isCanUseFC('OPENAI', 'deepseek-v4-flash')).toBe(true);
    expect(isCanUseFC('OPENAI', 'deepseek-chat')).toBe(true);
    expect(isCanUseFC('OPENAI', 'deepseek-reasoner')).toBe(true);
    expect(isCanUseFC('OPENAI', 'qwen-max')).toBe(true);
    expect(isCanUseFC('OPENAI', 'qwen-plus')).toBe(true);
    expect(isCanUseFC('OPENAI', 'qwen2.5-72b-instruct')).toBe(true);
    expect(isCanUseFC('OPENAI', 'moonshot-v1-32k')).toBe(true);
    expect(isCanUseFC('OPENAI', 'kimi-k2')).toBe(true);
    expect(isCanUseFC('OPENAI', 'yi-large')).toBe(true);
    expect(isCanUseFC('OPENAI', 'baichuan2-turbo')).toBe(true);
    // 任何未知模型名走 OPENAI provider 也应启用 FC,避免再次出现 选题 Copilot 那种静默吞工具的故障
    expect(isCanUseFC('OPENAI', 'some-future-model-2099')).toBe(true);
  });

  it('returns true for CLAUDE (Anthropic) claude-3 family', () => {
    expect(isCanUseFC('CLAUDE', 'claude-3-5-sonnet')).toBe(true);
    expect(isCanUseFC('CLAUDE', 'claude-3-opus')).toBe(true);
    expect(isCanUseFC('CLAUDE', 'claude-4-opus')).toBe(true);
  });
  it('returns true for GEMINI gemini-1.5+', () => {
    expect(isCanUseFC('GEMINI', 'gemini-1.5-pro')).toBe(true);
    expect(isCanUseFC('GEMINI', 'gemini-2.0-flash')).toBe(true);
  });
  it('returns true for GLM (zhipu)', () => {
    expect(isCanUseFC('GLM', 'glm-4')).toBe(true);
    expect(isCanUseFC('GLM', 'glm-4-flash')).toBe(true);
    expect(isCanUseFC('GLM', 'glm-4.6')).toBe(true);
  });
  it('returns true for OLLAMA models with native FC support', () => {
    expect(isCanUseFC('OLLAMA', 'llama3.1')).toBe(true);
    expect(isCanUseFC('OLLAMA', 'llama3.1:8b')).toBe(true);
    expect(isCanUseFC('OLLAMA', 'llama3.3:70b')).toBe(true);
    expect(isCanUseFC('OLLAMA', 'qwen2.5:7b')).toBe(true);
    expect(isCanUseFC('OLLAMA', 'mistral')).toBe(true);
    expect(isCanUseFC('OLLAMA', 'mistral-nemo:12b')).toBe(true);
    expect(isCanUseFC('OLLAMA', 'llama4-scout')).toBe(true);
    expect(isCanUseFC('OLLAMA', 'firefunction-v2')).toBe(true);
  });
  it('returns false for OLLAMA models without FC support', () => {
    expect(isCanUseFC('OLLAMA', 'llama2')).toBe(false);
    expect(isCanUseFC('OLLAMA', 'gemma2:9b')).toBe(false);
    expect(isCanUseFC('OLLAMA', 'phi3.5:mini')).toBe(false);
  });
  it('returns false for unknown provider', () => {
    expect(isCanUseFC('UNKNOWN', 'some-model')).toBe(false);
  });
  it('returns false for empty', () => {
    expect(isCanUseFC('', '')).toBe(false);
  });
  it('is case-insensitive on input (normalizes to upper)', () => {
    expect(isCanUseFC('openai', 'gpt-4o')).toBe(true);
    expect(isCanUseFC('openai', 'deepseek-v4-flash')).toBe(true);
    expect(isCanUseFC('ollama', 'LLAMA3.1')).toBe(true);
  });
});

describe('isCanUseVision', () => {
  it('returns true for gpt-4o', () => {
    expect(isCanUseVision('OPENAI', 'gpt-4o')).toBe(true);
  });
  it('returns true for claude-3.5-sonnet', () => {
    expect(isCanUseVision('CLAUDE', 'claude-3-5-sonnet')).toBe(true);
  });
  it('returns true for gemini-1.5-pro', () => {
    expect(isCanUseVision('GEMINI', 'gemini-1.5-pro')).toBe(true);
  });
  it('returns false for gpt-3.5-turbo', () => {
    expect(isCanUseVision('OPENAI', 'gpt-3.5-turbo')).toBe(false);
  });
  it('returns false for unknown provider', () => {
    expect(isCanUseVision('UNKNOWN', 'some-model')).toBe(false);
  });
  // 兼容网关上的视觉变体
  it('returns true for OpenAI-compatible vision model variants', () => {
    expect(isCanUseVision('OPENAI', 'qwen-vl-max')).toBe(true);
    expect(isCanUseVision('OPENAI', 'qwen2-vl-72b')).toBe(true);
    expect(isCanUseVision('OPENAI', 'glm-4v')).toBe(true);
    expect(isCanUseVision('OPENAI', 'deepseek-vl')).toBe(true);
    expect(isCanUseVision('OPENAI', 'o1')).toBe(true);
    expect(isCanUseVision('OPENAI', 'o3-mini')).toBe(true);
  });
});
