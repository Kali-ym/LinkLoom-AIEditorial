import fs from 'fs';
import { AppError } from '../../domain/errors.js';
import { AgentUploadService } from '../../services/agents/AgentUploadService.js';
import type { RouteRegistrar } from './types.js';

export const registerAgentUploadRoutes: RouteRegistrar = (fastify, { store }) => {
  const service = new AgentUploadService(store);

  fastify.post('/api/agent-uploads', async (request, reply) => {
    const { agentId } = request.query as { agentId?: string };
    const data = await request.file();
    try {
      const result = await service.upload(agentId, data);
      return reply.status(201).send(result);
    } catch (error) {
      throw toUploadError(error);
    }
  });

  fastify.get('/api/agent-uploads/:uploadId', async (request, reply) => {
    const { uploadId } = request.params as { uploadId: string };
    try {
      const { record, absolutePath } = await service.getUploadFile(uploadId);
      const stream = fs.createReadStream(absolutePath);
      return reply
        .header('Content-Type', record.mime)
        .header('Content-Disposition', `inline; filename="${encodeURIComponent(record.name)}"`)
        .send(stream);
    } catch (error) {
      throw toUploadError(error);
    }
  });
};

function toUploadError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/exceeds.*byte limit/i.test(message)) {
    return new AppError(413, message);
  }
  if (/unsupported mime/i.test(message)) {
    return new AppError(415, message);
  }
  if (/not found/i.test(message)) {
    return new AppError(404, message);
  }
  if (/required|empty/i.test(message)) {
    return new AppError(400, message);
  }
  return new AppError(500, message);
}
