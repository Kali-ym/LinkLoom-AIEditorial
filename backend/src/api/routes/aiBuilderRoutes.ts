import { AiBuilderService } from '../../services/aiBuilder/AiBuilderService.js';
import { LinkLoomDomainCatalogProvider } from '../../services/api/LinkLoomDomainCatalogProvider.js';
import type {
  AiBuildApplyRequest,
  AiBuildChatRequest,
  AiBuildPlan,
  AiBuildRequest
} from '../../types/aiBuilder.js';
import { streamSseRoute, writeSseEvent } from '../http.js';
import type { RouteRegistrar } from './types.js';

export const registerAiBuilderRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new AiBuilderService(store, context, new LinkLoomDomainCatalogProvider());

  fastify.get('/api/ai-builder/catalog', async () => {
    return service.buildCatalog();
  });

  fastify.post('/api/ai-builder/plan', async (request) => {
    return service.createPlan(request.body as AiBuildRequest);
  });

  fastify.post('/api/ai-builder/chat-stream', async (request, reply) => {
    const abortController = new AbortController();
    reply.raw.on('close', () => abortController.abort());

    await streamSseRoute(
      reply,
      async () => {
        const stream = service.streamChat(request.body as AiBuildChatRequest, {
          signal: abortController.signal
        });
        for await (const event of stream) {
          if (!reply.raw.writable || abortController.signal.aborted) break;
          writeSseEvent(reply, event);
        }
      },
      'message'
    );
  });

  fastify.post('/api/ai-builder/build-stream', async (request, reply) => {
    const abortController = new AbortController();
    reply.raw.on('close', () => abortController.abort());

    await streamSseRoute(
      reply,
      async () => {
        const stream = service.executeBuild(request.body as AiBuildApplyRequest, {
          signal: abortController.signal
        });
        for await (const event of stream) {
          if (!reply.raw.writable || abortController.signal.aborted) break;
          writeSseEvent(reply, event);
        }
      },
      'message'
    );
  });

  fastify.post('/api/ai-builder/revise', async (request) => {
    return service.revisePlan(
      request.body as { request?: AiBuildRequest; plan?: AiBuildPlan; feedback?: string }
    );
  });

  fastify.post('/api/ai-builder/validate', async (request) => {
    return service.validatePlan(request.body as AiBuildPlan);
  });

  fastify.post('/api/ai-builder/dry-run', async (request) => {
    const body = request.body as { plan?: AiBuildPlan } | AiBuildPlan;
    const plan = 'plan' in body ? body.plan : body;
    if (!plan) throw new Error('plan is required');
    return service.dryRunPlan(plan as AiBuildPlan);
  });
};
