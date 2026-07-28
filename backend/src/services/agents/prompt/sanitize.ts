const XML_ESCAPE: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;'
};

export function sanitizeXml(text: string): string {
  return text.replace(/[<>&"']/g, (ch) => XML_ESCAPE[ch] ?? ch);
}

export function wrapTag(
  tag: string,
  content: string,
  attrs?: Record<string, string>
): string {
  if (!content) return '';
  const attrStr = attrs
    ? ' ' +
      Object.entries(attrs)
        .map(([k, v]) => `${k}="${sanitizeXml(v)}"`)
        .join(' ')
    : '';
  return `<${tag}${attrStr}>${sanitizeXml(content)}</${tag}>`;
}

/**
 * 包裹标签但不转义 content。用于包裹已结构化内容(含子标签),如:
 *   <base>...<tool_calling>...</tool_calling>...</base>
 *   <agent_specific>...<role>...</role>...</agent_specific>
 * 与 wrapTag 区别:wrapTag 会把 content 里的 < > 转义,破坏内部子标签结构;
 * wrapTagRaw 假设 content 已是合法 XML 片段,只包裹不转义。
 * 仅属性值仍转义(防属性注入)。
 */
export function wrapTagRaw(
  tag: string,
  content: string,
  attrs?: Record<string, string>
): string {
  if (!content) return '';
  const attrStr = attrs
    ? ' ' +
      Object.entries(attrs)
        .map(([k, v]) => `${k}="${sanitizeXml(v)}"`)
        .join(' ')
    : '';
  return `<${tag}${attrStr}>${content}</${tag}>`;
}
