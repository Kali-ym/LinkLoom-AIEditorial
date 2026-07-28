import type { ToolExecutionContext } from '../../services/ToolExecutionContext.js';
import type { ToolDefinition, ToolExecutionPolicy } from '../../types/agent.js';

/**
 * 基础工具类，所有内置和外部工具插件都应继承此类。
 *
 * `handler(args, ctx?)`：
 * - `ctx` 由 ToolRegistry / WorkflowEngine 在调用时注入，包含 store/settings/taskService/agentService/logger。
 * - 当前为可选参数以保持向后兼容；新写的工具应直接使用 `ctx`，禁止再 `await ServiceContext.getInstance()`。
 */
export abstract class BaseTool implements ToolDefinition {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: any; // JSON Schema
  readonly displayName?: string;
  readonly scope?: 'agent' | 'workflow' | 'system' | 'both';
  readonly execution?: ToolExecutionPolicy;
  readonly uiHints?: Record<string, unknown>;
  readonly isBuiltin: boolean = false;

  abstract handler(args: any, ctx?: ToolExecutionContext): Promise<any>;
}
