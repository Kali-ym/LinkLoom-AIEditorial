import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  MCPLifecycleConfig,
  MCPServerConfig,
  MCPToolExecutionTrace,
  MCPToolSchemaTrace,
  ToolDefinition,
  ToolExecutionPolicy
} from '../../types/agent.js';
import { LogService } from '../LogService.js';

const MCP_SCHEMA_REMOVED_KEYWORDS = [
  '$schema',
  '$id',
  '$ref',
  '$defs',
  'definitions',
  'additionalProperties',
  'unevaluatedProperties',
  'minimum',
  'maximum',
  'default',
  'enum'
];

type MCPConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

export interface MCPServerHealthSnapshot {
  serverId: string;
  serverName?: string;
  transportType?: MCPServerConfig['transportType'];
  state: MCPConnectionState;
  connected: boolean;
  clientCreatedAt?: string;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  lastToolListAt?: string;
  cachedToolCount?: number;
  clientExpiresAt?: string;
}

export interface MCPToolCallResult {
  result: unknown;
  trace: MCPToolExecutionTrace;
}

interface MCPClientRecord {
  client: Client;
  transport: any;
  createdAt: number;
  connectedAt: number;
}

interface MCPToolCacheRecord {
  tools: ToolDefinition[];
  createdAt: number;
}

interface MCPServerLifecycleState {
  state: MCPConnectionState;
  serverName?: string;
  transportType?: MCPServerConfig['transportType'];
  clientCreatedAt?: number;
  lastConnectedAt?: number;
  lastDisconnectedAt?: number;
  lastErrorAt?: number;
  lastError?: string;
  lastToolListAt?: number;
  cachedToolCount?: number;
}

function nowIso(value?: number): string | undefined {
  return typeof value === 'number' ? new Date(value).toISOString() : undefined;
}

function positiveMs(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

function getToolListTtlMs(config: MCPServerConfig): number | undefined {
  return positiveMs(config.lifecycle?.toolListTtlMs);
}

function getClientTtlMs(config: MCPServerConfig): number | undefined {
  return positiveMs(config.lifecycle?.clientTtlMs);
}

function getConnectTimeoutMs(config: MCPServerConfig): number | undefined {
  return positiveMs(config.lifecycle?.connectTimeoutMs);
}

function getCallTimeoutMs(config: MCPServerConfig): number | undefined {
  return positiveMs(config.lifecycle?.callTimeoutMs);
}

function isCacheFresh(createdAt: number, ttlMs: number): boolean {
  return Date.now() - createdAt < ttlMs;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs?: number,
  label = 'MCP operation',
  signal?: AbortSignal
): Promise<T> {
  if (!timeoutMs && !signal) return promise;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const onAbort = () => {
      finish(() => reject(createAbortError()));
    };
    if (signal?.aborted) {
      finish(() => reject(createAbortError()));
      return;
    }
    if (timeoutMs) {
      timeout = setTimeout(() => {
        finish(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)));
      }, timeoutMs);
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error instanceof Error ? error : new Error(String(error))))
    );
  });
}

function extractRemovedSchemaKeywords(schema: unknown): string[] {
  const removed = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (MCP_SCHEMA_REMOVED_KEYWORDS.includes(key)) removed.add(key);
      visit(nested);
    }
  };
  visit(schema);
  return Array.from(removed).sort();
}

function getMcpToolSchemaTrace(
  originalInputSchema: unknown,
  modelInputSchema: unknown,
  lifecycle?: MCPLifecycleConfig
): MCPToolSchemaTrace {
  return {
    originalInputSchema,
    modelInputSchema,
    removedKeywords: extractRemovedSchemaKeywords(originalInputSchema),
    mode: lifecycle?.schemaMode || 'provider_compatible'
  };
}

