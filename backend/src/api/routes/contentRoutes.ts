import { ContentRouteService } from '../../services/api/ContentRouteService.js';
import type { RouteRegistrar } from './types.js';

export const registerContentRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new ContentRouteService(store, context);

  fastify.post('/api/import', async (request) => {
    const { mode, categoryId, payload } = request.body as any;
    return await service.importContent(mode, categoryId, payload);
  });

  fastify.post('/api/content/:id/regenerate', async (request) => {
    const { id } = request.params as any;
    return await service.regenerateContent(id, request.body as any);
  });

  fastify.get('/api/content', async (request) => {
    return await service.getAggregatedContent(request.query as any);
  });

  fastify.delete('/api/content/:id', async (request) => {
    const { id } = request.params as any;
    return await service.deleteContent(id);
  });

  fastify.get('/api/temp-image', async (request, reply) => {
    const { path: filePath } = request.query as any;
    const result = await service.readTempImage(filePath);
    if (result.redirectUrl) return reply.redirect(result.redirectUrl);
    if (result.contentType) reply.header('content-type', result.contentType);
    return result.buffer;
  });

  fastify.get('/api/proxy/image', async (request, reply) => {
    const { url } = request.query as any;
    const result = await service.fetchProxyImage(url);
    if (result.contentType) reply.header('content-type', result.contentType);
    return result.buffer;
  });

  fastify.post('/api/adapters/import-opml', async (request) => {
    const { opmlContent, adapterId } = request.body as any;
    return await service.importOpml(opmlContent, adapterId);
  });
};
