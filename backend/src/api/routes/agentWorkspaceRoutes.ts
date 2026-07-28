import { AppError } from '../../domain/errors.js';
import { tryCreateAgentSandboxService } from '../../services/agents/sandbox/AgentSandboxService.js';
import { AgentWorkspaceFileService } from '../../services/api/AgentWorkspaceFileService.js';
import type { RouteRegistrar } from './types.js';

export const registerAgentWorkspaceRoutes: RouteRegistrar = (fastify, { store }) => {
  const fileService = new AgentWorkspaceFileService({
    dataDir: store.getDataDir(),
    getAgent: (id) => store.getAgent(id),
    getSandboxHostMount: async (agentId) => {
      const sandboxService = tryCreateAgentSandboxService(store);
      if (!sandboxService) return null;
      const status = await sandboxService.getSandbox(agentId);
      return status.hostMountPath ?? null;
    },
  });

  fastify.get('/api/agents/:id/workspace/tree', async (request) => {
    const { id } = request.params as { id: string };
    const entries = await fileService.listTree(id);
    return { entries };
  });

  fastify.get('/api/agents/:id/workspace/files/content', async (request) => {
    const { id } = request.params as { id: string };
    const { path: filePath } = request.query as { path?: string };
    if (!filePath) {
      throw new AppError(400, 'path is required');
    }
    return fileService.readContent(id, filePath);
  });

  fastify.put('/api/agents/:id/workspace/files/content', async (request) => {
    const { id } = request.params as { id: string };
    const { path: filePath, content, expectedUpdatedAt } = request.body as {
      path?: string;
      content?: string;
      expectedUpdatedAt?: number;
    };
    if (!filePath) {
      throw new AppError(400, 'path is required');
    }
    return fileService.writeContent(id, filePath, content ?? '', expectedUpdatedAt);
  });

  fastify.post('/api/agents/:id/workspace/directories', async (request) => {
    const { id } = request.params as { id: string };
    const { path: dirPath } = request.body as { path?: string };
    if (!dirPath) {
      throw new AppError(400, 'path is required');
    }
    return fileService.mkdir(id, dirPath);
  });

  fastify.post('/api/agents/:id/workspace/files', async (request) => {
    const { id } = request.params as { id: string };
    const { path: filePath, content } = request.body as { path?: string; content?: string };
    if (!filePath) {
      throw new AppError(400, 'path is required');
    }
    return fileService.createFile(id, filePath, content);
  });

  fastify.patch('/api/agents/:id/workspace/files', async (request) => {
    const { id } = request.params as { id: string };
    const { from, to } = request.body as { from?: string; to?: string };
    if (!from) {
      throw new AppError(400, 'from is required');
    }
    if (!to) {
      throw new AppError(400, 'to is required');
    }
    return fileService.moveEntry(id, from, to);
  });

  fastify.delete('/api/agents/:id/workspace/files', async (request) => {
    const { id } = request.params as { id: string };
    const { path: filePath } = request.query as { path?: string };
    if (!filePath) {
      throw new AppError(400, 'path is required');
    }
    return fileService.deleteEntry(id, filePath);
  });
};