function getMcpExecutionPolicy(config: MCPServerConfig): ToolExecutionPolicy | undefined {
  const timeoutMs = getCallTimeoutMs(config);
  if (!config.execution && !timeoutMs) return undefined;
  return {
    ...(config.execution || {}),
    ...(timeoutMs ? { timeoutMs } : {})
  };
}

// 清理 schema 中不兼容的字段，特别是针对 Claude API
function cleanMCPSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  const newSchema = { ...schema };

  // 删除 Claude API 不支持的字段
  delete newSchema.$schema;
  delete newSchema.$id;
  delete newSchema.$ref;
  delete newSchema.$defs;
  delete newSchema.definitions;
  delete newSchema.additionalProperties; // Claude 不支持此字段
  delete newSchema.unevaluatedProperties;
  delete newSchema.minimum;
  delete newSchema.maximum;
  delete newSchema.default;
  delete newSchema.enum;

  // 递归清理 properties
  if (newSchema.properties) {
    const newProperties: any = {};
    for (const [key, value] of Object.entries(newSchema.properties)) {
      newProperties[key] = cleanMCPSchema(value);
    }
    newSchema.properties = newProperties;
  }

  // 递归清理 items
  if (newSchema.items) {
    newSchema.items = cleanMCPSchema(newSchema.items);
  }

  // 递归清理 anyOf/oneOf/allOf
  if (newSchema.anyOf) {
    newSchema.anyOf = newSchema.anyOf.map((s: any) => cleanMCPSchema(s));
  }
  if (newSchema.oneOf) {
    newSchema.oneOf = newSchema.oneOf.map((s: any) => cleanMCPSchema(s));
  }
  if (newSchema.allOf) {
    newSchema.allOf = newSchema.allOf.map((s: any) => cleanMCPSchema(s));
  }

  return newSchema;
}

/**
 * 使名称符合 Claude API 要求：必须以字母开头，只能包含字母、数字、下划线和连字符
 * @param name 原始名称
 * @returns 符合规范的名称
 */
function sanitizeName(name: string): string {
  // 替换所有非字母、数字、下划线、连字符为下划线
  let sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  // 确保以字母开头
  if (!/^[a-zA-Z]/.test(sanitized)) {
    sanitized = 'mcp_' + sanitized;
  }
  return sanitized;
}

export class MCPService {
  private clients: Map<string, MCPClientRecord> = new Map();
  private transports: Map<string, any> = new Map();
  private toolCache: Map<string, MCPToolCacheRecord> = new Map();
  private lifecycleStates: Map<string, MCPServerLifecycleState> = new Map();
  private proxyAgent?: any;

  constructor(proxyAgent?: any) {
    this.proxyAgent = proxyAgent;
  }

  async getTools(configs: MCPServerConfig[]): Promise<ToolDefinition[]> {
    const allTools: ToolDefinition[] = [];

    for (const config of configs) {
      if (!config.enabled) continue;

      try {
        const cached = this.getFreshToolCache(config);
        if (cached) {
          allTools.push(...cached);
          continue;
        }

        LogService.info(
          `Connecting to MCP server ${config.name} (${config.id}) at ${config.url || 'stdio'}`
        );
        const { client } = await this.getOrCreateClient(config);
        const response = await withTimeout(
          client.listTools(),
          getConnectTimeoutMs(config),
          `MCP listTools ${config.name}`
        );

        const tools = (response.tools || []).map((tool: any) => {
          const cleanedSchema = cleanMCPSchema(tool.inputSchema);

          const safeId = sanitizeName(config.id);
          const safeToolName = sanitizeName(tool.name);
          const schemaTrace = getMcpToolSchemaTrace(tool.inputSchema, cleanedSchema, config.lifecycle);

          return {
            id: `${config.id}:${tool.name}`,
            name: `${safeId}__${safeToolName}`,
            description: tool.description || '',
            parameters: cleanedSchema,
            isBuiltin: false,
            execution: getMcpExecutionPolicy(config),
            uiHints: {
              mcp: {
                serverId: config.id,
                serverName: config.name,
                transportType: config.transportType,
                originalName: tool.name,
                schema: schemaTrace
              }
            }
          };
        });

        this.toolCache.set(config.id, { tools, createdAt: Date.now() });
        this.updateLifecycleState(config, {
          state: 'connected',
          lastToolListAt: Date.now(),
          cachedToolCount: tools.length
        });
        allTools.push(...tools);
        LogService.info(`Successfully loaded ${tools.length} tools from ${config.name}`);
      } catch (error: any) {
        this.recordError(config, error);
        await this.closeClient(config.id, 'error');
        LogService.error(
          `Failed to get tools from MCP server ${config.name} (${config.id}): ${error.message}`
        );
        if (error.stack) {
          LogService.error(error.stack);
        }
      }
    }

    return allTools;
  }

