import type { AgentDefinition, SkillDefinition, ToolDefinition } from '../../../types/agent.js';
import type { AIProviderConfig } from '../../../types/config.js';
import type { WebSearchPolicy } from '../search/types.js';

/** few-shot 示例 */
export interface FewShotExample {
  input: string;
  output: string;
  /** 可选：示例适用场景标签 */
  tags?: string[];
}

/** 超级管理员 taskPlaybook 单条任务 SOP 的参数定义 */
export interface TaskPlaybookParam {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  desc: string;
  example?: string;
  hints?: string;
  values?: string[];
  dependsOn?: string;
  guide?: string;
  condition?: string;
}

/** 超级管理员 taskPlaybook 单条任务 SOP */
export interface TaskPlaybookEntry {
  task: string;
  intent: string[];
  params: TaskPlaybookParam[];
  guideOrder: string[];
  tool: string;
  confirm: string;
  result: string;
  /** Optional REST hint when tool is platform_invoke */
  invoke?: { method: string; path: string; body?: string };
}

/** per-model 提示：按 providerId 写特定提示语（大写枚举 OPENAI/CLAUDE/GEMINI/GLM/OLLAMA） */
export interface ModelHints {
  [providerId: string]: string;
}

/** 结构化 system prompt：七字段扁平分节对象 */
export interface StructuredPrompt {
  /** 角色定位：一句话说明「你是谁、做什么」 */
  role?: string;
  /** 身份人设：更详细的人格/语气/立场；预留文档引用扩展位 */
  identity?: string | { docRef: string };
  /** 能力说明：agent 能做什么、擅长什么、可用工具的高层提示 */
  capabilities?: string;
  /** 行为约束/规则：must/must-not、边界、安全规则 */
  constraints?: string;
  /** 输出格式要求：结构、长度、语言、JSON schema 等 */
  outputFormat?: string;
  /** few-shot 示例 */
  examples?: FewShotExample[];
  /** per-model 提示 */
  modelHints?: ModelHints;
  /** 超级管理员专属：面向任务的引导式操作 SOP 清单 */
  taskPlaybook?: TaskPlaybookEntry[];
}

/** Pipeline 阶段 */
export type PromptPhase =
  | 'system_accumulate'
  | 'variant_accumulate'
  | 'message_transform';

/** Prompt contribution 的缓存稳定性分类。 */
export type PromptCacheClass = 'stable' | 'variant' | 'dynamic';

/** Provider 注入的内容 */
export interface PromptContribution {
  content: string;
  cacheClass?: PromptCacheClass;
  variantKey?: string;
}

/** Pipeline 产出的带来源缓存元数据的 contribution。 */
export interface AssembledPromptContribution {
  providerId: string;
  phase: PromptPhase;
  content: string;
  cacheClass: PromptCacheClass;
  variantKey?: string;
}

/** Provider 构建上下文 */
export interface PromptBuildContext {
  agentDef: AgentDefinition;
  structuredPrompt: StructuredPrompt;
  tools: ToolDefinition[];
  skills: SkillDefinition[];
  mcpTools: ToolDefinition[];
  /** AIProviderConfig.type 的大写枚举值（OPENAI/CLAUDE/GEMINI/GLM/OLLAMA） */
  providerId: string;
  /** AIProviderConfig（用于读取 reasoningEffort/thinkingConfig 等模型特定配置） */
  providerConfig?: AIProviderConfig;
  model: string;
  variables: Record<string, string>;
  /** 预生成的 skill 元数据（由 AgentService 解析 turn skill ids 后生成） */
  skillMetadata?: import('../../../types/skill.js').SkillMetadata[];
  /** @deprecated 使用 skillMetadata */
  skillInstructions?: string;
  /** 可选:PromptRegistry 实例,供 BaseAgentProvider 等加载 base 模板(测试可注入) */
  registry?: import('./registry/PromptRegistry.js').PromptRegistry;
  /** Console 联网搜索策略;由 AgentService 解析并传入 TurnContextAssembler */
  webSearchPolicy?: WebSearchPolicy;
}

/** 可插拔 Provider */
export interface PromptProvider {
  id: string;
  phase: PromptPhase;
  priority: number;
  build(ctx: PromptBuildContext): PromptContribution | null;
}

/** Pipeline 最终组装的消息 */
export interface AssembledMessages {
  systemMessage: { role: 'system'; content: string };
  variantMessages: { role: 'system'; content: string }[];
  contributions?: AssembledPromptContribution[];
}
