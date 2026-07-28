import type { AgentDefinition, SkillDefinition, ToolDefinition } from '../../../types/agent.js';
import type { AIProviderConfig } from '../../../types/config.js';
import type { WebSearchPolicy } from '../search/types.js';
import type { AgentWorkspaceState } from '../workspace/AgentWorkspaceState.js';
import { expandStructuredPrompt } from './expandStructuredPrompt.js';
import { normalizeSystemPrompt } from './normalizeSystemPrompt.js';
import { PromptPipeline } from './PromptPipeline.js';
import { BaseAgentProvider } from './providers/BaseAgentProvider.js';
import { CapabilitiesProvider } from './providers/CapabilitiesProvider.js';
import { ConstraintsProvider } from './providers/ConstraintsProvider.js';
import { DateContextProvider } from './providers/DateContextProvider.js';
import { ExamplesProvider } from './providers/ExamplesProvider.js';
import { IdentityProvider } from './providers/IdentityProvider.js';
import { KnowledgeContextProvider } from './providers/KnowledgeContextProvider.js';
import { MemoryContextProvider } from './providers/MemoryContextProvider.js';
import { ModelHintProvider } from './providers/ModelHintProvider.js';
import { OutputFormatProvider } from './providers/OutputFormatProvider.js';
import { RoleProvider } from './providers/RoleProvider.js';
import { SkillProvider } from './providers/SkillProvider.js';
import { TodoHintProvider } from './providers/TodoHintProvider.js';
import { ToolSystemProvider } from './providers/ToolSystemProvider.js';
import { PromptRegistry } from './registry/PromptRegistry.js';
import { wrapTagRaw } from './sanitize.js';
import type { AssembledMessages, PromptBuildContext } from './types.js';

const BASE_OPEN_TAG = '<base>';
const BASE_CLOSE_TAG = '</base>';

export interface BuildContextInput {
  agentDef: AgentDefinition;
  /** AIProviderConfig.type 的大写枚举 */
  providerId: string;
  providerConfig?: AIProviderConfig;
  model: string;
  tools: ToolDefinition[];
  skills: SkillDefinition[];
  mcpTools: ToolDefinition[];
  /** 由 SkillService.buildTurnSkillInstructions 预先生成 */
  skillInstructions: string;
  date?: string;
  /** 可选:覆盖默认单例 registry(测试用) */
  registry?: PromptRegistry;
  /** 预检索的知识库上下文字符串(Provider 同步消费) */
  knowledgeContext?: string;
  /** 预检索的记忆上下文字符串(Provider 同步消费) */
  memoryContext?: string;
  /** 会话组内最新非空 workspaceState(TodoHintProvider 同步消费) */
  todoState?: AgentWorkspaceState;
  /** 运行时变量(供 VariableReplaceProcessor 与 Provider 渲染使用) */
  variables?: Record<string, string>;
  /** Console 联网搜索策略 */
  webSearchPolicy?: WebSearchPolicy;
}

export function buildPromptPipelineContext(input: BuildContextInput): PromptBuildContext {
  const registry = input.registry ?? PromptRegistry.getInstance();
  const raw = normalizeSystemPrompt(input.agentDef.systemPrompt);
  const structuredPrompt = expandStructuredPrompt(raw, registry);
  return {
    agentDef: input.agentDef,
    structuredPrompt,
    tools: input.tools,
    skills: input.skills,
    mcpTools: input.mcpTools,
    providerId: input.providerId,
    providerConfig: input.providerConfig,
    model: input.model,
    date: input.date,
    variables: input.variables ?? {},
    skillInstructions: input.skillInstructions,
    registry,
    knowledgeContext: input.knowledgeContext,
    memoryContext: input.memoryContext,
    todoState: input.todoState,
    webSearchPolicy: input.webSearchPolicy,
  };
}

/**
 * 用默认 Provider 组装 AssembledMessages。
 * 包裹式架构:<base>base 全文</base> + <agent_specific>应用字段</agent_specific>
 * AgentService.runAgent/streamAgent 调此函数。
 */
export function assembleSystemMessages(ctx: PromptBuildContext): AssembledMessages {
  const pipeline = new PromptPipeline([
    new BaseAgentProvider(),
    new RoleProvider(),
    new IdentityProvider(),
    new CapabilitiesProvider(),
    new ConstraintsProvider(),
    new OutputFormatProvider(),
    new ExamplesProvider(),
    // SkillProvider 兜底 service：实际优先用 ctx.skillInstructions
    new SkillProvider({ buildSkillsPrompt: () => '' }),
    new ModelHintProvider(),
    new ToolSystemProvider(),
    new DateContextProvider(),
    new KnowledgeContextProvider(),
    new MemoryContextProvider(),
    new TodoHintProvider()
  ]);
  const assembled = pipeline.build(ctx);

  // 包裹式后处理:把 <base>...</base> 之外的内容包进 <agent_specific>
  assembled.systemMessage.content = wrapAgentSpecificAroundBase(
    assembled.systemMessage.content
  );
  return assembled;
}

/**
 * 若 system message 含 <base> 段,则把 base 段之后的所有内容包裹进 <agent_specific>;
 * base 段之前的内容(若有)保留原位。无 <base> 段时原样返回(降级)。
 */
function wrapAgentSpecificAroundBase(systemContent: string): string {
  const baseOpenIdx = systemContent.indexOf(BASE_OPEN_TAG);
  if (baseOpenIdx < 0) return systemContent;
  const baseCloseIdx = systemContent.indexOf(BASE_CLOSE_TAG, baseOpenIdx);
  if (baseCloseIdx < 0) return systemContent;
  const beforeBase = systemContent.slice(0, baseOpenIdx).trim();
  const baseSegment = systemContent.slice(baseOpenIdx, baseCloseIdx + BASE_CLOSE_TAG.length);
  const afterBase = systemContent.slice(baseCloseIdx + BASE_CLOSE_TAG.length).trim();

  const parts: string[] = [];
  if (beforeBase) parts.push(beforeBase);
  parts.push(baseSegment);
  if (afterBase) parts.push(wrapTagRaw('agent_specific', afterBase));
  return parts.join('\n\n');
}
