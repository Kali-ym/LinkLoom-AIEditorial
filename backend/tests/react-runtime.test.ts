import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import { BaseTool } from '../src/plugins/base/BaseTool.js';
import { AskUserQuestionTool } from '../src/plugins/builtin/tools/AskUserQuestionTool.js';
import { ContextTransformer } from '../src/services/agents/context/ContextTransformer.js';
import { createTurnContext } from '../src/services/agents/context/PiContextTypes.js';
import { SessionContextBuilder } from '../src/services/agents/context/SessionContextBuilder.js';
import { ReActRuntime } from '../src/services/agents/runtime/ReActRuntime.js';
import type { AgentDefinition, ToolDefinition } from '../src/types/agent.js';
import type { AIMessage, AIResponse } from '../src/types/index.js';

class EchoReactTestTool extends BaseTool {
  readonly id = 'react_test_echo';
  readonly name = 'react_test_echo';
  readonly description = 'Echoes input for ReAct runtime tests';
  readonly parameters = {
    type: 'object',
    properties: {
      text: { type: 'string' }
    },
    required: ['text']
  };

  async handler(args: { text?: string }) {
    return { echoed: args.text || '' };
  }
}

class ParallelReactTestTool extends BaseTool {
  readonly id: string;
  readonly name: string;
  readonly description = 'Parallel timing probe for ReAct runtime tests';
  readonly parameters = {
    type: 'object',
    properties: {
      label: { type: 'string' }
    },
    required: ['label']
  };
  readonly execution?: ToolDefinition['execution'];

  constructor(
    id: string,
    private readonly timeline: string[],
    private readonly delayMs = 20,
    execution?: ToolDefinition['execution']
  ) {
    super();
    this.id = id;
    this.name = id;
    this.execution = execution;
  }

  async handler(args: { label?: string }) {
    const label = args.label || this.id;
    this.timeline.push(`start:${label}`);
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    this.timeline.push(`end:${label}`);
    return { label };
  }
}

function createAgent(runtime?: AgentDefinition['runtime']): AgentDefinition {
  return {
    id: `react_test_agent_${Math.random().toString(36).slice(2)}`,
    name: 'ReAct Test Agent',
    description: 'test agent',
    systemPrompt: 'You are a test agent.',
    providerId: 'test',
    model: 'test-model',
    temperature: 0,
    toolIds: [],
    skillIds: [],
    mcpServerIds: [],
    runtime
  };
}

function createProvider(responses: AIResponse[]) {
  let index = 0;
  let calls = 0;
  return {
    name: 'test-provider',
    get calls() {
      return calls;
    },
    async generateContent(_prompt: string | AIMessage[], _tools: ToolDefinition[]) {
      calls += 1;
      const response = responses[index] || responses[responses.length - 1];
      index += 1;
      return response;
    }
  };
}

function createStreamingProvider(responses: AIResponse[]) {
  let index = 0;
  let calls = 0;
  return {
    name: 'test-stream-provider',
    get calls() {
      return calls;
    },
    async generateContent(_prompt: string | AIMessage[], _tools: ToolDefinition[]) {
      calls += 1;
      const response = responses[index] || responses[responses.length - 1];
      index += 1;
      return response;
    },
    async *streamContent(_prompt: string | AIMessage[], _tools: ToolDefinition[]) {
      calls += 1;
      const response = responses[index] || responses[responses.length - 1];
      index += 1;
      if (response.content) {
        yield { content: response.content };
      }
      if (response.tool_calls) {
        yield { tool_calls: response.tool_calls };
      }
      yield { usage: response.usage };
    }
  };
}

function createRuntime(
  responses: AIResponse[],
  runtime?: AgentDefinition['runtime'],
  overrides: Partial<ConstructorParameters<typeof ReActRuntime>[0]> = {}
) {
  const toolRegistry = ToolRegistry.getInstance();
  const testTools = overrides.tools || [new EchoReactTestTool()];
  for (const tool of testTools) {
    toolRegistry.registerTool(tool as BaseTool);
  }
  const messages: AIMessage[] = [{ role: 'user', content: 'run test' }];
  const provider = createProvider(responses);

  return {
    runtime: new ReActRuntime({
      agentDef: createAgent(runtime),
      provider,
      tools: testTools,
      mcpConfigs: [],
      mcpService: { callTool: async () => ({}) } as any,
      toolRegistry,
      messages,
      silent: true,
      ...overrides
    }),
    provider
  };
}

