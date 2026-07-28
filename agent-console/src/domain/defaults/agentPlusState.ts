import type { AgentPlusState } from '../types/agentChatConfig';

export const DEFAULT_MODEL_PARAMS: AgentPlusState['params'] = {
  temperature: 0.7,
  top_p: 1,
  presence_penalty: null,
  frequency_penalty: null,
  max_tokens: null,
  reasoning_effort: null,
};

export const DEFAULT_AGENT_CHAT_CONFIG: AgentPlusState['chatConfig'] = {
  memory: { enabled: true },
  searchMode: 'auto',
  useModelBuiltinSearch: false,
  disableGatewayMode: false,
  skillActivateMode: 'auto',
  enableAgentMode: true,
  enableContextCompression: true,
  enableHistoryCount: false,
  historyCount: 20,
  enableAutoScrollOnStreaming: true,
  enableStreaming: true,
  enableFollowUpChips: false,
  inputTemplate: '',
  enableMaxTokens: false,
  enableReasoning: false,
  enableMaxContextWindow: false,
  maxContextWindow: 200_000,
};

const DEFAULT_FILES: AgentPlusState['files'] = [
  { id: 'file-readme', name: 'README.md', enabled: false },
  { id: 'file-app', name: 'src/App.tsx', enabled: true },
];

const DEFAULT_KNOWLEDGE_BASES: AgentPlusState['knowledgeBases'] = [
  { id: 'kb-linkloom', name: 'LinkLoom 文档', enabled: true },
  { id: 'kb-studio', name: 'Studio 设计稿', enabled: false },
];

const DEFAULT_PLUGINS: AgentPlusState['plugins'] = {
  'linkloom-skills-web-browsing': true,
  'agent-doc-linkloom': true,
  'linkloom-sandbox': true,
  'web-browsing': true,
  'agent-doc-rss': false,
  'proj-fe': false,
};

const DEFAULT_PINNED: AgentPlusState['pinnedPlugins'] = {
  'linkloom-skills-web-browsing': true,
  'web-browsing': true,
};

const DEFAULT_CATEGORY_BINDINGS: AgentPlusState['categoryBindings'] = {
  knowledgeCategoryIds: [],
  knowledgeSaveCategoryIds: [],
  memoryCategoryIds: [],
  memorySaveCategoryIds: [],
};

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_PROVIDER = 'openai';

/** Domain default for agent plus/config state — no fixture dependency. */
export function createDefaultPlusState(overrides?: Partial<AgentPlusState>): AgentPlusState {
  return {
    chatConfig: { ...DEFAULT_AGENT_CHAT_CONFIG, ...overrides?.chatConfig },
    params: { ...DEFAULT_MODEL_PARAMS, ...overrides?.params },
    model: overrides?.model ?? DEFAULT_MODEL,
    provider: overrides?.provider ?? DEFAULT_PROVIDER,
    systemRole:
      overrides?.systemRole ??
      '你是专业、简洁的 AI 助理，优先给出可执行建议。',
    files: overrides?.files ?? DEFAULT_FILES.map((f) => ({ ...f })),
    knowledgeBases: overrides?.knowledgeBases ?? DEFAULT_KNOWLEDGE_BASES.map((k) => ({ ...k })),
    plugins: { ...DEFAULT_PLUGINS, ...overrides?.plugins },
    pinnedPlugins: { ...DEFAULT_PINNED, ...overrides?.pinnedPlugins },
    categoryBindings: {
      ...DEFAULT_CATEGORY_BINDINGS,
      ...overrides?.categoryBindings,
    },
  };
}

/** Stable read fallback for selectors — must not allocate per getSnapshot call. */
export const FALLBACK_PLUS_STATE: AgentPlusState = createDefaultPlusState();
