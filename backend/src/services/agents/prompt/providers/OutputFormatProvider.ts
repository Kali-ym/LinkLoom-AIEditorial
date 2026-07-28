import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

export class OutputFormatProvider implements PromptProvider {
  id = 'output_format';
  phase = 'system_accumulate' as const;
  priority = 50;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const outputFormat = ctx.structuredPrompt.outputFormat?.trim();
    if (!outputFormat) return null;
    return { content: wrapTag('output_format', outputFormat) };
  }
}
