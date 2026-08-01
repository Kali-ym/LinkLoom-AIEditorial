import type { ToolDefinition } from '../../../types/agent.js';
import type { AIMessage } from '../../../types/index.js';
import {
  hashString,
  stableStringify,
} from '../engine/canonicalMessageSerializer.js';
import {
  PI_CONTEXT_PROTOCOL_VERSION,
  type SessionContext,
} from './PiContextTypes.js';

export interface SessionContextBuildInput {
  stableSystemPrompt: string;
  variantMessages?: AIMessage[];
  trajectory: AIMessage[];
  providerTools: ToolDefinition[];
}

export class SessionContextBuilder {
  build(input: SessionContextBuildInput): SessionContext {
    const variantMessages = cloneMessages(input.variantMessages ?? []);
    const trajectory = cloneMessages(input.trajectory);
    const providerTools = structuredClone(input.providerTools);
    const stableSystemPrompt = input.stableSystemPrompt.trim();

    return {
      protocolVersion: PI_CONTEXT_PROTOCOL_VERSION,
      stableSystemPrompt,
      variantMessages,
      trajectory,
      providerTools,
      stablePrefixHash: hashString(stableSystemPrompt),
      variantHash: hashString(stableStringify(variantMessages)),
      toolsetHash: hashString(stableStringify(providerTools)),
    };
  }
}

function cloneMessages(messages: AIMessage[]): AIMessage[] {
  return structuredClone(messages);
}
