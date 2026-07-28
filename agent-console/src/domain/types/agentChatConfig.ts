import type { DeviceExecutionTarget } from './workspaceControls';
import type { StructuredPrompt } from './structuredPrompt';

export type SearchMode = 'off' | 'auto';

export type SkillActivateMode = 'auto' | 'manual';

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type TextVerbosity = 'low' | 'medium' | 'high';

export type ThinkingMode = 'auto' | 'disabled' | 'enabled';

export interface AgentMemoryConfig {
  enabled: boolean;
}

export interface AgentChatConfig {
  memory: AgentMemoryConfig;
  searchMode: SearchMode;
  useModelBuiltinSearch: boolean;
  disableGatewayMode?: boolean;
  skillActivateMode: SkillActivateMode;
  /** §C.30 — Chat vs Agent 模式；false 时隐藏 WorkspaceControls / ApprovalMode */
  enableAgentMode?: boolean;
  /** §C.23 Params — 通用区 */
  enableContextCompression?: boolean;
  enableHistoryCount?: boolean;
  historyCount?: number;
  enableAutoScrollOnStreaming?: boolean;
  enableStreaming?: boolean;
  enableFollowUpChips?: boolean;
  inputTemplate?: string;
  enableMaxTokens?: boolean;
  /** @deprecated merged into enableReasoning — kept for persisted agent metadata */
  enableReasoningEffort?: boolean;
  enableReasoning?: boolean;
  /** @deprecated removed from console UI */
  reasoningBudgetToken?: number;
  preserveThinking?: boolean;
  disableContextCaching?: boolean;
  textVerbosity?: TextVerbosity;
  thinking?: ThinkingMode;
  /** Override model catalog context window (tokens). */
  enableMaxContextWindow?: boolean;
  maxContextWindow?: number;
}

export interface AgentModelParams {
  temperature: number | null;
  top_p: number | null;
  presence_penalty: number | null;
  frequency_penalty: number | null;
  max_tokens: number | null;
  reasoning_effort: ReasoningEffort | null;
}

export interface AgentAttachmentFile {
  id: string;
  name: string;
  enabled: boolean;
}

export interface AgentKnowledgeBase {
  id: string;
  name: string;
  enabled: boolean;
}

export interface AgentCategoryBindings {
  knowledgeCategoryIds: string[];
  knowledgeSaveCategoryIds: string[];
  memoryCategoryIds: string[];
  memorySaveCategoryIds: string[];
}

export interface AgentPlusState {
  chatConfig: AgentChatConfig;
  params: AgentModelParams;
  model: string;
  provider: string;
  systemRole?: string;
  /** 结构化 system prompt(与 systemRole 互斥:结构化 agent 用此字段) */
  structuredSystemRole?: StructuredPrompt;
  files: AgentAttachmentFile[];
  knowledgeBases: AgentKnowledgeBase[];
  plugins: Record<string, boolean>;
  pinnedPlugins: Record<string, boolean>;
  categoryBindings: AgentCategoryBindings;
}

export type AgentConfigPatch = {
  chatConfig?: Partial<AgentChatConfig>;
  params?: Partial<AgentModelParams>;
  model?: string;
  provider?: string;
  systemRole?: string;
  /** 结构化 system prompt patch(置 null 表示清除结构化、回退到字符串) */
  structuredSystemRole?: StructuredPrompt | null;
  toolIds?: string[];
  skillIds?: string[];
  mcpServerIds?: string[];
  knowledgeCategoryIds?: string[];
  knowledgeSaveCategoryIds?: string[];
  memoryCategoryIds?: string[];
  memorySaveCategoryIds?: string[];
  executionTarget?: DeviceExecutionTarget;
  sandboxPolicy?: {
    idleTimeoutMs?: number;
    image?: string;
    resourceLimits?: { cpuCores?: number; memoryMb?: number };
  };
};
