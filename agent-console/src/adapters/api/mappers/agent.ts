import type { Agent, AgentConfigPatch, AgentPlusState } from '../../../domain/types';
import type { AgencyConfig, DeviceExecutionTarget } from '../../../domain/types/workspaceControls';
import { isApplicationConsoleAgent } from '../../../domain/applicationConsoleAgents';
import { createDefaultPlusState } from '../../../domain/defaults/agentPlusState';
import { toMcpPluginId } from './agentPluginBindings';
import type { BackendAgentDto } from '../types/agent';
import {
  isStructuredPrompt,
  structuredPromptToPreviewString,
  type StructuredPrompt
} from '../../../domain/types/structuredPrompt';

interface AgentConsoleMetadata {
  params?: AgentPlusState['params'];
  chatConfig?: AgentPlusState['chatConfig'];
  executionTarget?: DeviceExecutionTarget;
  sandboxPolicy?: AgentConfigPatch['sandboxPolicy'];
}

function readAgentConsoleMetadata(
  metadata: Record<string, unknown> | undefined,
): AgentConsoleMetadata | undefined {
  const raw = metadata?.agentConsole;
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as AgentConsoleMetadata;
}

export function readAgencyConfigFromBackendAgent(dto: BackendAgentDto): AgencyConfig | undefined {
  const consoleMeta = readAgentConsoleMetadata(dto.metadata);
  if (!consoleMeta?.executionTarget) return undefined;
  return {
    executionTarget: consoleMeta.executionTarget,
  };
}

const AGENT_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
  'linear-gradient(135deg, #0ea5e9, #6366f1)',
  'linear-gradient(135deg, #10b981, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
] as const;

