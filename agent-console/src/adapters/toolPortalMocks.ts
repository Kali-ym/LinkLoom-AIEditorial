import type { PortalViewPayload } from '../domain/types/portalView';
import type {
  CrawlMultiPageState,
  CrawlPageResult,
  SearchPortalState,
  VerifyPlanPortalState,
} from '../domain/types/toolPortal';

const MOCK_SEARCH_RESULTS = [
  {
    title: '示例更新页',
    url: 'https://docs.example.com/changelog',
    snippet: 'Component library updates for @lobehub/ui 5.x…',
    score: 0.92,
  },
  {
    title: 'Agent Console',
    url: 'https://github.com/example/app',
    snippet: 'Open-source AI agent framework with plugin system.',
    score: 0.81,
  },
  {
    title: 'LinkLoom Design Docs',
    url: 'https://example.com/linkloom/design',
    snippet: 'COMPONENT-INVENTORY and Agent Console workflow.',
    score: 0.74,
  },
];

const MOCK_CRAWL_PAGE: CrawlPageResult = {
  url: 'https://github.com/example/ui-lib',
  title: 'ui-lib',
  description: 'React component library 示例描述.',
  siteName: 'GitHub',
  content:
    '# ui-lib\n\nModern React components with antd-style theming.\n\n## Features\n\n- Chat primitives\n- Editor integration',
  rawContent: '# ui-lib\n\nModern React components...',
  wordCount: 1280,
  crawler: 'jina',
};

export const MOCK_VERIFY_PLAN: VerifyPlanPortalState = {
  rubricId: 'rubric-demo',
  rubricName: '交付验收标准',
  maxRepairRounds: 2,
  items: [
    {
      criterionId: 'c1',
      title: '首页可访问',
      description: '生产环境首页返回 200 且包含产品标题',
      instruction: '打开 https://app.example.com 并确认标题包含 LinkLoom',
      required: true,
      verifierType: 'llm',
      onFail: 'auto_repair',
    },
    {
      criterionId: 'c2',
      title: 'Agent 控制台加载',
      description: '控制台路由在 3s 内完成首屏',
      instruction: '导航至 /console，检查 ChatHeader 与输入区渲染',
      required: true,
      verifierType: 'agent',
      onFail: 'manual',
    },
    {
      criterionId: 'c3',
      title: '分享链接有效',
      description: '分享模态可生成可访问链接',
      required: false,
      verifierType: 'llm',
      onFail: 'auto_repair',
    },
  ],
};

export function normalizeToolPluginId(plugin?: string): string {
  if (!plugin || plugin === 'web-browsing') return 'linkloom-web-browsing';
  return plugin;
}

export function resolveSearchState(payload: PortalViewPayload): SearchPortalState {
  const fromState = payload.pluginState as SearchPortalState | undefined;
  if (fromState?.results?.length) return fromState;
  const query = String(payload.args?.query ?? '');
  if (payload.state === 'executing' || payload.pending) {
    return { loading: true, results: [] };
  }
  return {
    loading: false,
    results: MOCK_SEARCH_RESULTS.map((r) => ({
      ...r,
      title: query ? `${r.title} · ${query}` : r.title,
    })),
  };
}

export function resolveCrawlResult(payload: PortalViewPayload): CrawlPageResult {
  const state = payload.pluginState as { results?: CrawlPageResult[] } | undefined;
  const url = String(payload.args?.url ?? payload.url ?? MOCK_CRAWL_PAGE.url);
  const fromState = state?.results?.find((r) => r.url === url) ?? state?.results?.[0];
  if (fromState) return fromState;
  return {
    ...MOCK_CRAWL_PAGE,
    url,
    content: payload.result || MOCK_CRAWL_PAGE.content,
    title: payload.title || MOCK_CRAWL_PAGE.title,
  };
}

export function resolveCrawlMultiState(payload: PortalViewPayload): CrawlMultiPageState {
  const state = (payload.pluginState as CrawlMultiPageState) ?? {};
  const urls = (payload.args?.urls as string[] | undefined) ?? [
    'https://github.com/example/ui-lib',
    'https://docs.example.com/changelog',
  ];
  const results =
    state.results ??
    urls.map((url, i) => ({
      ...MOCK_CRAWL_PAGE,
      url,
      title: `页面 ${i + 1}`,
    }));
  return {
    results,
    activePageContentUrl: state.activePageContentUrl ?? results[0]?.url,
  };
}

export function resolveVerifyPlanState(payload: PortalViewPayload): VerifyPlanPortalState {
  const fromState = payload.pluginState as VerifyPlanPortalState | undefined;
  if (fromState?.items?.length) return fromState;
  return MOCK_VERIFY_PLAN;
}
