import { describe, expect, it } from 'vitest';
import {
  AnthropicProvider,
  applyReasoningRequestFields,
  createAIProvider,
  createChatCompletionsStreamParseState,
  createMessagesStreamParseState,
  createResponsesStreamParseState,
  extractMessagesApiResult,
  extractResponsesApiResult,
  fromLangChainMessage,
  OpenAIProvider,
  parseChatCompletionsStreamPayload,
  parseMessagesStreamPayload,
  parseOpenAIChatResponseText,
  parseResponsesStreamPayload,
  resolveDefaultApiEndpoint,
  resolveStreamEndpointPlans,
  toMessagesApiTools,
  toMessagesApiMessages,
  toChatCompletionsApiMessages,
  toResponsesApiInputItems,
  toResponsesApiTools,
  splitSystemFromPrompt,
  isOfficialOpenAiApiBase,
  shouldTryAlternateOpenAIEndpoint,
} from '../src/services/AIProvider.js';

describe('provider tool call parsing', () => {
  it('maps LangChain tool_calls args to internal arguments', () => {
    const result = fromLangChainMessage({
      content: '',
      tool_calls: [
        {
          id: 'lc-1',
          name: 'query_knowledge',
          args: { query: 'LangChain 工具调用' }
        }
      ]
    });

    expect(result.tool_calls).toEqual([
      {
        id: 'lc-1',
        name: 'query_knowledge',
        arguments: { query: 'LangChain 工具调用' }
      }
    ]);
  });

  it('parses OpenAI chat/completions tool calls', () => {
    const result = parseOpenAIChatResponseText(
      JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'chat-1',
                  type: 'function',
                  function: {
                    name: 'query_memory',
                    arguments: '{"query":"OpenAI chat 工具调用"}'
                  }
                }
              ]
            }
          }
        ],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
      })
    );

    expect(result.content).toBe('');
    expect(result.tool_calls).toEqual([
      {
        id: 'chat-1',
        name: 'query_memory',
        arguments: { query: 'OpenAI chat 工具调用' }
      }
    ]);
    expect(result.usage?.total_tokens).toBe(3);
  });

  it('parses OpenAI responses function calls', () => {
    const result = extractResponsesApiResult({
      object: 'response',
      output: [
        {
          type: 'function_call',
          call_id: 'resp-1',
          name: 'query_knowledge',
          arguments: '{"query":"OpenAI responses 工具调用"}'
        }
      ],
      usage: { input_tokens: 4, output_tokens: 5, total_tokens: 9 }
    });

    expect(result.tool_calls).toEqual([
      {
        id: 'resp-1',
        name: 'query_knowledge',
        arguments: { query: 'OpenAI responses 工具调用' }
      }
    ]);
    expect(result.usage?.prompt_tokens).toBe(4);
  });

  it('enables DeepSeek-style thinking toggle when reasoning effort is requested', () => {
    const body: Record<string, unknown> = { model: 'deepseek-v4-flash', messages: [] };
    applyReasoningRequestFields(body, 'high');
    expect(body.reasoning_effort).toBe('high');
    expect(body.thinking).toEqual({ type: 'enabled' });
  });

  it('parses chat completions reasoning_content deltas', () => {
    const parsed = parseChatCompletionsStreamPayload({
      choices: [{ delta: { reasoning_content: '先比较小数位', content: '' } }]
    });
    expect(parsed?.reasoning).toBe('先比较小数位');
  });

  it('parses Anthropic-style messages API tool calls and thinking blocks', () => {
    const result = extractMessagesApiResult({
      content: [
        { type: 'thinking', thinking: '先分析用户意图' },
        { type: 'text', text: '你好' },
        {
          type: 'tool_use',
          id: 'msg-1',
          name: 'query_knowledge',
          input: { query: 'messages API 工具调用' }
        }
      ],
      usage: { input_tokens: 6, output_tokens: 7, total_tokens: 13 }
    });

    expect(result.reasoning).toBe('先分析用户意图');
    expect(result.content).toBe('你好');
    expect(result.tool_calls).toEqual([
      {
        id: 'msg-1',
        name: 'query_knowledge',
        arguments: { query: 'messages API 工具调用' }
      }
    ]);
    expect(result.usage?.total_tokens).toBe(13);
  });

  it('parses reasoning_text blocks from messages API responses', () => {
    const result = extractMessagesApiResult({
      content: [
        { type: 'reasoning_text', text: '逐步比较两个小数' },
        { type: 'text', text: '9.92 更大' }
      ]
    });

    expect(result.reasoning).toBe('逐步比较两个小数');
    expect(result.content).toBe('9.92 更大');
  });

  it('parses messages API thinking_delta variants in stream events', () => {
    const state = createMessagesStreamParseState();
    const parsed = parseMessagesStreamPayload(
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking', thinking: '先分析' }
      },
      state
    );
    expect(parsed?.reasoning).toBe('先分析');
  });

  it('backfills reasoning from message_stop when no deltas streamed', () => {
    const state = createMessagesStreamParseState();
    const parsed = parseMessagesStreamPayload(
      {
        type: 'message_stop',
        message: {
          content: [
            { type: 'reasoning_text', text: '完整思考摘要' },
            { type: 'text', text: '最终答案' }
          ]
        }
      },
      state
    );
    expect(parsed?.reasoning).toBe('完整思考摘要');
  });

  it('parses responses-style reasoning events on messages streams', () => {
    const state = createMessagesStreamParseState();
    const parsed = parseMessagesStreamPayload(
      {
        type: 'response.reasoning_summary_text.delta',
        item_id: 'rs_msg',
        delta: 'messages 流里的推理'
      },
      state
    );
    expect(parsed?.reasoning).toBe('messages 流里的推理');
  });

  it('parses responses reasoning_summary_text.delta stream events', () => {
    const state = createResponsesStreamParseState();
    const parsed = parseResponsesStreamPayload(
      {
        type: 'response.reasoning_summary_text.delta',
        item_id: 'rs_1',
        delta: '先分析'
      },
      state
    );
    expect(parsed?.reasoning).toBe('先分析');
  });

  it('parses responses output_item.done reasoning blob when no deltas streamed', () => {
    const state = createResponsesStreamParseState();
    const parsed = parseResponsesStreamPayload(
      {
        type: 'response.output_item.done',
        item: {
          id: 'rs_2',
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: '完整推理摘要' }]
        }
      },
      state
    );
    expect(parsed?.reasoning).toBe('完整推理摘要');
  });

  it('skips output_item.done reasoning when deltas already streamed for same item', () => {
    const state = createResponsesStreamParseState();
    parseResponsesStreamPayload(
      {
        type: 'response.reasoning_summary_text.delta',
        item_id: 'rs_3',
        delta: '流式'
      },
      state
    );
    const parsed = parseResponsesStreamPayload(
      {
        type: 'response.output_item.done',
        item: {
          id: 'rs_3',
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: '不应重复' }]
        }
      },
      state
    );
    expect(parsed).toBeNull();
  });

  it('parses responses reasoning_summary_part.done stream events', () => {
    const state = createResponsesStreamParseState();
    const parsed = parseResponsesStreamPayload(
      {
        type: 'response.reasoning_summary_part.done',
        item_id: 'rs_1',
        summary_index: 0,
        part: { type: 'summary_text', text: '完整推理段落' }
      },
      state
    );
    expect(parsed?.reasoning).toBe('完整推理段落');
  });

  it('parses chat completions reasoning_text delta on responses fallback', () => {
    const parsed = parseChatCompletionsStreamPayload({
      choices: [{ delta: { reasoning_text: '链式思考', content: '' } }]
    });
    expect(parsed?.reasoning).toBe('链式思考');
  });

  it('parses non-stream responses reasoning output items', () => {
    const result = extractResponsesApiResult({
      object: 'response',
      output: [
        {
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: '非流式推理' }]
        },
        {
          type: 'message',
          content: [{ type: 'output_text', text: '回答' }]
        }
      ]
    });
    expect(result.reasoning).toBe('非流式推理');
    expect(result.content).toBe('回答');
  });

  it('backfills reasoning from response.completed when no deltas streamed', () => {
    const state = createResponsesStreamParseState();
    const parsed = parseResponsesStreamPayload(
      {
        type: 'response.completed',
        response: {
          id: 'resp_done',
          usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          output: [
            {
              type: 'reasoning',
              summary: [{ type: 'summary_text', text: '牛顿迭代法推导' }],
            },
            {
              type: 'message',
              content: [{ type: 'output_text', text: '最终答案' }],
            },
          ],
        },
      },
      state,
    );
    expect(parsed?.reasoning).toBe('牛顿迭代法推导');
    expect(parsed?.response_id).toBe('resp_done');
    expect(parsed?.usage?.prompt_tokens).toBe(100);
  });

  it('backfills only the reasoning remainder when partial deltas were streamed', () => {
    const state = createResponsesStreamParseState();
    state.reasoningStreamedText = '已分析小数位';
    const parsed = parseResponsesStreamPayload(
      {
        type: 'response.completed',
        response: {
          id: 'resp_partial',
          output: [
            {
              type: 'reasoning',
              summary: [{ type: 'summary_text', text: '已分析小数位，9.92 更大' }],
            },
          ],
        },
      },
      state,
    );
    expect(parsed?.reasoning).toBe('，9.92 更大');
  });

  it('parses responses function_call stream events', () => {
    const state = createResponsesStreamParseState();
    const added = parseResponsesStreamPayload(
      {
        type: 'response.output_item.added',
        item: {
          type: 'function_call',
          call_id: 'call_read_upload',
          name: 'readUpload',
          arguments: '',
        },
      },
      state,
    );
    expect(added?.tool_calls).toEqual([
      { id: 'call_read_upload', name: 'readUpload', arguments: {} },
    ]);

    const delta = parseResponsesStreamPayload(
      {
        type: 'response.function_call_arguments.delta',
        item_id: 'call_read_upload',
        delta: '{"fileId":"file-1"',
      },
      state,
    );
    expect(delta?.tool_calls?.[0]).toMatchObject({
      id: 'call_read_upload',
      name: 'readUpload',
      arguments: '{"fileId":"file-1"',
    });

    const done = parseResponsesStreamPayload(
      {
        type: 'response.function_call_arguments.done',
        item_id: 'call_read_upload',
        name: 'readUpload',
        arguments: '{"fileId":"file-1"}',
      },
      state,
    );
    expect(done?.tool_calls).toEqual([
      { id: 'call_read_upload', name: 'readUpload', arguments: { fileId: 'file-1' } },
    ]);
  });

  it('backfills function calls from response.completed output', () => {
    const state = createResponsesStreamParseState();
    const parsed = parseResponsesStreamPayload(
      {
        type: 'response.completed',
        response: {
          id: 'resp_tools',
          output: [
            {
              type: 'reasoning',
              summary: [{ type: 'summary_text', text: 'Inspecting file access' }],
            },
            {
              type: 'function_call',
              call_id: 'call_read_upload',
              name: 'readUpload',
              arguments: '{"fileId":"file-1"}',
            },
          ],
        },
      },
      state,
    );
    expect(parsed?.tool_calls).toEqual([
      { id: 'call_read_upload', name: 'readUpload', arguments: { fileId: 'file-1' } },
    ]);
  });

  it('parses chat completions final message chunk without delta', () => {
    const parsed = parseChatCompletionsStreamPayload({
      id: 'chatcmpl-final',
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: { role: 'assistant', content: '你好，有什么可以帮你？' },
        },
      ],
    });
    expect(parsed?.content).toBe('你好，有什么可以帮你？');
  });

  it('parses chat completions content when chunk also carries chatcmpl id', () => {
    const parsed = parseChatCompletionsStreamPayload({
      id: 'chatcmpl-abc123',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: '你好' }, finish_reason: null }],
    });
    expect(parsed?.content).toBe('你好');
  });

  it('parses chat completions tool_calls deltas in stream events', () => {
    const state = createChatCompletionsStreamParseState();
    const first = parseChatCompletionsStreamPayload(
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_chat',
                  function: { name: 'readUpload', arguments: '{"fileId":"' },
                },
              ],
            },
          },
        ],
      },
      state,
    );
    expect(first?.tool_calls).toEqual([
      { id: 'call_chat', name: 'readUpload', arguments: '{"fileId":"' },
    ]);

    const second = parseChatCompletionsStreamPayload(
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: { arguments: 'file-1"}' },
                },
              ],
            },
          },
        ],
      },
      state,
    );
    expect(second?.tool_calls).toEqual([
      { id: 'call_chat', name: 'readUpload', arguments: { fileId: 'file-1' } },
    ]);
  });

  it('backfills chat completions tool_calls from final message chunk', () => {
    const state = createChatCompletionsStreamParseState();
    const parsed = parseChatCompletionsStreamPayload(
      {
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              tool_calls: [
                {
                  id: 'call_final',
                  type: 'function',
                  function: {
                    name: 'readUpload',
                    arguments: '{"fileId":"file-1"}',
                  },
                },
              ],
            },
          },
        ],
      },
      state,
    );
    expect(parsed?.tool_calls).toEqual([
      { id: 'call_final', name: 'readUpload', arguments: { fileId: 'file-1' } },
    ]);
  });

  it('parses messages API tool_use stream events', () => {
    const state = createMessagesStreamParseState();
    const started = parseMessagesStreamPayload(
      {
        type: 'content_block_start',
        index: 1,
        content_block: {
          type: 'tool_use',
          id: 'toolu_read_upload',
          name: 'readUpload',
          input: {},
        },
      },
      state,
    );
    expect(started?.tool_calls).toEqual([
      { id: 'toolu_read_upload', name: 'readUpload', arguments: {} },
    ]);

    const delta = parseMessagesStreamPayload(
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{"fileId":"file-1"}' },
      },
      state,
    );
    expect(delta?.tool_calls).toEqual([
      { id: 'toolu_read_upload', name: 'readUpload', arguments: '{"fileId":"file-1"}' },
    ]);

    const stopped = parseMessagesStreamPayload(
      {
        type: 'content_block_stop',
        index: 1,
      },
      state,
    );
    expect(stopped?.tool_calls).toEqual([
      { id: 'toolu_read_upload', name: 'readUpload', arguments: { fileId: 'file-1' } },
    ]);
  });

  it('backfills messages API tool_use from message_stop payload', () => {
    const state = createMessagesStreamParseState();
    const parsed = parseMessagesStreamPayload(
      {
        type: 'message_stop',
        message: {
          content: [
            { type: 'thinking', thinking: 'Inspecting file access' },
            {
              type: 'tool_use',
              id: 'toolu_read_upload',
              name: 'readUpload',
              input: { fileId: 'file-1' },
            },
          ],
        },
      },
      state,
    );
    expect(parsed?.reasoning).toBe('Inspecting file access');
    expect(parsed?.tool_calls).toEqual([
      { id: 'toolu_read_upload', name: 'readUpload', arguments: { fileId: 'file-1' } },
    ]);
  });
});

