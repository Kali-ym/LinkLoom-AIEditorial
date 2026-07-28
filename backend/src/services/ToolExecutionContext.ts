import type { RagKnowledgeScope } from '../types/rag.js';
import type { WorkspacePolicy, WorkspaceRef } from './agents/engine/WorkspacePolicy.js';
import type { SystemSettings } from '../types/config.js';
import type { AgentService } from './agents/AgentService.js';
import { LogServiceAuditLogger, type AuditLogger } from './audit/AuditLogger.js';
import type { LocalStore } from './LocalStore.js';
import { LogService } from './LogService.js';
import type { ServiceContext } from './ServiceContext.js';
import type { TaskService } from './TaskService.js';

/**
 * Tool / Publisher / Adapter 执行时收到的依赖上下文。
 *
 * 引入目的：替代散落的 `await ServiceContext.getInstance()` 调用，
 * 让插件单测可注入假实现，运行时由 WorkflowEngine / ExecutionService
 * 在调用 ToolRegistry.callTool 时显式传入。
 *
 * 字段说明：
 * - `store` 数据访问外观，含数据库仓储集合（注意：消费方应优先按 `domain/ports/*` 的小 Port 声明依赖，
 *   而不是直接使用整个 `LocalStore`）。
 * - `settings` 当前系统设置（已合并 KV）。
 * - `taskService` 采集与发布相关高层服务。
 * - `agentService` Agent/工作流/Skill 管理。
 * - `logger` 统一日志通道，等价 LogService。
 * - `auditLogger` 审计日志通道；ToolRegistry 在每次 callTool 入口/出口写入一行结构化日志。
 * - `services` 原始 ServiceContext，作为暂时兜底（Phase B1 之后仅允许通过更具体的字段访问）。
 */
export interface UploadAllowlist {
  agentId: string;
  fileIds: Set<string>;
}

export interface AgentRunToolContext {
  sessionId: string;
  runId: string;
}

export interface ToolExecutionContext {
  store: LocalStore;
  settings: SystemSettings;
  taskService: TaskService;
  /** AgentService 在 wiring 早期可能为空（缺少 aiProvider 时）。 */
  agentService: AgentService | null;
  logger: typeof LogService;
  auditLogger: AuditLogger;
  workspace?: WorkspaceRef;
  workspacePolicy?: WorkspacePolicy;
  knowledgeScope?: RagKnowledgeScope;
  /** Current user turn non-image uploads the agent may read via read_upload. */
  uploadAllowlist?: UploadAllowlist;
  signal?: AbortSignal;
  services: ServiceContext;
  /** Active agent run scope for session-scoped tools (todos/plan). */
  agentRun?: AgentRunToolContext;
  /** Agent-bound skill ids for this run (Console「工具与技能」+ inline skill tags). */
  exposedSkillIds?: string[];
}

/** 从 ServiceContext 构造一个标准 ToolExecutionContext。 */
export function createToolExecutionContext(services: ServiceContext): ToolExecutionContext {
  return {
    store: services.localStore,
    settings: services.settings,
    taskService: services.taskService,
    agentService: services.agentService,
    logger: LogService,
    auditLogger: new LogServiceAuditLogger(),
    services
  };
}

/**
 * 兼容性兜底：Tool / Publisher 若收到 undefined ctx 应当报错而不是回退到 ServiceContext 单例。
 * Phase B1 起所有插件通过 ToolRegistry 调用都有显式 ctx；本函数把"没有 ctx"变成显式异常，
 * 让 lint / 运行时同时阻断旧的 fire-and-forget 用法。
 */
export function requireToolContext(
  ctx: ToolExecutionContext | undefined,
  toolName: string
): ToolExecutionContext {
  if (!ctx) {
    throw new Error(
      `Tool "${toolName}" was invoked without a ToolExecutionContext. ` +
        '所有 Tool 必须通过 ToolRegistry.callTool 调用，或在显式调用时传入 ctx。'
    );
  }
  return ctx;
}
