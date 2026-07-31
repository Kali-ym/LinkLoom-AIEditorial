import type {
  AssembledPromptContribution,
  AssembledMessages,
  PromptBuildContext,
  PromptContribution,
  PromptPhase,
  PromptProvider
} from './types.js';

/**
 * Pipeline 引擎：按 phase + priority 编排 Provider，组装 AssembledMessages。
 * - system_accumulate：累积进 systemMessage（用 \n\n 连接），稳定前缀
 * - before_first_user：作为独立 system 消息插入首条 user 前
 * - tail_guidance：插入消息尾部，动态尾部
 * - message_transform：消息转换（本轮 P1/P2 暂未消费）
 */
export class PromptPipeline {
  constructor(private readonly providers: PromptProvider[]) {}

  build(ctx: PromptBuildContext): AssembledMessages {
    const byPhase = this.groupByPhase();
    const systemParts = this.collect(byPhase, 'system_accumulate', ctx);
    const preUser = this.collect(byPhase, 'before_first_user', ctx);
    const tail = this.collect(byPhase, 'tail_guidance', ctx);
    const contributions = [...systemParts, ...preUser, ...tail];

    return {
      systemMessage: {
        role: 'system',
        content: systemParts.map((item) => item.content).join('\n\n')
      },
      preUserMessages: preUser.map((item) => ({ role: 'system', content: item.content })),
      tailMessages: tail.map((item) => ({ role: 'system', content: item.content })),
      contributions
    };
  }

  private groupByPhase(): Record<PromptPhase, PromptProvider[]> {
    const init: Record<PromptPhase, PromptProvider[]> = {
      system_accumulate: [],
      before_first_user: [],
      tail_guidance: [],
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
        out.push({
          providerId: provider.id,
          phase,
          content: contrib.content,
          cacheClass: contrib.cacheClass ?? defaultCacheClassForPhase(phase),
          variantKey: contrib.variantKey
        });
      }
    }
    return out;
  }
}

function defaultCacheClassForPhase(phase: PromptPhase): AssembledPromptContribution['cacheClass'] {
  return phase === 'system_accumulate' ? 'stable' : 'dynamic';
}
