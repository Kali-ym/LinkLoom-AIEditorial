import { KnowledgeRouteService } from '../../services/api/KnowledgeRouteService.js';
import type { RouteRegistrar } from './types.js';

export const registerKnowledgeRoutes: RouteRegistrar = (fastify, { context }) => {
  const service = new KnowledgeRouteService(context);

  fastify.get('/api/kb/categories', async () => {
    return await service.getCategories();
  });

  fastify.post('/api/kb/categories', async (request) => {
    const { name, description } = request.body as any;
    return await service.addCategory(name, description);
  });

  fastify.delete('/api/kb/categories/:id', async (request) => {
    const { id } = request.params as any;
    return await service.deleteCategory(id);
  });

  fastify.put('/api/kb/categories/:id', async (request) => {
    const { id } = request.params as any;
    const { name, description } = request.body as any;
    return await service.updateCategory(id, name, description);
  });

  fastify.post('/api/kb/categories/merge', async (request) => {
    const { ids, targetName, targetDescription } = request.body as any;
    return await service.mergeCategories(ids, targetName, targetDescription);
  });

  fastify.get('/api/kb/documents', async (request) => {
    const { categoryId } = request.query as any;
    return await service.getDocuments(categoryId);
  });

  fastify.post('/api/kb/documents', async (request) => {
    const data = await request.file();
    return await service.addDocument(data);
  });

  fastify.delete('/api/kb/documents/:id', async (request) => {
    const { id } = request.params as any;
    return await service.deleteDocument(id);
  });

  fastify.get('/api/kb/documents/:id/content', async (request) => {
    const { id } = request.params as any;
    return await service.getDocumentContent(id);
  });

  fastify.put('/api/kb/documents/:id/content', async (request) => {
    const { id } = request.params as any;
    const { content } = request.body as any;
    return await service.updateDocumentContent(id, content);
  });

  fastify.post('/api/kb/documents/:id/move-to-memory', async (request) => {
    const { id } = request.params as any;
    return await service.moveDocumentToMemory(id);
  });

  fastify.post('/api/kb/query', async (request) => {
    const { query, categoryIds, documentIds, limit } = request.body as any;
    return await service.queryKnowledge(query, categoryIds, limit, documentIds);
  });
};
