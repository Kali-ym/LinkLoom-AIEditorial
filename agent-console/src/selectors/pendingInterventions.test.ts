import { describe, expect, it, beforeEach } from 'vitest';

import { INTERVENTION_DEMO_MESSAGES } from '../fixtures/interventionDemo';
import { useChatStore } from '../stores/chatStore';
import { selectAllPendingInterventions, selectPendingInterventions } from './pendingInterventions';

describe('mock intervention smoke (M2)', () => {
  beforeEach(() => {
    useChatStore.setState({
      messagesByTopicId: { approval: INTERVENTION_DEMO_MESSAGES },
    });
  });

  it('surfaces pending interventions from approval fixture', () => {
    const pending = selectPendingInterventions(
      useChatStore.getState().getMessages('approval'),
    );
    expect(pending).toHaveLength(12);
    expect(pending.map((p) => p.apiName)).toEqual(
      expect.arrayContaining([
        'createTodos',
        'createPlan',
        'clearTodos',
        'runCommand',
        'executeCode',
        'askUserQuestion',
        'showAgentMarketplace',
        'installPlugin',
        'executeAgentTask',
        'addExperienceMemory',
        'writeFile',
        'editFile',
      ]),
    );
  });

  it('resolves intervention from turnSegments', () => {
    const toolCallId = 'perm-turn-seg';
    useChatStore.setState({
      messagesByTopicId: {
        approval: [
          {
            id: 'approval-a2',
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            turnSegments: [
              {
                kind: 'tool',
                id: 'seg-1',
                tool: {
                  id: toolCallId,
                  toolCallId,
                  apiName: 'runCommand',
                  identifier: 'linkloom-local-system',
                  intervention: { status: 'pending' as const },
                  state: 'executing',
                },
              },
            ],
          },
        ],
      },
    });

    const pending = selectPendingInterventions(useChatStore.getState().getMessages('approval'));
    expect(pending).toHaveLength(1);
    expect(pending[0]?.toolCallId).toBe(toolCallId);
  });

  it('resolves intervention locally in mock mode (approve path)', () => {
    const toolCallId = 'tc_create_todos';
    useChatStore.getState().resolveIntervention('approval', toolCallId, 'approve');

    const pending = selectPendingInterventions(
      useChatStore.getState().getMessages('approval'),
    );
    expect(pending).toHaveLength(11);
    expect(pending.some((p) => p.toolCallId === toolCallId)).toBe(false);

    const assistant = useChatStore
      .getState()
      .getMessages('approval')
      .find((m) => m.id === 'approval-a1');
    const tool = assistant?.tools?.find((t) => t.toolCallId === toolCallId);
    expect(tool?.intervention?.status).toBe('resolved');
    expect(tool?.state).toBe('executing');
    expect(tool?.resultText).toBeUndefined();
  });

  it('only surfaces interventions matching active run permission context', () => {
    const staleToolCallId = 'call_write_stale';
    const activeToolCallId = 'call_cmd_active';
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: '',
        createdAt: new Date().toISOString(),
        turnSegments: [
          {
            kind: 'tool' as const,
            id: 'seg-write',
            tool: {
              id: staleToolCallId,
              toolCallId: staleToolCallId,
              permissionId: 'perm_old',
              apiName: 'writeFile',
              identifier: 'linkloom-local-system',
              intervention: { status: 'pending' as const },
              state: 'executing' as const,
            },
          },
          {
            kind: 'tool' as const,
            id: 'seg-cmd',
            tool: {
              id: activeToolCallId,
              toolCallId: activeToolCallId,
              permissionId: 'perm_new',
              apiName: 'runCommand',
              identifier: 'linkloom-local-system',
              intervention: { status: 'pending' as const },
              state: 'executing' as const,
            },
          },
        ],
      },
    ];

    const pending = selectAllPendingInterventions(messages, null, {
      permissionId: 'perm_new',
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.toolCallId).toBe(activeToolCallId);
  });

  it('matches askUserQuestion when hitlRequestId differs from toolCallId', () => {
    const toolCallId = 'tc_ask_1';
    const hitlRequestId = 'hitl-ask-1';
    const messages = [
      {
        id: 'assistant-ask',
        role: 'assistant' as const,
        content: '',
        createdAt: new Date().toISOString(),
        turnSegments: [
          {
            kind: 'tool' as const,
            id: 'seg-ask',
            tool: {
              id: toolCallId,
              toolCallId,
              apiName: 'askUserQuestion',
              identifier: 'linkloom-user-interaction',
              hitlKind: 'needs_input' as const,
              intervention: { status: 'pending' as const },
              state: 'executing' as const,
            },
          },
        ],
      },
    ];

    const pending = selectAllPendingInterventions(messages, null, {
      hitlRequestId,
      toolCallId,
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.toolCallId).toBe(toolCallId);

    const missed = selectAllPendingInterventions(messages, null, {
      hitlRequestId,
    });
    expect(missed).toHaveLength(0);
  });
});
