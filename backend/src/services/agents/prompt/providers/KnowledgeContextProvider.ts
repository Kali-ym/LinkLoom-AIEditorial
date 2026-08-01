import { wrapTagRaw } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/**
 * tail_guidance 阶段注入预检索的知识库上下文。
 * 触发条件:agent 绑定 knowledgeCategoryIds/knowledgeScope(在 AgentService.resolveKnowledgeContext
 * 处判定),检索结果已由 AgentService 异步解析为字符串并写入 ctx.knowledgeContext。
 * 工具 query_knowledge 保留用于追问/synthesis,Provider 只注入 raw evidence chunks。
 * 动态检索结果追加到尾部，避免污染稳定前缀。
 */
export class KnowledgeContextProvider implements PromptProvider {
  id = 'knowledge_context';
  phase = 'tail_guidance' as const;
  priority = 20;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const content = ctx.knowledgeContext?.trim();
    if (!content) return null;
    return {
      content: wrapTagRaw('retrieved_knowledge', content),
      cacheClass: 'dynamic'
    };
  }
}
