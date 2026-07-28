import { McpRouteService } from '../../services/api/McpRouteService.js';
import type { RouteRegistrar } from './types.js';

export const registerMcpRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new McpRouteService(store, context);

  fastify.get('/api/mcp-configs', async () => {
    return await service.listConfigs();
  });

  fastify.post('/api/mcp-configs', async (request) => {
    return await service.saveConfig(request.body as any);
  });

  fastify.get('/api/mcp-configs/health', async () => {
    return await service.getHealth();
  });

  fastify.get('/api/mcp-configs/:id/health', async (request) => {
    const { id } = request.params as any;
    return await service.getHealth(id);
  });

  fastify.post('/api/mcp-configs/:id/test', async (request) => {
    const { id } = request.params as any;
    return await service.testConnection(id);
  });

  fastify.post('/api/mcp-configs/:id/reconnect', async (request) => {
    const { id } = request.params as any;
    return await service.reconnect(id);
  });

  fastify.delete('/api/mcp-configs/:id', async (request) => {
    const { id } = request.params as any;
    return await service.deleteConfig(id);
  });
};
