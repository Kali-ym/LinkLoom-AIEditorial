import type { ToolPayload } from '../../../../domain/types/tool';
import { hasBuiltinRender } from './Render/registry';
import { hasBuiltinStreaming } from './Streaming/registry';
import { resolveToolApiName, resolveToolIdentifier } from './toolArgsUtils';

export function getToolSettingsSchema(tool: ToolPayload): Record<string, unknown> | undefined {
  const schema = tool.settingsSchema;
  if (!schema || Object.keys(schema).length === 0) return undefined;
  return schema;
}

export function isToolSettingsSchemaNonEmpty(schema?: Record<string, unknown>): boolean {
  if (!schema) return false;
  if (schema.type === 'object' && schema.properties) {
    return Object.keys(schema.properties as object).length > 0;
  }
  return Object.keys(schema).length > 0;
}

export function hasStreamingRenderer(tool: ToolPayload): boolean {
  if (tool.hasStreamingRenderer != null) return tool.hasStreamingRenderer;
  return hasBuiltinStreaming(resolveToolIdentifier(tool), resolveToolApiName(tool));
}

export function canToggleCustomToolRender(tool: ToolPayload): boolean {
  const intervention = tool.intervention?.status;
  if (intervention === 'pending' || tool.state === 'rejected' || tool.state === 'aborted') {
    return false;
  }
  if (tool.hasBuiltinRender === false) return false;
  const identifier = resolveToolIdentifier(tool);
  const apiName = resolveToolApiName(tool);
  if (hasBuiltinRender(identifier, apiName)) return true;
  if (hasStreamingRenderer(tool)) return true;
  return Boolean(
    tool.hasBuiltinRender ??
      (tool.state === 'success' && !tool.hidePortal && Boolean(tool.resultText || tool.plugin)),
  );
}

export function resolveRenderDisplayControl(
  tool: ToolPayload,
): 'collapsed' | 'expand' | 'alwaysExpand' {
  return tool.renderDisplayControl ?? (tool.state === 'executing' ? 'expand' : 'collapsed');
}
