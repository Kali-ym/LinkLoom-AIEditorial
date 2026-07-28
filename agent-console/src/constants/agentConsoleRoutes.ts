export const AGENT_CONSOLE_BASE = '/console';
export const AGENT_CONSOLE_TOPIC_SEGMENT = 't';

export type AgentConsoleSection = 'chat' | 'topics' | 'task' | 'popup';

export interface AgentConsoleUrlOptions {
  agentId?: string;
  topicId?: string;
  popup?: boolean;
}

export interface ParsedAgentConsolePath {
  agentId?: string;
  topicId?: string;
  section: AgentConsoleSection;
  taskId?: string;
  popup?: boolean;
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

function decodeSegment(value: string): string {
  return decodeURIComponent(value);
}

/** Parse pathname under `/console`. */
export function parseAgentConsolePath(pathname: string): ParsedAgentConsolePath {
  const normalized = pathname.replace(/\/+$/, '') || AGENT_CONSOLE_BASE;

  if (normalized === AGENT_CONSOLE_BASE) {
    return { section: 'chat' };
  }

  const popupMatch = normalized.match(
    /^\/console\/popup\/([^/]+)(?:\/t\/([^/]+))?$/,
  );
  if (popupMatch) {
    return {
      agentId: decodeSegment(popupMatch[1]!),
      topicId: popupMatch[2] ? decodeSegment(popupMatch[2]) : undefined,
      section: 'popup',
      popup: true,
    };
  }

  if (normalized === `${AGENT_CONSOLE_BASE}/popup`) {
    return { section: 'popup', popup: true };
  }

  const legacyTaskMatch = normalized.match(/^\/console\/task\/([^/]+)$/);
  if (legacyTaskMatch) {
    return {
      section: 'task',
      taskId: decodeSegment(legacyTaskMatch[1]!),
    };
  }

  if (normalized === `${AGENT_CONSOLE_BASE}/topics`) {
    return { section: 'topics' };
  }

  const agentMatch = normalized.match(/^\/console\/([^/]+)(?:\/(.+))?$/);
  if (agentMatch) {
    const agentId = decodeSegment(agentMatch[1]!);
    const rest = agentMatch[2];

    if (!rest) {
      return { agentId, section: 'chat' };
    }
    if (rest === 'topics') {
      return { agentId, section: 'topics' };
    }

    const topicMatch = rest.match(new RegExp(`^${AGENT_CONSOLE_TOPIC_SEGMENT}/([^/]+)$`));
    if (topicMatch) {
      return {
        agentId,
        topicId: decodeSegment(topicMatch[1]!),
        section: 'chat',
      };
    }

    const taskMatch = rest.match(/^task\/([^/]+)$/);
    if (taskMatch) {
      return {
        agentId,
        section: 'task',
        taskId: decodeSegment(taskMatch[1]!),
      };
    }

    return { agentId, section: 'chat' };
  }

  return { section: 'chat' };
}

export function agentConsoleAgentPath(agentId: string): string {
  return `${AGENT_CONSOLE_BASE}/${encodeSegment(agentId)}`;
}

export function agentConsoleTopicPath(agentId: string, topicId: string): string {
  return `${agentConsoleAgentPath(agentId)}/${AGENT_CONSOLE_TOPIC_SEGMENT}/${encodeSegment(topicId)}`;
}

export function agentConsoleTopicsPath(agentId: string): string {
  return `${agentConsoleAgentPath(agentId)}/topics`;
}

export function agentConsoleTaskPath(agentId: string, taskId: string): string {
  return `${agentConsoleAgentPath(agentId)}/task/${encodeSegment(taskId)}`;
}

export function agentConsolePopupPath(agentId: string, topicId?: string): string {
  if (topicId) {
    return `${AGENT_CONSOLE_BASE}/popup/${encodeSegment(agentId)}/${AGENT_CONSOLE_TOPIC_SEGMENT}/${encodeSegment(topicId)}`;
  }
  return `${AGENT_CONSOLE_BASE}/popup/${encodeSegment(agentId)}`;
}

/** Chat home or topic URL for the active agent. */
export function agentConsoleChatPath(agentId: string, topicId?: string): string {
  if (topicId) return agentConsoleTopicPath(agentId, topicId);
  return agentConsoleAgentPath(agentId);
}

/** Build `/console/...` deep link (pathname only). */
export function buildAgentConsoleUrl(
  options: AgentConsoleUrlOptions = {},
  _baseUrl = 'http://localhost',
): string {
  const { agentId, topicId, popup } = options;
  if (!agentId) return AGENT_CONSOLE_BASE;
  if (popup) return agentConsolePopupPath(agentId, topicId);
  return agentConsoleChatPath(agentId, topicId);
}

export function buildAgentConsoleAbsoluteUrl(options: AgentConsoleUrlOptions = {}): string {
  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'http://localhost';
  const relative = buildAgentConsoleUrl(options, origin);
  return `${origin}${relative}`;
}

export function isAgentConsolePopupRoute(pathname: string): boolean {
  const parsed = parseAgentConsolePath(pathname);
  return parsed.popup === true || parsed.section === 'popup';
}

/** §C.54 — sub-routes skip WorkingSidebar */
export function isAgentSubRoute(pathname: string): boolean {
  const section = parseAgentConsolePath(pathname).section;
  return section === 'topics' || section === 'task';
}

export function isAgentTaskRoute(pathname: string): boolean {
  return parseAgentConsolePath(pathname).section === 'task';
}

export function isAgentChatRoute(pathname: string): boolean {
  const parsed = parseAgentConsolePath(pathname);
  return parsed.section === 'chat' || parsed.section === 'popup';
}
