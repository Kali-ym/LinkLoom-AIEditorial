import { safeParsePartialJSON } from '../../../../../../utils/safeParsePartialJSON';

export function parsePluginJson<T>(content?: string | null, pluginState?: unknown): T | undefined {
  if (pluginState && typeof pluginState === 'object') return pluginState as T;
  if (!content?.trim()) return undefined;
  try {
    return JSON.parse(content) as T;
  } catch {
    return safeParsePartialJSON(content) as T;
  }
}
