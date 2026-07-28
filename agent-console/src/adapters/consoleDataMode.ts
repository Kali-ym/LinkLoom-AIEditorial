import type { ToolPayload } from '../domain/types/tool';
import { isAgentConsoleApiMode } from './registry';
import {
  enrichToolPayload as enrichToolPayloadMock,
  enrichToolPayloads as enrichToolPayloadsMock,
  resolvePluginSettingsSchema as resolvePluginSettingsSchemaMock,
} from './mock/pluginSettingsSchema';

/**
 * API 模式：仅透传真实 payload，不注入 mock settingsSchema / showcase 字段。
 * Mock 模式：填充演示用 plugin settings schema。
 */
export function enrichToolPayload(tool: ToolPayload): ToolPayload {
  if (isAgentConsoleApiMode()) return tool;
  return enrichToolPayloadMock(tool);
}

export function enrichToolPayloads(tools: ToolPayload[]): ToolPayload[] {
  if (isAgentConsoleApiMode()) return tools;
  return enrichToolPayloadsMock(tools);
}

/** API 模式不返回 mock plugin manifest；mock 模式返回演示 schema。 */
export function resolvePluginSettingsSchema(pluginId: string | undefined): Record<string, unknown> | undefined {
  if (isAgentConsoleApiMode()) return undefined;
  return resolvePluginSettingsSchemaMock(pluginId);
}
