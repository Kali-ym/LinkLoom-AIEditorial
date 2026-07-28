import { InteropRouteService } from '../../services/api/InteropRouteService.js';
import { streamSseRoute, writeSseEvent } from '../http.js';
import type { RouteRegistrar } from './types.js';

export const registerInteropRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new InteropRouteService(store, context);

  fastify.post('/api/ai/v1/register', async (request) => {
    const { name } = request.body as any;
    return service.registerPendingKey(name, request.headers, request.ip);
  });

  fastify.get('/api/ai/v1/verify/:token', async (request, reply) => {
    const { token } = request.params as any;
    reply.type('text/html; charset=utf-8');
    return service.renderVerifyPage(token);
  });

  fastify.post('/api/ai/v1/verify/:token', async (request, reply) => {
    const { token } = request.params as any;
    reply.type('text/html; charset=utf-8');
    return service.approveKey(token);
  });

  fastify.get('/api/ai/v1/discovery', async () => {
    return await context.interopService.getDiscovery();
  });

  fastify.get('/api/ai/v1/context', async (_request, reply) => {
    const md = await context.interopService.getSystemContextMarkdown();
    reply.type('text/markdown');
    return md;
  });

  fastify.get('/api/ai/v1/tools', async () => {
    return await context.interopService.getToolsAsOpenAIFormat();
  });

  fastify.get('/api/ai/v1/skills', async () => {
    return context.skillService.listSkills();
  });

  fastify.get('/api/ai/v1/settings', async () => {
    return await context.interopService.getSettings();
  });

  fastify.post('/api/ai/v1/settings', async (request) => {
    return service.updateSettings(request.body as any);
  });

  fastify.get('/api/ai/v1/schedules', async () => {
    return await context.interopService.getSchedules();
  });

  fastify.post('/api/ai/v1/schedules', async (request) => {
    return service.saveSchedule(request.body as any);
  });

  fastify.delete('/api/ai/v1/schedules/:id', async (request) => {
    const { id } = request.params as any;
    return service.deleteSchedule(id);
  });

  fastify.get('/api/ai/v1/agents', async () => {
    return await context.interopService.getAgents();
  });

  fastify.post('/api/ai/v1/agents', async (request) => {
    return service.saveAgent(request.body as any);
  });

  fastify.delete('/api/ai/v1/agents/:id', async (request) => {
    const { id } = request.params as any;
    return service.deleteAgent(id);
  });

  fastify.get('/api/ai/v1/workflows', async () => {
    return await context.interopService.getWorkflows();
  });

  fastify.post('/api/ai/v1/workflows', async (request) => {
    return service.saveWorkflow(request.body as any);
  });

  fastify.delete('/api/ai/v1/workflows/:id', async (request) => {
    const { id } = request.params as any;
    return service.deleteWorkflow(id);
  });

  fastify.post('/api/ai/v1/execute', async (request, reply) => {
    const body = request.body as any;
    if (!body.stream) {
      return await context.interopService.execute(body);
    }

    service.assertStreamingAction(body);
    await streamSseRoute(reply, async () => {
      const result = await context.interopService.execute(body);
      if (typeof (result as any)[Symbol.asyncIterator] === 'function') {
        for await (const chunk of result as any) {
          if (!reply.raw.writable) break;
          writeSseEvent(reply, chunk);
        }
      } else {
        writeSseEvent(reply, result);
      }
    });
  });
};
