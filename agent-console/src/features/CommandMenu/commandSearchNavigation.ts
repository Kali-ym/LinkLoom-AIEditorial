import type { CommandSearchResult } from './types';
import { agentConsoleChatPath } from '../../constants/agentConsoleRoutes';
import { getSettingsRoutePath } from '../../adapters/navigableRoutes';
import { openPortalView } from '../Portal/portalActions';

export interface CommandSearchNavigationDeps {
  navigate: (path: string) => void;
  newTopic: () => void;
  onFallback: (result: CommandSearchResult) => void;
  openWorkingSidebar: (options?: {
    tab?: 'space' | 'review' | 'files' | 'params';
    resourceFilter?: 'skills' | 'documents' | 'web';
  }) => void;
  selectTopic: (topicId: string) => void;
  setActiveAgentId: (agentId: string) => void;
}

const STATIC_SEARCH_ACTION_IDS = new Set([
  'action-resource',
  'action-memory',
  'action-page',
  'action-settings',
  'action-new-topic',
]);

export function isStaticSearchAction(result: Pick<CommandSearchResult, 'id'>): boolean {
  return STATIC_SEARCH_ACTION_IDS.has(result.id);
}

function resolveStaticSearchAction(
  result: CommandSearchResult,
  deps: CommandSearchNavigationDeps,
): boolean {
  switch (result.id) {
    case 'action-resource':
    case 'action-memory':
    case 'action-page':
      deps.navigate('/knowledge');
      return true;
    case 'action-settings':
      deps.navigate(getSettingsRoutePath());
      return true;
    case 'action-new-topic':
      deps.newTopic();
      return true;
    default:
      return false;
  }
}

function resolveFilePreviewPath(result: CommandSearchResult): string {
  const description = result.description?.trim();
  if (description && !description.endsWith('/')) return description;
  return result.identifier?.trim() || result.id;
}

/** Cmd+K 搜索结果选中后的导航 — api / mock 共用。 */
export function applyCommandSearchSelection(
  result: CommandSearchResult,
  deps: CommandSearchNavigationDeps,
): void {
  if (resolveStaticSearchAction(result, deps)) return;

  switch (result.type) {
    case 'topic':
      deps.selectTopic(result.id);
      if (result.agentId) {
        deps.navigate(agentConsoleChatPath(result.agentId, result.id));
      }
      return;
    case 'agent':
    case 'chatGroup':
      deps.setActiveAgentId(result.id);
      return;
    case 'message':
      if (result.topicId) deps.selectTopic(result.topicId);
      return;
    case 'knowledgeBase':
      openPortalView('Document', {
        documentId: result.id,
        title: result.title,
        path: result.description ?? result.id,
      });
      return;
    case 'file':
      openPortalView('FilePreview', {
        name: result.title,
        path: resolveFilePreviewPath(result),
      });
      return;
    case 'folder':
      deps.openWorkingSidebar({ tab: 'files' });
      return;
    case 'page':
    case 'memory':
      deps.navigate('/knowledge');
      return;
    case 'plugin':
    case 'mcp':
      deps.openWorkingSidebar({ tab: 'space', resourceFilter: 'skills' });
      return;
    default:
      deps.onFallback(result);
  }
}
