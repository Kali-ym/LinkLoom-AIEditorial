import { loadChannelPlatforms } from '../../services/gateway/ChannelPlatformCatalog.js';
import type { RouteRegistrar } from './types.js';

export const registerChannelPlatformRoutes: RouteRegistrar = (fastify, { projectRoot }) => {
  fastify.get('/api/gateway/platforms', async () => {
    return loadChannelPlatforms(projectRoot);
  });
};
