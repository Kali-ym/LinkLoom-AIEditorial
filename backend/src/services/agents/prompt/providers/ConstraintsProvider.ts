import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

export class ConstraintsProvider implements PromptProvider {
  id = 'constraints';
  phase = 'system_accumulate' as const;
  priority = 40;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const constraints = ctx.structuredPrompt.constraints?.trim();
    if (!constraints) return null;
    return { content: wrapTag('constraints', constraints) };
  }
}
