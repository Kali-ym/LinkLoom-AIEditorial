import type { ChannelBindingInput } from '../../services/gateway/channelBindingTypes.js';
import type { GatewayService } from '../../services/gateway/GatewayService.js';
import type { IncomingMessage } from '../../services/gateway/gatewayTypes.js';
import { LogService } from '../../services/LogService.js';
import { beginSse, endSse, writeSseEvent, writeSseDone } from '../http.js';
import type { RouteRegistrar } from './types.js';

export const registerGatewayRoutes: RouteRegistrar = (fastify, { context }) => {
  const gateway: GatewayService | undefined = (context as { gateway?: GatewayService })
    .gateway;
  if (!gateway) {
    LogService.warn('GatewayService not configured; skipping /api/gateway/* routes');
    return;
  }
  const { bindingStore, messageRepo, gateway: agentGateway } = gateway;

  // -------- Bindings CRUD --------

  fastify.get('/api/gateway/bindings', async (request) => {
    const q = request.query as { channel?: string; agentId?: string; isEnabled?: string };
    const isEnabled =
      q.isEnabled === undefined ? undefined : q.isEnabled === 'true' || q.isEnabled === '1';
    return {
      bindings: await bindingStore.list({
        channel: q.channel,
        agentId: q.agentId,
        isEnabled,
      }),
    };
  });

  fastify.post('/api/gateway/bindings', async (request, reply) => {
    const body = request.body as Partial<ChannelBindingInput>;
    if (!body.channel || !body.agentId) {
      return reply.status(400).send({ error: 'channel and agentId are required' });
    }
    const b = await bindingStore.upsert({
      channel: body.channel,
      agentId: body.agentId,
      accountId: body.accountId ?? null,
      peerId: body.peerId ?? null,
      priority: body.priority,
      isEnabled: body.isEnabled,
      description: body.description,
      metadata: body.metadata,
    });
    return reply.status(201).send({ binding: b });
  });

  fastify.put('/api/gateway/bindings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<ChannelBindingInput>;
    const existing = await bindingStore.get(id);
    if (!existing) {
      return reply.status(404).send({ error: `binding ${id} not found` });
    }
    const merged: ChannelBindingInput = {
      ...existing,
      ...body,
      id,
      channel: body.channel ?? existing.channel,
      agentId: body.agentId ?? existing.agentId,
    };
    const b = await bindingStore.upsert(merged);
    return { binding: b };
  });

  fastify.patch('/api/gateway/bindings/:id/enabled', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { isEnabled?: boolean };
    if (typeof body.isEnabled !== 'boolean') {
      return reply.status(400).send({ error: 'isEnabled (boolean) is required' });
    }
    const b = await bindingStore.setEnabled(id, body.isEnabled);
    if (!b) return reply.status(404).send({ error: `binding ${id} not found` });
    return { binding: b };
  });

  fastify.delete('/api/gateway/bindings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ok = await bindingStore.delete(id);
    if (!ok) return reply.status(404).send({ error: `binding ${id} not found` });
    return reply.status(204).send();
  });

  // -------- Incoming messages --------

  fastify.post('/api/gateway/messages', async (request, reply) => {
    const body = request.body as Partial<IncomingMessage>;
    if (!body.channel || typeof body.text !== 'string' || body.text.length === 0) {
      return reply.status(400).send({ error: 'channel and non-empty text are required' });
    }
    const req: IncomingMessage = {
      channel: body.channel,
      accountId: body.accountId ?? null,
      peerId: body.peerId ?? null,
      text: body.text,
      stream: body.stream ?? false,
      metadata: body.metadata,
    };

    if (!req.stream) {
      // Sync mode: wait for the full result and return JSON.
      try {
        const handle = await agentGateway.handleMessage(req);
        const result = await handle.result;
        reply.status(200);
        return {
          messageId: handle.messageId,
          runId: handle.runId,
          agentId: handle.resolution?.agentId ?? null,
          bindingId: handle.resolution?.bindingId ?? null,
          matchLevel: handle.resolution?.matchLevel ?? null,
          strategy: handle.resolution?.strategy ?? null,
          fallback: handle.resolution?.fallback ?? false,
          status: result.status,
          output: result.output ?? null,
          error: result.error ?? null,
          usage: result.usage ?? null,
        };
      } catch (err) {
        const message = (err as Error).message;
        // 422 = input was OK but gateway couldn't process (unrouted / oversized)
        // 500 = unexpected
        const status = /unrouted|exceeds|required/.test(message) ? 422 : 500;
        return reply.status(status).send({ error: message });
      }
    }

    // Stream mode: SSE.
    beginSse(reply);
    const streamController = new AbortController();
    const cancel = () => {
      if (!streamController.signal.aborted) streamController.abort('client_disconnect');
    };
    request.raw.on('aborted', cancel);
    reply.raw.on('close', cancel);

    try {
      const handle = await agentGateway.handleMessage(req);
      if (handle.resolution === null) {
        // Unrouted: emit synthetic completed event.
        for await (const ev of handle.events) writeSseEvent(reply, ev, { id: handle.messageId });
        writeSseDone(reply);
        return;
      }
      for await (const ev of handle.events) {
        if (!reply.raw.writable) break;
        writeSseEvent(reply, ev, { id: handle.messageId });
      }
      writeSseDone(reply);
    } catch (err) {
      writeSseEvent(reply, { type: 'error', error: (err as Error).message });
      writeSseDone(reply);
    } finally {
      endSse(reply);
    }
  });

  // -------- Message audit --------

  fastify.get('/api/gateway/messages', async (request) => {
    const q = request.query as { channel?: string; agentId?: string; limit?: string };
    const limit = q.limit ? Math.max(1, Math.min(500, Number(q.limit))) : 50;
    return {
      messages: await messageRepo.list({
        channel: q.channel,
        agentId: q.agentId,
        limit,
      }),
    };
  });

  fastify.get('/api/gateway/messages/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const m = await messageRepo.get(id);
    if (!m) return reply.status(404).send({ error: `message ${id} not found` });
    return { message: m };
  });
};
