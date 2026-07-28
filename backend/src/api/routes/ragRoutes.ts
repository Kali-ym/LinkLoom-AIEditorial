import { RagRouteService } from '../../services/rag/RagRouteService.js';
import type { SmallModelServiceConfig } from '../../types/config.js';
import type { RouteRegistrar } from './types.js';

export const registerRagRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new RagRouteService(store, context);

  fastify.get('/api/rag/status', async () => service.getStatus());

  fastify.post('/api/rag/search-explicit', async (request) => {
    return service.searchExplicit(request.body ?? {});
  });

  fastify.post('/api/rag/test-service', async (request) => {
    const body = (request.body ?? {}) as {
      serviceId?: string;
      service?: SmallModelServiceConfig;
    };
    if (!body.serviceId?.trim() && !body.service) {
      throw new Error('serviceId or service is required');
    }
    return service.testService(body);
  });

  fastify.post('/api/rag/reindex', async (request) => {
    return service.reindexEmbeddings(request.body ?? {});
  });

  fastify.post('/api/rag/jobs/run-once', async (request) => {
    return service.runEmbeddingJobsOnce(request.body ?? {});
  });

  fastify.get('/api/rag/jobs', async (request) => {
    return service.listEmbeddingJobs(request.query ?? {});
  });

  fastify.get('/api/rag/index-versions', async (request) => service.listIndexVersions(request.query ?? {}));

  fastify.post('/api/rag/index-versions', async (request) => {
    return service.createIndexVersion(request.body ?? {});
  });

  fastify.post('/api/rag/index-versions/evaluate', async (request) => {
    return service.evaluateIndexVersion(request.body ?? {});
  });

  fastify.post('/api/rag/index-versions/activate', async (request) => {
    return service.activateIndexVersion(request.body ?? {});
  });

  fastify.post('/api/rag/index-versions/rollback', async (request) => {
    return service.rollbackIndexVersion(request.body ?? {});
  });

  fastify.get('/api/rag/traces', async (request) => {
    return service.listTraces(request.query ?? {});
  });

  fastify.get('/api/rag/traces/:traceId', async (request) => {
    return service.getTrace(request.params ?? {});
  });

  fastify.get('/api/rag/eval/datasets', async () => service.listEvalDatasets());

  fastify.post('/api/rag/eval/datasets', async (request) => {
    return service.createEvalDataset(request.body ?? {});
  });

  fastify.post('/api/rag/eval/run', async (request) => {
    return service.runEvalDataset(request.body ?? {});
  });

  fastify.post('/api/rag/eval/compare', async (request) => {
    return service.compareEvalRuns(request.body ?? {});
  });

  fastify.get('/api/rag/eval/runs', async (request) => {
    return service.listEvalRuns(request.query ?? {});
  });
};
