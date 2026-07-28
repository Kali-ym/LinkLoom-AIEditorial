import fs from 'fs/promises';
import path from 'path';
import { MonitoringService } from '../../services/MonitoringService.js';
import type { RouteRegistrar } from './types.js';

async function readVersion(projectRoot: string): Promise<string> {
  try {
    return (await fs.readFile(path.join(projectRoot, 'version'), 'utf-8')).trim();
  } catch {
    return 'unknown';
  }
}

async function checkNext(upstream?: string): Promise<boolean> {
  if (!upstream || process.env.SKIP_NEXT_SPAWN === '1') return true;
  try {
    const response = await fetch(upstream, { method: 'HEAD' });
    return response.status < 500;
  } catch {
    return false;
  }
}

export const registerHealthRoutes: RouteRegistrar = (fastify, { store, context, projectRoot }) => {
  fastify.get('/api/health', async () => ({
    status: 'ok',
    version: await readVersion(projectRoot),
    startedAt: new Date(MonitoringService.startedAt).toISOString(),
    uptimeSeconds: MonitoringService.snapshot().uptimeSeconds
  }));

  fastify.get('/api/ready', async (_request, reply) => {
    const checks = {
      db: false,
      scheduler: Boolean(context.schedulerService),
      next: await checkNext(process.env.NEXT_UPSTREAM_URL)
    };
    try {
      await store.getAllKeys();
      checks.db = true;
    } catch {
      checks.db = false;
    }

    const ready = Object.values(checks).every(Boolean);
    if (!ready) reply.status(503);
    return { status: ready ? 'ready' : 'not_ready', checks };
  });

  fastify.get('/api/admin/status', async () => ({
    status: 'ok',
    version: await readVersion(projectRoot),
    metrics: MonitoringService.snapshot(),
    databaseUrl: store.getDbPath(),
    nextUpstream: process.env.NEXT_UPSTREAM_URL || null
  }));

  fastify.get('/api/metrics', async (_request, reply) => {
    reply.header('content-type', 'text/plain; version=0.0.4');
    return MonitoringService.prometheusText();
  });
};
