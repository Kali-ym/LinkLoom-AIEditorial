import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/**
 * before_first_user 阶段注入当前处理日期。
 * 取代现状的「system 尾部 + 正则切分」脆弱做法：日期作为独立 system 消息
 * 插入首条 user 前，stable prefix 完全不被日期污染，prefix cache 友好。
 */
export class DateContextProvider implements PromptProvider {
  id = 'date_context';
  phase = 'before_first_user' as const;
  priority = 10;

  build(ctx: PromptBuildContext): PromptContribution | null {
    if (!ctx.date) return null;
    return { content: `<context>当前处理日期为: ${ctx.date}</context>` };
  }
}
