import type { PortalViewPayload } from '../../domain/types/portalView';
import type {
  CrawlMultiPageState,
  CrawlPageResult,
  SearchPortalState,
  VerifyPlanPortalState,
} from '../../domain/types/toolPortal';

function readPluginState<T>(payload: PortalViewPayload): T | undefined {
  return payload.pluginState as T | undefined;
}

/** api 模式：仅使用 message / stream 已写入 payload 的 ToolUI 状态，不注入 fixture。 */
export function resolveSearchState(payload: PortalViewPayload): SearchPortalState {
  const fromState = readPluginState<SearchPortalState>(payload);
  if (fromState?.results?.length) return fromState;
  if (payload.state === 'executing' || payload.pending) {
    return { loading: true, results: [] };
  }
  return { loading: false, results: [] };
}

export function resolveCrawlResult(payload: PortalViewPayload): CrawlPageResult {
  const state = readPluginState<{ results?: CrawlPageResult[] }>(payload);
  const url = String(payload.args?.url ?? payload.url ?? '');
  const fromState = state?.results?.find((r) => r.url === url) ?? state?.results?.[0];
  if (fromState) return fromState;

  const resultText = typeof payload.result === 'string' ? payload.result : '';
  return {
    url: url || 'about:blank',
    title: payload.title || url || '页面内容',
    description: '',
    content: resultText,
    rawContent: resultText,
    wordCount: resultText ? resultText.split(/\s+/).length : 0,
  };
}

export function resolveCrawlMultiState(payload: PortalViewPayload): CrawlMultiPageState {
  const state = readPluginState<CrawlMultiPageState>(payload) ?? {};
  if (state.results?.length) {
    return {
      results: state.results,
      activePageContentUrl: state.activePageContentUrl ?? state.results[0]?.url,
    };
  }
  return { results: [], activePageContentUrl: undefined };
}

export function resolveVerifyPlanState(payload: PortalViewPayload): VerifyPlanPortalState {
  const fromState = readPluginState<VerifyPlanPortalState>(payload);
  if (fromState?.items?.length) return fromState;
  return { rubricId: '', rubricName: '', maxRepairRounds: 0, items: [] };
}
