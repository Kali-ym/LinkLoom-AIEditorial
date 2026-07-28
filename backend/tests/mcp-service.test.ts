import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MCPService } from '../src/services/agents/MCPService.js';
import type { MCPServerConfig } from '../src/types/agent.js';

const mockState = vi.hoisted(() => {
  const clients: any[] = [];
  class MockMcpClient {
    connect = vi.fn(async () => undefined);
    close = vi.fn(async () => undefined);
    listTools = vi.fn(async () => ({
      tools: [
        {
          name: 'search.docs',
          description: 'Search docs',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              query: { type: 'string', enum: ['ai', 'agent'] },
              limit: { type: 'number', default: 5 }
            },
            required: ['query']
          }
        }
      ]
    }));
    callTool = vi.fn(async (payload: any) => ({
      content: [{ type: 'text', text: `called:${payload.name}` }]
    }));

    constructor() {
      clients.push(this);
    }
  }
  return { clients, MockMcpClient };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: mockState.MockMcpClient
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(function MockStdioTransport(this: any, options: any) {
    this.options = options;
  })
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn(function MockSseTransport(this: any, url: URL, options: any) {
    this.url = url;
    this.options = options;
  })
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(function MockHttpTransport(this: any, url: URL, options: any) {
    this.url = url;
    this.options = options;
  })
}));

function createConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    id: 'docs.server',
    name: 'Docs Server',
    description: 'docs',
    transportType: 'stdio',
    command: 'mock-mcp',
    enabled: true,
    ...overrides
  };
}

describe('MCPService lifecycle governance', () => {
  beforeEach(() => {
    mockState.clients.length = 0;
    vi.clearAllMocks();
  });

  it('keeps legacy tool loading while attaching optional schema trace', async () => {
    const service = new MCPService();
    const tools = await service.getTools([createConfig()]);

    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      id: 'docs.server:search.docs',
      name: 'docs_server__search_docs',
      isBuiltin: false,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' }
        },
        required: ['query']
      }
    });
    expect((tools[0].uiHints as any).mcp.schema).toMatchObject({
      mode: 'provider_compatible',
      removedKeywords: ['additionalProperties', 'default', 'enum'],
      originalInputSchema: expect.objectContaining({ additionalProperties: false }),
      modelInputSchema: tools[0].parameters
    });
  });

  it('uses tool list TTL only when explicitly configured', async () => {
    const service = new MCPService();
    const config = createConfig({ lifecycle: { toolListTtlMs: 60_000 } });

    await service.getTools([config]);
    await service.getTools([config]);

    expect(mockState.clients).toHaveLength(1);
    expect(mockState.clients[0].listTools).toHaveBeenCalledTimes(1);
    expect(service.getHealth(config)).toMatchObject({
      serverId: 'docs.server',
      state: 'connected',
      connected: true,
      cachedToolCount: 1
    });
  });

  it('expires mockState.clients by configured TTL and marks reconnect reason', async () => {
    const service = new MCPService();
    const config = createConfig({ lifecycle: { clientTtlMs: 1 } });

    await service.callToolWithTrace(config, 'search.docs', { query: 'ai' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await service.callToolWithTrace(config, 'search.docs', { query: 'agent' });

    expect(mockState.clients).toHaveLength(2);
    expect(mockState.clients[0].close).toHaveBeenCalledTimes(1);
    expect(second.trace).toMatchObject({
      serverId: 'docs.server',
      toolName: 'search.docs',
      status: 'ok',
      clientReused: false,
      reconnectReason: 'ttl_expired'
    });
  });

  it('returns legacy callTool payload while callToolWithTrace exposes lifecycle trace', async () => {
    const service = new MCPService();
    const config = createConfig();

    const traced = await service.callToolWithTrace(config, 'docs.server:search.docs', { query: 'ai' });
    const legacy = await service.callTool(config, 'search.docs', { query: 'ai' });

    expect(traced.result).toMatchObject({ content: [{ type: 'text', text: 'called:search.docs' }] });
    expect(traced.trace).toMatchObject({
      serverId: 'docs.server',
      status: 'ok',
      clientReused: false
    });
    expect(legacy).toMatchObject({ content: [{ type: 'text', text: 'called:search.docs' }] });
    expect(mockState.clients).toHaveLength(1);
  });

  it('records health errors and clears failed mockState.clients', async () => {
    const service = new MCPService();
    const config = createConfig();

    await service.getTools([config]);
    mockState.clients[0].callTool.mockRejectedValueOnce(new Error('remote failed'));

    await expect(service.callToolWithTrace(config, 'search.docs', {})).rejects.toThrow('remote failed');

    expect(mockState.clients[0].close).toHaveBeenCalledTimes(1);
    expect(service.getHealth(config)).toMatchObject({
      state: 'error',
      connected: false,
      lastError: 'remote failed'
    });
  });
});