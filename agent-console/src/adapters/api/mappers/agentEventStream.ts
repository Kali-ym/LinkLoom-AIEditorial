import type { ChatStreamEvent } from '../../ports/IChatStreamPort';
import type { AgentEventItem } from '../../../utils/agentEvents';
import { isAgentRunTerminalEvent } from '../../../utils/agentEvents';
import { extractTokenUsage } from '../../../utils/tokenUsage';
import type { ContextUsageSnapshot } from '../../../domain/types/contextUsage';
import type {
  BackendHitlRequest,
  BackendPermissionDecision,
  BackendPermissionRequest,
} from '../types/hitl';
import { resolveLinkLoomToolIdentity } from './toolIdentityMapper';
import { TOOLSET_IDS } from '../../../domain/constants/toolsetIdentifiers';
import { resolvePayloadPluginState, resolveToolErrorDisplay } from './toolResultPayload';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function normalizeToolArguments(argumentsValue: unknown): Record<string, unknown> | undefined {
  if (argumentsValue === undefined || argumentsValue === null) return undefined;
  if (typeof argumentsValue === 'object' && !Array.isArray(argumentsValue)) {
    return argumentsValue as Record<string, unknown>;
  }
  return { input: argumentsValue };
}

function resolveMcpServerId(payload: Record<string, unknown>): string | undefined {
  const direct = asString(payload.mcpServerId);
  if (direct) return direct;
  const execution = asRecord(payload.execution);
  const mcp = asRecord(execution?.mcp);
  return asString(mcp?.serverId) || undefined;
}

