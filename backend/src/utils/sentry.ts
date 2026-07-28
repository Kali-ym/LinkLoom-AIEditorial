import * as Sentry from '@sentry/node';
import type { FastifyError, FastifyRequest } from 'fastify';

const parseSampleRate = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
};

export function initSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1)
  });
}

export function captureHttpError(error: FastifyError | Error, request: FastifyRequest) {
  const statusCode = 'statusCode' in error ? Number(error.statusCode) : 500;
  if (Number.isFinite(statusCode) && statusCode < 500) return;

  Sentry.withScope((scope) => {
    scope.setContext('request', {
      method: request.method,
      url: request.url,
      route: request.routeOptions.url,
      requestId: request.id
    });
    Sentry.captureException(error);
  });
}
