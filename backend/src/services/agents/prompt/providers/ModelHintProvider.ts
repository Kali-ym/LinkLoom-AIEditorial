import type { WebSearchEffectiveMode } from '../../search/types.js';
import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

function webSearchHint(mode: WebSearchEffectiveMode): string | null {
  switch (mode) {
    case 'off':
      return '本轮未开启联网搜索，请勿调用任何网页相关工具。';
    case 'app':
      return '使用 web_search 搜索；已知 URL 用 crawl_pages（可传 url 或 urls）。';
    case 'provider':
      return '优先用 google_search 获取实时信息，用 url_context 读网页；勿调用 web_search。';
    default:
      return null;
  }
}

/**
 * per-model 提示注入：
 * 1. agent 自定义 modelHints[providerId]
 * 2. 联网搜索策略提示（由 webSearchPolicy.effectiveMode 触发）
 * 3. Claude thinking 提示（由 providerConfig.reasoningEffort 触发）
 * 4. Gemini thinking 提示（由 providerConfig.thinkingConfig 触发，若存在）
 */
export class ModelHintProvider implements PromptProvider {
  id = 'model_hint';
  phase = 'system_accumulate' as const;
  priority = 80;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const providerId = (ctx.providerId || '').toUpperCase();
    const hints: string[] = [];

    // 1. agent 自定义 modelHints[providerId]
    const custom = ctx.structuredPrompt.modelHints?.[providerId];
    if (custom) hints.push(custom);

    // 2. 联网搜索策略提示
    const searchMode = ctx.webSearchPolicy?.effectiveMode;
    if (searchMode) {
      const hint = webSearchHint(searchMode);
      if (hint) hints.push(hint);
    }

    // 3. 内置 Claude thinking 提示（由 providerConfig.reasoningEffort 控制）
    if (providerId === 'CLAUDE') {
      const reasoningEffort = (ctx.providerConfig as { reasoningEffort?: string } | undefined)
        ?.reasoningEffort;
      if (reasoningEffort && reasoningEffort !== 'none') {
        hints.push('你可以使用扩展思考（extended thinking）处理复杂推理任务。');
      }
    }

    // 4. 内置 Gemini thinking 提示（由 providerConfig.thinkingConfig 控制，若存在）
    if (providerId === 'GEMINI') {
      const thinkingConfig = (ctx.providerConfig as { thinkingConfig?: unknown } | undefined)
        ?.thinkingConfig;
      if (thinkingConfig) {
        hints.push('你可以使用思考模式处理复杂推理任务。');
      }
    }

    if (hints.length === 0) return null;
    return { content: hints.map((h) => wrapTag('model_hint', h)).join('\n') };
  }
}
