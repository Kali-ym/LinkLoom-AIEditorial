import type { FastifyReply, FastifyRequest } from 'fastify';
import { FeedRouteService } from '../../services/api/FeedRouteService.js';
import type { RouteRegistrar } from './types.js';

export const FEED_PUBLIC_PREFIXES = [
  '/api/feed/timeline',
  '/api/feed/hot',
  '/api/feed/tags',
  '/api/feed/items',
  '/api/feed/report-json',
  '/api/feed/rss.xml'
];

export const registerFeedRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new FeedRouteService(store, context);

  // Query includes optional `event` (hot event id) — passed through to getTimeline.
  fastify.get('/api/feed/timeline', async (request) => {
    return service.getTimeline(request.query as any);
  });

  fastify.get('/api/feed/hot', async (request) => {
    return service.getHot(request.query as { period?: string });
  });

  fastify.get('/api/feed/tags', async (request) => {
    return service.getTags(request.query as any);
  });

  fastify.get('/api/feed/report-json', async (request) => {
    const result = await service.getReportJson(request.query as any);
    if (!result) {
      const date = (request.query as any).date || null;
      return {
        date,
        report: null
      };
    }
    return result;
  });

  fastify.get('/api/feed/report-json/dates', async () => {
    return { dates: await service.getReportJsonDates() };
  });

  fastify.get('/api/feed/rss.xml', async (request: FastifyRequest, reply: FastifyReply) => {
    const xml = await service.getRss();
    reply.header('content-type', 'application/rss+xml; charset=utf-8');
    return xml;
  });

  fastify.get('/api/feed/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await service.getItemDetail(id);
    if (!item) return reply.code(404).send({ error: 'not_found' });
    return item;
  });

  // ---------- admin ----------

  fastify.get('/api/feed/admin/stats', async () => {
    return service.getAdminStats();
  });

  fastify.get('/api/feed/admin/raw', async (request) => {
    return service.getRawTimeline(request.query as any);
  });

  fastify.get('/api/feed/admin/processed', async (request) => {
    return service.getProcessedTimeline(request.query as any);
  });

  fastify.get('/api/feed/admin/items/:id', async (request) => {
    const { id } = request.params as { id: string };
    return service.getAdminItemDetail(id);
  });

  fastify.post('/api/feed/admin/scoring/:id/reset', async (request) => {
    const { id } = request.params as any;
    return service.resetScoring(id, request.body as any);
  });

  fastify.patch('/api/feed/admin/scoring/:id', async (request) => {
    const { id } = request.params as any;
    return service.patchScoring(id, request.body as any);
  });

  fastify.post('/api/feed/admin/hot/rebuild', async (request) => {
    return service.rebuildHotSnapshot(request.body as any);
  });
};
