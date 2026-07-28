import { LogService } from '../../LogService.js';
import {
  CRAWL_TOOL_IDS,
  WEB_BROWSING_TOOL_IDS,
  type WebSearchPolicy,
} from './types.js';

function readSearchMode(chatConfig?: Record<string, unknown>): 'off' | 'auto' {
  const mode = chatConfig?.searchMode;
  // Default off: workflow / admin agents without console chatConfig must not get web tools injected.
  // Console explicitly sets searchMode: 'auto' when the user enables search.
  return mode === 'auto' ? 'auto' : 'off';
}

function readUseModelBuiltinSearch(chatConfig?: Record<string, unknown>): boolean {
  return chatConfig?.useModelBuiltinSearch === true;
}

function supportsProviderBuiltinSearch(providerType: string): boolean {
  return providerType.toUpperCase() === 'GEMINI';
}

export function resolveWebSearchPolicy(
  chatConfig: Record<string, unknown> | undefined,
  providerType: string,
): WebSearchPolicy {
  const allWebTools = [...WEB_BROWSING_TOOL_IDS];
  const crawlTools = [...CRAWL_TOOL_IDS];

  if (readSearchMode(chatConfig) === 'off') {
    return {
      effectiveMode: 'off',
      injectToolIds: [],
      stripToolIds: allWebTools,
      enableProviderBuiltinSearch: false,
      degradedFromProvider: false,
    };
  }

  if (readUseModelBuiltinSearch(chatConfig) && supportsProviderBuiltinSearch(providerType)) {
    return {
      effectiveMode: 'provider',
      injectToolIds: crawlTools,
      stripToolIds: ['web_search'],
      enableProviderBuiltinSearch: true,
      degradedFromProvider: false,
    };
  }

  if (readUseModelBuiltinSearch(chatConfig) && !supportsProviderBuiltinSearch(providerType)) {
    LogService.info(
      `[WebSearchPolicy] provider mode requested but provider=${providerType} → degraded to app search`,
    );
    return {
      effectiveMode: 'app',
      injectToolIds: allWebTools,
      stripToolIds: [],
      enableProviderBuiltinSearch: false,
      degradedFromProvider: true,
    };
  }

  return {
    effectiveMode: 'app',
    injectToolIds: allWebTools,
    stripToolIds: [],
    enableProviderBuiltinSearch: false,
    degradedFromProvider: false,
  };
}

export function applyWebSearchPolicy(
  toolIds: Set<string>,
  policy: WebSearchPolicy,
): Set<string> {
  const next = new Set(toolIds);
  for (const id of policy.stripToolIds) next.delete(id);
  for (const id of policy.injectToolIds) next.add(id);
  return next;
}
