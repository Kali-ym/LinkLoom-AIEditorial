import { MemoryRouteService } from '../../services/api/MemoryRouteService.js';
import type { RouteRegistrar } from './types.js';

export const registerMemoryRoutes: RouteRegistrar = (fastify, { context }) => {
  const service = new MemoryRouteService(context);

  fastify.get('/api/memory/categories', async () => {
    return await service.getCategories();
  });

  fastify.post('/api/memory/categories', async (request) => {
    const { name, description } = request.body as any;
    return await service.addCategory(name, description);
  });

  fastify.get('/api/memory/categories/:id', async (request) => {
    const { id } = request.params as any;
    return await service.getCategoryDetails(id);
  });

  fastify.delete('/api/memory/categories/:id', async (request) => {
    const { id } = request.params as any;
    return await service.deleteCategory(id);
  });

  fastify.put('/api/memory/categories/:id', async (request) => {
    const { id } = request.params as any;
    const { name, description } = request.body as any;
    return await service.updateCategory(id, name, description);
  });

  fastify.post('/api/memory/categories/merge', async (request) => {
    const { ids, targetName, targetDescription } = request.body as any;
    return await service.mergeCategories(ids, targetName, targetDescription);
  });

  fastify.post('/api/memory/query', async (request) => {
    const { query, categoryIds, limit } = request.body as any;
    return await service.queryMemory(query, categoryIds, limit);
  });

  fastify.delete('/api/memory/:id', async (request) => {
    const { id } = request.params as any;
    return await service.deleteMemory(id);
  });

  fastify.post('/api/memory/merge', async (request) => {
    const { ids, targetCategoryId } = request.body as any;
    return await service.mergeMemories(ids, targetCategoryId);
  });

  fastify.post('/api/memory/:id/move', async (request) => {
    const { id } = request.params as any;
    const { targetCategoryId } = request.body as any;
    return await service.moveMemory(id, targetCategoryId);
  });

  fastify.get('/api/memory/:id/content', async (request) => {
    const { id } = request.params as any;
    return await service.getMemoryContent(id);
  });

  fastify.put('/api/memory/:id/content', async (request) => {
    const { id } = request.params as any;
    const { content } = request.body as any;
    return await service.updateMemoryContent(id, content);
  });
};
