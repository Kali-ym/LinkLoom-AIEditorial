import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, DomainError } from '../domain/errors.js';
import { captureHttpError } from '../utils/sentry.js';

export { AppError, DomainError };

export function httpErrorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const statusCode =
    error instanceof AppError ? error.statusCode : (error as any).statusCode || 500;
  captureHttpError(error, request);
  const message = error.message || 'Internal Server Error';
  reply.status(statusCode).send({ error: message });
}

export function beginSse(reply: FastifyReply) {
  reply.header('Content-Type', 'text/event-stream');
  reply.header('Cache-Control', 'no-cache');
  reply.header('Connection', 'keep-alive');
  // Disable proxy buffering (e.g. nginx) so comments/events flush promptly.
  reply.header('X-Accel-Buffering', 'no');

  // Writing via reply.raw skips Fastify's send path, so plugin headers
  // (notably @fastify/cors Access-Control-Allow-Origin) never reach the wire
  // unless we flush them onto the Node response first.
  // Preflight OPTIONS still works; only the actual SSE GET was missing ACAO.
  if (!reply.raw.headersSent) {
    reply.hijack();
    reply.raw.writeHead(reply.statusCode || 200, reply.getHeaders());
  }
}

export function writeSseComment(reply: FastifyReply, comment: string) {
  if (!reply.raw.writable) return;
  reply.raw.write(`: ${comment}\n\n`);
}

export function writeSseEvent(reply: FastifyReply, payload: unknown, options: { id?: string | number } = {}) {
  if (!reply.raw.writable) return;
  const id = options.id == null ? '' : `id: ${String(options.id)}\n`;
  reply.raw.write(`${id}data: ${JSON.stringify(payload)}\n\n`);
  const flush = (reply.raw as NodeJS.WritableStream & { flush?: () => void }).flush;
  flush?.call(reply.raw);
}

export function writeSseDone(reply: FastifyReply) {
  if (!reply.raw.writable) return;
  reply.raw.write('data: [DONE]\n\n');
}

export function sendSseError(
  reply: FastifyReply,
  error: unknown,
  field: 'error' | 'message' = 'error'
) {
  const message = error instanceof Error ? error.message : String(error);
  writeSseEvent(reply, { type: 'error', [field]: message });
}

export function endSse(reply: FastifyReply) {
  if (!reply.raw.destroyed) {
    reply.raw.end();
  }
}

export async function streamSseRoute(
  reply: FastifyReply,
  run: () => Promise<void>,
  errorField: 'error' | 'message' = 'error',
  doneOnError = false
) {
  beginSse(reply);
  try {
    await run();
    writeSseDone(reply);
  } catch (error) {
    sendSseError(reply, error, errorField);
    if (doneOnError) {
      writeSseDone(reply);
    }
  } finally {
    endSse(reply);
  }
}