function formatDurationMs(durationMs: number): string {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function resolveResultText(payload: Record<string, unknown>, state: 'executing' | 'success' | 'error'): string | undefined {
  if (state === 'error') {
    return asString(payload.error) || asString(payload.content) || '失败';
  }
  if (state !== 'success') return undefined;

  const content = asString(payload.content);
  if (content) return content;

  const data = payload.data;
  if (data === undefined || data === null) return undefined;
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function resolvePluginState(
  payload: Record<string, unknown>,
  toolName: string,
  args?: Record<string, unknown>,
): unknown {
  return resolvePayloadPluginState(payload, toolName, args);
}

function toolPayloadFromPermission(request: BackendPermissionRequest): Record<string, unknown> {
  const subject = request.subject;
  const toolName = subject.toolName ?? subject.exposedName ?? 'tool';
  const exposedName = subject.exposedName ?? subject.toolName;
  const permissionId = request.permissionId;
  const toolCallId = asString(request.metadata?.toolCallId) || undefined;
  const identity = resolveLinkLoomToolIdentity({
    toolName,
    exposedName,
    mcpServerId: subject.mcpServerId,
  });
  const args = normalizeToolArguments(request.arguments);
  return {
    permissionId,
    id: toolCallId ?? permissionId,
    toolCallId: toolCallId ?? permissionId,
    identifier: identity.identifier,
    apiName: identity.apiName,
    api: identity.apiName,
    plugin: identity.plugin,
    linkloomToolId: identity.linkloomToolId,
    state: 'pending',
    intervention: { status: 'pending' },
    arguments: args,
    params: args ?? { input: request.arguments },
    customTitle: request.reason ? `等待批准：${exposedName ?? toolName}` : `等待批准：${exposedName ?? toolName}`,
  };
}

function toolPayloadFromPermissionHitl(request: BackendHitlRequest): Record<string, unknown> {
  const metadata = asRecord(request.metadata);
  const subject = asRecord(metadata?.subject);
  const toolName = asString(subject?.toolName) || asString(subject?.exposedName) || 'tool';
  const exposedName = asString(subject?.exposedName) || undefined;
  const toolCallId = asString(metadata?.toolCallId) || request.requestId;
  const identity = resolveLinkLoomToolIdentity({
    toolName,
    exposedName,
    mcpServerId: asString(subject?.mcpServerId) || undefined,
  });
  const args = normalizeToolArguments(request.proposedArguments);
  return {
    permissionId: request.permissionId,
    id: toolCallId,
    toolCallId,
    identifier: identity.identifier,
    apiName: identity.apiName,
    api: identity.apiName,
    plugin: identity.plugin,
    linkloomToolId: identity.linkloomToolId,
    state: 'pending',
    intervention: { status: 'pending' },
    arguments: args,
    params: args ?? {},
    customTitle: request.prompt ?? `等待批准：${exposedName ?? toolName}`,
    hitlKind: request.kind,
    hitlPrompt: request.prompt,
    allowedActions: request.allowedActions,
    hitlSchema: request.schema,
  };
}

function toolPayloadFromAskUserHitl(request: BackendHitlRequest): Record<string, unknown> | null {
  const metadata = asRecord(request.metadata);
  if (metadata?.sourceKind !== 'ask_user_question') return null;
  const toolCallId = asString(metadata?.toolCallId) || request.requestId;
  const identity = resolveLinkLoomToolIdentity({ toolName: 'ask_user_question' });
  const args = normalizeToolArguments(request.proposedArguments);
  return {
    id: toolCallId,
    toolCallId,
    identifier: identity.identifier,
    apiName: identity.apiName,
    api: identity.apiName,
    plugin: identity.plugin,
    linkloomToolId: identity.linkloomToolId,
    state: 'pending',
    intervention: { status: 'pending' },
    arguments: args,
    params: args ?? {},
    customTitle: request.prompt ?? '等待你的回答',
    hitlKind: request.kind,
    hitlPrompt: request.prompt,
    allowedActions: request.allowedActions,
    hitlSchema: request.schema,
  };
}

function toolPayloadFromHitlRequest(request: BackendHitlRequest): Record<string, unknown> {
  const kind = request.kind ?? 'hitl';
  return {
    id: request.requestId,
    toolCallId: request.requestId,
    identifier: kind,
    apiName: kind,
    plugin: 'runtime-hitl',
    state: 'executing',
    intervention: { status: 'pending' },
    arguments: request.proposedArguments,
    params:
      request.proposedArguments &&
      typeof request.proposedArguments === 'object' &&
      !Array.isArray(request.proposedArguments)
        ? (request.proposedArguments as Record<string, unknown>)
        : {},
    customTitle: request.prompt ?? '等待人工确认',
    hitlKind: kind,
    hitlPrompt: request.prompt,
    allowedActions: request.allowedActions,
    hitlSchema: request.schema,
  };
}

function hitlContextEvent(
  runId: string,
  permissionId?: string,
  hitlRequestId?: string,
): ChatStreamEvent {
  return {
    type: 'hitl_context',
    data: { runId, permissionId, hitlRequestId },
  };
}

function toolPayloadFromEvent(
  event: AgentEventItem,
  state: 'executing' | 'success' | 'error',
): Record<string, unknown> {
  const payload = asRecord(event.payload) ?? {};
  const toolCallId = asString(payload.toolCallId) || event.id;
  const toolName = asString(payload.toolName) || asString(payload.exposedName) || 'tool';
  const exposedName = asString(payload.exposedName) || undefined;
  const identity = resolveLinkLoomToolIdentity({
    toolName,
    exposedName,
    mcpServerId: resolveMcpServerId(payload),
  });
  const args = normalizeToolArguments(payload.arguments);
  const durationMs = typeof payload.durationMs === 'number' ? payload.durationMs : undefined;
  const resultText = resolveResultText(payload, state);
  const pluginState = resolvePluginState(payload, toolName, args);

  const tool: Record<string, unknown> = {
    id: toolCallId,
    toolCallId,
    identifier: identity.identifier,
    apiName: identity.apiName,
    api: identity.apiName,
    plugin: identity.plugin,
    linkloomToolId: identity.linkloomToolId,
    state,
    arguments: args,
    params: args,
  };

  if (identity.identifier === TOOLSET_IDS.MCP) {
    const mcpServerId = resolveMcpServerId(payload);
    tool.customTitle = mcpServerId
      ? `MCP · ${mcpServerId} · ${identity.apiName}`
      : `MCP · ${identity.apiName}`;
  }

  if (durationMs !== undefined) {
    tool.duration = formatDurationMs(durationMs);
  }

  if (state === 'success') {
    if (resultText) {
      tool.resultText = resultText;
      tool.resultContent = resultText;
    }
    if (pluginState !== undefined) {
      tool.pluginState = pluginState;
    }
  } else if (state === 'error') {
    const display = resolveToolErrorDisplay(payload, pluginState);
    tool.error = display.error;
    if (pluginState !== undefined) {
      tool.pluginState = pluginState;
    }
    const content = display.resultContent ?? resultText;
    if (content) {
      tool.resultText = content;
      tool.resultContent = content;
    }
  }

  return tool;
}

function liveReasoningBlock(): 1 {
  return 1;
}

/** Map one LinkLoom AgentEvent SSE item to UI stream events. */
export function mapAgentEventToChatStreamEvents(
  event: AgentEventItem,
): ChatStreamEvent[] {
  if (event.type === 'error') {
    throw new Error(asString(event.payload.error) || 'SSE stream error');
  }

  if (event.type === 'run_failed') {
    const error = asString(event.payload.error) || 'Agent 运行失败';
    return [{ type: 'turn_failed', text: error, content: error }, { type: 'stop' }];
  }

  if (isAgentRunTerminalEvent(event)) {
    return [{ type: 'stop' }];
  }

  switch (event.type) {
    case 'run_started': {
      const workspace = asRecord(event.payload.workspace);
      const fallback = asString(workspace?.fallback);
      if (!fallback) return [];
      return [
        {
          type: 'workspace_fallback',
          data: {
            fallback,
            fallbackReason: asString(workspace?.fallbackReason) || undefined,
          },
        },
      ];
    }

    case 'model_started':
      return [{ type: 'reasoning_part', content: '', text: '', block: liveReasoningBlock() }];

    case 'message_delta': {
      const content = asString(event.payload.content);
      if (!content) return [];
      return [{ type: 'content_part', content, text: content }];
    }

    case 'model_delta':
      // model_delta mirrors message_delta for the same chunk — skip to avoid 2× streaming text.
      return [];

    case 'reasoning_delta': {
      const content = asString(event.payload.content);
      if (!content) return [];
      return [{ type: 'reasoning_part', content, text: content, block: liveReasoningBlock() }];
    }

    // Durable replay-only event: live UI already rendered reasoning_delta tokens.
    case 'reasoning_snapshot':
      return [];

    case 'tool_call_requested':
      return [
        {
          type: 'tool_calls',
          tools: [toolPayloadFromEvent(event, 'executing')],
        },
      ];

    // tool_started 不含稳定 toolCallId（后端 tool_start 未携带 id），若再映射为 tool_calls
    // 会与 tool_call_requested 产生重复块（后者用 event.id 作 key → plugin › api）。
    case 'tool_started':
      return [];

    case 'tool_finished': {
      const success = event.payload.success !== false;
      if (!success) {
        const payload = asRecord(event.payload) ?? {};
        const data = asRecord(payload.data);
        if (asString(data?.status) === 'user_denied') {
          return [];
        }
        const errorText = (
          resolveResultText(payload, 'error') ?? asString(payload.error) ?? ''
        ).toLowerCase();
        // Only filter the backend permission-pause stub / deny markers, NOT genuine
        // execution failures whose message merely contains "permission denied"
        // (e.g. filesystem EACCES). See ReActRuntime permission stub/deny text.
        const isPermissionStub =
          errorText.includes('permission required:') ||
          errorText.includes('permission required for') ||
          errorText.includes('permission denied for tool');
        if (isPermissionStub) {
          return [];
        }
      }
      return [
        {
          type: 'tool_calls',
          tools: [toolPayloadFromEvent(event, success ? 'success' : 'error')],
        },
      ];
    }

    case 'permission_required': {
      const request = event.payload as unknown as BackendPermissionRequest;
      const runId = event.runId ?? request.runId;
      return [
        hitlContextEvent(runId, request.permissionId),
        {
          type: 'tool_calls',
          tools: [toolPayloadFromPermission(request)],
        },
      ];
    }

    case 'hitl_required': {
      const request = event.payload as unknown as BackendHitlRequest;
      const runId = event.runId ?? '';
      if (request.permissionId) {
        return [
          hitlContextEvent(runId, request.permissionId, request.requestId),
          {
            type: 'tool_calls',
            tools: [toolPayloadFromPermissionHitl(request)],
          },
        ];
      }
      const askPayload = toolPayloadFromAskUserHitl(request);
      if (askPayload) {
        return [
          hitlContextEvent(runId, undefined, request.requestId),
          {
            type: 'tool_calls',
            tools: [askPayload],
          },
        ];
      }
      return [
        hitlContextEvent(runId, undefined, request.requestId),
        {
          type: 'tool_calls',
          tools: [toolPayloadFromHitlRequest(request)],
        },
      ];
    }

    case 'permission_resolved': {
      const decision = event.payload as unknown as BackendPermissionDecision;
      const rejected = decision.effect === 'deny';
      const permissionId = decision.permissionId;
      const toolCallId = asString(decision.metadata?.toolCallId) || undefined;
      if (!permissionId) return [];
      return [
        {
          type: 'tool_calls',
          tools: [
            {
              permissionId,
              id: toolCallId ?? permissionId,
              toolCallId: toolCallId ?? permissionId,
              // Approval only unlocks execution; wait for tool_finished before success.
              state: rejected ? 'rejected' : 'executing',
              intervention: { status: 'resolved' },
              rejectedReason: rejected ? decision.reason : undefined,
            },
          ],
        },
      ];
    }

    case 'hitl_resolved':
      return [];

    case 'run_paused': {
      const reason = asString(event.payload.reason);
      if (reason === 'permission' || event.payload.permissionId) {
        return [{ type: 'run_paused', data: event.payload }];
      }
      if (reason === 'needs_input') {
        return [{ type: 'run_paused', data: event.payload }];
      }
      return [];
    }

    case 'message_finished':
      return [];

    case 'model_finished': {
      const events: ChatStreamEvent[] = [];
      const usage = extractTokenUsage(event.payload.usage);
      if (usage.promptTokens || usage.completionTokens) {
        events.push({
          type: 'usage_update',
          usage: {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            breakdown: usage.breakdown,
          },
        });
      }
      return events;
    }

    case 'context_usage_preview': {
      const snapshot = normalizeContextSnapshot(event.payload?.snapshot);
      if (snapshot) {
        return [{ type: 'context_usage_preview', contextSnapshot: snapshot }];
      }
      return [];
    }

    case 'context_compacted': {
      const snapshot = normalizeContextSnapshot(event.payload?.afterSnapshot);
      const events: ChatStreamEvent[] = [];
      if (snapshot) {
        events.push({ type: 'context_compacted', contextSnapshot: snapshot });
      }
      return events;
    }

    default:
      return [];
  }
}

function normalizeContextSnapshot(raw: unknown): ContextUsageSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const byCategory = r.byCategory && typeof r.byCategory === 'object'
    ? r.byCategory as Record<string, number>
    : {};
  const totalTokens = Number(r.totalTokens) || 0;
  const adjustedTotal = Number(r.adjustedTotal) || totalTokens;
  const driftMultiplier = Number(r.driftMultiplier) || 1.15;
  const maxContextTokens = Number(r.maxContextTokens) || 0;
  const reserveOutputTokens = Number(r.reserveOutputTokens) || 0;
  const compactionBuffer = Number(r.compactionBuffer) || 0;
  const usable = maxContextTokens - reserveOutputTokens - compactionBuffer;
  return {
    byCategory,
    totalTokens,
    adjustedTotal,
    driftMultiplier,
    countedAt: typeof r.countedAt === 'string' ? r.countedAt : undefined,
    maxContextTokens,
    reserveOutputTokens,
    compactionBuffer,
    remainingTokens: Number(r.remainingTokens) || Math.max(usable - adjustedTotal, 0),
    usageRatio: Number(r.usageRatio) || (usable > 0 ? adjustedTotal / usable : 0),
    source: (r.source === 'provider' ? 'provider' : 'counter'),
    round: typeof r.round === 'number' ? r.round : undefined,
    compacted: typeof r.compacted === 'boolean' ? r.compacted : undefined,
  };
}