function gradientForAgentId(agentId: string): string {
  let hash = 0;
  for (const char of agentId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AGENT_GRADIENTS[hash % AGENT_GRADIENTS.length];
}

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * 后端 systemPrompt(string | StructuredPrompt) -> 前端 PlusState 字段。
 * - 结构化对象:填 structuredSystemRole,并把 role+identity 拼成 systemRole 供旧展示兜底
 * - 字符串:填 systemRole,structuredSystemRole 留空
 */
function mapSystemPromptToPlusState(
  systemPrompt: BackendAgentDto['systemPrompt'],
  fallbackSystemRole?: string
): { systemRole?: string; structuredSystemRole?: StructuredPrompt } {
  if (isStructuredPrompt(systemPrompt)) {
    return {
      systemRole: structuredPromptToPreviewString(systemPrompt) || fallbackSystemRole,
      structuredSystemRole: systemPrompt,
    };
  }
  if (typeof systemPrompt === 'string' && systemPrompt) {
    return { systemRole: systemPrompt };
  }
  return { systemRole: fallbackSystemRole };
}

/**
 * 前端 PlusState patch -> 后端 systemPrompt。
 * - patch.structuredSystemRole 显式 null:清除结构化,回退到 systemRole 字符串
 * - patch.structuredSystemRole 为对象:用结构化对象覆盖
 * - 否则按 systemRole 字符串处理(旧路径)
 */
function applySystemPromptPatch(
  current: BackendAgentDto,
  patch: AgentConfigPatch
): BackendAgentDto['systemPrompt'] | undefined {
  if (patch.structuredSystemRole === null) {
    // 显式清除结构化:回退到字符串(systemRole 或空)
    return patch.systemRole ?? '';
  }
  if (patch.structuredSystemRole !== undefined) {
    return patch.structuredSystemRole;
  }
  if (patch.systemRole !== undefined) {
    // 字符串 patch:若当前是结构化对象,保留结构化(字符串仅作为预览/兜底)
    if (isStructuredPrompt(current.systemPrompt)) {
      return current.systemPrompt;
    }
    return patch.systemRole;
  }
  return undefined;
}

function readMetadataStringArray(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string[] | undefined {
  const value = metadata?.[key];
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

function readMetadataBoolean(
  record: Record<string, unknown> | undefined,
  key: string,
): boolean | undefined {
  const value = record?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function mapBackendAgentToDomain(dto: BackendAgentDto): Agent {
  const metadata = dto.metadata;
  const ui = metadata?.ui;
  const uiRecord =
    ui && typeof ui === 'object' ? (ui as Record<string, unknown>) : undefined;

  const gradient =
    readMetadataString(uiRecord, 'gradient') ??
    readMetadataString(metadata, 'agentConsoleGradient') ??
    gradientForAgentId(dto.id);

  const welcome =
    readMetadataString(uiRecord, 'welcome') ??
    readMetadataString(metadata, 'welcome');

  const openingQuestions =
    readMetadataStringArray(uiRecord, 'openingQuestions') ??
    readMetadataStringArray(metadata, 'openingQuestions');

  const consoleVisibleRaw = readMetadataBoolean(uiRecord, 'consoleVisible');
  const isPrimaryRaw = readMetadataBoolean(uiRecord, 'isPrimary');

  const consoleVisible =
    consoleVisibleRaw ?? (isApplicationConsoleAgent(dto.id) ? true : false);
  const isPrimary = isPrimaryRaw ?? false;

  const workingDirectory =
    readMetadataString(metadata, 'workingDirectory') ??
    readMetadataString(uiRecord, 'workingDirectory');

  if (import.meta.env.DEV && !dto.description) {
    console.warn('[agent mapper] missing description for agent', dto.id);
  }

  return {
    id: dto.id,
    name: dto.name,
    description: dto.description || '',
    gradient,
    welcome,
    openingQuestions,
    consoleVisible,
    isPrimary,
    sessionType:
      metadata?.sessionType === 'group' ? 'group' : undefined,
    groupMembers: readMetadataStringArray(metadata, 'groupMembers'),
    isLocalSystemEnabled: metadata?.isLocalSystemEnabled === true || undefined,
    workingDirectory,
    repoType:
      metadata?.repoType === 'git' || metadata?.repoType === 'github'
        ? metadata.repoType
        : undefined,
    isDeviceMode: metadata?.isDeviceMode === true || undefined,
  };
}

export function mapBackendAgentToPlusState(dto: BackendAgentDto): AgentPlusState {
  const defaults = createDefaultPlusState();
  const consoleMeta = readAgentConsoleMetadata(dto.metadata);
  const plugins: Record<string, boolean> = {};

  for (const toolId of dto.toolIds ?? []) {
    plugins[toolId] = true;
  }
  for (const skillId of dto.skillIds ?? []) {
    plugins[skillId] = true;
  }
  for (const mcpId of dto.mcpServerIds ?? []) {
    plugins[toMcpPluginId(mcpId)] = true;
  }

  const knowledgeBases = (dto.knowledgeCategoryIds ?? []).map((id) => ({
    id,
    name: id,
    enabled: true,
  }));

  return {
    ...defaults,
    model: dto.model?.trim() || '',
    provider: dto.providerId?.trim() || defaults.provider,
    ...mapSystemPromptToPlusState(dto.systemPrompt, defaults.systemRole),
    params: {
      ...defaults.params,
      ...consoleMeta?.params,
      temperature:
        typeof dto.temperature === 'number' ? dto.temperature : defaults.params.temperature,
    },
    chatConfig: {
      ...defaults.chatConfig,
      ...consoleMeta?.chatConfig,
      enableStreaming: dto.streaming ?? consoleMeta?.chatConfig?.enableStreaming ?? defaults.chatConfig.enableStreaming,
    },
    plugins,
    pinnedPlugins: {},
    categoryBindings: {
      knowledgeCategoryIds: dto.knowledgeCategoryIds ?? [],
      knowledgeSaveCategoryIds: dto.knowledgeSaveCategoryIds ?? [],
      memoryCategoryIds: dto.memoryCategoryIds ?? [],
      memorySaveCategoryIds: dto.memorySaveCategoryIds ?? [],
    },
    knowledgeBases:
      knowledgeBases.length > 0 ? knowledgeBases : defaults.knowledgeBases,
  };
}

export function applyConfigPatchToBackendAgent(
  dto: BackendAgentDto,
  patch: AgentConfigPatch,
): BackendAgentDto {
  const next: BackendAgentDto = { ...dto };

  if (patch.model !== undefined) next.model = patch.model;
  if (patch.provider !== undefined) next.providerId = patch.provider;
  const nextSystemPrompt = applySystemPromptPatch(dto, patch);
  if (nextSystemPrompt !== undefined) next.systemPrompt = nextSystemPrompt;
  if (patch.params?.temperature !== undefined && patch.params.temperature !== null) {
    next.temperature = patch.params.temperature;
  }
  if (patch.chatConfig?.enableStreaming !== undefined) {
    next.streaming = patch.chatConfig.enableStreaming;
  }
  if (patch.toolIds !== undefined) next.toolIds = patch.toolIds;
  if (patch.skillIds !== undefined) next.skillIds = patch.skillIds;
  if (patch.mcpServerIds !== undefined) next.mcpServerIds = patch.mcpServerIds;
  if (patch.knowledgeCategoryIds !== undefined) next.knowledgeCategoryIds = patch.knowledgeCategoryIds;
  if (patch.knowledgeSaveCategoryIds !== undefined) {
    next.knowledgeSaveCategoryIds = patch.knowledgeSaveCategoryIds;
  }
  if (patch.memoryCategoryIds !== undefined) next.memoryCategoryIds = patch.memoryCategoryIds;
  if (patch.memorySaveCategoryIds !== undefined) next.memorySaveCategoryIds = patch.memorySaveCategoryIds;

  if (patch.params || patch.chatConfig || patch.executionTarget !== undefined || patch.sandboxPolicy !== undefined) {
    const metadata = { ...(next.metadata ?? {}) };
    const consoleMeta = readAgentConsoleMetadata(metadata) ?? {};
    next.metadata = {
      ...metadata,
      agentConsole: {
        ...consoleMeta,
        ...(patch.params
          ? { params: { ...consoleMeta.params, ...patch.params } }
          : {}),
        ...(patch.chatConfig
          ? { chatConfig: { ...consoleMeta.chatConfig, ...patch.chatConfig } }
          : {}),
        ...(patch.executionTarget !== undefined ? { executionTarget: patch.executionTarget } : {}),
        ...(patch.sandboxPolicy !== undefined ? { sandboxPolicy: patch.sandboxPolicy } : {}),
      },
    };
  }

  return next;
}

export function cloneBackendAgentAsDuplicate(
  source: BackendAgentDto,
  newId: string,
  newName: string,
): BackendAgentDto {
  return {
    ...source,
    id: newId,
    name: newName,
  };
}

const DEFAULT_RUNTIME = {
  mode: 'classic',
  maxRounds: 5,
  returnTrace: true,
  toolErrorStrategy: 'observe-and-continue',
  maxRepeatedToolErrors: 2,
  stopOnRepeatedToolError: true,
} as const;

export function createBlankBackendAgent(input?: {
  id?: string;
  name?: string;
  sessionType?: 'group';
}): BackendAgentDto {
  const defaults = createDefaultPlusState();
  const id = input?.id ?? `agent_${Math.random().toString(36).slice(2, 7)}`;
  const metadata: Record<string, unknown> = {};
  if (input?.sessionType === 'group') {
    metadata.sessionType = 'group';
  }

  const defaultName = input?.sessionType === 'group' ? '新群聊' : '新 Agent';

  return {
    id,
    name: input?.name ?? defaultName,
    description: '',
    systemPrompt: '',
    providerId: defaults.provider,
    model: defaults.model,
    temperature: defaults.params.temperature ?? 0.7,
    toolIds: [],
    skillIds: [],
    mcpServerIds: [],
    streaming: defaults.chatConfig.enableStreaming,
    runtime: { ...DEFAULT_RUNTIME },
    knowledgeCategoryIds: [],
    knowledgeSaveCategoryIds: [],
    memoryCategoryIds: [],
    memorySaveCategoryIds: [],
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}
