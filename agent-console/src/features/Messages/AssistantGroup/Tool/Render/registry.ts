import type { BuiltinRender, BuiltinRenderRegistryEntry } from '../toolComponentTypes';
import {
  AgentRender,
  AskUserQuestionRender,
  EditRender,
  GlobRender,
  GrepRender,
  ReadRender,
  SkillRender,
  TaskRender,
  TodoWriteRender,
  WebFetchRender,
  WebSearchRender,
  WriteRender,
} from './shared/claudeCodeRenders';
import {
  EditFileRender,
  DeleteFileRender,
  ExecuteCodeResultRender,
  ExportFileRender,
  ListFilesRender,
  MoveFilesRender,
  ReadFileRender,
  SearchFilesRender,
  WriteFileRender,
} from './shared/localSystemRenders';
import { LinearRender } from './shared/linearRender';
import { RunCommandRender } from './shared/runCommandRender';
import {
  ActivateSkillRender,
  BatchCreateAgentsRender,
  BroadcastRender,
  CallAgentRender,
  CallSubAgentRender,
  CodexTodoListRender,
  CodexWebSearchRender,
  CollabToolRender,
  CreateAgentRender,
  CreatePlanRender,
  DeviceCardRender,
  DocumentCardRender,
  DuplicateAgentRender,
  ExecScriptRender,
  ExecuteTaskRender,
  ExecuteTasksRender,
  FileChangeRender,
  GenerateVerifyPlanRender,
  GetAgentDetailRender,
  GetAvailableModelsRender,
  GithubRunCommandRender,
  ImportStatusRender,
  InstallPluginRender,
  KnowledgeFileRender,
  TodoListRender,
  UpdateTodosRender,
  McpToolRender,
  MemoryCardRender,
  ModifyNodesRender,
  ReadReferenceRender,
  RunTasksResultRender,
  SaveUserQuestionRender,
  SearchAgentRender,
  SearchListRender,
  SearchMarketToolsRender,
  SkillActivateRender,
  SpeakRender,
  SubmitAgentPickRender,
  TaskCardRender,
  TaskListRender,
  UpdateAgentPromptRender,
  UpdateAgentRender,
  UpdateConfigRender,
  UpdateGroupPromptRender,
  UpdatePromptRender,
  WebPageCardsRender,
} from './shared/toolsetRenders';
import { resolveRegistryToolsetId, TOOLSET_IDS } from '../../../../../domain/constants/toolsetIdentifiers';
import { isLinearMcpApiName, LINEAR_MCP_PREFIX, LINEAR_TOOL_NAMES } from './linearApiNames';
import {
  CronCreatedRender,
  GenericAdminResultRender,
  NewsScoreUpdatedRender,
  ReportPublishedRender,
  WorkflowRunStartedRender,
  WorkflowStepDecidedRender,
} from './admin/AdminRenders';
import { ADMIN_QUERY_RENDERS } from './admin/AdminQueryRenders';
import {
  createAdapterActionRender,
  TaskLogsRender,
} from './admin/AdminSchedulingRenders';
import {
  ContinuationReportRender,
  SelectionStatsRender,
} from './admin/AdminSelectionRenders';
import {
  RefreshDigestContextRender,
  ReportPreviewRender,
  WorkflowDetailRender,
} from './admin/AdminGenerationRenders';
import { createOpsDashboardRender } from './admin/AdminOpsRenders';
import { createHistoryCommitRender, HistoryCommitRender } from './admin/AdminHistoryRenders';
import {
  AgentBindingsRender,
  AgentDetailRender,
  AgentSavedRender,
  createAgentCatalogRender,
  createWorkflowSavedRender,
  McpTestRender,
} from './admin/AdminAgentRenders';
import {
  createKnowledgeBrowseRender,
  KbCategoryCreatedRender,
  KbContentRender,
  PluginMetadataRender,
  RagStatusRender,
} from './admin/AdminKnowledgeRenders';
import {
  ADMIN_AGENT_CATALOG_RENDER_API_NAMES,
  ADMIN_AGENT_WRITE_RENDER_API_NAMES,
  ADMIN_CRON_RENDER_API_NAMES,
  ADMIN_GENERIC_WRITE_RENDER_API_NAMES,
  ADMIN_GENERATION_WRITE_RENDER_API_NAMES,
  ADMIN_HISTORY_WRITE_RENDER_API_NAMES,
  ADMIN_KNOWLEDGE_BROWSE_RENDER_API_NAMES,
  ADMIN_OPS_DASHBOARD_RENDER_API_NAMES,
  ADMIN_SCHEDULING_WRITE_RENDER_API_NAMES,
  ADMIN_WORKFLOW_RUN_RENDER_API_NAMES,
} from './admin/adminRenderConfig';

