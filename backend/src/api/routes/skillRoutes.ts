import { SkillCatalogService } from '../../services/api/SkillCatalogService.js';
import { SkillFileService } from '../../services/api/SkillFileService.js';
import { SkillImportService } from '../../services/api/SkillImportService.js';
import type { RouteRegistrar } from './types.js';

export const registerSkillRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const catalogService = new SkillCatalogService(store, context);
  const fileService = new SkillFileService(store, context);
  const importService = new SkillImportService(store, context);

  fastify.get('/api/skills', async () => {
    return await catalogService.listSkills();
  });

  fastify.post('/api/skills/scan', async () => {
    return await catalogService.scanSkills();
  });

  fastify.post('/api/skills', async (request) => {
    const data = await request.file();
    return await importService.importFromZip(data);
  });

  fastify.delete('/api/skills/:id', async (request) => {
    const { id } = request.params as any;
    return fileService.deleteSkill(id);
  });

  fastify.get('/api/skills/:id/files', async (request) => {
    const { id } = request.params as any;
    return fileService.listFiles(id);
  });

  fastify.get('/api/skills/:id/file/*', async (request) => {
    const { id, '*': filePath } = request.params as any;
    return fileService.readFile(id, filePath);
  });

  fastify.post('/api/skills/:id/file/*', async (request) => {
    const { id, '*': filePath } = request.params as any;
    const { content } = request.body as any;
    return fileService.writeFile(id, filePath, content);
  });
};
