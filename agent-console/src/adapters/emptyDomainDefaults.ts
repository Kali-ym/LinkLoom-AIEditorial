import type {
  ConsoleConfig,
  InputMenuData,
  PortalContentData,
  ShowcaseData,
  SkillCatalog,
  StaticConversation,
} from '../domain/types';
import { DEFAULT_AGENT_PAGE_SIZE, type AgentListLayout } from '../domain/types/agentList';

/** api 模式 stub Port 降级用空结构（避免 mock 演示数据误导）。 */
export const EMPTY_SKILL_CATALOG: SkillCatalog = {
  commands: [],
  agentSkills: [],
  projectSkills: [],
  userSkills: [],
  tools: [],
  agents: [],
};

export const EMPTY_PORTAL_CONTENT: PortalContentData = {
  homeFiles: [],
  homeArtifact: { id: '', title: '', meta: '' },
  homeTool: {},
  notebookDocs: [],
  groupThreads: [],
  threadBubbles: [],
  localFileTabs: [],
  artifactPreview: { title: '', description: '' },
  artifactCode: '',
  documentDefault: { title: '', paragraphs: [] },
  filePreviewDefault: '',
  filePreviewByPath: {},
};

export const EMPTY_INPUT_MENU: InputMenuData = {
  mentionTopics: [],
  mentionFiles: [],
  mentionRecent: [],
};

export const EMPTY_SHOWCASE: ShowcaseData = {
  reasoning: { title: '', demoFullText: '', blocks: [] },
  tools: {
    title: '',
    accordions: [],
    workflowCompleted: { tools: [], opts: {} },
    workflowStreaming: { tools: [], opts: {} },
  },
  grounding: { title: '', web: { citations: [] }, images: { citations: [] } },
  portal: { title: '', entries: [], verifyResult: {} },
  skills: { title: '', hint: '', tagDemos: [] },
  msgTypes: { title: '' },
};

export const EMPTY_STATIC_CONVERSATION = {} as StaticConversation;

export const EMPTY_AGENT_LIST_LAYOUT: AgentListLayout = {
  inboxAgentId: '',
  pinnedAgentIds: [],
  groups: [],
  ungroupedAgentIds: [],
  expandedGroupIds: [],
  agentPageSize: DEFAULT_AGENT_PAGE_SIZE,
  isAgentListInit: false,
};

export const EMPTY_CONSOLE_CONFIG: ConsoleConfig = {
  enableBusinessFeatures: false,
  showInputFootnote: true,
  isDevMode: false,
  enableKnowledgeBase: false,
  enableGatewayMode: false,
  enableFC: false,
  showProviderSearch: false,
  enableInputMarkdown: true,
};