const AGENT_BUILDER = 'linkloom-agent-builder';
const AGENT_DOCUMENTS = 'linkloom-agent-documents';
const AGENT_MANAGEMENT = 'linkloom-agent-management';
const CLAUDE_CODE = 'claude-code';
const CLOUD_SANDBOX = 'linkloom-cloud-sandbox';
const GROUP_AGENT_BUILDER = 'linkloom-group-agent-builder';
const GROUP_MANAGEMENT = 'linkloom-group-management';
const KNOWLEDGE_BASE = 'linkloom-knowledge-base';
const AGENT_TOOLSET = 'linkloom-agent';
const DELIVERY_CHECKER = 'linkloom-delivery-checker';
const LOCAL_SYSTEM = 'linkloom-local-system';
const USER_MEMORY = 'linkloom-user-memory';
const MESSAGE = 'linkloom-message';
const NOTEBOOK = 'linkloom-notebook';
const PAGE_AGENT = 'linkloom-page-agent';
const REMOTE_DEVICE = 'linkloom-remote-device';
const SKILL_STORE = 'linkloom-skill-store';
const SKILLS = 'linkloom-skills';
const TASK = 'linkloom-task';
const ACTIVATOR = 'linkloom-activator';
const WEB_BROWSING = 'linkloom-web-browsing';
const WEB_ONBOARDING = 'linkloom-web-onboarding';
const CODEX = 'codex';
const GITHUB = 'github';
const ADMIN = 'linkloom-admin';

const LOCAL_FILE_RENDERS = {
  deleteFile: DeleteFileRender,
  deleteLocalFile: DeleteFileRender,
  editFile: EditFileRender,
  editLocalFile: EditFileRender,
  executeCode: ExecuteCodeResultRender,
  exportFile: ExportFileRender,
  listFiles: ListFilesRender,
  listLocalFiles: ListFilesRender,
  moveFiles: MoveFilesRender,
  moveLocalFiles: MoveFilesRender,
  readFile: ReadFileRender,
  readLocalFile: ReadFileRender,
  runCommand: RunCommandRender,
  searchFiles: SearchFilesRender,
  searchLocalFiles: SearchFilesRender,
  writeFile: WriteFileRender,
  writeLocalFile: WriteFileRender,
} satisfies Record<string, BuiltinRender>;

const LINEAR_RENDERS = Object.fromEntries(
  LINEAR_TOOL_NAMES.map((name) => [`${LINEAR_MCP_PREFIX}${name}`, LinearRender]),
) as Record<string, BuiltinRender>;

