import { wrapTagRaw } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/**
 * before_first_user 阶段注入预检索的知识库上下文。
 * 触发条件:agent 绑定 knowledgeCategoryIds/knowledgeScope(在 AgentService.resolveKnowledgeContext
 * 处判定),检索结果已由 AgentService 异步解析为字符串并写入 ctx.knowledgeContext。
 * 工具 query_knowledge 保留用于追问/synthesis,Provider 只注入 raw evidence chunks。
 */
export class KnowledgeContextProvider implements PromptProvider {
  id = 'knowledge_context';
  phase = 'before_first_user' as const;
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
