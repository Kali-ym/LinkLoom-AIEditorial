import {
  CHAT_PORTAL_TOOL_UI_WIDTH,
  CHAT_PORTAL_WIDTH,
} from '../constants/layoutTokens';
import type { PortalViewType } from '../stores/types';

const TOOL_UI_MIN_VIEWS: ReadonlySet<PortalViewType> = new Set([
  'ToolUI',
  'Artifact',
  'Thread',
]);

/** §B / lobehub Portal.tsx — minWidth by active view type */
export function resolvePortalMinWidth(viewType?: PortalViewType | null): number {
  if (viewType && TOOL_UI_MIN_VIEWS.has(viewType)) {
    return CHAT_PORTAL_TOOL_UI_WIDTH;
  }
  return CHAT_PORTAL_WIDTH;
}