const ADMIN_TOOL_RENDERS = {
  ...Object.fromEntries(ADMIN_CRON_RENDER_API_NAMES.map((apiName) => [apiName, CronCreatedRender])),
  ...Object.fromEntries(
    ADMIN_WORKFLOW_RUN_RENDER_API_NAMES.map((apiName) => [apiName, WorkflowRunStartedRender]),
  ),
  ...Object.fromEntries(
    ADMIN_SCHEDULING_WRITE_RENDER_API_NAMES.map((apiName) => [
      apiName,
      createAdapterActionRender(apiName),
    ]),
  ),
  ...Object.fromEntries(
    ADMIN_GENERATION_WRITE_RENDER_API_NAMES.map((apiName) => [apiName, RefreshDigestContextRender]),
  ),
  getDailyReportJson: ReportPreviewRender,
  getWorkflowRunDetail: WorkflowDetailRender,
  ...Object.fromEntries(
    ADMIN_OPS_DASHBOARD_RENDER_API_NAMES.map((apiName) => [
      apiName,
      createOpsDashboardRender(apiName),
    ]),
  ),
  ...Object.fromEntries(
    ADMIN_HISTORY_WRITE_RENDER_API_NAMES.map((apiName) => [
      apiName,
      createHistoryCommitRender(apiName),
    ]),
  ),
  getCommitHistory: HistoryCommitRender,
  updateNewsScore: NewsScoreUpdatedRender,
  deleteNews: GenericAdminResultRender,
  publishReport: ReportPublishedRender,
  decideWorkflowStep: WorkflowStepDecidedRender,
  ...ADMIN_QUERY_RENDERS,
  listTaskLogs: TaskLogsRender,
  getSelectionStats: SelectionStatsRender,
  queryContinuationReport: ContinuationReportRender,
  ...Object.fromEntries(
    ADMIN_AGENT_CATALOG_RENDER_API_NAMES.map((apiName) => [
      apiName,
      createAgentCatalogRender(apiName),
    ]),
  ),
  getAgent: AgentDetailRender,
  testMcp: McpTestRender,
  listAgentBindings: AgentBindingsRender,
  ...Object.fromEntries(
    ADMIN_KNOWLEDGE_BROWSE_RENDER_API_NAMES.map((apiName) => [
      apiName,
      createKnowledgeBrowseRender(apiName),
    ]),
  ),
  getKbContent: KbContentRender,
  getRagStatus: RagStatusRender,
  listPluginMetadata: PluginMetadataRender,
  saveAgent: AgentSavedRender,
  ...Object.fromEntries(
    ADMIN_AGENT_WRITE_RENDER_API_NAMES.filter((apiName) => apiName !== 'saveAgent').map((apiName) => [
      apiName,
      createWorkflowSavedRender(apiName),
    ]),
  ),
  createKbCategory: KbCategoryCreatedRender,
  ...Object.fromEntries(
    ADMIN_GENERIC_WRITE_RENDER_API_NAMES.map((apiName) => [apiName, GenericAdminResultRender]),
  ),
} satisfies Record<string, BuiltinRender>;

/** §C.45*/
const BUILTIN_TOOL_RENDERS: Record<string, Record<string, BuiltinRender | null | undefined>> = {
  [AGENT_BUILDER]: {
    getAvailableModels: GetAvailableModelsRender,
    installPlugin: InstallPluginRender,
    searchMarketTools: SearchMarketToolsRender,
    updateAgentConfig: UpdateConfigRender,
    updatePrompt: UpdatePromptRender,
  },
  [AGENT_DOCUMENTS]: {
    createDocument: DocumentCardRender,
  },
  [AGENT_MANAGEMENT]: {
    callAgent: CallAgentRender,
    createAgent: CreateAgentRender,
    duplicateAgent: DuplicateAgentRender,
    getAgentDetail: GetAgentDetailRender,
    installPlugin: InstallPluginRender,
    searchAgent: SearchAgentRender,
    updateAgent: UpdateAgentRender,
    updatePrompt: UpdatePromptRender,
  },
  [CLAUDE_CODE]: {
    Agent: AgentRender,
    AskUserQuestion: AskUserQuestionRender,
    Bash: RunCommandRender,
    Edit: EditRender,
    Glob: GlobRender,
    Grep: GrepRender,
    Read: ReadRender,
    Skill: SkillRender,
    TaskList: TaskRender,
    TaskUpdate: TaskRender,
    TodoWrite: TodoWriteRender,
    WebFetch: WebFetchRender,
    WebSearch: WebSearchRender,
    Write: WriteRender,
    ...LINEAR_RENDERS,
  },
  [CLOUD_SANDBOX]: LOCAL_FILE_RENDERS,
  [GROUP_AGENT_BUILDER]: {
    batchCreateAgents: BatchCreateAgentsRender,
    updateAgentPrompt: UpdateAgentPromptRender,
    updateGroupPrompt: UpdateGroupPromptRender,
  },
  [GROUP_MANAGEMENT]: {
    broadcast: BroadcastRender,
    executeAgentTask: ExecuteTaskRender,
    executeAgentTasks: ExecuteTasksRender,
    speak: SpeakRender,
  },
  [KNOWLEDGE_BASE]: {
    readKnowledge: KnowledgeFileRender,
    searchKnowledgeBase: SearchListRender,
  },
  [AGENT_TOOLSET]: {
    callSubAgent: CallSubAgentRender,
    clearTodos: TodoListRender,
    createPlan: CreatePlanRender,
    createTodos: TodoListRender,
    updatePlan: CreatePlanRender,
    updateTodos: UpdateTodosRender,
  },
  [DELIVERY_CHECKER]: {
    generateVerifyPlan: GenerateVerifyPlanRender,
  },
  [LOCAL_SYSTEM]: LOCAL_FILE_RENDERS,
  [USER_MEMORY]: {
    addExperienceMemory: MemoryCardRender,
    addPreferenceMemory: MemoryCardRender,
    searchUserMemory: MemoryCardRender,
  },
  [MESSAGE]: {
    readMessages: undefined,
    searchMessages: undefined,
  },
  [NOTEBOOK]: {
    createDocument: DocumentCardRender,
  },
  [PAGE_AGENT]: {
    initPage: null,
    modifyNodes: ModifyNodesRender,
  },
  [REMOTE_DEVICE]: {
    activateDevice: DeviceCardRender,
    listOnlineDevices: DeviceCardRender,
  },
  [SKILL_STORE]: {
    importFromMarket: ImportStatusRender,
    importSkill: ImportStatusRender,
    searchSkill: SearchListRender,
  },
  [SKILLS]: {
    activateSkill: SkillActivateRender,
    execScript: ExecScriptRender,
    readReference: ReadReferenceRender,
    runCommand: RunCommandRender,
  },
  [TASK]: {
    createTask: TaskCardRender,
    createTasks: TaskListRender,
    runTasks: RunTasksResultRender,
  },
  [ACTIVATOR]: {
    activateSkill: ActivateSkillRender,
  },
  [WEB_BROWSING]: {
    crawlMultiPages: WebPageCardsRender,
    crawlSinglePage: WebPageCardsRender,
    search: SearchListRender,
  },
  [WEB_ONBOARDING]: {
    saveUserQuestion: SaveUserQuestionRender,
    showAgentMarketplace: SubmitAgentPickRender,
    submitAgentPick: SubmitAgentPickRender,
    updateDocument: UpdateConfigRender,
    writeDocument: DocumentCardRender,
  },
  [CODEX]: {
    collab_tool_call: CollabToolRender,
    command_execution: RunCommandRender,
    file_change: FileChangeRender,
    mcp_tool_call: McpToolRender,
    todo_list: CodexTodoListRender,
    web_search: CodexWebSearchRender,
  },
  [GITHUB]: {
    runCommand: GithubRunCommandRender,
    run_command: GithubRunCommandRender,
  },
  [ADMIN]: ADMIN_TOOL_RENDERS,
};

