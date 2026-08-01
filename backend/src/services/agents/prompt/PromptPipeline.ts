import type {
  AssembledPromptContribution,
  AssembledMessages,
  PromptBuildContext,
  PromptContribution,
  PromptPhase,
  PromptProvider
} from './types.js';

const DEPRECATED_PHASES = ['before_first_user', 'tail_guidance'] as const;

/**
 * Pipeline 引擎：按 phase + priority 编排 Provider，组装 AssembledMessages。
 * - system_accumulate：累积进 systemMessage（用 \n\n 连接），稳定前缀
 * - variant_accumulate：作为独立 system 消息收集 variant 内容（Skill/模型 hint/非原生工具说明等）
 * - message_transform：消息转换（本轮 P1/P2 暂未消费）
 *
 * 语义顺序 invariant：stable system → variant messages → conversation。
 * dynamic contribution 不得进入 pipeline 产出，否则会破坏会话级 prompt cache。
 */
export class PromptPipeline {
  constructor(private readonly providers: PromptProvider[]) {
    for (const provider of providers) {
      if (DEPRECATED_PHASES.includes(provider.phase as (typeof DEPRECATED_PHASES)[number])) {
        throw new Error(`deprecated_prompt_phase_not_allowed:${provider.id}:${provider.phase}`);
      }
    }
  }

  build(ctx: PromptBuildContext): AssembledMessages {
    const byPhase = this.groupByPhase();
    const systemParts = this.collect(byPhase, 'system_accumulate', ctx);
    const variantParts = this.collect(byPhase, 'variant_accumulate', ctx);
    const contributions = [...systemParts, ...variantParts];

    return {
      systemMessage: {
        role: 'system',
        content: systemParts.map((item) => item.content).join('\n\n')
      },
      variantMessages: variantParts.map((item) => ({ role: 'system', content: item.content })),
      contributions
    };
  }

  private groupByPhase(): Record<PromptPhase, PromptProvider[]> {
    const init: Record<PromptPhase, PromptProvider[]> = {
      system_accumulate: [],
      variant_accumulate: [],
      message_transform: []
    };
    for (const provider of this.providers) init[provider.phase].push(provider);
    for (const phase of Object.keys(init) as PromptPhase[]) {
      init[phase].sort((a, b) => a.priority - b.priority);
    }
    return init;
  }

  private collect(
    byPhase: Record<PromptPhase, PromptProvider[]>,
    phase: PromptPhase,
    ctx: PromptBuildContext
  ): AssembledPromptContribution[] {
    const out: AssembledPromptContribution[] = [];
    for (const provider of byPhase[phase]) {
      const contrib: PromptContribution | null = provider.build(ctx);
      if (contrib && contrib.content) {
        const cacheClass = contrib.cacheClass ?? defaultCacheClassForPhase(phase);
        if (cacheClass === 'dynamic') {
          throw new Error(`dynamic_prompt_provider_not_allowed:${provider.id}`);
        }
        out.push({
          providerId: provider.id,
          phase,
          content: contrib.content,
          cacheClass,
          variantKey: contrib.variantKey
        });
      }
    }
    return out;
  }
}

function defaultCacheClassForPhase(phase: PromptPhase): AssembledPromptContribution['cacheClass'] {
  return phase === 'system_accumulate' ? 'stable' : 'variant';
}