  async callTool(config: MCPServerConfig, toolName: string, args: any, signal?: AbortSignal): Promise<any> {
    const { result } = await this.callToolWithTrace(config, toolName, args, signal);
    return result;
  }

  async callToolWithTrace(
    config: MCPServerConfig,
    toolName: string,
    args: any,
    signal?: AbortSignal
  ): Promise<MCPToolCallResult> {
    const startedAt = Date.now();
    let clientReused = false;
    let reconnectReason: string | undefined;
    let connectedAt: string | undefined;
    let finalToolName = toolName;

    try {
      const connection = await this.getOrCreateClient(config);
      clientReused = connection.reused;
      reconnectReason = connection.reconnectReason;
      connectedAt = nowIso(connection.record.connectedAt);

      if (toolName.includes(':') && !toolName.includes('__')) {
        finalToolName = toolName.split(':').slice(1).join(':');
      }

      const result = await withTimeout(
        connection.record.client.callTool({
          name: finalToolName,
          arguments: args
        }),
        getCallTimeoutMs(config),
        `MCP tool ${config.name}.${finalToolName}`,
        signal
      );

      return {
        result,
        trace: {
          serverId: config.id,
          serverName: config.name,
          transportType: config.transportType,
          toolName: finalToolName,
          status: 'ok',
          clientReused,
          reconnectReason,
          connectedAt,
          durationMs: Date.now() - startedAt
        }
      };
    } catch (error: any) {
      this.recordError(config, error);
      await this.closeClient(config.id, 'error');
      LogService.error(
        `Failed to call MCP tool ${toolName} on server ${config.name}: ${error.message}`
      );
      const wrapped = new Error(error?.message || String(error));
      (wrapped as any).mcpTrace = {
        serverId: config.id,
        serverName: config.name,
        transportType: config.transportType,
        toolName: finalToolName,
        status: 'error',
        clientReused,
        reconnectReason,
        connectedAt,
        durationMs: Date.now() - startedAt,
        error: {
          code: classifyMcpErrorCode(error),
          message: error?.message || String(error),
          retryable: true
        }
      } satisfies MCPToolExecutionTrace;
      throw wrapped;
    }
  }

  async reconnect(config: MCPServerConfig): Promise<MCPServerHealthSnapshot> {
    try {
      await this.getOrCreateClient(config, { forceReconnect: true, reconnectReason: 'manual' });
      return this.getHealth(config);
    } catch (error) {
      this.recordError(config, error);
      return this.getHealth(config);
    }
  }

  async testConnection(config: MCPServerConfig): Promise<MCPServerHealthSnapshot> {
    try {
      const { client } = await this.getOrCreateClient(config, { forceReconnect: true, reconnectReason: 'test' });
      const response = await withTimeout(
        client.listTools(),
        getConnectTimeoutMs(config),
        `MCP test ${config.name}`
      );
      const toolCount = response.tools?.length || 0;
      this.updateLifecycleState(config, {
        state: 'connected',
        lastToolListAt: Date.now(),
        cachedToolCount: toolCount
      });
      return this.getHealth(config);
    } catch (error) {
      this.recordError(config, error);
      return this.getHealth(config);
    }
  }

