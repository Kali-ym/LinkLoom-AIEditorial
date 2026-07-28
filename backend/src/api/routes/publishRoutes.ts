import { PublishingRouteService } from '../../services/api/PublishingRouteService.js';
import type { RouteRegistrar } from './types.js';

export const registerPublishRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new PublishingRouteService(store, context);

  fastify.post('/api/publish/:id', async (request) => {
    const { id } = request.params as any;
    const { content, ...options } = request.body as any;
    return await service.publish(id, content, options);
  });

  fastify.get('/api/history/commits', async (request) => {
    return await service.listCommitHistory(request.query as any);
  });

  fastify.delete('/api/history/commits/:id', async (request) => {
    const { id } = request.params as any;
    return await service.deleteCommitHistory(id);
  });

  fastify.get('/api/history/:id/items', async (request) => {
    const { id } = request.params as any;
    return await service.listPublicationItems(id);
  });

  fastify.post('/api/history/publication-items/query', async (request) => {
    return await service.queryPublicationItems(request.body as any);
  });

  fastify.post('/api/history/publication-items/backfill', async (request) => {
    return await service.backfillPublicationItems(request.body as any);
  });

  fastify.post('/api/history/republish/:id', async (request) => {
    const { id } = request.params as any;
    return await service.republish(id);
  });

  fastify.post('/api/wechat/upload-material', async (request) => {
    const { url } = request.body as any;
    return await service.uploadWechatMaterial(url);
  });
};
