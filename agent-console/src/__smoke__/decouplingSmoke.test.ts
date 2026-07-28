// @vitest-environment happy-dom
/**
 * Agent Console decoupling smoke checks — mock + API architectural paths.
 * No browser required; validates module wiring and key domain utilities.
 *
 * API mode reachability (manual / CI curl):
 *   GET http://localhost:3000/           → 200
 *   GET http://localhost:3000/api/agents → 401 (auth required)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { ChatStreamEvent } from '../adapters/ports/IChatStreamPort';

const smokeDir = path.dirname(fileURLToPath(import.meta.url));
const agentConsoleRoot = path.resolve(smokeDir, '..');
import { filterBindingsByPlugins } from '../domain/utils/agentPluginBindings';
import { mergeMentionFiles } from '../domain/utils/mentionMenuItems';
import { hasInterventionMeta } from '../features/ChatInput/InterventionBar/interventionMeta';
import { saveClientTopic } from '../services/topic/clientTopicStorage';
import { resolveRemoteMessagesForRefresh } from '../services/topic/resolveRemoteMessagesForRefresh';

describe('Agent Console decoupling smoke', () => {
  describe('import hygiene', () => {
    it('registry exports getAgentConsolePorts and isAgentConsoleApiMode', () => {
      const registrySrc = fs.readFileSync(
        path.join(agentConsoleRoot, 'adapters/registry.ts'),
        'utf8',
      );
      expect(registrySrc).toMatch(/export function getAgentConsolePorts/);
      expect(registrySrc).toMatch(/export function isAgentConsoleApiMode/);
      // Full registry dynamic import pulls apiPorts → @lobehub/* (needs Vite bundle).
      // API reachability is weak-node env: curl localhost:3000 → 200, /api/agents → 401.
    });

    it('loads mock chat stream port without throwing', async () => {
      const mockStream = await import('../adapters/mock/chatStreamPort');
      expect(typeof mockStream.registerMockStreamRun).toBe('function');
      expect(mockStream.mockChatStreamPort.subscribe).toBeTypeOf('function');

      const mockIndexSrc = fs.readFileSync(path.join(agentConsoleRoot, 'adapters/mock/index.ts'), 'utf8');
      expect(mockIndexSrc).toMatch(/export const mockPorts/);
    });
  });

  describe('mock stream port', () => {
    it('emits content events and completes with stop + onDone', async () => {
      const { registerMockStreamRun, mockChatStreamPort } = await import(
        '../adapters/mock/chatStreamPort'
      );

      registerMockStreamRun('test-run', 'hello');

      const events: ChatStreamEvent[] = [];
      let doneCalled = false;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('mock stream timed out')), 10_000);

        mockChatStreamPort.subscribe('test-run', {
          onEvent: (event) => {
            events.push(event);
          },
          onDone: () => {
            doneCalled = true;
            clearTimeout(timeout);
            resolve();
          },
          onError: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });
      });

      const hasContent = events.some(
        (event) => event.type === 'content_part' || event.type === 'text',
      );
      const hasStop = events.some((event) => event.type === 'stop');

      expect(hasContent).toBe(true);
      expect(hasStop).toBe(true);
      expect(doneCalled).toBe(true);
    });
  });

  describe('fork message merge', () => {
    it('prepends fork seed before API messages via resolveRemoteMessagesForRefresh', () => {
      const topicId = 'fork-smoke-topic';
      saveClientTopic({
        id: topicId,
        title: 'Fork smoke',
        seedMessages: [
          { id: 'u1', role: 'user', content: 'u1', createdAt: '2026-06-23T10:00:00.000Z' },
          { id: 'a1', role: 'assistant', content: 'a1', createdAt: '2026-06-23T10:00:01.000Z' },
        ],
        messages: [],
        createdAt: '2026-06-23T10:00:00.000Z',
      });

      const remote = [
        { id: 'u2', role: 'user' as const, content: 'u2', createdAt: '2026-06-23T10:01:00.000Z' },
        {
          id: 'a2',
          role: 'assistant' as const,
          content: 'a2',
          createdAt: '2026-06-23T10:01:01.000Z',
        },
      ];

      const merged = resolveRemoteMessagesForRefresh(topicId, remote);
      expect(merged.map((message) => message.id)).toEqual(['u1', 'a1', 'u2', 'a2']);
    });
  });

  describe('domain utils (post-cleanup)', () => {
    it('filterBindingsByPlugins keeps only enabled plugin ids', () => {
      expect(
        filterBindingsByPlugins(
          [
            { id: 'tool-a', name: 'A' },
            { id: 'tool-b', name: 'B' },
          ],
          { 'tool-a': true, 'tool-b': false },
        ).map((item) => item.id),
      ).toEqual(['tool-a']);
    });

    it('mergeMentionFiles deduplicates by path and caps output', () => {
      const merged = mergeMentionFiles(
        [{ kind: 'file', label: 'README.md', type: 'f1', path: 'README.md' }],
        [{ kind: 'file', label: 'README.md', type: 'kb-doc-1', path: 'README.md' }],
        [{ kind: 'file', label: 'Guide.md', type: 'kb-doc-2', path: 'Docs/Guide.md' }],
      );

      expect(merged).toHaveLength(2);
      expect(merged.map((item) => item.label)).toEqual(['README.md', 'Guide.md']);
    });
  });

  describe('intervention meta coverage', () => {
    it('has meta for legacy alias apiNames', () => {
      expect(hasInterventionMeta('executeAgentTask')).toBe(true);
      expect(hasInterventionMeta('showAgentMarketplace')).toBe(true);
    });
  });
});
