import { describe, expect, it } from 'vitest';

import { createDefaultPlusState } from '../../../domain/defaults/agentPlusState';
import { applyConfigPatchToBackendAgent, mapBackendAgentToPlusState } from './agent';
import type { BackendAgentDto } from '../types/agent';

function makeBackendAgent(): BackendAgentDto {
  const defaults = createDefaultPlusState();
  return {
    id: 'agent-test',
    name: 'Test Agent',
    description: '',
    systemPrompt: '',
    providerId: defaults.provider,
    model: defaults.model,
    temperature: 0.7,
    toolIds: [],
    skillIds: [],
    mcpServerIds: [],
    streaming: true,
    runtime: { mode: 'classic', maxRounds: 5, returnTrace: true },
    knowledgeCategoryIds: [],
    knowledgeSaveCategoryIds: [],
    memoryCategoryIds: [],
    memorySaveCategoryIds: [],
  };
}

describe('applyConfigPatchToBackendAgent', () => {
  it('persists params and chatConfig under metadata.agentConsole', () => {
    const current = makeBackendAgent();
    const next = applyConfigPatchToBackendAgent(current, {
      params: { temperature: 0.3, top_p: 0.8 },
      chatConfig: { historyCount: 12, enableHistoryCount: true },
    });

    expect(next.temperature).toBe(0.3);
    const consoleMeta = next.metadata?.agentConsole as {
      params?: { temperature?: number; top_p?: number };
      chatConfig?: { historyCount?: number; enableHistoryCount?: boolean };
    };
    expect(consoleMeta?.params?.temperature).toBe(0.3);
    expect(consoleMeta?.params?.top_p).toBe(0.8);
    expect(consoleMeta?.chatConfig?.historyCount).toBe(12);
    expect(consoleMeta?.chatConfig?.enableHistoryCount).toBe(true);
  });

  it('does not seed mock demo plugins when mapping backend agent', () => {
    const plusState = mapBackendAgentToPlusState(makeBackendAgent());
    expect(plusState.plugins).toEqual({});
  });

  it('keeps empty model when backend agent has no model override', () => {
    const plusState = mapBackendAgentToPlusState({
      ...makeBackendAgent(),
      providerId: 'default-gemini',
      model: '',
    });
    expect(plusState.model).toBe('');
    expect(plusState.provider).toBe('default-gemini');
  });

  it('round-trips params via mapBackendAgentToPlusState', () => {
    const patched = applyConfigPatchToBackendAgent(makeBackendAgent(), {
      params: { frequency_penalty: 0.5 },
      chatConfig: { enableFollowUpChips: true },
    });
    const plusState = mapBackendAgentToPlusState(patched);

    expect(plusState.params.frequency_penalty).toBe(0.5);
    expect(plusState.chatConfig.enableFollowUpChips).toBe(true);
  });

  it('persists executionTarget under metadata.agentConsole', () => {
    const next = applyConfigPatchToBackendAgent(makeBackendAgent(), {
      executionTarget: 'sandbox',
      sandboxPolicy: { idleTimeoutMs: 1_800_000, image: 'linkloom-agent:latest' },
    });

    const consoleMeta = next.metadata?.agentConsole as {
      executionTarget?: string;
      sandboxPolicy?: { idleTimeoutMs?: number; image?: string };
    };
    expect(consoleMeta?.executionTarget).toBe('sandbox');
    expect(consoleMeta?.sandboxPolicy).toMatchObject({
      idleTimeoutMs: 1_800_000,
      image: 'linkloom-agent:latest',
    });
  });
});

describe('structured systemPrompt round-trip mapping', () => {
  it('maps backend StructuredPrompt to plusState.structuredSystemRole + preview systemRole', () => {
    const structured = {
      role: '选题 Copilot',
      identity: '详细人设',
      capabilities: '能力',
      constraints: '约束',
      outputFormat: '格式',
    };
    const dto = makeBackendAgent();
    dto.systemPrompt = structured;
    const plus = mapBackendAgentToPlusState(dto);

    expect(plus.structuredSystemRole).toEqual(structured);
    // 预览字符串由 role + identity 拼成
    expect(plus.systemRole).toContain('选题 Copilot');
    expect(plus.systemRole).toContain('详细人设');
  });

  it('maps backend string systemPrompt to plusState.systemRole only (no structured)', () => {
    const dto = makeBackendAgent();
    dto.systemPrompt = '你是助手';
    const plus = mapBackendAgentToPlusState(dto);

    expect(plus.systemRole).toBe('你是助手');
    expect(plus.structuredSystemRole).toBeUndefined();
  });

  it('applies structuredSystemRole patch to backend systemPrompt', () => {
    const current = makeBackendAgent();
    current.systemPrompt = 'old string';
    const next = applyConfigPatchToBackendAgent(current, {
      structuredSystemRole: { role: '新角色', constraints: '新约束' },
    });
    expect(next.systemPrompt).toEqual({ role: '新角色', constraints: '新约束' });
  });

  it('structuredSystemRole=null patch clears structured and falls back to string', () => {
    const current = makeBackendAgent();
    current.systemPrompt = { role: '结构化' };
    const next = applyConfigPatchToBackendAgent(current, {
      structuredSystemRole: null,
      systemRole: '回退字符串',
    });
    expect(next.systemPrompt).toBe('回退字符串');
  });

  it('systemRole patch on a structured agent preserves the structured object', () => {
    const current = makeBackendAgent();
    const structured = { role: '结构化', constraints: '约束' };
    current.systemPrompt = structured;
    // 仅 patch systemRole(预览字符串),不应覆盖结构化对象
    const next = applyConfigPatchToBackendAgent(current, { systemRole: '新预览' });
    expect(next.systemPrompt).toEqual(structured);
  });

  it('systemRole patch on a string agent updates the string', () => {
    const current = makeBackendAgent();
    current.systemPrompt = '旧字符串';
    const next = applyConfigPatchToBackendAgent(current, { systemRole: '新字符串' });
    expect(next.systemPrompt).toBe('新字符串');
  });
});
