import type { MCPServerConfig, AgentDefinition, ToolDefinition } from '../../../types/agent.js';
import type { AIMessage } from '../../../types/index.js';
import type { ContextPolicy } from '../engine/ContextPolicy.js';
import type { ObservationPolicy } from '../engine/ObservationPolicy.js';
import type { PermissionPolicy } from '../engine/PermissionPolicy.js';
import type { AgentBudgetPolicy, AgentRunSource, AgentRunSpec } from '../engine/AgentRunSpec.js';
import type { WorkspacePolicy } from '../engine/WorkspacePolicy.js';
import type { UserTurnMessageMetadata } from '../userTurnPayload.js';
import { runtimeMessageToAgentContent } from '../userTurnRuntime.js';
import { createAgentSpecSnapshot } from '../engine/AgentSpec.js';

export interface AgentRunSpecInput {
  agentDef: AgentDefinition;
  input: string;
  messages: AIMessage[];
  attachments?: AgentRunSpec['input']['attachments'];
  tools: ToolDefinition[];
  mcpConfigs: MCPServerConfig[];
  skillInstructions: string[];
  date?: string;
  source?: AgentRunSource;
  metadata?: Record<string, unknown>;
  contextPolicy?: ContextPolicy;
  observationPolicy?: ObservationPolicy;
  permissionPolicy?: PermissionPolicy;
  workspacePolicy?: WorkspacePolicy;
  budgetPolicy?: AgentBudgetPolicy;
  threadId?: string;
  sessionId?: string;
  userTurnMetadata?: UserTurnMessageMetadata;
}

export class AgentRunManager {
  createSpec(params: AgentRunSpecInput): AgentRunSpec {
    const runId = this.createRuntimeId(params.agentDef.id, 'run');
    const sessionId = params.sessionId || this.createRuntimeId(params.agentDef.id, 'session');
    const threadId = params.threadId || sessionId;
    const lastUserIndex = findLastMessageIndex(params.messages, 'user');
    const budgetPolicy = this.resolveBudgetPolicy(params.agentDef, params.budgetPolicy);
    const agentSpec = createAgentSpecSnapshot(params.agentDef);

    return {
      runId,
      sessionId,
      threadId,
      source: params.source ?? 'agent',
      agentSpec,
      agentDef: params.agentDef,
      input: {
        prompt: params.input,
        messages: params.messages.map((message, index) => {
          const isTurnInput = index === lastUserIndex && message.role === 'user';
          const persistedContent = isTurnInput
            ? params.input
            : runtimeMessageToAgentContent(message.content);
          return {
            role: message.role,
            content: persistedContent,
            name: message.name,
            toolCallId: message.tool_call_id,
            metadata: {
              toolCalls: message.tool_calls,
              rawParts: message.raw_parts,
              turnInput: isTurnInput || undefined,
              ...(isTurnInput && params.userTurnMetadata ? params.userTurnMetadata : {}),
            }
          };
        }),
        attachments: params.attachments
      },
      tools: params.tools,
      mcpConfigs: params.mcpConfigs,
      skillInstructions: params.skillInstructions,
      budgetPolicy,
      contextPolicy: params.contextPolicy,
      observationPolicy: params.observationPolicy,
      permissionPolicy: params.permissionPolicy,
      workspacePolicy: params.workspacePolicy,
      metadata: {
        agentId: params.agentDef.id,
        agentSpec,
        agentSpecId: agentSpec.specId,
        agentSpecRevision: agentSpec.revision,
        exposedToolIds: params.tools
          .filter((tool) => !String(tool.id).includes('__'))
          .map((tool) => tool.id),
        date: params.date,
        runtimeMode: params.agentDef.runtime?.mode || 'classic',
        contextPolicy: cloneJsonSafe(params.contextPolicy),
        observationPolicy: cloneJsonSafe(params.observationPolicy),
        permissionPolicy: cloneJsonSafe(params.permissionPolicy),
        workspacePolicy: cloneJsonSafe(params.workspacePolicy),
        budgetPolicy: this.cloneBudgetPolicyForMetadata(budgetPolicy),
        ...params.metadata
      }
    };
  }

  resolveBudgetPolicy(agentDef: AgentDefinition, policy?: AgentBudgetPolicy): AgentBudgetPolicy {
    return {
      maxRounds: policy?.maxRounds ?? agentDef.runtime?.maxRounds,
      maxModelCalls: policy?.maxModelCalls,
      maxToolCalls: policy?.maxToolCalls ?? agentDef.runtime?.maxToolCalls,
      maxToolCallsPerRound: policy?.maxToolCallsPerRound ?? agentDef.runtime?.maxToolCallsPerRound,
      maxInputTokens: policy?.maxInputTokens,
      maxOutputTokens: policy?.maxOutputTokens,
      timeoutMs: policy?.timeoutMs,
      maxCostUsd: policy?.maxCostUsd,
      providerGovernance: policy?.providerGovernance
    };
  }

  createRuntimeId(agentId: string, scope: 'run' | 'session'): string {
    return `${scope}_${agentId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private cloneBudgetPolicyForMetadata(policy: AgentBudgetPolicy | undefined): AgentBudgetPolicy | undefined {
    return cloneJsonSafe(policy);
  }
}

function cloneJsonSafe<T>(value: T | undefined): T | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as T;
}

function findLastMessageIndex(messages: AIMessage[], role: AIMessage['role']): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === role) return index;
  }
  return -1;
}

/** Persist only the current turn user input — not the full merged history. */
export function resolvePersistedRunMessages(
  messages: AgentRunSpec['input']['messages'],
): AgentRunSpec['input']['messages'] {
  if (!messages?.length) return [];
  const turnInputs = messages.filter(
    (message) => message.role === 'user' && message.metadata?.turnInput === true,
  );
  if (turnInputs.length > 0) return turnInputs;
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  return lastUser ? [lastUser] : [];
}