// @vitest-environment happy-dom
/**
 * Super-admin agent smoke — mock stream, HITL, registry config wiring (no browser).
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { filterAgentsForConsole } from '../domain/consoleAgentFilter';
import { APPLICATION_CONSOLE_AGENT_IDS } from '../domain/applicationConsoleAgents';
import {
  applyMockAdminToolSuccess,
  buildAdminMockStreamEvents,
  buildAdminMockToolPayload,
  MOCK_ADMIN_TOOL_RESULTS,
} from '../fixtures/mockAdminTools';
import { MOCK_AGENTS } from '../mock/data';
import { getMockAgents } from '../adapters/mock/seeds/agentSeed';
import { registerMockStreamRun, mockChatStreamPort } from '../adapters/mock/chatStreamPort';
import type { ChatStreamEvent } from '../adapters/ports/IChatStreamPort';
import {
  ADMIN_WRITE_INTERVENTION_API_NAMES,
  isHighRiskAdminIntervention,
} from '../features/ChatInput/InterventionBar/Intervention/adminInterventionConfig';
import { BUILTIN_INTERVENTION_APIS } from '../features/ChatInput/InterventionBar/Intervention/registryMeta';
import { ADMIN_RENDER_API_NAMES } from '../features/Messages/AssistantGroup/Tool/Render/admin/adminRenderConfig';
import { hasInterventionMeta } from '../features/ChatInput/InterventionBar/interventionMeta';
import { useChatStore } from '../stores/chatStore';
import { selectPendingInterventions } from '../selectors/pendingInterventions';

describe('super_admin smoke (Task 5)', () => {
  beforeEach(() => {
    useChatStore.setState({ messagesByTopicId: {}, streamingByTopicId: {} });
  });

  describe('mock agent seed', () => {
    it('super_admin is in console whitelist and mock agent list', () => {
      expect(APPLICATION_CONSOLE_AGENT_IDS).toContain('super_admin');
      const seed = MOCK_AGENTS.find((a) => a.id === 'super_admin');
      expect(seed?.consoleVisible).toBe(true);
      expect(seed?.welcome).toContain('超级管理员');
      expect(seed?.openingQuestions).toContain('帮我创建一个定时任务');

      const agents = getMockAgents();
      expect(agents.some((a) => a.id === 'super_admin')).toBe(true);
      expect(
        filterAgentsForConsole(MOCK_AGENTS.map((a) => ({ ...a, gradient: a.gradient ?? '' }))).some(
          (a) => a.id === 'super_admin',
        ),
      ).toBe(true);
    });
  });

  describe('mock stream — read-only query', () => {
    it('emits listUnevaluatedNews tool + content for 未评分 query', () => {
      const events = buildAdminMockStreamEvents('现在有多少未评分新闻？');
      expect(events).not.toBeNull();
      const tools = events!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : []));
      expect(tools.some((t) => t.apiName === 'listUnevaluatedNews' && t.state === 'success')).toBe(
        true,
      );
      expect(tools.every((t) => t.intervention?.status !== 'pending')).toBe(true);
      expect(events!.some((e) => e.type === 'content_part' && String(e.content).includes('47'))).toBe(
        true,
      );
    });

    it('emits listTaskLogs tool + content for 任务日志 query', () => {
      const events = buildAdminMockStreamEvents('查看任务日志');
      expect(events).not.toBeNull();
      const tools = events!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : []));
      expect(tools.some((t) => t.apiName === 'listTaskLogs' && t.state === 'success')).toBe(true);
      expect(tools.every((t) => t.intervention?.status !== 'pending')).toBe(true);
    });

    it('mock stream port completes for admin query message', async () => {
      registerMockStreamRun('smoke-query', '现在有多少未评分新闻？', 'super_admin');
      const events: ChatStreamEvent[] = [];
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('timeout')), 10_000);
        mockChatStreamPort.subscribe('smoke-query', {
          onEvent: (event) => events.push(event),
          onDone: () => {
            clearTimeout(timeout);
            resolve();
          },
          onError: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });
      });
      expect(events.some((e) => e.type === 'tool_calls')).toBe(true);
      expect(events.some((e) => e.type === 'stop')).toBe(true);
    });
  });

  describe('mock stream — HITL write ops', () => {
    it('create cron intent surfaces pending createCron intervention', () => {
      const events = buildAdminMockStreamEvents('帮我创建一个定时任务');
      const tools = events!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : []));
      const pending = tools.find((t) => t.apiName === 'createCron');
      expect(pending?.intervention?.status).toBe('pending');
      expect(pending?.plugin).toBe('linkloom-admin');
    });

    it('deleteCommitHistory is high-risk; refreshDigestContext is not', () => {
      expect(isHighRiskAdminIntervention('deleteCommitHistory')).toBe(true);
      expect(isHighRiskAdminIntervention('refreshDigestContext')).toBe(false);
      expect(isHighRiskAdminIntervention('republishReport')).toBe(false);
      expect(isHighRiskAdminIntervention('clearAdapterData')).toBe(true);
      expect(isHighRiskAdminIntervention('syncAdapter')).toBe(false);
      expect(isHighRiskAdminIntervention('deleteAgent')).toBe(true);
      expect(isHighRiskAdminIntervention('updateSettings')).toBe(true);
      expect(isHighRiskAdminIntervention('saveAgent')).toBe(false);
    });

    it('delete cron and publish report are high-risk intents', () => {
      expect(isHighRiskAdminIntervention('deleteCron')).toBe(true);
      expect(isHighRiskAdminIntervention('publishReport')).toBe(true);
      const deleteEvents = buildAdminMockStreamEvents('删除一个定时任务');
      expect(
        deleteEvents!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
          (t) => t.apiName === 'deleteCron',
        ),
      ).toBe(true);
    });

    it('scoring flow lists news then pending triggerScoring', () => {
      const events = buildAdminMockStreamEvents('给未评分新闻评分');
      const tools = events!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : []));
      expect(tools.some((t) => t.apiName === 'listUnevaluatedNews')).toBe(true);
      expect(tools.find((t) => t.apiName === 'triggerScoring')?.intervention?.status).toBe('pending');
    });
  });

  describe('mock HITL approve → success payload for Render', () => {
    it('approve createCron applies create_cron pluginState', () => {
      const topicId = 'super-admin-smoke';
      const toolCallId = 'tc_create_cron';
      const pending = buildAdminMockToolPayload('create_cron', {
        state: 'pending',
        toolCallId,
        intervention: { status: 'pending' },
        params: { name: '每日新闻生产' },
      });
      useChatStore.setState({
        messagesByTopicId: {
          [topicId]: [
            {
              id: 'a1',
              role: 'assistant',
              content: '',
              createdAt: new Date().toISOString(),
              tools: [pending],
            },
          ],
        },
      });

      useChatStore.getState().resolveIntervention(topicId, toolCallId, 'approve');
      const tool = useChatStore
        .getState()
        .getMessages(topicId)[0]
        ?.tools?.find((t) => t.toolCallId === toolCallId);
      expect(tool?.state).toBe('success');
      expect(tool?.pluginState).toEqual(MOCK_ADMIN_TOOL_RESULTS.create_cron);
      expect(selectPendingInterventions(useChatStore.getState().getMessages(topicId))).toHaveLength(0);
    });

    it('approve triggerScoring applies trigger_scoring pluginState', () => {
      const tool = applyMockAdminToolSuccess(
        buildAdminMockToolPayload('trigger_scoring', {
          state: 'pending',
          toolCallId: 'tc_trigger',
          intervention: { status: 'pending' },
        }),
      );
      expect(tool?.state).toBe('success');
      expect(tool?.pluginState).toMatchObject({ workflowId: 'feed_scoring_pipeline_workflow' });
    });
  });

  describe('registry config wiring', () => {
    it('registers 27 admin write interventions with meta', () => {
      expect(BUILTIN_INTERVENTION_APIS['linkloom-admin']).toEqual(ADMIN_WRITE_INTERVENTION_API_NAMES);
      expect(ADMIN_WRITE_INTERVENTION_API_NAMES).toHaveLength(27);
      for (const apiName of ADMIN_WRITE_INTERVENTION_API_NAMES) {
        expect(hasInterventionMeta(apiName)).toBe(true);
      }
      expect(hasInterventionMeta('listSchedules')).toBe(false);
      expect(hasInterventionMeta('getSettings')).toBe(false);
    });

    it('defines 70 admin render apiNames including phase 4 tools', () => {
      expect(ADMIN_RENDER_API_NAMES).toHaveLength(70);
      expect(ADMIN_RENDER_API_NAMES).toContain('listTaskLogs');
      expect(ADMIN_RENDER_API_NAMES).toContain('getDailyReportJson');
      expect(ADMIN_RENDER_API_NAMES).toContain('listPendingApprovals');
      expect(ADMIN_RENDER_API_NAMES).toContain('getCommitHistory');
      expect(ADMIN_RENDER_API_NAMES).toContain('refreshDigestContext');
      expect(ADMIN_RENDER_API_NAMES).toContain('deleteCommitHistory');
      expect(ADMIN_RENDER_API_NAMES).toContain('listAgents');
      expect(ADMIN_RENDER_API_NAMES).toContain('getKbContent');
      expect(ADMIN_RENDER_API_NAMES).toContain('getRagStatus');
      expect(ADMIN_RENDER_API_NAMES).toContain('getSettings');
      expect(ADMIN_RENDER_API_NAMES).toContain('saveAgent');
      expect(ADMIN_RENDER_API_NAMES).toContain('updateSettings');
      expect(ADMIN_RENDER_API_NAMES).toContain('batchResetScoring');
    });
  });
});
