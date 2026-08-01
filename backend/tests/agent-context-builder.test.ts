import { describe, expect, it } from 'vitest';
import {
  AGENT_CONTEXT_BUILDER_VERSION,
  AgentContextBuilder
} from '../src/services/agents/context/AgentContextBuilder.js';
import { DefaultContextManager } from '../src/services/agents/engine/ContextManager.js';
import type { AgentCheckpoint } from '../src/services/agents/engine/AgentSession.js';
import type { AIMessage } from '../src/types/index.js';

describe('AgentContextBuilder', () => {
  it('assembles stable, dynamic, conversation, and tail layers in order', () => {
    const builder = new AgentContextBuilder();
    const snapshot = builder.buildInitial({
      systemMessage: { role: 'system', content: 'stable' },
      preUserMessages: [{ role: 'system', content: 'retrieved context' }],
      conversationMessages: [{ role: 'user', content: 'question' }],
      tailMessages: [{ role: 'system', content: 'current todos' }]
    });

    expect(snapshot.messages.map((message) => message.content)).toEqual([
      'stable',
      'retrieved context',
      'question',
      'current todos'
    ]);
    expect(snapshot.layers).toMatchObject({
      stablePrefixMessages: [{ content: 'stable' }],
      dynamicPreUserMessages: [{ content: 'retrieved context' }],
      conversationMessages: [{ content: 'question' }],
      dynamicTailMessages: [{ content: 'current todos' }]
    });
    expect(snapshot.metadata.builderVersion).toBe(AGENT_CONTEXT_BUILDER_VERSION);
  });

  it('does not alias the input messages when building a snapshot', () => {
    const builder = new AgentContextBuilder();
    const systemMessage: AIMessage = {
      role: 'system',
      content: 'stable',
      tool_calls: [{ id: 'call-1', name: 'tool', arguments: { value: 1 } }]
    };
    const snapshot = builder.buildInitial({
      systemMessage,
      preUserMessages: [],
      conversationMessages: [{ role: 'user', content: 'question' }],
      tailMessages: []
    });

    snapshot.messages[0]!.content = 'changed';
    snapshot.messages[0]!.tool_calls![0].arguments.value = 2;

    expect(systemMessage.content).toBe('stable');
    expect(systemMessage.tool_calls![0].arguments.value).toBe(1);
  });

  it('creates stable fingerprints independent of metadata key ordering', () => {
    const builder = new AgentContextBuilder();
    const messages: AIMessage[] = [{ role: 'user', content: 'same' }];

    const first = builder.createFingerprint(messages, {
      summary: 'summary',
      summarySource: 'heuristic',
      artifactIds: ['artifact-b', 'artifact-a'],
      summarizedMessages: 2,
      retainedMessages: 3
    });
    const second = builder.createFingerprint(messages, {
      retainedMessages: 3,
      artifactIds: ['artifact-a', 'artifact-b'],
      summarizedMessages: 2,
      summarySource: 'heuristic',
      summary: 'summary'
    });

    expect(first).toBe(second);
  });

  it('propagates compaction results back into the live message array', async () => {
    const builder = new AgentContextBuilder(new DefaultContextManager());
    const messages: AIMessage[] = Array.from({ length: 8 }, (_, index) => ({
      role: 'user',
      content: `message-${index}-${'x'.repeat(500)}`
    }));

    const result = await builder.compactMessages(messages, {
      policy: {
        compactionStrategy: 'summarize',
        maxMessages: 3,
        summarizeOlderThanMessages: 3,
        maxInputTokens: 1,
        reserveOutputTokens: 0,
        compactionBuffer: 0
      },
      summarizer: async () => 'stable summary'
    });

    expect(result.compacted).toBe(true);
    builder.replaceMessagesInPlace(messages, result.messages);
    expect(messages).toEqual(result.messages);
    expect(messages.some((message) => message.content === 'stable summary')).toBe(true);
    expect(result.fingerprint).toHaveLength(32);
  });

  it('rejects a checkpoint with an invalid context fingerprint', () => {
    const builder = new AgentContextBuilder();
    const messages: AIMessage[] = [{ role: 'user', content: 'resume' }];
    const checkpoint = {
      checkpointId: 'checkpoint-1',
      runId: 'run-1',
      sessionId: 'session-1',
      status: 'running',
      messages: [],
      createdAt: new Date().toISOString(),
      metadata: {
        context: {
          builderVersion: AGENT_CONTEXT_BUILDER_VERSION,
          fingerprint: 'invalid-fingerprint',
          compacted: true
        }
      }
    } as AgentCheckpoint;

    expect(builder.buildFromCheckpoint(checkpoint, messages)).toBeNull();
  });

  it('rehydrates a checkpoint whose context fingerprint matches', () => {
    const builder = new AgentContextBuilder();
    const messages: AIMessage[] = [
      { role: 'system', content: 'stable' },
      { role: 'system', name: '__linkloom_context_summary__', content: 'summary' },
      { role: 'user', content: 'resume' }
    ];
    const fingerprint = builder.createFingerprint(messages, {
      summary: 'summary',
      summarySource: 'heuristic',
      artifactIds: ['artifact-1'],
      summarizedMessages: 2,
      retainedMessages: 1
    });
    const checkpoint = {
      checkpointId: 'checkpoint-2',
      runId: 'run-2',
      sessionId: 'session-2',
      status: 'running',
      messages: [],
      createdAt: new Date().toISOString(),
      metadata: {
        context: {
          builderVersion: AGENT_CONTEXT_BUILDER_VERSION,
          fingerprint,
          compacted: true,
          summary: 'summary',
          summarySource: 'heuristic',
          artifactIds: ['artifact-1'],
          summarizedMessages: 2,
          retainedMessages: 1
        }
      }
    } as AgentCheckpoint;

    expect(builder.buildFromCheckpoint(checkpoint, messages)).toMatchObject({
      compacted: true,
      summary: 'summary',
      artifactIds: ['artifact-1'],
      fingerprint
    });
  });
});
