import type { WebSearchEffectiveMode } from '../../search/types.js';
import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

function webSearchHint(mode: WebSearchEffectiveMode): string | null {
  switch (mode) {
    case 'off':
      return null;
    case 'app':
      return '需要实时外部信息时才使用联网工具；其他问题直接回答。';
    case 'provider':
      return '需要实时外部信息时使用内置搜索；已知 URL 可读取页面。';
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
  // Search/reasoning hints can vary per turn, so keep them in the dynamic tail.
  phase = 'tail_guidance' as const;
  priority = 5;

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
    return {
      content: hints.map((h) => wrapTag('model_hint', h)).join('\n'),
      cacheClass: 'dynamic'
    };
  }
}
