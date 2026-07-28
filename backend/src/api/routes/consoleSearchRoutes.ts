import fs from 'fs';
import path from 'path';
import { AppError } from '../../domain/errors.js';
import { ConsoleBootstrapService } from '../../services/console/ConsoleBootstrapService.js';
import { ConsoleSearchService } from '../../services/console/ConsoleSearchService.js';
import type { RouteRegistrar } from './types.js';

function readInstanceVersion(projectRoot: string): string {
  try {
    const versionPath = path.join(projectRoot, 'version');
    if (fs.existsSync(versionPath)) {
      return fs.readFileSync(versionPath, 'utf-8').trim() || '0';
    }
  } catch {
    // keep default
  }
  return '0';
}

export const registerConsoleSearchRoutes: RouteRegistrar = (fastify, { store, context, projectRoot }) => {
  const service = new ConsoleSearchService(store);
  const bootstrapService = new ConsoleBootstrapService(store, context);

  fastify.get('/api/console/connection', async () => ({
    ok: true as const,
    instance: {
      name: 'LinkLoom',
      version: readInstanceVersion(projectRoot),
    },
  }));

  fastify.get('/api/console/bootstrap', async (request) => {
    const query = request.query as { agentId?: string; topicId?: string };
    return bootstrapService.bootstrap({
      agentId: typeof query.agentId === 'string' ? query.agentId : undefined,
      topicId: typeof query.topicId === 'string' ? query.topicId : undefined,
    });
  });

  fastify.get('/api/console/search', async (request) => {
    const query = request.query as { q?: string; agentId?: string; limit?: string };
    const q = typeof query.q === 'string' ? query.q : '';
    const agentId = typeof query.agentId === 'string' && query.agentId.trim() ? query.agentId : undefined;
    const limit = query.limit ? Number(query.limit) : undefined;
    try {
      return await service.search(q, agentId, limit);
    } catch (error) {
      throw toSearchError(error);
    }
  });
};

function toSearchError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/not found/i.test(message)) return new AppError(404, message);
  return new AppError(500, message);
}