export function getBuiltinRender(identifier?: string, apiName?: string): BuiltinRender | undefined {
  if (!identifier || !apiName) return undefined;
  const registryId = resolveRegistryToolsetId(identifier) ?? identifier;
  const toolset = BUILTIN_TOOL_RENDERS[registryId];
  const direct = toolset?.[apiName];
  if (direct) return direct ?? undefined;
  if (identifier === TOOLSET_IDS.MCP) {
    return toolset?.mcp_tool_call ?? McpToolRender;
  }
  if (registryId === CLAUDE_CODE && isLinearMcpApiName(apiName)) return LinearRender;
  return undefined;
}

export function hasBuiltinRender(identifier?: string, apiName?: string): boolean {
  return Boolean(getBuiltinRender(identifier, apiName));
}

export function listBuiltinRenderEntries(): BuiltinRenderRegistryEntry[] {
  return Object.entries(BUILTIN_TOOL_RENDERS).flatMap(([identifier, toolset]) =>
    Object.entries(toolset)
      .filter((entry): entry is [string, BuiltinRender] => Boolean(entry[1]))
      .map(([apiName, render]) => ({ apiName, identifier, render })),
  );
}

export const RENDER_REGISTRY_IDENTIFIERS = {
  ACTIVATOR,
  AGENT_BUILDER,
  AGENT_DOCUMENTS,
  AGENT_MANAGEMENT,
  CLAUDE_CODE,
  CLOUD_SANDBOX,
  CODEX,
  DELIVERY_CHECKER,
  GITHUB,
  GROUP_AGENT_BUILDER,
  GROUP_MANAGEMENT,
  KNOWLEDGE_BASE,
  AGENT_TOOLSET,
  LOCAL_SYSTEM,
  MESSAGE,
  NOTEBOOK,
  PAGE_AGENT,
  REMOTE_DEVICE,
  SKILL_STORE,
  SKILLS,
  TASK,
  USER_MEMORY,
  WEB_BROWSING,
  WEB_ONBOARDING,
  ADMIN,
} as const;

export { BUILTIN_TOOL_RENDERS };
