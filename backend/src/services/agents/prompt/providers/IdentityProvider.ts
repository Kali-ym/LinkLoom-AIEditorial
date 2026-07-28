import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

export class IdentityProvider implements PromptProvider {
  id = 'identity';
  phase = 'system_accumulate' as const;
  priority = 20;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const identity = ctx.structuredPrompt.identity;
    if (!identity) return null;
    // docRef 预留：本轮仅支持字符串，docRef 解析留待后续
    if (typeof identity === 'string') {
      const trimmed = identity.trim();
      if (!trimmed) return null;
      return { content: wrapTag('identity', trimmed) };
    }
    return null;
  }
}
