/**
 * 判定模型是否支持原生 function calling。
 *
 * 设计原则：FC 能力按「provider 端点协议」判定,而非按模型名白名单。
 * - OPENAI / CLAUDE / GEMINI / GLM：均为远程商业或 OpenAI/Anthropic 兼容 API,
 *   工具调用是端点协议层面的能力（/chat/completions 的 tools、/responses 的 function 工具、
 *   /messages 的 tool_use、Gemini 的 bindTools、GLM 的 tools 字段）。只要走这些 provider,
 *   无论底层是 GPT、DeepSeek、Qwen、Moonshot、Claude、Gemini 还是 GLM,都应走原生 tool_calls。
 *   早期按模型名白名单 gate 会把 DeepSeek-v4 / Qwen-Max 等兼容模型误判为 !FC,导致 tools 不下发,
 *   模型只能把代码当文本吐出而无法触发工具执行（见 选题 Copilot 闰年脚本案例）。
 * - OLLAMA：本地推理,同一端点可挂任意模型,FC 支持因模型而异,故保留模型族白名单。
 *   未列出的本地模型保守返回 false,走 ToolSystemProvider 的 XML 注入兜底。
 *
 * providerId 取 AIProviderConfig.type 的大写枚举值（OPENAI/CLAUDE/GEMINI/GLM/OLLAMA）。
 */
export function isCanUseFC(providerId: string, model: string): boolean {
  const p = (providerId || '').toUpperCase();
  const m = (model || '').toLowerCase();
  if (!p || !m) return false;
  // 远程商业 / 兼容 API:端点协议原生支持工具调用,与具体模型名无关
  if (p === 'OPENAI' || p === 'CLAUDE' || p === 'GEMINI' || p === 'GLM') {
    return true;
  }
  if (p === 'OLLAMA') {
    // 支持 FC 的 Ollama 模型族;保守匹配,未列出的走 system 注入
    return /llama-?3\.[13]|llama-?4|qwen2\.?5|mistral|firefunction/.test(m);
  }
  return false;
}

/**
 * 判定模型是否支持视觉输入。
 *
 * 视觉能力是模型属性而非端点协议属性,故仍按模型名匹配。
 * OPENAI 类下涵盖官方 GPT-4o/4-turbo/4-vision 及其 o 系列多模态,以及常见 OpenAI 兼容
 * 网关上的视觉模型（如 qwen-vl、glm-4v、deepseek-vl 等以 vl/vision/vl- 命名的变体）。
 */
export function isCanUseVision(providerId: string, model: string): boolean {
  const p = (providerId || '').toUpperCase();
  const m = (model || '').toLowerCase();
  if (!p || !m) return false;
  if (p === 'OPENAI') {
    return (
      /gpt-4o|gpt-4-turbo|gpt-4-vision/.test(m) ||
      /^o[134]/.test(m) ||
      /-vl$|-vl-|vision|glm-4v|qwen-?vl/.test(m)
    );
  }
  if (p === 'CLAUDE') return /claude-3|claude-4/.test(m);
  if (p === 'GEMINI') return /gemini-?[12]/.test(m);
  if (p === 'GLM') return /glm-4v/.test(m);
  return false;
}
