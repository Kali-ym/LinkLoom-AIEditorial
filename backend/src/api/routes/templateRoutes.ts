import { WorkflowTemplateRouteService } from '../../services/api/WorkflowTemplateRouteService.js';
import type { RouteRegistrar } from './types.js';

export const registerTemplateRoutes: RouteRegistrar = (
  fastify,
  { projectRoot, store, context }
) => {
  void projectRoot;
  const service = () => new WorkflowTemplateRouteService(store, context.settings);

  fastify.get('/api/workflow-templates', async () => {
    return service().listTemplates();
  });

  fastify.get('/api/workflow-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await service().readTemplateById(id);
    } catch {
      return reply.status(404).send({ error: 'Template not found' });
    }
  });

  fastify.post('/api/workflow-templates/:id/instantiate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as {
      variables?: Record<string, unknown>;
      conflictStrategy?: 'reuse' | 'copy' | 'fail';
    };
    try {
      await service().readTemplateById(id);
    } catch {
      return reply.status(404).send({ error: 'Template not found' });
    }
    try {
      const result = await service().instantiate(id, {
        variables: body.variables,
        conflictStrategy: body.conflictStrategy
      });
      await context.reload();
      return result;
    } catch (error: any) {
      return reply.status(400).send({ error: error?.message || 'Template instantiate failed' });
    }
  });
};
