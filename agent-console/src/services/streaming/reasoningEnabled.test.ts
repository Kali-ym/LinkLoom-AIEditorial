import { describe, expect, it } from 'vitest';

import type { AgentChatConfig, AgentPlusState } from '../../domain/types/agentChatConfig';
import { createDefaultPlusState, DEFAULT_AGENT_CHAT_CONFIG, DEFAULT_MODEL_PARAMS } from '../../domain/defaults/agentPlusState';
import {
  buildAgentRunConsoleMetadata,
  hasHydratedPlusState,
  isReasoningUiEnabled,
  shouldConsumeReasoningStream,
} from './reasoningEnabled';

describe('reasoning UI gate', () => {
  it('treats enableReasoning as reasoning on', () => {
    expect(isReasoningUiEnabled({ enableReasoning: true } as AgentChatConfig)).toBe(true);
  });

  it('treats enableReasoningEffort as reasoning on', () => {
    expect(isReasoningUiEnabled({ enableReasoningEffort: true } as AgentChatConfig)).toBe(true);
  });

  it('treats thinking=enabled as reasoning on', () => {
    expect(
      isReasoningUiEnabled({
        thinking: 'enabled',
      } as AgentChatConfig),
    ).toBe(true);
  });

  it('treats all-off as reasoning disabled', () => {
    expect(
      isReasoningUiEnabled({
        enableReasoning: false,
        enableReasoningEffort: false,
        thinking: 'disabled',
      } as AgentChatConfig),
    ).toBe(false);
  });

  it('treats missing config as reasoning disabled', () => {
    expect(isReasoningUiEnabled(undefined)).toBe(false);
  });
});

describe('reasoning stream metadata', () => {
  const plusState = createDefaultPlusState({
    chatConfig: { ...DEFAULT_AGENT_CHAT_CONFIG, enableReasoning: true, enableReasoningEffort: true },
    params: { ...DEFAULT_MODEL_PARAMS, reasoning_effort: 'high' },
  });

  it('omits run metadata until plus state is hydrated', () => {
    expect(buildAgentRunConsoleMetadata('agent-1', plusState, {})).toBeUndefined();
  });

  it('sends run metadata after plus state hydrates', () => {
    const map: Record<string, AgentPlusState> = { 'agent-1': plusState };
    expect(buildAgentRunConsoleMetadata('agent-1', plusState, map)).toEqual({
      agentConsole: {
        chatConfig: plusState.chatConfig,
        params: plusState.params,
      },
    });
    expect(hasHydratedPlusState('agent-1', map)).toBe(true);
  });

  it('does not gate reasoning events before hydration', () => {
    expect(
      shouldConsumeReasoningStream('agent-1', {}, { enableReasoning: false } as AgentChatConfig),
    ).toBe(true);
  });

  it('gates reasoning events after hydration when toggles are off', () => {
    const map: Record<string, AgentPlusState> = { 'agent-1': plusState };
    expect(
      shouldConsumeReasoningStream(
        'agent-1',
        map,
        { enableReasoning: false, enableReasoningEffort: false } as AgentChatConfig,
      ),
    ).toBe(false);
  });
});
