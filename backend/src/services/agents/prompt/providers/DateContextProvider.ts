import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/**
 * tail_guidance 阶段注入当前处理日期。
 * 动态日期不得进入稳定 system 前缀，否则会破坏 prompt/KV cache。
 */
export class DateContextProvider implements PromptProvider {
  id = 'date_context';
  phase = 'tail_guidance' as const;
  priority = 10;

  build(ctx: PromptBuildContext): PromptContribution | null {
    if (!ctx.date) return null;
    return {
      content: `<context>当前处理日期为: ${ctx.date}</context>`,
      cacheClass: 'dynamic'
    };
  }
}
