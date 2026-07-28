import { AppError } from '../../domain/errors.js';
import { ToolAuthService } from '../../services/agents/ToolAuthService.js';
import type { RouteRegistrar } from './types.js';

export const registerToolAuthRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new ToolAuthService(store, context);

  fastify.get('/api/agents/:agentId/pending-auth-tools', async (request) => {
    const { agentId } = request.params as { agentId: string };
    try {
      return await service.listPendingAuthTools(agentId);
    } catch (error) {
      throw toToolAuthError(error);
    }
  });

  fastify.post('/api/agents/:agentId/tools/:toolId/authorize', async (request) => {
    const { agentId, toolId } = request.params as { agentId: string; toolId: string };
    try {
      return await service.createAuthorizeUrl(agentId, decodeURIComponent(toolId));
    } catch (error) {
      throw toToolAuthError(error);
    }
  });

  fastify.get('/api/tool-auth/consent', async (request, reply) => {
    const { state } = request.query as { state?: string };
    if (!state?.trim()) {
      return reply.status(400).type('text/plain').send('state is required');
    }
    try {
      const page = await service.getConsentPage(state.trim());
      return reply.type('text/html').send(page.html);
    } catch (error) {
      throw toToolAuthError(error);
    }
  });

  fastify.post('/api/tool-auth/complete', async (request, reply) => {
    const { state } = request.body as { state?: string };
    if (!state?.trim()) {
      return reply.status(400).send({ error: 'state is required' });
    }
    try {
      const result = await service.completeAuthorization(state.trim());
      return reply.send({ status: 'authorized', ...result });
    } catch (error) {
      throw toToolAuthError(error);
    }
  });
};

function toToolAuthError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/not found/i.test(message)) return new AppError(404, message);
  if (/invalid|expired|required/i.test(message)) return new AppError(400, message);
  return new AppError(500, message);
}