  getHealth(config: MCPServerConfig): MCPServerHealthSnapshot {
    const state = this.lifecycleStates.get(config.id);
    const client = this.clients.get(config.id);
    const clientTtlMs = getClientTtlMs(config);
    const clientExpiresAt = client && clientTtlMs ? client.createdAt + clientTtlMs : undefined;
    return {
      serverId: config.id,
      serverName: state?.serverName || config.name,
      transportType: state?.transportType || config.transportType,
      state: state?.state || 'idle',
      connected: !!client && (state?.state || 'connected') === 'connected',
      clientCreatedAt: nowIso(state?.clientCreatedAt ?? client?.createdAt),
      lastConnectedAt: nowIso(state?.lastConnectedAt),
      lastDisconnectedAt: nowIso(state?.lastDisconnectedAt),
      lastErrorAt: nowIso(state?.lastErrorAt),
      lastError: state?.lastError,
      lastToolListAt: nowIso(state?.lastToolListAt),
      cachedToolCount: state?.cachedToolCount,
      clientExpiresAt: nowIso(clientExpiresAt)
    };
  }

  getHealthSnapshot(configs?: MCPServerConfig[]): MCPServerHealthSnapshot[] {
    if (configs?.length) return configs.map((config) => this.getHealth(config));
    const ids = new Set<string>([
      ...Array.from(this.lifecycleStates.keys()),
      ...Array.from(this.clients.keys())
    ]);
    return Array.from(ids).map((id) => ({
      serverId: id,
      state: this.lifecycleStates.get(id)?.state || 'idle',
      connected: this.clients.has(id),
      clientCreatedAt: nowIso(this.clients.get(id)?.createdAt),
      lastConnectedAt: nowIso(this.lifecycleStates.get(id)?.lastConnectedAt),
      lastDisconnectedAt: nowIso(this.lifecycleStates.get(id)?.lastDisconnectedAt),
      lastErrorAt: nowIso(this.lifecycleStates.get(id)?.lastErrorAt),
      lastError: this.lifecycleStates.get(id)?.lastError,
      lastToolListAt: nowIso(this.lifecycleStates.get(id)?.lastToolListAt),
      cachedToolCount: this.lifecycleStates.get(id)?.cachedToolCount
    }));
  }

  invalidateServer(configOrId: MCPServerConfig | string): void {
    const id = typeof configOrId === 'string' ? configOrId : configOrId.id;
    this.toolCache.delete(id);
    void this.closeClient(id, 'closed');
  }

  private getFreshToolCache(config: MCPServerConfig): ToolDefinition[] | undefined {
    const ttlMs = getToolListTtlMs(config);
    if (!ttlMs) return undefined;
    const cached = this.toolCache.get(config.id);
    if (!cached) return undefined;
    if (!isCacheFresh(cached.createdAt, ttlMs)) {
      this.toolCache.delete(config.id);
      return undefined;
    }
    this.updateLifecycleState(config, {
      cachedToolCount: cached.tools.length,
      lastToolListAt: cached.createdAt
    });
    return cached.tools;
  }

