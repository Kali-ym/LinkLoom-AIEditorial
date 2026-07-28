import { AppError } from '../../domain/errors.js';
import { AgentBindingService } from '../../services/agents/AgentBindingService.js';
import type { RouteRegistrar } from './types.js';

export const registerAgentBindingRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new AgentBindingService(store, context);

  fastify.get('/api/agents/:agentId/bindings', async (request) => {
    const { agentId } = request.params as { agentId: string };
    try {
      return await service.listBindings(agentId);
    } catch (error) {
      throw toBindingError(error);
    }
  });

  fastify.post('/api/agents/:agentId/bindings', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as {
      resourceType?: string;
      resourceId?: string;
      metadata?: Record<string, unknown>;
    };
    try {
      const result = await service.addBinding(agentId, {
        resourceType: body.resourceType as any,
        resourceId: body.resourceId ?? '',
        metadata: body.metadata,
      });
      return reply.status(201).send(result);
    } catch (error) {
      throw toBindingError(error);
    }
  });

  fastify.delete('/api/agents/:agentId/bindings/:bindingId', async (request, reply) => {
    const { agentId, bindingId } = request.params as { agentId: string; bindingId: string };
    try {
      const result = await service.removeBinding(agentId, bindingId);
      if (result.status === 'not_found') {
        return reply.status(404).send({ error: `binding ${bindingId} not found` });
      }
      return reply.status(204).send();
    } catch (error) {
      throw toBindingError(error);
    }
  });

  fastify.delete('/api/agents/:agentId/bindings', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const q = request.query as { resourceType?: string; resourceId?: string };
    if (!q.resourceType || !q.resourceId) {
      return reply.status(400).send({ error: 'resourceType and resourceId are required' });
    }
    try {
      const result = await service.removeBindingByResource(
        agentId,
        q.resourceType as any,
        q.resourceId,
      );
      if (result.status === 'not_found') {
        return reply.status(404).send({ error: 'binding not found' });
      }
      return reply.status(204).send();
    } catch (error) {
      throw toBindingError(error);
    }
  });
};

function toBindingError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error);
  if (/not found/i.test(message)) {
    return new AppError(404, message);
  }
  if (/required|invalid/i.test(message)) {
    return new AppError(400, message);
  }
  return new AppError(500, message);
}
