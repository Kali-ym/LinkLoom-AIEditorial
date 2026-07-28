/**
 * StructuredPrompt:与后端 backend/src/services/agents/prompt/types.ts 镜像。
 * 七字段扁平分节对象,通过 PromptRegistry 渲染时展开 {{#fragment:xxx}} 引用。
 */

export interface FewShotExample {
  input: string;
  output: string;
  /** 可选:示例适用场景标签 */
  tags?: string[];
}

/** per-model 提示:按 providerId 写特定提示语 */
export interface ModelHints {
  [providerId: string]: string;
}

export interface StructuredPrompt {
  /** 角色定位:一句话说明「你是谁、做什么」 */
  role?: string;
  /** 身份人设:更详细的人格/语气/立场;支持 docRef 引用共享片段 */
  identity?: string | { docRef: string };
  /** 能力说明:agent 能做什么、擅长什么、可用工具的高层提示 */
  capabilities?: string;
  /** 行为约束/规则:must/must-not、边界、安全规则 */
  constraints?: string;
  /** 输出格式要求:结构、长度、语言、JSON schema 等 */
  outputFormat?: string;
  /** few-shot 示例 */
  examples?: FewShotExample[];
  /** per-model 提示 */
  modelHints?: ModelHints;
}

/** 类型守卫:判断 systemPrompt 是结构化对象还是字符串 */
export function isStructuredPrompt(value: unknown): value is StructuredPrompt {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    // 至少含一个 StructuredPrompt 已知字段,避免把任意对象误判
    ('role' in value ||
      'identity' in value ||
      'capabilities' in value ||
      'constraints' in value ||
      'outputFormat' in value ||
      'examples' in value ||
      'modelHints' in value)
  );
}

/** 把 StructuredPrompt 转成可读的字符串预览(供旧展示路径兜底) */
export function structuredPromptToPreviewString(prompt: StructuredPrompt): string {
  const parts: string[] = [];
  if (prompt.role) parts.push(prompt.role);
  if (typeof prompt.identity === 'string' && prompt.identity) parts.push(prompt.identity);
  return parts.join('\n\n');
}
