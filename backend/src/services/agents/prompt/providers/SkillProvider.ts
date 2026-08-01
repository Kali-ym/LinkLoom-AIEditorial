import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/** SkillService 的最小接口（结构化子集，便于测试 mock） */
export interface SkillServiceLike {
  buildSkillsPrompt(skillIds: string[]): string;
}

export class SkillProvider implements PromptProvider {
  id = 'skill';
  // Skill catalogs are request-scoped variant content, not stable system prefix.
  phase = 'variant_accumulate' as const;
  priority = 70;

  constructor(private readonly skillService: SkillServiceLike) {}

  build(ctx: PromptBuildContext): PromptContribution | null {
    const skillIds = ctx.agentDef.skillIds;
    if (!skillIds || skillIds.length === 0) return null;
    // 优先用预生成的 instructions（AgentService.buildTurnSkillInstructions 已生成）
    const prompt = ctx.skillInstructions ?? this.skillService.buildSkillsPrompt(skillIds);
    if (!prompt || !prompt.trim()) return null;
    return {
      content: wrapTag('available_skills', prompt.trim()),
      cacheClass: 'variant'
    };
  }
}
