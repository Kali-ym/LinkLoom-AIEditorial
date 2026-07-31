import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

export class CapabilitiesProvider implements PromptProvider {
  id = 'capabilities';
  phase = 'system_accumulate' as const;
  priority = 30;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const capabilities = ctx.structuredPrompt.capabilities?.trim();
    if (!capabilities) return null;
    return { content: wrapTag('capabilities', capabilities), cacheClass: 'stable' };
  }
}