describe('createAIProvider routing', () => {
  it('uses apiUrl directly when apiEndpoint is passthrough', () => {
    class TestableOpenAIProvider extends OpenAIProvider {
      exposeChatCompletionsEndpoint() {
        return this.chatCompletionsEndpoint();
      }
    }

    const provider = new TestableOpenAIProvider(
      'https://proxy.example.com/custom/v1/chat/completions',
      'sk-test',
      'gpt-4',
      undefined,
      'passthrough'
    );

    expect(provider.exposeChatCompletionsEndpoint()).toBe(
      'https://proxy.example.com/custom/v1/chat/completions'
    );
  });

  it('appends /v1/chat/completions for model-scoped gateway base URLs', () => {
    class TestableOpenAIProvider extends OpenAIProvider {
      exposeChatCompletionsEndpoint() {
        return this.chatCompletionsEndpoint();
      }
    }

    const provider = new TestableOpenAIProvider(
      'https://modelinference.inspurcloud.cn:9443/deepseek-v4-flash',
      'sk-test',
      'DeepSeek-V4-Flash',
      undefined,
      'chat_completions'
    );

    expect(provider.exposeChatCompletionsEndpoint()).toBe(
      'https://modelinference.inspurcloud.cn:9443/deepseek-v4-flash/v1/chat/completions'
    );
  });

  it('appends /v1/chat/completions for standard OpenAI base URLs', () => {
    class TestableOpenAIProvider extends OpenAIProvider {
      exposeChatCompletionsEndpoint() {
        return this.chatCompletionsEndpoint();
      }
    }

    const provider = new TestableOpenAIProvider(
      'https://api.openai.com/v1',
      'sk-test',
      'gpt-4.1',
      undefined,
      'chat_completions'
    );

    expect(provider.exposeChatCompletionsEndpoint()).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
  });

  it('creates Anthropic provider defaulting to /v1/messages for DeepSeek gateway', () => {
    expect(resolveDefaultApiEndpoint('CLAUDE')).toBe('messages');

    const provider = createAIProvider({
      type: 'CLAUDE',
      apiUrl: 'https://api.deepseek.com/anthropic',
      apiKey: 'sk-test',
      model: 'deepseek-v4-flash',
      reasoningEffort: 'high'
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider?.name).toBe('Anthropic');
  });

  it('keeps official Anthropic hosts on AnthropicProvider with messages endpoint', () => {
    const provider = createAIProvider({
      type: 'CLAUDE',
      apiUrl: 'https://api.anthropic.com',
      apiKey: 'sk-test',
      model: 'claude-opus-4-6'
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider?.name).toBe('Anthropic');
  });
});

describe('resolveStreamEndpointPlans', () => {
  it('pins to responses only when responses is pinned, even on third-party hosts (no cache-namespace fallback)', () => {
    expect(
      resolveStreamEndpointPlans({
        apiUrl: 'https://ahg.codes/v1',
        apiEndpoint: 'responses',
        reasoningEffort: 'high'
      })
    ).toEqual(['responses']);
  });

  it('uses only /responses when apiEndpoint is pinned to responses on official OpenAI', () => {
    expect(
      resolveStreamEndpointPlans({
        apiUrl: 'https://api.openai.com/v1',
        apiEndpoint: 'responses',
        reasoningEffort: 'high'
      })
    ).toEqual(['responses']);
  });

  it('uses only /messages when apiEndpoint is pinned to messages', () => {
    expect(
      resolveStreamEndpointPlans({
        apiUrl: 'https://api.anthropic.com',
        apiEndpoint: 'messages',
        reasoningEffort: 'high'
      })
    ).toEqual(['messages']);
  });

  it('auto-prefers messages for anthropic-compatible hosts with reasoning in auto mode', () => {
    expect(
      resolveStreamEndpointPlans({
        apiUrl: 'https://ahg.codes/v1/anthropic',
        apiEndpoint: 'auto',
        reasoningEffort: 'high'
      })
    ).toEqual(['messages', 'chat_completions', 'responses']);
  });

  it('auto-prefers chat/completions for third-party OpenAI-compatible hosts with reasoning', () => {
    expect(
      resolveStreamEndpointPlans({
        apiUrl: 'https://ahg.codes/v1',
        apiEndpoint: 'auto',
        providerLabel: 'OpenAI',
        model: 'gpt-5.5',
        reasoningEffort: 'high'
      })
    ).toEqual(['chat_completions', 'responses', 'messages']);
    expect(isOfficialOpenAiApiBase('https://api.openai.com/v1')).toBe(true);
    expect(isOfficialOpenAiApiBase('https://ahg.codes/v1')).toBe(false);
  });
});

describe('shouldTryAlternateOpenAIEndpoint', () => {
  it('retries alternate endpoints after transient network failures', () => {
    expect(shouldTryAlternateOpenAIEndpoint(new Error('fetch failed'))).toBe(true);
    expect(shouldTryAlternateOpenAIEndpoint(new Error('502 Bad Gateway'))).toBe(true);
    expect(shouldTryAlternateOpenAIEndpoint(new Error('invalid api key'))).toBe(false);
  });
});

describe('endpoint tool adapters', () => {
  it('toResponsesApiTools flattens tools for Responses API', () => {
    expect(
      toResponsesApiTools([
        {
          name: 'query_knowledge',
          description: 'Search KB',
          schema: { type: 'object', properties: { query: { type: 'string' } } }
        }
      ])
    ).toEqual([
      {
        type: 'function',
        name: 'query_knowledge',
        description: 'Search KB',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: [],
          }
      }
    ]);
  });

  it('toMessagesApiTools maps tools for Messages API', () => {
    expect(
      toMessagesApiTools([
        {
          name: 'query_knowledge',
          description: 'Search KB',
          schema: { type: 'object', properties: { query: { type: 'string' } } }
        }
      ])
    ).toEqual([
      {
        name: 'query_knowledge',
        description: 'Search KB',
        input_schema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: [],
        }
      }
    ]);
  });

  it('normalizes a null required field for every provider tool format', () => {
    const tool = [
      {
        name: 'list_dir',
        description: 'List a directory',
        schema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: null,
        },
      },
    ];

    expect(toResponsesApiTools(tool)?.[0]?.parameters).toMatchObject({
      type: 'object',
      required: [],
    });
    expect(toMessagesApiTools(tool)?.[0]?.input_schema).toMatchObject({
      type: 'object',
      required: [],
    });
  });

  it('toMessagesApiMessages omits history reasoning by default for cache stability', () => {
    expect(
      toMessagesApiMessages([
        { role: 'user', content: '看一下所有skill' },
        {
          role: 'assistant',
          content: '',
          reasoning: '先列出技能目录',
          tool_calls: [{ id: 'toolu_list', name: 'list_skill', arguments: {} }],
        },
        {
          role: 'tool',
          tool_call_id: 'toolu_list',
          name: 'list_skill',
          content: JSON.stringify({
            count: 2,
            results: [{ id: 'daily-one-x' }, { id: 'memory-read' }],
          }),
        },
      ]),
    ).toEqual([
      { role: 'user', content: '看一下所有skill' },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'toolu_list', name: 'list_skill', input: {} },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_list',
            content: JSON.stringify({
              count: 2,
              results: [{ id: 'daily-one-x' }, { id: 'memory-read' }],
            }),
          },
        ],
      },
    ]);
  });

  it('toMessagesApiMessages keeps thinking blocks when keepHistoryReasoning is true', () => {
    expect(
      toMessagesApiMessages(
        [
          { role: 'user', content: '看一下所有skill' },
          {
            role: 'assistant',
            content: '',
            reasoning: '先列出技能目录',
            tool_calls: [{ id: 'toolu_list', name: 'list_skill', arguments: {} }],
          },
        ],
        { keepHistoryReasoning: true },
      ),
    ).toEqual([
      { role: 'user', content: '看一下所有skill' },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '先列出技能目录' },
          { type: 'tool_use', id: 'toolu_list', name: 'list_skill', input: {} },
        ],
      },
    ]);
  });

  it('toResponsesApiInputItems omits history reasoning by default for cache stability', () => {
    expect(
      toResponsesApiInputItems([
        { role: 'user', content: '看一下所有skill' },
        {
          role: 'assistant',
          content: '',
          reasoning: '先列出技能目录',
          tool_calls: [{ id: 'call_list', name: 'list_skill', arguments: {} }],
        },
        {
          role: 'tool',
          tool_call_id: 'call_list',
          name: 'list_skill',
          content: JSON.stringify({ count: 2, results: [{ id: 'daily-one-x' }] }),
        },
      ]),
    ).toEqual([
      { role: 'user', content: '看一下所有skill' },
      {
        type: 'function_call',
        call_id: 'call_list',
        name: 'list_skill',
        arguments: '{}',
      },
      {
        type: 'function_call_output',
        call_id: 'call_list',
        output: JSON.stringify({ count: 2, results: [{ id: 'daily-one-x' }] }),
      },
    ]);
  });

  it('toResponsesApiInputItems keeps reasoning summary when keepHistoryReasoning is true', () => {
    expect(
      toResponsesApiInputItems(
        [
          { role: 'user', content: '看一下所有skill' },
          {
            role: 'assistant',
            content: '',
            reasoning: '先列出技能目录',
            tool_calls: [{ id: 'call_list', name: 'list_skill', arguments: {} }],
          },
        ],
        { keepHistoryReasoning: true },
      ),
    ).toEqual([
      { role: 'user', content: '看一下所有skill' },
      {
        type: 'reasoning',
        summary: [{ type: 'summary_text', text: '先列出技能目录' }],
      },
      {
        type: 'function_call',
        call_id: 'call_list',
        name: 'list_skill',
        arguments: '{}',
      },
    ]);
  });

  it('toChatCompletionsApiMessages omits history reasoning by default for cache stability', () => {
    expect(
      toChatCompletionsApiMessages([
        { role: 'user', content: '看一下所有skill' },
        {
          role: 'assistant',
          content: '',
          reasoning: '先列出技能目录',
          tool_calls: [{ id: 'call_list', name: 'list_skill', arguments: {} }],
        },
        {
          role: 'tool',
          tool_call_id: 'call_list',
          name: 'list_skill',
          content: JSON.stringify({ count: 2, results: [{ id: 'daily-one-x' }] }),
        },
      ]),
    ).toEqual([
      { role: 'user', content: '看一下所有skill' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_list',
            type: 'function',
            function: { name: 'list_skill', arguments: '{}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_list',
        name: 'list_skill',
        content: JSON.stringify({ count: 2, results: [{ id: 'daily-one-x' }] }),
      },
    ]);
  });

  it('toChatCompletionsApiMessages keeps reasoning_content when keepHistoryReasoning is true', () => {
    expect(
      toChatCompletionsApiMessages(
        [
          { role: 'user', content: '看一下所有skill' },
          {
            role: 'assistant',
            content: '',
            reasoning: '先列出技能目录',
            tool_calls: [{ id: 'call_list', name: 'list_skill', arguments: {} }],
          },
        ],
        undefined,
        { keepHistoryReasoning: true },
      ),
    ).toEqual([
      { role: 'user', content: '看一下所有skill' },
      {
        role: 'assistant',
        content: null,
        reasoning_content: '先列出技能目录',
        tool_calls: [
          {
            id: 'call_list',
            type: 'function',
            function: { name: 'list_skill', arguments: '{}' },
          },
        ],
      },
    ]);
  });

  it('splitSystemFromPrompt keeps only the first system message as instructions and routes the rest to a dynamic suffix', () => {
    const result = splitSystemFromPrompt([
      { role: 'system', content: '<base>stable agent prompt</base>' },
      { role: 'system', content: '<retrieved_knowledge>dynamic kb</retrieved_knowledge>' },
      { role: 'system', content: '<memory>dynamic memory</memory>' },
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！' },
      { role: 'system', content: '<todos>dynamic todo</todos>' },
    ]);

    expect(result.systemInstruction).toBe('<base>stable agent prompt</base>');
    expect(result.dynamicSystemSuffix).toBe(
      '<retrieved_knowledge>dynamic kb</retrieved_knowledge>\n\n<memory>dynamic memory</memory>\n\n<todos>dynamic todo</todos>',
    );
    expect(result.conversation).toEqual([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！' },
    ]);
  });

  it('splitSystemFromPrompt collects leftover system messages as suffix when an explicit systemInstruction is supplied', () => {
    const result = splitSystemFromPrompt(
      [
        { role: 'system', content: '<base>should be ignored</base>' },
        { role: 'system', content: '<memory>dynamic memory</memory>' },
        { role: 'user', content: '你好' },
      ],
      '<base>explicit stable prompt</base>',
    );

    expect(result.systemInstruction).toBe('<base>explicit stable prompt</base>');
    expect(result.dynamicSystemSuffix).toBe(
      '<base>should be ignored</base>\n\n<memory>dynamic memory</memory>',
    );
    expect(result.conversation).toEqual([{ role: 'user', content: '你好' }]);
  });
});
