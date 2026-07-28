import { ScheduleRouteService } from '../../services/api/ScheduleRouteService.js';
import type { RouteRegistrar } from './types.js';

export const registerScheduleRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new ScheduleRouteService(store, context);

  fastify.get('/api/schedules', async () => {
    return await service.listSchedules();
  });

  fastify.post('/api/schedules', async (request) => {
    return await service.saveSchedule(request.body as any);
  });

  fastify.delete('/api/schedules/:id', async (request) => {
    const { id } = request.params as any;
    return await service.deleteSchedule(id);
  });

  fastify.get('/api/schedules/logs', async (request) => {
    return await service.listTaskLogs(request.query as any);
  });

  fastify.post('/api/schedules/:id/run', async (request) => {
    const { id } = request.params as any;
    return await service.runNow(id);
  });
};
