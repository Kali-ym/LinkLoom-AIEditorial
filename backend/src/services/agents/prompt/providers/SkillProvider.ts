import type { SkillMetadata } from '../../../../types/skill.js';
import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/** SkillService 的最小接口（结构化子集，便于测试 mock） */
export interface SkillServiceLike {
  listSkillMetadata(skillIds?: string[]): SkillMetadata[];
}

function formatSkillMetadataBlock(metadata: SkillMetadata[]): string {
  if (metadata.length === 0) return '';
  const sections = metadata.map(
    (skill) =>
      `### Skill: ${skill.name}\nID: ${skill.id}\nDescription: ${skill.description}`
  );
  return [
    '## Available Skills',
    '',
    'The following skills are active for this turn. Use read_skill / list_skill to load full instructions when needed.',
    '',
    ...sections,
  ].join('\n');
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

    const metadata =
      ctx.skillMetadata ??
      (skillIds.length ? this.skillService.listSkillMetadata(skillIds) : []);
    if (metadata.length === 0) return null;

    const prompt = formatSkillMetadataBlock(metadata);
    if (!prompt.trim()) return null;
    return {
      content: wrapTag('available_skills', prompt.trim()),
      cacheClass: 'variant',
    };
  }
}
