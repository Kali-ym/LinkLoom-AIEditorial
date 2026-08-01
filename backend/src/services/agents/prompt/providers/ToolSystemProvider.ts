import type { ToolDefinition } from '../../../../types/agent.js';
import {
  canonicalizeToolDefinitions,
  sortToolDefinitions,
  stableStringify
} from '../../engine/canonicalMessageSerializer.js';
import { isCanUseFC } from '../ModelCapabilities.js';
import { wrapTag } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/**
 * !isCanUseFC 时的工具描述兜底：把工具描述注入 system prompt（XML 标签式）。
 * 支持 FC 的模型走 bindTools 原生 tool_calls，本 Provider 返回 null。
 */
export class ToolSystemProvider implements PromptProvider {
  id = 'tool_system';
  // Non-native tool descriptions are request-dependent variant content.
  phase = 'variant_accumulate' as const;
  priority = 40;

  build(ctx: PromptBuildContext): PromptContribution | null {
    if (isCanUseFC(ctx.providerId, ctx.model)) return null;
    const tools: ToolDefinition[] = sortToolDefinitions([...ctx.tools, ...ctx.mcpTools]);
    if (tools.length === 0) return null;
    const inner = tools
      .map((t) => wrapTag('tool', t.description || 'no description', { name: t.name }))
      .join('\n');
    return {
      content: `<tools description="The tools you can use below">\n${inner}\n</tools>`,
      cacheClass: 'variant',
      variantKey: stableStringify(canonicalizeToolDefinitions(tools))
    };
  }
}
