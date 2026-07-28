export type ToolAuthType = 'composio' | 'market';

export interface PendingAuthToolDto {
  id: string;
  label: string;
  avatar: string;
  authType: ToolAuthType;
}

/** Tool ids that require Composio-style OAuth before use. */
export const COMPOSIO_OAUTH_TOOL_IDS = new Set<string>([
  'composio-github',
  'composio-gmail',
  'composio-slack',
]);

export function isComposioOAuthToolId(toolId: string): boolean {
  return COMPOSIO_OAUTH_TOOL_IDS.has(toolId) || toolId.startsWith('composio-');
}

export function toMcpToolKey(mcpId: string): string {
  return `mcp:${mcpId}`;
}

export function isMcpToolKey(toolKey: string): boolean {
  return toolKey.startsWith('mcp:');
}

export function mcpIdFromToolKey(toolKey: string): string | null {
  return isMcpToolKey(toolKey) ? toolKey.slice('mcp:'.length) : null;
}

export function defaultAvatarForAuthType(authType: ToolAuthType): string {
  return authType === 'market' ? '🔌' : '🛠';
}
