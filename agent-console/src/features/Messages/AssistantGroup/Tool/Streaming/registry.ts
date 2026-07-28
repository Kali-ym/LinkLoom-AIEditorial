import type { BuiltinStreaming, BuiltinStreamingRegistryEntry } from '../toolComponentTypes';
import { resolveRegistryToolsetId } from '../../../../../domain/constants/toolsetIdentifiers';
import {
  AddExperienceMemoryStreaming,
  AddPreferenceMemoryStreaming,
  BatchCreateAgentsStreaming,
  BroadcastStreaming,
  CallSubAgentStreaming,
  CreateAgentStreaming,
  CreateDocumentStreaming,
  CreatePlanStreaming,
  EditFileStreaming,
  ExecuteCodeStreaming,
  ExecuteTaskStreaming,
  ExecuteTasksStreaming,
  InitPageStreaming,
  RunCommandStreaming,
  SpeakStreaming,
  UpdateAgentPromptStreaming,
  UpdateGroupPromptStreaming,
  UpdatePromptStreaming,
  WriteFileStreaming,
} from './builtinStreamings';
import { ClaudeCodeStreamings } from './claudeCode';

const AGENT_BUILDER = 'linkloom-agent-builder';
const AGENT_DOCUMENTS = 'linkloom-agent-documents';
const AGENT_MANAGEMENT = 'linkloom-agent-management';
const CLAUDE_CODE = 'claude-code';
const CLOUD_SANDBOX = 'linkloom-cloud-sandbox';
const GROUP_AGENT_BUILDER = 'linkloom-group-agent-builder';
const GROUP_MANAGEMENT = 'linkloom-group-management';
const AGENT_TOOLSET = 'linkloom-agent';
const LOCAL_SYSTEM = 'linkloom-local-system';
const USER_MEMORY = 'linkloom-user-memory';
const PAGE_AGENT = 'linkloom-page-agent';

/** §C.43*/
const BUILTIN_TOOL_STREAMINGS: Record<string, Record<string, BuiltinStreaming>> = {
  [AGENT_BUILDER]: {
    updatePrompt: UpdatePromptStreaming,
  },
  [AGENT_DOCUMENTS]: {
    createDocument: CreateDocumentStreaming,
  },
  [AGENT_MANAGEMENT]: {
    createAgent: CreateAgentStreaming,
  },
  [CLAUDE_CODE]: ClaudeCodeStreamings,
  [CLOUD_SANDBOX]: {
    executeCode: ExecuteCodeStreaming,
  },
  [GROUP_AGENT_BUILDER]: {
    batchCreateAgents: BatchCreateAgentsStreaming,
    updateAgentPrompt: UpdateAgentPromptStreaming,
    updateGroupPrompt: UpdateGroupPromptStreaming,
  },
  [GROUP_MANAGEMENT]: {
    broadcast: BroadcastStreaming,
    executeAgentTask: ExecuteTaskStreaming,
    executeAgentTasks: ExecuteTasksStreaming,
    speak: SpeakStreaming,
  },
  [AGENT_TOOLSET]: {
    callSubAgent: CallSubAgentStreaming,
    createPlan: CreatePlanStreaming,
  },
  [LOCAL_SYSTEM]: {
    editFile: EditFileStreaming,
    editLocalFile: EditFileStreaming,
    runCommand: RunCommandStreaming,
    writeFile: WriteFileStreaming,
    writeLocalFile: WriteFileStreaming,
  },
  [USER_MEMORY]: {
    addExperienceMemory: AddExperienceMemoryStreaming,
    addPreferenceMemory: AddPreferenceMemoryStreaming,
  },
  [PAGE_AGENT]: {
    initPage: InitPageStreaming,
  },
  'linkloom-message': {},
};

export function getBuiltinStreaming(
  identifier?: string,
  apiName?: string,
): BuiltinStreaming | undefined {
  if (!identifier || !apiName) return undefined;
  const registryId = resolveRegistryToolsetId(identifier) ?? identifier;
  return BUILTIN_TOOL_STREAMINGS[registryId]?.[apiName];
}

export function hasBuiltinStreaming(identifier?: string, apiName?: string): boolean {
  return Boolean(getBuiltinStreaming(identifier, apiName));
}

export function listBuiltinStreamingEntries(): BuiltinStreamingRegistryEntry[] {
  return Object.entries(BUILTIN_TOOL_STREAMINGS).flatMap(([identifier, toolset]) =>
    Object.entries(toolset)
      .filter((entry): entry is [string, BuiltinStreaming] => Boolean(entry[1]))
      .map(([apiName, streaming]) => ({ apiName, identifier, streaming })),
  );
}

export const STREAMING_REGISTRY_IDENTIFIERS = {
  AGENT_BUILDER,
  AGENT_DOCUMENTS,
  AGENT_MANAGEMENT,
  CLAUDE_CODE,
  CLOUD_SANDBOX,
  GROUP_AGENT_BUILDER,
  GROUP_MANAGEMENT,
  AGENT_TOOLSET,
  LOCAL_SYSTEM,
  PAGE_AGENT,
  USER_MEMORY,
} as const;
