import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import { BaseTool } from '../src/plugins/base/BaseTool.js';
import { ExecuteCommandTool } from '../src/plugins/builtin/tools/ExecuteCommandTool.js';
import {
  assertValidToolArguments,
  createToolFailureSignature,
  executeWithToolEnvelope,
  normalizeToolCall,
  normalizeToolArguments,
  validateToolArguments
} from '../src/services/agents/runtime/toolProtocol.js';
import type { ToolDefinition } from '../src/types/agent.js';

const queryTool: ToolDefinition = {
  id: 'query_knowledge',
  name: 'query_knowledge',
  description: 'query tool',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' }
    },
    required: ['query']
  },
  uiHints: {
    argumentAliases: {
      query: ['question', 'keyword']
    }
  }
};

class EnvelopeEchoTool extends BaseTool {
  readonly id = 'tool_protocol_echo';
  readonly name = 'tool_protocol_echo';
  readonly description = 'echo tool';
  readonly parameters = {
    type: 'object',
    properties: {
      text: { type: 'string' }
    },
    required: ['text']
  };

  async handler(args: { text?: string }) {
    return { success: true, content: args.text || '', data: { echoed: args.text || '' } };
  }
}

describe('tool protocol', () => {
  it('normalizes JSON string arguments', () => {
    const normalized = normalizeToolArguments('query_knowledge', '{"query":"ReAct","limit":2}');

    expect(normalized.args).toEqual({ query: 'ReAct', limit: 2 });
    expect(normalized.parseError).toBeUndefined();
  });

  it('maps raw query strings to query tools', () => {
    const normalized = normalizeToolCall({ name: 'query_memory', arguments: '用户偏好' });

    expect(normalized.arguments).toEqual({ query: '用户偏好' });
    expect(normalized.rawArguments).toBe('用户偏好');
  });

  it('keeps raw strings for non-query tools', () => {
    const normalized = normalizeToolCall({ name: 'publish_to_wechat', arguments: 'hello' });

    expect(normalized.arguments).toEqual({ _rawInput: 'hello' });
  });

  it('maps aliases before required validation', () => {
    const result = validateToolArguments('query_knowledge', { question: '工具协议' }, queryTool);

    expect(result.ok).toBe(true);
    expect(result.args.query).toBe('工具协议');
  });

  it('coerces numeric strings for schema-compatible legacy workflow args', () => {
    const coverageTool = {
      id: 'query_coverage_index',
      name: 'query_coverage_index',
      description: 'coverage tool',
      parameters: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
          lookbackDays: { type: 'number' },
          maxItems: { type: 'integer' }
        },
        required: ['namespace', 'lookbackDays']
      }
    } as ToolDefinition;

    const result = validateToolArguments(
      'query_coverage_index',
      { namespace: 'ai-daily', lookbackDays: '7', maxItems: '4' },
      coverageTool
    );

    expect(result.ok).toBe(true);
    expect(result.args).toMatchObject({ lookbackDays: 7, maxItems: 4 });
  });

  it('reports missing required and type errors', () => {
    const result = validateToolArguments('query_knowledge', { limit: 'many' }, queryTool);

    expect(result.ok).toBe(false);
    expect(result.missingRequired).toEqual(['query']);
    expect(result.typeErrors).toEqual(['limit 应为 number']);
    expect(() => assertValidToolArguments('query_knowledge', result.args, queryTool)).toThrow(
      'query_knowledge 参数无效'
    );
  });

  it('creates stable failure signatures', () => {
    const left = createToolFailureSignature('tool', { b: 2, a: 1 }, 'missing query');
    const right = createToolFailureSignature('tool', { a: 1, b: 2 }, 'missing query');

    expect(left).toBe(right);
  });

  it('wraps successful tool execution in an envelope without changing result payload', async () => {
    const envelope = await executeWithToolEnvelope({
      toolId: queryTool.id,
      exposedName: queryTool.name,
      arguments: { question: '工具协议', limit: '2' },
      toolDef: queryTool,
      execution: {
        readonly: true,
        parallelizable: true,
        timeoutMs: 1000,
        retryPolicy: { maxAttempts: 2, backoffMs: 0 },
        riskLevel: 'low'
      },
      execute: async (args) => ({ success: true, content: String(args.query), data: args })
    });

    expect(envelope.error).toBeUndefined();
    expect(envelope.result).toMatchObject({
      success: true,
      content: '工具协议',
      data: { query: '工具协议', limit: 2 }
    });
    expect(envelope).toMatchObject({
      toolId: 'query_knowledge',
      exposedName: 'query_knowledge',
      source: 'local',
      schemaVersion: 'tool-execution-envelope-v1',
      validation: { ok: true },
      readonly: true,
      parallelizable: true,
      concurrencySafe: true,
      attempts: 1
    });
  });

  it('returns validation envelope without entering the tool body', async () => {
    let entered = false;
    const envelope = await executeWithToolEnvelope({
      toolId: queryTool.id,
      arguments: { limit: 'many' },
      toolDef: queryTool,
      execute: async () => {
        entered = true;
        return { success: true };
      }
    });

    expect(entered).toBe(false);
    expect(envelope.error).toMatchObject({ code: 'validation_error', retryable: false, attempt: 0 });
    expect(envelope.validation).toMatchObject({
      ok: false,
      missingRequired: ['query'],
      typeErrors: ['limit 应为 number']
    });
  });

  it('classifies timeout and does not retry non-readonly tools by default', async () => {
    let attempts = 0;
    const envelope = await executeWithToolEnvelope({
      toolId: 'slow_tool',
      arguments: {},
      execution: {
        timeoutMs: 5,
        retryPolicy: { maxAttempts: 3, backoffMs: 0 }
      },
      execute: async () => {
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { success: true };
      }
    });

    expect(attempts).toBe(1);
    expect(envelope.error).toMatchObject({ code: 'timeout', retryable: true, attempt: 1 });
    expect(envelope.attempts).toBe(1);
  });

  it('retries readonly retryable failures', async () => {
    let attempts = 0;
    const envelope = await executeWithToolEnvelope({
      toolId: 'flaky_readonly_tool',
      arguments: {},
      execution: {
        readonly: true,
        retryPolicy: { maxAttempts: 2, backoffMs: 0 }
      },
      execute: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('temporary failure');
        return { success: true, content: 'ok' };
      }
    });

    expect(attempts).toBe(2);
    expect(envelope.error).toBeUndefined();
    expect(envelope.result).toMatchObject({ success: true, content: 'ok' });
    expect(envelope.attempts).toBe(2);
  });

  it('classifies parent abort even when the tool body ignores AbortSignal', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort('client_disconnect'), 5);

    const envelope = await executeWithToolEnvelope({
      toolId: 'abort_ignoring_tool',
      arguments: {},
      signal: controller.signal,
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { success: true };
      }
    });

    expect(controller.signal.aborted).toBe(true);
    expect(envelope.error).toMatchObject({ code: 'aborted', retryable: false, attempt: 1 });
  });

  it('keeps ToolRegistry.callTool legacy-compatible while exposing callToolEnvelope', async () => {
    const registry = ToolRegistry.getInstance();
    registry.registerTool(new EnvelopeEchoTool());

    const legacy = await registry.callTool('tool_protocol_echo', { text: 'legacy' });
    const envelope = await registry.callToolEnvelope('tool_protocol_echo', { text: 'envelope' });
    const missingEnvelope = await registry.callToolEnvelope('missing_tool_for_envelope', {});

    await expect(registry.callTool('missing_tool_for_envelope', {})).rejects.toThrow(
      'Tool missing_tool_for_envelope not found'
    );
    expect(legacy).toMatchObject({ success: true, content: 'legacy' });
    expect(envelope.result).toMatchObject({ success: true, content: 'envelope' });
    expect(missingEnvelope.error).toMatchObject({ code: 'not_found' });
  });

  it('passes AbortSignal to execute_command and returns cancellation result', async () => {
    const tool = new ExecuteCommandTool();
    const controller = new AbortController();
    const command = `node -e "setTimeout(() => {}, 1000)"`;
    setTimeout(() => controller.abort('client_disconnect'), 20);

    const result = await tool.handler(
      { command },
      { signal: controller.signal } as any
    );

    expect(controller.signal.aborted).toBe(true);
    expect(result.code).toBe(130);
    expect(result.stderr || '').toContain('Command cancelled');
  });

  it('returns RunCommand-friendly fields after permission-approved execution', async () => {
    const tool = new ExecuteCommandTool();
    const result = await tool.handler({ command: 'echo hitl-approved' });

    expect(result).toMatchObject({
      command: 'echo hitl-approved',
      stdout: 'hitl-approved\n',
      exitCode: 0,
      output: 'hitl-approved\n',
      code: 0,
    });
  });
});
