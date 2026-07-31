import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

export class RoleProvider implements PromptProvider {
  id = 'role';
  phase = 'system_accumulate' as const;
  priority = 10;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const role = ctx.structuredPrompt.role?.trim();
    if (!role) return null;
    return { content: wrapTag('role', role), cacheClass: 'stable' };
  }
}
