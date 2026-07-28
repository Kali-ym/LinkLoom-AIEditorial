import { ConfigService } from '../../services/ConfigService.js';
import { DailyCoverageOrchestrator } from '../../services/editorial/DailyCoverageOrchestrator.js';
import { DigestContextService } from '../../services/editorial/DigestContextService.js';
import type { RouteRegistrar } from './types.js';

export const registerEditorialRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const digestService = new DigestContextService(store);

  fastify.get('/api/editorial/digest-context', async (request) => {
    const query = request.query as { date?: string };
    const date =
      typeof query.date === 'string' && query.date.trim()
        ? query.date.trim().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    return digestService.getDigestContext(date);
  });

  fastify.post('/api/editorial/digest-context/refresh', async () => {
    if (!context?.schedulerService) {
      throw new Error('SchedulerService unavailable');
    }
    const pipelineIds = [
      'sched_hot_topics_digest',
      'sched_source_monitor_digest',
      'sched_topic_track_digest'
    ] as const;
    const triggered: string[] = [];
    for (const scheduleId of pipelineIds) {
      const schedule = await store.getSchedule(scheduleId);
      if (schedule) {
        await context.schedulerService.runNow(scheduleId);
        triggered.push(scheduleId);
      }
    }
    return { status: 'success', triggered };
  });

  fastify.post('/api/editorial/coverage/backfill', async (request) => {
    const { limit, dryRun } = (request.body as { limit?: number; dryRun?: boolean }) || {};
    const configService = await ConfigService.getInstance(store);
    const settings = configService.getSettings();
    const orchestrator = new DailyCoverageOrchestrator(store, settings);
    return await orchestrator.backfillFromHistory({ limit, dryRun });
  });
};
