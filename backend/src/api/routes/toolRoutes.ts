import { ToolRouteService } from '../../services/api/ToolRouteService.js';
import type { RouteRegistrar } from './types.js';

export const registerToolRoutes: RouteRegistrar = (fastify, { context }) => {
  const service = new ToolRouteService(context);

  fastify.get('/api/tools', async () => service.listAvailableTools());

  fastify.post('/api/tools/:id/run', async (request, reply) => {
    const { id } = request.params as any;
    const result = await service.runTool(id, request.body);
    if (result.statusCode) {
      return reply.status(result.statusCode).send(result);
    }
    return result;
  });
};
