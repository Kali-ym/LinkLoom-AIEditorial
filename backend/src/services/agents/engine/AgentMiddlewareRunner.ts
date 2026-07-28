import { LogService } from '../../LogService.js';
import type { AgentEvent } from './AgentEvent.js';
import type {
  AgentMiddleware,
  AgentMiddlewareContext,
  AgentModelCallContext,
  AgentToolCallContext
} from './AgentMiddleware.js';
import type { AgentRunOutput, AgentRunSpec } from './AgentRunSpec.js';

export interface AgentMiddlewareRuntimeContext {
  spec: AgentRunSpec;
  metadata: Record<string, unknown>;
  emit: (event: AgentEvent) => void | Promise<void>;
}

type MiddlewareHookName = keyof Pick<
  AgentMiddleware,
  | 'beforeRun'
  | 'beforeModelCall'
  | 'afterModelCall'
  | 'beforeToolCall'
  | 'afterToolCall'
  | 'beforeFinish'
  | 'onError'
>;

export class AgentMiddlewareRunner {
  private readonly middleware: AgentMiddleware[];
  readonly metadata: Record<string, unknown>;

  constructor(
    middleware: AgentMiddleware[] | undefined,
    private readonly baseContext: AgentMiddlewareRuntimeContext
  ) {
    this.middleware = middleware ?? [];
    this.metadata = baseContext.metadata;
  }

  get enabled(): boolean {
    return this.middleware.length > 0;
  }

  async beforeRun(): Promise<void> {
    await this.call('beforeRun', this.createContext());
  }

  async beforeModelCall(input: {
    messages: unknown[];
    providerId?: string;
    model?: string;
  }): Promise<void> {
    await this.call('beforeModelCall', {
      ...this.createContext(),
      messages: input.messages,
      providerId: input.providerId,
      model: input.model
    });
  }

  async afterModelCall(input: {
    messages: unknown[];
    providerId?: string;
    model?: string;
    result: unknown;
  }): Promise<void> {
    await this.call('afterModelCall', {
      ...this.createContext(),
      messages: input.messages,
      providerId: input.providerId,
      model: input.model,
      result: input.result
    });
  }

  async beforeToolCall(input: {
    toolName: string;
    arguments: unknown;
    permission?: AgentToolCallContext['permission'];
  }): Promise<void> {
    await this.call('beforeToolCall', {
      ...this.createContext(),
      toolName: input.toolName,
      arguments: input.arguments,
      permission: input.permission
    });
  }

  async afterToolCall(input: {
    toolName: string;
    arguments: unknown;
    permission?: AgentToolCallContext['permission'];
    result: unknown;
  }): Promise<void> {
    await this.call('afterToolCall', {
      ...this.createContext(),
      toolName: input.toolName,
      arguments: input.arguments,
      permission: input.permission,
      result: input.result
    });
  }

  async beforeFinish(output: AgentRunOutput): Promise<void> {
    await this.call('beforeFinish', {
      ...this.createContext(),
      output
    });
  }

  async onError(error: unknown): Promise<void> {
    await this.call('onError', {
      ...this.createContext(),
      error
    });
  }

  private createContext(): AgentMiddlewareContext {
    return {
      spec: this.baseContext.spec,
      metadata: this.metadata,
      emit: this.baseContext.emit
    };
  }

  private async call(hook: MiddlewareHookName, context: unknown): Promise<void> {
    for (const item of this.middleware) {
      const handler = item[hook] as ((ctx: any) => void | Promise<void>) | undefined;
      if (!handler) continue;
      try {
        await handler(context);
      } catch (error: any) {
        LogService.warn(
          `[AgentMiddleware ${item.name}] ${hook} failed: ${error?.message || String(error)}`
        );
      }
    }
  }
}