import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/**
 * per-model 提示注入：
 * 1. agent 自定义 modelHints[providerId]
 * 2. Claude thinking 提示（由 providerConfig.reasoningEffort 触发）
 * 3. Gemini thinking 提示（由 providerConfig.thinkingConfig 触发，若存在）
 *
 * 联网搜索策略等 per-turn 状态由 TurnContextAssembler 写入 runtime metadata。
 */
export class ModelHintProvider implements PromptProvider {
  id = 'model_hint';
  // Search/reasoning hints vary per configuration and belong in variant messages.
  phase = 'variant_accumulate' as const;
  priority = 5;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const providerId = (ctx.providerId || '').toUpperCase();
    const hints: string[] = [];

    // 1. agent 自定义 modelHints[providerId]
    const custom = ctx.structuredPrompt.modelHints?.[providerId];
    if (custom) hints.push(custom);

    // 2. 内置 Claude thinking 提示（由 providerConfig.reasoningEffort 控制）
    if (providerId === 'CLAUDE') {
      const reasoningEffort = (ctx.providerConfig as { reasoningEffort?: string } | undefined)
        ?.reasoningEffort;
      if (reasoningEffort && reasoningEffort !== 'none') {
        hints.push('你可以使用扩展思考（extended thinking）处理复杂推理任务。');
      }
    }

    // 3. 内置 Gemini thinking 提示（由 providerConfig.thinkingConfig 控制，若存在）
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
      cacheClass: 'variant'
    };
  }
}
