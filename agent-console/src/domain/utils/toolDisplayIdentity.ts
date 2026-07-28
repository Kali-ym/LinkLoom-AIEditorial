import type { ToolPayload } from '../types/tool';

/** Tool has enough identity to render (not the plugin › api placeholder). */
export function hasResolvableToolIdentity(tool: ToolPayload): boolean {
  if (tool.customTitle?.trim() || tool.hitlKind) return true;
  return Boolean(
    tool.identifier?.trim() ||
      tool.apiName?.trim() ||
      tool.plugin?.trim() ||
      tool.api?.trim() ||
      tool.linkloomToolId?.trim(),
  );
}

export function filterResolvableTools(tools: ToolPayload[]): ToolPayload[] {
  return tools.filter(hasResolvableToolIdentity);
}
