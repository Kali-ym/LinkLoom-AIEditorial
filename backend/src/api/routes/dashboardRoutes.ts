import { DashboardRouteService } from '../../services/api/DashboardRouteService.js';
import type { RouteRegistrar } from './types.js';

export const registerDashboardRoutes: RouteRegistrar = (fastify, { context }) => {
  const service = new DashboardRouteService(context);

  fastify.get('/api/dashboard/stats', async () => {
    return await service.getStats();
  });

  fastify.get('/api/dashboard/adapters', async () => {
    return await service.getAdapterStatus();
  });

  fastify.post('/api/dashboard/adapters/:name/sync', async (request) => {
    const { name } = request.params as any;
    return await service.syncAdapter(name, request.body as any);
  });

  fastify.post('/api/dashboard/adapters/:name/clear', async (request) => {
    const { name } = request.params as any;
    const { date } = request.body as any;
    return await service.clearAdapter(name, date);
  });

  fastify.get('/api/dashboard/logs', async () => {
    return service.getLogs();
  });

  fastify.post('/api/ai/models', async (request) => {
    return await service.listModels(request.body as any);
  });

  fastify.post('/api/ai/test', async (request) => {
    return await service.testProvider(request.body as any);
  });
};