  private async getOrCreateClient(
    config: MCPServerConfig,
    options: { forceReconnect?: boolean; reconnectReason?: string } = {}
  ): Promise<{ record: MCPClientRecord; client: Client; reused: boolean; reconnectReason?: string }> {
    const existing = this.clients.get(config.id);
    const ttlMs = getClientTtlMs(config);
    const expired = !!existing && !!ttlMs && Date.now() - existing.createdAt >= ttlMs;

    if (existing && !options.forceReconnect && !expired) {
      this.updateLifecycleState(config, { state: 'connected' });
      return { record: existing, client: existing.client, reused: true };
    }

    const reconnectReason = options.reconnectReason || (expired ? 'ttl_expired' : existing ? 'refresh' : undefined);
    if (existing) {
      await this.closeClient(config.id, 'closed');
    }

    this.updateLifecycleState(config, { state: 'connecting' });
    const transport = this.createTransport(config);

    const client = new Client(
      {
        name: 'PrismFlowAgent',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    await withTimeout(client.connect(transport), getConnectTimeoutMs(config), `MCP connect ${config.name}`);

    const record: MCPClientRecord = {
      client,
      transport,
      createdAt: Date.now(),
      connectedAt: Date.now()
    };

    this.clients.set(config.id, record);
    this.transports.set(config.id, transport);
    this.updateLifecycleState(config, {
      state: 'connected',
      clientCreatedAt: record.createdAt,
      lastConnectedAt: record.connectedAt,
      lastError: undefined
    });

    return { record, client, reused: false, reconnectReason };
  }

  private createTransport(config: MCPServerConfig): any {
    if (config.transportType === 'stdio') {
      return new StdioClientTransport({
        command: config.command!,
        args: config.args || [],
        env: Object.entries({ ...process.env, ...(config.env || {}) }).reduce(
          (acc, [k, v]) => {
            if (v !== undefined) acc[k] = v;
            return acc;
          },
          {} as Record<string, string>
        )
      });
    }

    if (config.transportType === 'sse') {
      return new SSEClientTransport(new URL(config.url!), {
        eventSourceInit: {
          headers: config.headers
        } as any,
        requestInit: {
          headers: config.headers,
          // @ts-ignore - undici fetch supports dispatcher
          dispatcher: this.proxyAgent
        }
      });
    }

    if (config.transportType === 'streamable-http') {
      return new StreamableHTTPClientTransport(new URL(config.url!), {
        requestInit: {
          headers: config.headers,
          // @ts-ignore - undici fetch supports dispatcher
          dispatcher: this.proxyAgent
        }
      });
    }

    throw new Error(`Unsupported transport type: ${config.transportType}`);
  }

  private updateLifecycleState(
    config: MCPServerConfig,
    patch: Partial<MCPServerLifecycleState>
  ): void {
    const previous = this.lifecycleStates.get(config.id) || { state: 'idle' as MCPConnectionState };
    this.lifecycleStates.set(config.id, {
      ...previous,
      serverName: config.name,
      transportType: config.transportType,
      ...patch
    });
  }

  private recordError(config: MCPServerConfig, error: unknown): void {
    this.updateLifecycleState(config, {
      state: 'error',
      lastErrorAt: Date.now(),
      lastError: error instanceof Error ? error.message : String(error)
    });
    this.toolCache.delete(config.id);
  }

  private async closeClient(id: string, nextState: MCPConnectionState): Promise<void> {
    const record = this.clients.get(id);
    if (record) {
      try {
        await record.client.close();
      } catch (error: any) {
        LogService.error(`Error closing MCP client ${id}: ${error.message}`);
      }
    }
    this.clients.delete(id);
    this.transports.delete(id);
    const previous = this.lifecycleStates.get(id) || { state: nextState };
    this.lifecycleStates.set(id, {
      ...previous,
      state: nextState,
      lastDisconnectedAt: Date.now()
    });
  }

  async disconnectAll() {
    for (const id of Array.from(this.clients.keys())) {
      await this.closeClient(id, 'closed');
    }
    this.clients.clear();
    this.transports.clear();
  }
}

function createAbortError(): Error {
  const error = new Error('MCP operation aborted');
  error.name = 'AbortError';
  return error;
}

function classifyMcpErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();
  if (normalized.includes('timeout') || normalized.includes('timed out')) return 'timeout';
  if (normalized.includes('abort')) return 'aborted';
  if (normalized.includes('not found') || normalized.includes('unsupported')) return 'not_found';
  return 'execution_error';
}
