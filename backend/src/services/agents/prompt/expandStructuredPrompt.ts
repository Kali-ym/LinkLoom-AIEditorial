import type { PromptRegistry } from './registry/PromptRegistry.js';
import type { StructuredPrompt, FewShotExample } from './types.js';

/**
 * 把 StructuredPrompt 各字符串字段中嵌入的 {{#fragment:xxx}} 与 {{var}} 占位符
 * 通过 PromptRegistry 展开,返回一个「已展开」的 StructuredPrompt 副本。
 *
 * 设计目的:
 * - RoleProvider / IdentityProvider / ConstraintsProvider 等只做 wrapTag 包标签,
 *   不感知片段引用。预展开发生在 ctx 构建时,Provider 拿到的已是纯文本。
 * - identity 字段若为 { docRef: 'xxx } 形式,直接用 registry.resolve 取正文。
 * - examples 的 input/output 也展开,支持示例中引用片段。
 * - modelHints 按 providerId 展开对应提示。
 *
 * 缺少 registry 时(旧路径或测试 mock)安全降级:返回原对象。
 */
export function expandStructuredPrompt(
  prompt: StructuredPrompt,
  registry: PromptRegistry | undefined,
  variables?: Record<string, string>
): StructuredPrompt {
  if (!registry) return prompt;

  const expand = (text: string | undefined): string | undefined => {
    if (!text) return text;
    if (!text.includes('{{')) return text;
    const result = registry.renderString(text, { variables });
    return result.text;
  };

  // identity 可能是 string 或 { docRef }
  let identity: StructuredPrompt['identity'];
  if (typeof prompt.identity === 'string') {
    identity = expand(prompt.identity);
  } else if (prompt.identity && typeof prompt.identity === 'object' && 'docRef' in prompt.identity) {
    const body = registry.resolve(prompt.identity.docRef);
    identity = body ?? '';
  } else {
    identity = prompt.identity;
  }

  const examples: FewShotExample[] | undefined = prompt.examples?.map((ex) => ({
    input: expand(ex.input) ?? ex.input,
    output: expand(ex.output) ?? ex.output,
    tags: ex.tags
  }));

  const modelHints = prompt.modelHints
    ? Object.fromEntries(
        Object.entries(prompt.modelHints).map(([k, v]) => [k, expand(v) ?? v])
      )
    : undefined;

  return {
    role: expand(prompt.role),
    identity,
    capabilities: expand(prompt.capabilities),
    constraints: expand(prompt.constraints),
    outputFormat: expand(prompt.outputFormat),
    examples,
    modelHints
  };
}
