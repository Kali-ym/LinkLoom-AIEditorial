import { BaseTool } from '../plugins/base/BaseTool.js';
import {
  executeWithToolEnvelope,
  ToolArgumentValidationError,
  type ToolExecutionEnvelope
} from '../services/agents/runtime/toolProtocol.js';
import { LogService } from '../services/LogService.js';
import { evaluateWorkspaceSandbox } from '../services/agents/engine/WorkspaceSandbox.js';
import type { ToolExecutionContext } from '../services/ToolExecutionContext.js';
import type { ToolDefinition, ToolExecutionPolicy } from '../types/agent.js';

export interface ToolMetadata {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  isBuiltin?: boolean;
  scope?: 'agent' | 'workflow' | 'system' | 'both';
  execution?: ToolExecutionPolicy;
  uiHints?: Record<string, unknown>;
}

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<
    string,
    { constructor?: typeof BaseTool; instance?: BaseTool; metadata: ToolMetadata }
  > = new Map();

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * 注册工具类（用于发现和元数据）
   */
  public register(id: string, toolClass: typeof BaseTool, metadata?: ToolMetadata) {
    const existing = this.tools.get(id);
    this.tools.set(id, {
      ...existing,
      constructor: toolClass,
      metadata: metadata || existing?.metadata || { id, name: id, isBuiltin: false }
    });
  }

  /**
   * 注册工具实例（用于执行）
   */
  public registerTool(tool: BaseTool) {
    const existing = this.tools.get(tool.id);
    this.tools.set(tool.id, {
      ...existing,
      instance: tool,
      metadata: existing?.metadata || {
        id: tool.id,
        name: tool.name,
        displayName: tool.displayName,
        description: tool.description,
        isBuiltin: tool.isBuiltin,
        scope: tool.scope,
        execution: tool.execution,
        uiHints: tool.uiHints
      }
    });
    LogService.info(`Tool registered: ${tool.id} (${tool.name})`);
  }

  /**
   * 批量注册工具实例
   */
  public registerTools(tools: BaseTool[]) {
    tools.forEach((tool) => this.registerTool(tool));
  }

  /**
   * 获取工具类
   */
  public get(id: string): typeof BaseTool | undefined {
    return this.tools.get(id)?.constructor;
  }

  /**
   * 获取工具实例
   */
  public getTool(id: string): BaseTool | undefined {
    return this.tools.get(id)?.instance;
  }

  /**
   * 获取工具元数据
   */
  public getMetadata(id: string): ToolMetadata | undefined {
    return this.tools.get(id)?.metadata;
  }

  /**
   * 获取所有注册的工具 ID
   */
  public getAll(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 列出所有工具元数据
   */
  public listMetadata(): ToolMetadata[] {
    return Array.from(this.tools.values()).map((t) => t.metadata);
  }

  /**
   * 获取所有已实例化的工具定义（用于 Agent/API）
   */
  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter((t) => t.instance)
      .map((t) => {
        const tool = t.instance!;
        return {
          id: tool.id,
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description || '',
          parameters: tool.parameters,
          isBuiltin: tool.isBuiltin,
          scope: tool.scope,
          execution: tool.execution,
          uiHints: tool.uiHints
        };
      });
  }

  /**
   * 设置默认 ToolExecutionContext 的供应器。
   * 由 composition root（initServices）注入，当 callTool 未显式传入 ctx 时使用。
   */
  public setDefaultContextSupplier(supplier: () => Promise<ToolExecutionContext>) {
    this.defaultCtxSupplier = supplier;
  }

  private defaultCtxSupplier?: () => Promise<ToolExecutionContext>;

  /**
   * 调用工具。
   * `ctx` 由 WorkflowEngine / ExecutionService / AgentService 调用时显式传入；
   * 不传时会自动通过 defaultCtxSupplier 构造（避免每个 tool 内部 `ServiceContext.getInstance()`）。
   */
  public async callTool(
    id: string,
    args: any,
    ctx?: ToolExecutionContext | Partial<ToolExecutionContext>
  ) {
    const envelope = await this.callToolEnvelope(id, args, ctx);
    if (envelope.error) {
      throw this.toLegacyToolError(id, envelope);
    }
    return envelope.result;
  }

  public async callToolEnvelope(
    id: string,
    args: any,
    ctx?: ToolExecutionContext | Partial<ToolExecutionContext>
  ): Promise<ToolExecutionEnvelope> {
    const tool = this.getTool(id);
    if (!tool) {
      LogService.error(`Tool ${id} not found`);
      return executeWithToolEnvelope({
        toolId: id,
        exposedName: id,
        source: 'local',
        arguments: args,
        execute: () => {
          throw new Error(`Tool ${id} not found`);
        }
      });
    }
    const effectiveCtx = await this.createEffectiveContext(ctx);
    const auditLogger = effectiveCtx?.auditLogger;
    const startedAt = Date.now();
    const workspacePolicy = effectiveCtx?.workspacePolicy;
    const envelope = await executeWithToolEnvelope({
      toolId: tool.id,
      exposedName: tool.name,
      source: 'local',
      arguments: args,
      toolDef: tool,
      workspace: effectiveCtx?.workspace,
      sandbox: (validatedArgs) => evaluateWorkspaceSandbox({
        source: 'local',
        toolId: tool.id,
        exposedName: tool.name,
        arguments: validatedArgs,
        toolDef: tool,
        workspace: effectiveCtx?.workspace,
        policy: workspacePolicy
      }),
      signal: effectiveCtx?.signal,
      execute: async (validatedArgs, signal) => {
        const attemptCtx =
          effectiveCtx || signal
            ? ({
                ...(effectiveCtx || {}),
                ...(signal ? { signal } : {})
              } as ToolExecutionContext)
            : undefined;
        const result = await tool.handler(validatedArgs, attemptCtx);
        auditLogger?.log({
          toolId: id,
          args: validatedArgs,
          result,
          durationMs: Date.now() - startedAt
        });
        return result;
      }
    });

    if (envelope.error) {
      auditLogger?.log({
        toolId: id,
        args,
        error: envelope.error,
        durationMs: envelope.durationMs
      });
      LogService.error(`Error calling tool ${id}: ${envelope.error.message}`);
    }
    return envelope;
  }

  private async createEffectiveContext(
    ctx?: ToolExecutionContext | Partial<ToolExecutionContext>
  ): Promise<ToolExecutionContext | undefined> {
    let effectiveCtx: ToolExecutionContext | undefined;
    if (this.defaultCtxSupplier) {
      try {
        effectiveCtx = await this.defaultCtxSupplier();
      } catch (err: any) {
        LogService.warn(`ToolRegistry default ctx supplier failed: ${err?.message || err}`);
      }
    }
    if (ctx) {
      effectiveCtx = effectiveCtx ? { ...effectiveCtx, ...ctx } : (ctx as ToolExecutionContext);
    }
    return effectiveCtx;
  }

  private toLegacyToolError(id: string, envelope: ToolExecutionEnvelope): Error {
    if (envelope.error?.code === 'validation_error') {
      const validation = envelope.validation;
      return new ToolArgumentValidationError(id, {
        ok: false,
        args: envelope.arguments,
        missingRequired: validation.missingRequired,
        typeErrors: validation.typeErrors,
        warning: validation.warning
      });
    }
    return new Error(envelope.error?.message || `Tool ${id} execution failed`);
  }
}
