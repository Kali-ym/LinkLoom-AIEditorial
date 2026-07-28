/**
 * 当轮 user 输入的变量替换:把 content 里的 {{var}} / {{ var }} 替换为 variables[var]。
 * 缺失变量原样保留(不报错),与 PromptRegistry.templateEngine 的纯变量替换语义一致,
 * 但不引入 fragment 语法({{#fragment:xxx}})。
 */
export function replaceMessageVariables(
  content: string,
  variables: Record<string, string>
): string {
  if (!content) return content;
  let text = content;
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value !== 'string') continue;
    text = text.split(`{{${key}}}`).join(value);
    text = text.split(`{{ ${key} }}`).join(value);
  }
  return text;
}
