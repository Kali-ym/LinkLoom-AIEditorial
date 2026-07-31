import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

export class ExamplesProvider implements PromptProvider {
  id = 'examples';
  phase = 'system_accumulate' as const;
  priority = 60;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const examples = ctx.structuredPrompt.examples;
    if (!examples || examples.length === 0) return null;
    const inner = examples
      .map((ex) => `<example>\n${wrapTag('input', ex.input)}\n${wrapTag('output', ex.output)}\n</example>`)
      .join('\n');
    return { content: `<examples>\n${inner}\n</examples>`, cacheClass: 'stable' };
  }
}
