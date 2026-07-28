import cors from '@fastify/cors';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { streamSseRoute, writeSseComment, writeSseEvent } from '../src/api/http.js';

describe('SSE CORS via reply.raw', () => {
  const origin = 'http://localhost:5175';
  let app: ReturnType<typeof Fastify>;
  let baseUrl = '';

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cors, {
      origin: async (requestOrigin) => !requestOrigin || requestOrigin === origin,
    });
    app.get('/events', async (_request, reply) => {
      await streamSseRoute(reply, async () => {
        writeSseComment(reply, 'stream-open');
        writeSseEvent(reply, { type: 'ping' });
      });
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('expected TCP address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('includes Access-Control-Allow-Origin on the SSE response body request', async () => {
    const response = await fetch(`${baseUrl}/events`, {
      headers: {
        Origin: origin,
        Accept: 'text/event-stream',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(response.headers.get('content-type') ?? '').toContain('text/event-stream');

    const text = await response.text();
    expect(text).toContain('stream-open');
    expect(text).toContain('"type":"ping"');
  });
});
