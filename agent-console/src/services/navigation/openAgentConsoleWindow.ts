import {
  buildAgentConsoleAbsoluteUrl,
  type AgentConsoleUrlOptions,
} from '../../constants/agentConsoleRoutes';

const NEW_TAB_FEATURES = 'noopener,noreferrer';
const POPUP_WINDOW_FEATURES =
  'noopener,noreferrer,width=1024,height=768,menubar=no,toolbar=no,location=no,status=no';

export function openAgentConsoleInNewTab(options: AgentConsoleUrlOptions = {}): void {
  const url = buildAgentConsoleAbsoluteUrl(options);
  window.open(url, '_blank', NEW_TAB_FEATURES);
}

export function openAgentConsoleInPopupWindow(options: AgentConsoleUrlOptions = {}): void {
  const url = buildAgentConsoleAbsoluteUrl({ ...options, popup: true });
  window.open(url, '_blank', POPUP_WINDOW_FEATURES);
}
