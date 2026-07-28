/** Normalize plugin id for ToolUI portal routing (pure domain helper). */
export function normalizeToolPluginId(plugin?: string): string {
  if (!plugin || plugin === 'web-browsing') return 'linkloom-web-browsing';
  return plugin;
}