describe('ReActRuntime', () => {
  it('observes provider request from explicit session and turn context without polluting persistent messages', async () => {
    const calls: Array<{
      prompt: AIMessage[] | string;
      systemInstruction?: string;
      tools: ToolDefinition[];
    }> = [];
    const toolRegistry = ToolRegistry.getInstance();
    const testTools = [new EchoReactTestTool()];
    for (const tool of testTools) {
      toolRegistry.registerTool(tool as BaseTool);
    }

    const sessionContext = new SessionContextBuilder().build({
      stableSystemPrompt: 'stable system prompt',
      trajectory: [{ role: 'user', content: 'run test' }],
      providerTools: []
    });
    const turnContext = createTurnContext({
      turnId: 'turn-1',
      sources: [{ source: 'knowledge', content: 'knowledge base evidence' }]
    });
    const runtimeOptions = {
      agentDef: createAgent({ mode: 'react', maxRounds: 3, returnTrace: true }),
      provider: {
        name: 'test-provider',
        generateContent: async (
          prompt: string | AIMessage[],
          tools: ToolDefinition[],
          systemInstruction?: string
        ) => {
          calls.push({ prompt, systemInstruction, tools });
          if (calls.length === 1) {
            return {
              content: '',
              tool_calls: [
                {
                  id: 'call-1',
                  name: 'react_test_echo',
                  arguments: { text: 'hello' }
                }
              ]
            };
          }
          return { content: 'done' };
        }
      },
      tools: testTools,
      mcpConfigs: [],
      mcpService: { callTool: async () => ({}) } as any,
      toolRegistry,
      messages: [{ role: 'user' as const, content: 'run test' }],
      silent: true,
      context: {
        runId: 'run-ctx',
        sessionId: 'session-ctx',
        sessionContext,
        turnContext,
        contextTransformer: new ContextTransformer()
      }
    };

    const runtime = new ReActRuntime(runtimeOptions);
    await runtime.run();

    const runtimeMessages = runtimeOptions.messages;
    expect(calls[0].systemInstruction).toContain('stable');
    expect(calls[0].prompt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('knowledge')
        })
      ])
    );
    expect(calls[0].prompt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('<linkloom_context')
        })
      ])
    );
    expect(calls[1].prompt).toHaveLength((calls[0].prompt as AIMessage[]).length + 2);
    expect(runtimeMessages.every((message) => !String(message.content).includes('knowledge'))).toBe(
      true
    );
    expect(runtimeMessages).not.toContainEqual(
      expect.objectContaining({
        content: expect.stringContaining('<linkloom_context')
      })
    );
    expect(runtimeMessages.some((message) => message.role === 'assistant')).toBe(true);
    expect(runtimeMessages.some((message) => message.role === 'tool')).toBe(true);
  });

  it('returns final content without tool calls', async () => {
    const { runtime } = createRuntime([{ content: 'final answer' }], {
      mode: 'classic',
      returnTrace: true
    });

    const result = await runtime.run();

    expect(result.content).toBe('final answer');
    expect(result.stopReason).toBe('final');
    expect(result.trace?.rounds).toHaveLength(1);
    expect(result.trace?.rounds[0].toolCalls).toHaveLength(0);
  });

  it('feeds tool failures back to the model instead of stopping the run', async () => {
    const { runtime, provider } = createRuntime(
      [
        {
          content: '',
          tool_calls: [
            {
              id: 'call-write',
              name: 'writeFile',
              arguments: { path: '/workspace/is_prime.py', content: 'print(1)' }
            }
          ]
        },
        { content: '当前运行未暴露 writeFile，我会说明限制。' }
      ],
      {
        mode: 'react',
        maxRounds: 3,
        returnTrace: true,
        toolErrorStrategy: 'stop'
      }
    );

    const result = await runtime.run();

    expect(provider.calls).toBe(2);
    expect(result.stopReason).toBe('final');
    expect(result.content).toContain('writeFile');
    expect(result.trace?.rounds[0].observations[0]).toMatchObject({
      success: false,
      error: expect.stringContaining('未在本次运行中暴露')
    });
  });

  it('does not add provider calls for default context handling', async () => {
    const { runtime, provider } = createRuntime(
      [{ content: 'final answer' }],
      { mode: 'classic', returnTrace: true },
      {
        messages: Array.from({ length: 20 }, (_, index) => ({
          role: 'user' as const,
          content: `message-${index}`
        }))
      }
    );

    const result = await runtime.run();

    expect(result.stopReason).toBe('final');
    expect(provider.calls).toBe(1);
  });

  it('saves large model output as artifact only when policy requires offload', async () => {
    const savedArtifacts: Array<{ artifactId: string; kind: string; content?: unknown }> = [];
    const largeContent = 'x'.repeat(64);
    const { runtime } = createRuntime(
      [{ content: largeContent }],
      { mode: 'classic', returnTrace: true },
      {
        context: {
          runId: 'run-artifact',
          sessionId: 'session-artifact',
          policy: {
            artifactPolicy: {
              enabled: true,
              maxInlineBytes: 8,
              previewBytes: 12
            }
          },
          onArtifactSaved: (artifact, content) => {
            savedArtifacts.push({ artifactId: artifact.artifactId, kind: artifact.kind, content });
          }
        }
      }
    );

    const result = await runtime.run();

    expect(result.content).toBe(largeContent);
    expect(savedArtifacts).toHaveLength(1);
    expect(savedArtifacts[0]).toMatchObject({ kind: 'model_output', content: largeContent });
  });

  it('carries artifact refs through context compaction and summarization', async () => {
    const compactedRecords: Array<{ compacted: boolean; artifactIds: string[] }> = [];
    const summarizer = vi.fn(
      async (input: { artifactIds?: string[] }) =>
        `LLM summary with refs: ${(input.artifactIds || []).join(',')}`
    );
    let modelInput: AIMessage[] = [];
    const provider = {
      name: 'test-provider',
      generateContent: vi.fn(async (prompt: string | AIMessage[]) => {
        modelInput = Array.isArray(prompt) ? prompt : [];
        return { content: 'final answer' };
      })
    };

    const { runtime } = createRuntime(
      [{ content: 'unused' }],
      { mode: 'classic', returnTrace: true },
      {
        provider: provider as any,
        messages: [
          { role: 'user' as const, content: 'first fact artifact_run_ctx_tool_1' },
          { role: 'assistant' as const, content: 'first answer' },
          { role: 'user' as const, content: 'second fact' },
          { role: 'assistant' as const, content: 'second answer' },
          { role: 'user' as const, content: 'latest question' }
        ],
        context: {
          runId: 'run-ctx',
          sessionId: 'session-ctx',
          policy: {
            compactionStrategy: 'summarize',
            maxMessages: 3,
            summarizeOlderThanMessages: 3,
            maxInputTokens: 16
          },
          summarizer,
          onContextCompacted: (record) => {
            compactedRecords.push({ compacted: record.compacted, artifactIds: record.artifactIds });
          }
        }
      }
    );

    const result = await runtime.run();

    expect(result.stopReason).toBe('final');
    expect(provider.generateContent).toHaveBeenCalledTimes(1);
    expect(summarizer).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactIds: ['artifact_run_ctx_tool_1']
      })
    );
    expect(compactedRecords).toEqual([
      { compacted: true, artifactIds: ['artifact_run_ctx_tool_1'] }
    ]);
    expect(
      modelInput.some(
        (message) =>
          message.role === 'system' && String(message.content).includes('artifact_run_ctx_tool_1')
      )
    ).toBe(true);
  });

  it('keeps the compacted snapshot for subsequent ReAct rounds', async () => {
    const modelInputs: AIMessage[][] = [];
    const summarizer = vi.fn(
      async (input: { messages: AIMessage[] }) =>
        `summary:${input.messages.map((message) => String(message.content)).join('|')}`
    );
    const provider = {
      name: 'test-provider',
      generateContent: vi.fn(async (prompt: string | AIMessage[]) => {
        modelInputs.push(Array.isArray(prompt) ? prompt.map((message) => ({ ...message })) : []);
        if (modelInputs.length === 1) {
          return {
            content: '',
            tool_calls: [
              {
                id: 'call-compaction',
                name: 'react_test_echo',
                arguments: { text: 'continue' }
              }
            ]
          };
        }
        return { content: 'final after compaction' };
      })
    };

    const { runtime } = createRuntime(
      [{ content: 'unused' }],
      { mode: 'react', maxRounds: 3, returnTrace: true },
      {
        provider: provider as any,
        messages: Array.from({ length: 10 }, (_, index) => ({
          role: 'user' as const,
          content: `message-${index}-${'x'.repeat(500)}`
        })),
        context: {
          runId: 'run-compaction',
          sessionId: 'session-compaction',
          policy: {
            compactionStrategy: 'summarize',
            maxMessages: 3,
            summarizeOlderThanMessages: 3,
            maxInputTokens: 1,
            reserveOutputTokens: 0,
            compactionBuffer: 0
          },
          summarizer
        }
      }
    );

    const result = await runtime.run();

    expect(result.stopReason).toBe('final');
    expect(modelInputs).toHaveLength(2);
    expect(modelInputs[0]?.some((message) => String(message.content).includes('message-0-'))).toBe(
      true
    );
    expect(modelInputs[1]?.some((message) => String(message.content).includes('message-0-'))).toBe(
      false
    );
    expect(modelInputs[1]?.some((message) => String(message.content).startsWith('summary:'))).toBe(
      true
    );
    expect(summarizer).toHaveBeenCalledTimes(2);
  });

  it('offloads large tool results into artifact refs for model-visible context', async () => {
    const savedArtifacts: Array<{ artifactId: string; kind: string; content?: unknown }> = [];
    const largeToolText = 'large-tool-result-'.repeat(8);
    const messages: AIMessage[] = [{ role: 'user', content: 'run test' }];
    const { runtime } = createRuntime(
      [
        {
          content: '',
          tool_calls: [
            {
              id: 'call-large-tool',
              name: 'react_test_echo',
              arguments: { text: largeToolText }
            }
          ]
        },
        { content: 'done' }
      ],
      { mode: 'react', maxRounds: 2, returnTrace: true },
      {
        messages,
        context: {
          runId: 'run-tool-artifact',
          sessionId: 'session-tool-artifact',
          policy: {
            artifactPolicy: {
              enabled: true,
              maxInlineBytes: 16,
              previewBytes: 24
            }
          },
          onArtifactSaved: (artifact, content) => {
            savedArtifacts.push({ artifactId: artifact.artifactId, kind: artifact.kind, content });
          }
        }
      }
    );

    const result = await runtime.run();
    const toolMessage = messages.find((message) => message.role === 'tool');
    const artifactId = savedArtifacts[0]?.artifactId;

    expect(result.stopReason).toBe('final');
    expect(savedArtifacts).toHaveLength(1);
    expect(savedArtifacts[0]).toMatchObject({ kind: 'tool_result' });
    expect(String(savedArtifacts[0].content)).toContain(largeToolText);
    expect(result.trace?.rounds[0].observations[0].artifactId).toBe(artifactId);
    expect(toolMessage?.content).toContain(`artifact: ${artifactId}`);
    expect(toolMessage?.content).not.toContain(largeToolText);
  });

  it('records tool calls and observations before final answer', async () => {
    const { runtime } = createRuntime(
      [
        {
          content: '',
          tool_calls: [
            {
              id: 'call-1',
              name: 'react_test_echo',
              arguments: { text: 'hello' }
            }
          ]
        },
        { content: 'done' }
      ],
      { mode: 'react', maxRounds: 3, returnTrace: true }
    );

    const result = await runtime.run();

    expect(result.content).toBe('done');
    expect(result.stopReason).toBe('final');
    expect(result.toolCalls?.map((call) => call.name)).toEqual(['react_test_echo']);
    expect(result.trace?.rounds[0].observations[0]).toMatchObject({
      toolName: 'react_test_echo',
      success: true,
      data: { echoed: 'hello' }
    });
  });

  it('attaches optional MCP lifecycle trace without wrapping model-visible tool result', async () => {
    const mcpTool: ToolDefinition = {
      id: 'docs-server:search_docs',
      name: 'docs_server__search_docs',
      description: 'Search docs',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      },
      isBuiltin: false,
      uiHints: {
        mcp: {
          schema: {
            originalInputSchema: { type: 'object', additionalProperties: false },
            modelInputSchema: { type: 'object', properties: { query: { type: 'string' } } },
            removedKeywords: ['additionalProperties'],
            mode: 'provider_compatible'
          }
        }
      }
    };
    const messages: AIMessage[] = [{ role: 'user', content: 'run mcp' }];
    const provider = createProvider([
      {
        content: '',
        tool_calls: [
          { id: 'call-mcp', name: 'docs_server__search_docs', arguments: { query: 'agent' } }
        ]
      },
      { content: 'done' }
    ]);
    const mcpService = {
      callToolWithTrace: vi.fn(async () => ({
        result: { content: [{ type: 'text', text: 'mcp result' }] },
        trace: {
          serverId: 'docs-server',
          serverName: 'Docs Server',
          transportType: 'stdio',
          toolName: 'search_docs',
          status: 'ok',
          clientReused: true,
          connectedAt: '2026-01-01T00:00:00.000Z',
          durationMs: 3
        }
      }))
    };

    const runtime = new ReActRuntime({
      agentDef: createAgent({ mode: 'react', maxRounds: 2, returnTrace: true }),
      provider,
      tools: [mcpTool],
      mcpConfigs: [
        {
          id: 'docs-server',
          name: 'Docs Server',
          description: '',
          transportType: 'stdio',
          enabled: true
        }
      ],
      mcpService: mcpService as any,
      toolRegistry: ToolRegistry.getInstance(),
      messages,
      silent: true
    });

    const result = await runtime.run();

    expect(result.stopReason).toBe('final');
    expect(mcpService.callToolWithTrace).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'docs-server' }),
      'search_docs',
      { query: 'agent' },
      undefined
    );
    expect(messages.find((message) => message.role === 'tool')?.content).toBe(
      '{"content":[{"type":"text","text":"mcp result"}]}'
    );
    expect(result.trace?.rounds[0].observations[0].execution?.mcp).toMatchObject({
      serverId: 'docs-server',
      toolName: 'search_docs',
      status: 'ok',
      schema: {
        mode: 'provider_compatible',
        removedKeywords: ['additionalProperties']
      }
    });
  });

  it('stops at configured max rounds while preserving the last observation fallback', async () => {
    const { runtime } = createRuntime(
      [
        {
          content: '',
          tool_calls: [
            {
              id: 'call-1',
              name: 'react_test_echo',
              arguments: { text: 'only round' }
            }
          ]
        }
      ],
      { mode: 'react', maxRounds: 1, returnTrace: true }
    );

    const result = await runtime.run();

    expect(result.stopReason).toBe('max_rounds');
    expect(result.content).toBe('{"echoed":"only round"}');
    expect(result.trace?.rounds).toHaveLength(1);
  });

  it('normalizes JSON string tool arguments before execution', async () => {
    const { runtime } = createRuntime(
      [
        {
          content: '',
          tool_calls: [
            {
              id: 'call-1',
              name: 'react_test_echo',
              arguments: '{"text":"from json"}'
            }
          ]
        },
        { content: 'done' }
      ],
      { mode: 'react', maxRounds: 2, returnTrace: true }
    );

    const result = await runtime.run();

    expect(result.stopReason).toBe('final');
    expect(result.trace?.rounds[0].toolCalls[0]).toMatchObject({
      name: 'react_test_echo',
      arguments: { text: 'from json' },
      rawArguments: '{"text":"from json"}'
    });
    expect(result.trace?.rounds[0].observations[0]).toMatchObject({
      success: true,
      data: { echoed: 'from json' }
    });
  });

  it('resumes a permission pause with edited tool arguments on the same pending call', async () => {
    const messages: AIMessage[] = [{ role: 'user', content: 'resume edited args' }];
    const { runtime } = createRuntime(
      [{ content: 'done' }],
      { mode: 'react', maxRounds: 2, returnTrace: true },
      {
        messages
      }
    );

    const result = await runtime.resumeFromPermission({
      state: {
        pendingToolCall: {
          id: 'call-edit-1',
          name: 'react_test_echo',
          arguments: { text: 'original' },
          rawArguments: { text: 'original' },
          source: 'provider'
        },
        roundIndex: 1,
        assistantContent: ''
      },
      decision: {
        permissionId: 'permission-edit-1',
        effect: 'allow',
        resolvedBy: 'human',
        resolvedAt: new Date().toISOString(),
        editedArguments: { text: 'edited' }
      }
    });

    expect(result.stopReason).toBe('final');
    expect(result.trace?.rounds[0].toolCalls[0]).toMatchObject({
      id: 'call-edit-1',
      name: 'react_test_echo',
      arguments: { text: 'edited' },
      rawArguments: { text: 'edited' }
    });
    expect(result.trace?.rounds[0].observations[0]).toMatchObject({
      toolCallId: 'call-edit-1',
      toolName: 'react_test_echo',
      success: true,
      data: { echoed: 'edited' }
    });
    expect(messages.find((message) => message.role === 'tool')).toMatchObject({
      tool_call_id: 'call-edit-1',
      name: 'react_test_echo'
    });

    // The paused assistant turn must be re-attached before the tool result so
    // the continuation model call sees a valid tool_calls -> tool sequence and
    // does not return empty content.
    const assistantIndex = messages.findIndex(
      (message) =>
        message.role === 'assistant' &&
        Array.isArray((message as any).tool_calls) &&
        (message as any).tool_calls.some((call: any) => call.id === 'call-edit-1')
    );
    const toolIndex = messages.findIndex((message) => message.role === 'tool');
    expect(assistantIndex).toBeGreaterThanOrEqual(0);
    expect(toolIndex).toBeGreaterThan(assistantIndex);
    expect(result.content).toBe('done');
  });

  it('sanitizes checkpoint messages and avoids duplicate assistant turns on resume', async () => {
    const pendingToolCall = {
      id: 'call-checkpoint-1',
      name: 'react_test_echo',
      arguments: { text: 'list files' },
      rawArguments: { text: 'list files' },
      source: 'provider' as const
    };
    const messages: AIMessage[] = [
      { role: 'user', content: 'list files' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [pendingToolCall]
      },
      {
        role: 'tool',
        tool_call_id: pendingToolCall.id,
        name: pendingToolCall.name,
        content: 'Permission required for tool "react_test_echo"'
      }
    ];
    const { runtime } = createRuntime(
      [{ content: 'workspace is empty' }],
      { mode: 'react', maxRounds: 1, returnTrace: true },
      { messages }
    );

    const result = await runtime.resumeFromPermission({
      state: {
        pendingToolCall,
        roundIndex: 1,
        assistantContent: ''
      },
      decision: {
        permissionId: 'permission-checkpoint-1',
        effect: 'allow',
        resolvedBy: 'human',
        resolvedAt: new Date().toISOString()
      }
    });

    expect(result.stopReason).toBe('final');
    expect(result.content).toBe('workspace is empty');
    expect(
      messages.filter(
        (message) =>
          message.role === 'assistant' &&
          Array.isArray(message.tool_calls) &&
          message.tool_calls.length > 0
      )
    ).toHaveLength(1);
    expect(messages.filter((message) => message.role === 'tool')).toHaveLength(1);
    expect(messages.find((message) => message.role === 'tool')).toMatchObject({
      role: 'tool',
      tool_call_id: pendingToolCall.id
    });
    expect(String(messages.find((message) => message.role === 'tool')?.content)).not.toContain(
      'Permission required'
    );
  });

  it('streams permission resume chunks before model continuation finishes', async () => {
    const messages: AIMessage[] = [{ role: 'user', content: 'resume with stream' }];
    const provider = createStreamingProvider([{ content: 'streamed answer' }]);
    const toolRegistry = ToolRegistry.getInstance();
    const testTools = [new EchoReactTestTool()];
    for (const tool of testTools) {
      toolRegistry.registerTool(tool as BaseTool);
    }
    const chunks: Array<Record<string, unknown>> = [];
    const runtime = new ReActRuntime({
      agentDef: createAgent({ mode: 'react', maxRounds: 2, returnTrace: true }),
      provider,
      tools: testTools,
      mcpConfigs: [],
      mcpService: { callTool: async () => ({}) } as any,
      toolRegistry,
      messages,
      silent: true,
      onStreamChunk: async (chunk) => {
        if (chunk && typeof chunk === 'object') {
          chunks.push(chunk as Record<string, unknown>);
        }
      }
    });

    const result = await runtime.resumeFromPermission({
      state: {
        pendingToolCall: {
          id: 'call-stream-1',
          name: 'react_test_echo',
          arguments: { text: 'stream' },
          rawArguments: { text: 'stream' },
          source: 'provider'
        },
        roundIndex: 1,
        assistantContent: ''
      },
      decision: {
        permissionId: 'permission-stream-1',
        effect: 'allow',
        resolvedBy: 'human',
        resolvedAt: new Date().toISOString()
      }
    });

    expect(result.stopReason).toBe('final');
    expect(result.content).toBe('streamed answer');
    expect(chunks.some((chunk) => chunk.type === 'trace_observation')).toBe(true);
    expect(chunks.some((chunk) => chunk.type === 'content' || chunk.type === 'final_content')).toBe(
      true
    );
    const observationIndex = chunks.findIndex((chunk) => chunk.type === 'trace_observation');
    const contentIndex = chunks.findIndex(
      (chunk) => chunk.type === 'content' || chunk.type === 'final_content'
    );
    expect(observationIndex).toBeGreaterThanOrEqual(0);
    expect(contentIndex).toBeGreaterThan(observationIndex);
  });

  it('runs explicitly safe non-stream tool batches in parallel while preserving trace order', async () => {
    const timeline: string[] = [];
    const tools = [
      new ParallelReactTestTool('parallel_safe_a', timeline, 25, {
        readonly: true,
        parallelizable: true,
        riskLevel: 'low'
      }),
      new ParallelReactTestTool('parallel_safe_b', timeline, 25, {
        readonly: true,
        concurrencySafe: true,
        riskLevel: 'low'
      })
    ];
    const { runtime } = createRuntime(
      [
        {
          content: '',
          tool_calls: [
            { id: 'call-a', name: 'parallel_safe_a', arguments: { label: 'a' } },
            { id: 'call-b', name: 'parallel_safe_b', arguments: { label: 'b' } }
          ]
        },
        { content: 'done' }
      ],
      {
        mode: 'react',
        maxRounds: 2,
        returnTrace: true,
        stopOnRepeatedToolError: false
      },
      { tools }
    );

    const result = await runtime.run();

    expect(result.stopReason).toBe('final');
    expect(timeline.indexOf('start:b')).toBeLessThan(timeline.indexOf('end:a'));
    expect(result.trace?.rounds[0].observations.map((observation) => observation.toolName)).toEqual(
      ['parallel_safe_a', 'parallel_safe_b']
    );
    expect(result.trace?.rounds[0].observations.map((observation) => observation.data)).toEqual([
      { label: 'a' },
      { label: 'b' }
    ]);
    expect(result.trace?.rounds[0].observations[0].execution).toMatchObject({
      readonly: true,
      parallelizable: true,
      concurrencySafe: true,
      source: 'local'
    });
  });

  it('keeps default non-stream tool batches serial', async () => {
    const timeline: string[] = [];
    const tools = [
      new ParallelReactTestTool('serial_default_a', timeline, 10),
      new ParallelReactTestTool('serial_default_b', timeline, 10, {
        readonly: true,
        parallelizable: true
      })
    ];
    const { runtime } = createRuntime(
      [
        {
          content: '',
          tool_calls: [
            { id: 'call-a', name: 'serial_default_a', arguments: { label: 'a' } },
            { id: 'call-b', name: 'serial_default_b', arguments: { label: 'b' } }
          ]
        },
        { content: 'done' }
      ],
      {
        mode: 'react',
        maxRounds: 2,
        returnTrace: true,
        stopOnRepeatedToolError: false
      },
      { tools }
    );

    const result = await runtime.run();

    expect(result.stopReason).toBe('final');
    expect(timeline).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
    expect(result.trace?.rounds[0].observations.map((observation) => observation.toolName)).toEqual(
      ['serial_default_a', 'serial_default_b']
    );
  });

  it('stops repeated invalid tool arguments before exhausting max rounds', async () => {
    const { runtime } = createRuntime(
      [
        {
          content: '',
          tool_calls: [
            {
              id: 'call-1',
              name: 'react_test_echo',
              arguments: {}
            }
          ]
        }
      ],
      {
        mode: 'react',
        maxRounds: 5,
        returnTrace: true,
        maxRepeatedToolErrors: 2,
        stopOnRepeatedToolError: true
      }
    );

    const result = await runtime.run();

    expect(result.stopReason).toBe('invalid_tool_arguments');
    expect(result.trace?.rounds).toHaveLength(2);
    expect(result.trace?.rounds[0].observations[0]).toMatchObject({
      success: false
    });
  });

  it('stops repeated tool failures across different arguments with a visible fallback', async () => {
    const { runtime, provider } = createRuntime(
      [
        {
          content: '',
          tool_calls: [{ id: 'call-1', name: 'list_dir', arguments: { path: '/tmp/a' } }]
        },
        {
          content: '',
          tool_calls: [{ id: 'call-2', name: 'list_dir', arguments: { path: '/tmp/b' } }]
        },
        { content: '不应继续调用模型' }
      ],
      {
        mode: 'react',
        maxRounds: 5,
        returnTrace: true,
        maxRepeatedToolErrors: 2,
        stopOnRepeatedToolError: true
      }
    );

    const result = await runtime.run();

    expect(provider.calls).toBe(2);
    expect(result.stopReason).toBe('repeated_tool_error');
    expect(result.content).toContain('工具「list_dir」执行失败');
    expect(result.content).toContain('已停止继续重试');
  });

  it('pauses on ask_user_question and resumes with user input', async () => {
    const askTool = new AskUserQuestionTool();
    const messages: AIMessage[] = [{ role: 'user', content: 'ask me' }];
    const userInputRequired = vi.fn();
    const { runtime } = createRuntime(
      [
        {
          content: '',
          tool_calls: [
            {
              id: 'call-ask-1',
              name: 'ask_user_question',
              arguments: {
                question: {
                  prompt: 'Which env?',
                  fields: [{ key: 'env', label: 'Env' }]
                }
              }
            }
          ]
        },
        { content: 'Thanks, deploying to staging.' }
      ],
      { mode: 'react', maxRounds: 3, returnTrace: true },
      {
        tools: [askTool],
        messages,
        userInput: { onUserInputRequired: userInputRequired }
      }
    );

    const paused = await runtime.run();
    expect(paused.stopReason).toBe('needs_input');
    expect(userInputRequired).toHaveBeenCalledTimes(1);

    const pauseState = userInputRequired.mock.calls[0][1];
    const request = userInputRequired.mock.calls[0][0];
    const resumed = await runtime.resumeFromUserInput({
      state: pauseState,
      resolution: {
        action: 'provide_input',
        requestId: request.requestId,
        input: { env: 'staging' }
      }
    });

    expect(resumed.stopReason).toBe('final');
    expect(resumed.content).toContain('staging');
    expect(messages.find((message) => message.role === 'tool')).toMatchObject({
      tool_call_id: 'call-ask-1',
      name: 'ask_user_question'
    });
  });
});
