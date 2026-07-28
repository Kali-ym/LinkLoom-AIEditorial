import { describe, expect, it } from 'vitest';
import { withoutPendingArtifactIds, type ChatMessage } from './sessionStorage';

describe('AI Builder session pending artifact helpers', () => {
  it('removes only matching pending artifact ids', () => {
    const messages: ChatMessage[] = [
      {
        id: 'pending_old',
        role: 'assistant',
        content: 'old pending plan',
        kind: 'plan_artifact_pending',
        pending: true
      } as ChatMessage,
      {
        id: 'pending_new',
        role: 'assistant',
        content: 'new pending plan',
        kind: 'planning_artifact_pending',
        pending: true
      } as ChatMessage,
      {
        id: 'same_id_but_text',
        role: 'assistant',
        content: 'visible assistant message',
        kind: 'text',
        pending: false
      } as ChatMessage
    ];

    const next = withoutPendingArtifactIds(messages, ['pending_old', 'same_id_but_text']);

    expect(next.map((message) => message.id)).toEqual(['pending_new', 'same_id_but_text']);
  });
});