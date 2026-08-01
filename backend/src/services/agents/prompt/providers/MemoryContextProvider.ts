import { wrapTagRaw } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/**
 * tail_guidance 阶段注入预检索的记忆上下文。
 * 触发条件:agent 绑定 memoryCategoryIds 且 chatConfig.memory.enabled !== false
 * (在 AgentService.resolveMemoryContext 处判定),检索结果已由 AgentService 异步解析为字符串
 * 并写入 ctx.memoryContext。工具 query_memory 保留用于追问,Provider 只注入原始片段(非子 Agent 总结)。
 * 动态记忆片段追加到尾部，避免污染稳定前缀。
 */
export class MemoryContextProvider implements PromptProvider {
  id = 'memory_context';
  phase = 'tail_guidance' as const;
  priority = 30;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const content = ctx.memoryContext?.trim();
    if (!content) return null;
    return {
      content: wrapTagRaw('memory', content),
      cacheClass: 'dynamic'
    };
  }
}
