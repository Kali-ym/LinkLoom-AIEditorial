import { SettingsRouteService } from '../../services/api/SettingsRouteService.js';
import type { RouteRegistrar } from './types.js';

export const registerSettingsRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new SettingsRouteService(store, context);

  fastify.get('/api/settings', async () => {
    return service.getSettings();
  });

  fastify.get('/api/plugins/metadata', async () => {
    return service.getPluginMetadata();
  });

  fastify.post('/api/settings', async (request) => {
    return await service.saveSettings(request.body as any);
  });

  fastify.get('/api/settings/api-keys', async (request) => {
    return await service.listApiKeys(Boolean((request as any).isApiKeyAuth));
  });

  fastify.post('/api/settings/api-keys', async (request) => {
    const { name, status } = request.body as any;
    return await service.createApiKey(Boolean((request as any).isApiKeyAuth), name, status);
  });

  fastify.patch('/api/settings/api-keys/:id', async (request) => {
    const { id } = request.params as any;
    return await service.updateApiKey(
      Boolean((request as any).isApiKeyAuth),
      id,
      request.body as any
    );
  });

  fastify.delete('/api/settings/api-keys/:id', async (request) => {
    const { id } = request.params as any;
    return await service.deleteApiKey(Boolean((request as any).isApiKeyAuth), id);
  });
};
