import { describe, expect, it } from 'vitest';

import { mapAgentEventToChatStreamEvents } from './agentEventStream';

describe('mapAgentEventToChatStreamEvents', () => {
  it('ignores reasoning_snapshot during live SSE (replay-only; delta already rendered)', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-snapshot',
      type: 'reasoning_snapshot',
      timestamp: '2026-06-26T08:00:02.000Z',
      payload: {
        round: 1,
        content: '要读工作区脚本',
        durationMs: 2100,
        phase: 'pre_tool',
      },
    });

    expect(events).toEqual([]);
  });

  it('emits reasoning_part from model_finished when reasoning was not streamed', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-3',
      type: 'model_finished',
      timestamp: '2026-06-20T08:00:00.000Z',
      payload: {
        reasoning: '比较两个小数',
        usage: { input_tokens: 10, output_tokens: 20 },
      },
    });

    expect(events).toEqual([
      {
        type: 'usage_update',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      },
    ]);
  });

  it('maps reasoning_delta to block 1 (pre-tool)', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-delta',
      type: 'reasoning_delta',
      timestamp: '2026-06-20T08:00:00.000Z',
      payload: { round: 1, content: '先确认文件' },
    });

    expect(events).toEqual([
      { type: 'reasoning_part', content: '先确认文件', text: '先确认文件', block: 1 },
    ]);
  });

  it('skips reasoning_part on model_finished when backend flagged reasoningStreamed', () => {
    // trace_round fires model_finished with reasoning AFTER reasoning_delta already
    // rendered the live "deep thinking" block. Re-emitting would duplicate it below
    // the tool call. The backend sets reasoningStreamed=true; the mapper must
    // suppress the reasoning_part and only forward usage.
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-trace',
      type: 'model_finished',
      timestamp: '2026-06-20T08:00:00.000Z',
      payload: {
        round: 1,
        reasoning: '已经在 delta 里流过了',
        reasoningStreamed: true,
        content: '',
        usage: { input_tokens: 5, output_tokens: 7 },
      },
    });

    expect(events).toEqual([
      {
        type: 'usage_update',
        usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12 },
      },
    ]);
  });

  it('model_finished only forwards usage (reasoning comes from reasoning_snapshot / delta)', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-replay',
      type: 'model_finished',
      timestamp: '2026-06-20T08:00:00.000Z',
      payload: {
        round: 1,
        reasoning: '刷新后重建的思考',
        reasoningStreamed: false,
        usage: { input_tokens: 5, output_tokens: 7 },
      },
    });

    expect(events).toEqual([
      {
        type: 'usage_update',
        usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12 },
      },
    ]);
  });

  it('maps model_finished usage into usage_update stream events', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-1',
      type: 'model_finished',
      timestamp: '2026-06-20T08:00:00.000Z',
      payload: {
        usage: {
          input_tokens: 822,
          output_tokens: 878,
        },
      },
    });

    expect(events).toEqual([
      {
        type: 'usage_update',
        usage: {
          promptTokens: 822,
          completionTokens: 878,
          totalTokens: 1700,
        },
      },
    ]);
  });

  it('ignores model_finished without usage', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-2',
      type: 'model_finished',
      timestamp: '2026-06-20T08:00:00.000Z',
      payload: {},
    });

    expect(events).toEqual([]);
  });

  it('ignores tool_started because tool_call_requested already drives the tool block', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-tool-start',
      type: 'tool_started',
      timestamp: '2026-06-23T08:00:00.000Z',
      payload: {
        toolName: 'query_knowledge',
        arguments: { query: 'RAG 架构' },
      },
    });

    expect(events).toEqual([]);
  });

  it('maps tool_finished with content, duration, and pluginState from data', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-tool-done',
      type: 'tool_finished',
      timestamp: '2026-06-23T08:00:01.000Z',
      payload: {
        toolCallId: 'tc-1',
        toolName: 'query_knowledge',
        success: true,
        content: '找到 3 条相关知识',
        data: { hits: [{ title: 'doc-a' }], total: 3 },
        durationMs: 820,
      },
    });

    expect(events).toEqual([
      {
        type: 'tool_calls',
        tools: [
          {
            id: 'tc-1',
            toolCallId: 'tc-1',
            identifier: 'linkloom-knowledge-base',
            apiName: 'searchKnowledgeBase',
            api: 'searchKnowledgeBase',
            plugin: 'linkloom-knowledge-base',
            linkloomToolId: 'query_knowledge',
            state: 'success',
            arguments: undefined,
            params: undefined,
            duration: '0.8s',
            resultText: '找到 3 条相关知识',
            resultContent: '找到 3 条相关知识',
            pluginState: { hits: [{ title: 'doc-a' }], total: 3 },
          },
        ],
      },
    ]);
  });

  it('maps execute_command tool_finished into RunCommand pluginState', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-exec-done',
      type: 'tool_finished',
      timestamp: '2026-06-23T08:00:02.000Z',
      payload: {
        toolCallId: 'tc-exec',
        toolName: 'execute_command',
        success: true,
        content: 'hello\n',
        data: {
          command: 'echo hello',
          stdout: 'hello\n',
          stderr: '',
          code: 0,
          exitCode: 0,
          output: 'hello\n',
        },
        durationMs: 120,
      },
    });

    expect(events[0]?.type).toBe('tool_calls');
    const tool = events[0]?.tools?.[0];
    expect(tool).toMatchObject({
      identifier: 'linkloom-local-system',
      apiName: 'runCommand',
      state: 'success',
      pluginState: {
        command: 'echo hello',
        stdout: 'hello\n',
        stderr: '',
        code: 0,
        exitCode: 0,
        output: 'hello\n',
      },
    });
  });

  it('maps failed execute_command tool_finished with stderr into error pluginState', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-exec-fail',
      type: 'tool_finished',
      timestamp: '2026-06-23T08:00:02.500Z',
      payload: {
        toolCallId: 'tc-exec-fail',
        toolName: 'execute_command',
        success: false,
        error: 'Tool execution failed',
        data: {
          command: 'rm -rf /workspace/*',
          stdout: '',
          stderr: 'rm: cannot remove: Permission denied',
          exitCode: 1,
        },
        durationMs: 1200,
      },
    });

    expect(events[0]?.type).toBe('tool_calls');
    const tool = events[0]?.tools?.[0] as { resultContent?: unknown } | undefined;
    expect(tool).toMatchObject({
      state: 'error',
      error: 'Tool execution failed',
      pluginState: {
        command: 'rm -rf /workspace/*',
        stderr: 'rm: cannot remove: Permission denied',
        exitCode: 1,
      },
    });
    expect(String(tool?.resultContent)).toContain('stderr:');
    expect(String(tool?.resultContent)).toContain('Permission denied');
  });

  it('maps permission_required for execute_command into runCommand intervention', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-perm',
      type: 'permission_required',
      runId: 'run-exec',
      timestamp: '2026-06-23T08:00:03.000Z',
      payload: {
        permissionId: 'perm-exec-1',
        runId: 'run-exec',
        subject: {
          toolName: 'execute_command',
          exposedName: 'execute_command',
        },
        arguments: { command: 'echo hello' },
        reason: '命令执行需要人工审批。',
      },
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      type: 'hitl_context',
      data: { runId: 'run-exec', permissionId: 'perm-exec-1', hitlRequestId: undefined },
    });
    expect(events[1]).toEqual({
      type: 'tool_calls',
      tools: [
        expect.objectContaining({
          permissionId: 'perm-exec-1',
          id: 'perm-exec-1',
          toolCallId: 'perm-exec-1',
          identifier: 'linkloom-local-system',
          apiName: 'runCommand',
          state: 'pending',
          intervention: { status: 'pending' },
          arguments: { command: 'echo hello' },
        }),
      ],
    });
  });

  it('maps permission_required with toolCallId metadata onto the LLM call id', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-perm-call',
      type: 'permission_required',
      runId: 'run-exec',
      timestamp: '2026-06-23T08:00:03.000Z',
      payload: {
        permissionId: 'perm-exec-1',
        runId: 'run-exec',
        subject: {
          toolName: 'execute_command',
          exposedName: 'execute_command',
        },
        arguments: { command: 'echo hello' },
        metadata: { toolCallId: 'call_wsM0' },
      },
    });

    expect(events[1]?.tools?.[0]).toMatchObject({
      permissionId: 'perm-exec-1',
      toolCallId: 'call_wsM0',
      id: 'call_wsM0',
    });
  });

  it('maps hitl_required with permissionId into hitl_context and pending tool_calls', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-hitl-perm',
      type: 'hitl_required',
      runId: 'run-write',
      timestamp: '2026-06-24T11:49:28.881Z',
      payload: {
        requestId: 'perm_run_write',
        permissionId: 'perm_run_write',
        kind: 'confirmation',
        prompt: 'Approve tool call: writeFile',
        proposedArguments: { path: '/workspace/check_prime.py', content: 'print(1)' },
        metadata: {
          toolCallId: 'call_write',
          subject: { toolName: 'writeFile', exposedName: 'writeFile' },
        },
      },
    });

    expect(events[0]).toMatchObject({
      type: 'hitl_context',
      data: { runId: 'run-write', permissionId: 'perm_run_write', hitlRequestId: 'perm_run_write' },
    });
    expect(events[1]?.tools?.[0]).toMatchObject({
      permissionId: 'perm_run_write',
      toolCallId: 'call_write',
      apiName: 'writeFile',
      intervention: { status: 'pending' },
    });
  });

  it('ignores tool_finished permission errors already covered by permission_required', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-perm-finish',
      type: 'tool_finished',
      runId: 'run-exec',
      timestamp: '2026-06-23T08:00:03.500Z',
      payload: {
        toolCallId: 'perm-exec-1',
        toolName: 'execute_command',
        success: false,
        error: "Permission required for tool 'execute_command'",
      },
    });
    expect(events).toEqual([]);
  });

  it('ignores tool_finished permission denied after user reject', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-deny-finish',
      type: 'tool_finished',
      runId: 'run-exec',
      timestamp: '2026-06-23T08:00:03.600Z',
      payload: {
        toolCallId: 'call_cmd',
        toolName: 'execute_command',
        success: false,
        error: "Permission denied for tool: 'execute_command'",
      },
    });
    expect(events).toEqual([]);
  });

  it('ignores tool_finished user_denied after user reject', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-user-deny-finish',
      type: 'tool_finished',
      runId: 'run-exec',
      timestamp: '2026-06-23T08:00:03.700Z',
      payload: {
        toolCallId: 'call_cmd',
        toolName: 'execute_command',
        success: false,
        error: '直接用 rm -rf',
        data: {
          success: false,
          status: 'user_denied',
          error: '直接用 rm -rf',
        },
      },
    });
    expect(events).toEqual([]);
  });

  it('maps web_search tool_finished into search pluginState for portal', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-search-done',
      type: 'tool_finished',
      timestamp: '2026-06-23T08:00:04.000Z',
      payload: {
        toolCallId: 'tc-search',
        toolName: 'web_search',
        success: true,
        content: '找到 2 条网页结果',
        data: {
          query: 'linkloom agent',
          results: [
            { title: 'Hit A', url: 'https://a.example', snippet: 'A', score: 0.9 },
            { title: 'Hit B', url: 'https://b.example' },
          ],
          count: 2,
        },
        durationMs: 640,
      },
    });

    expect(events[0]?.tools?.[0]).toMatchObject({
      identifier: 'linkloom-web-browsing',
      apiName: 'search',
      state: 'success',
      pluginState: {
        query: 'linkloom agent',
        count: 2,
        results: [
          { title: 'Hit A', url: 'https://a.example', snippet: 'A', score: 0.9 },
          { title: 'Hit B', url: 'https://b.example' },
        ],
      },
    });
  });

  it('maps ask_user_question hitl_required into user-interaction intervention payload', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-ask-hitl',
      type: 'hitl_required',
      runId: 'run-ask',
      timestamp: '2026-06-20T08:00:00.000Z',
      payload: {
        requestId: 'hitl-ask-1',
        kind: 'needs_input',
        status: 'pending',
        prompt: '部署到哪个环境？',
        proposedArguments: {
          question: {
            prompt: '部署到哪个环境？',
            selection: {
              mode: 'single',
              options: [
                { label: 'Staging', value: 'staging' },
                { label: 'Production', value: 'production' },
              ],
              allowCustomInput: true,
            },
          },
        },
        allowedActions: ['provide_input', 'cancel'],
        metadata: {
          sourceKind: 'ask_user_question',
          toolCallId: 'tc_ask_1',
          toolName: 'ask_user_question',
        },
      },
    });

    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({
      type: 'tool_calls',
      tools: [
        expect.objectContaining({
          id: 'tc_ask_1',
          toolCallId: 'tc_ask_1',
          identifier: 'linkloom-user-interaction',
          apiName: 'askUserQuestion',
          plugin: 'linkloom-user-interaction',
          hitlKind: 'needs_input',
          hitlPrompt: '部署到哪个环境？',
          intervention: { status: 'pending' },
        }),
      ],
    });
  });

  it('maps hitl_required needs_input into pending runtime HITL tool payload', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-hitl',
      type: 'hitl_required',
      runId: 'run-1',
      timestamp: '2026-06-20T08:00:00.000Z',
      payload: {
        requestId: 'hitl-1',
        kind: 'needs_input',
        status: 'pending',
        prompt: '请补充信息',
        allowedActions: ['provide_input', 'cancel'],
      },
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      type: 'hitl_context',
      data: { runId: 'run-1', permissionId: undefined, hitlRequestId: 'hitl-1' },
    });
    expect(events[1]).toEqual({
      type: 'tool_calls',
      tools: [
        expect.objectContaining({
          id: 'hitl-1',
          toolCallId: 'hitl-1',
          identifier: 'needs_input',
          apiName: 'needs_input',
          hitlKind: 'needs_input',
          hitlPrompt: '请补充信息',
          allowedActions: ['provide_input', 'cancel'],
          intervention: { status: 'pending' },
        }),
      ],
    });
  });

  it('routes model_started to reasoning block 1 (pre-tool)', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-round-2',
      type: 'model_started',
      timestamp: '2026-06-23T08:00:06.000Z',
      payload: {},
    });

    expect(events).toEqual([
      { type: 'reasoning_part', content: '', text: '', block: 1 },
    ]);
  });

  it('emits workspace_fallback from run_started when workspace fell back to local', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-run-started',
      type: 'run_started',
      timestamp: '2026-06-24T08:00:00.000Z',
      payload: {
        status: 'running',
        workspace: {
          mode: 'local',
          fallback: 'docker-unreachable',
          fallbackReason: 'daemon-unreachable',
        },
      },
    });

    expect(events).toEqual([
      {
        type: 'workspace_fallback',
        data: {
          fallback: 'docker-unreachable',
          fallbackReason: 'daemon-unreachable',
        },
      },
    ]);
  });

  it('ignores run_started without workspace fallback', () => {
    const events = mapAgentEventToChatStreamEvents({
      id: 'evt-run-started',
      type: 'run_started',
      timestamp: '2026-06-24T08:00:00.000Z',
      payload: {
        status: 'running',
        workspace: { mode: 'docker', pool: 'per-agent' },
      },
    });

    expect(events).toEqual([]);
  });
});
