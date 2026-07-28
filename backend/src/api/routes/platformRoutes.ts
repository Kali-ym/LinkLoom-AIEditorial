import { AgentRegressionService } from '../../services/agents/AgentRegressionService.js';
import { AgentGovernanceService } from '../../services/agents/AgentGovernanceService.js';
import { BusinessWorkflowPipelineService, BUSINESS_PIPELINES } from '../../services/agents/BusinessWorkflowPipelineService.js';
import { NewsPipelineService } from '../../services/agents/NewsPipelineService.js';
import { PlatformPipelineService } from '../../services/agents/PlatformPipelineService.js';
import { SourceQualityService } from '../../services/agents/SourceQualityService.js';
import type { RouteRegistrar } from './types.js';

export const registerPlatformRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const newsPipeline = new NewsPipelineService(store, context);
  const governance = new AgentGovernanceService(store, context);
  const sourceQuality = new SourceQualityService(store, context);
  const platformPipelines = new PlatformPipelineService(store, context);
  const businessPipelines = new BusinessWorkflowPipelineService(store, context);
  const regression = new AgentRegressionService(store, context);

  fastify.get('/api/platform/news-pipeline/status', async () => {
    return newsPipeline.getStatus();
  });

  fastify.post('/api/platform/news-pipeline/setup', async (request) => {
    const body = (request.body ?? {}) as {
      providerId?: string;
      model?: string;
      enableSchedules?: boolean;
    };
    return newsPipeline.setup(body);
  });

  fastify.post('/api/platform/news-pipeline/run', async () => {
    return newsPipeline.runProductionNow();
  });

  fastify.get('/api/platform/governance/status', async () => {
    return governance.getStatus();
  });

  fastify.get('/api/platform/governance/permission-matrix', async () => {
    return governance.getPermissionMatrix();
  });

  fastify.get('/api/platform/source-quality/status', async () => {
    return sourceQuality.getStatus();
  });

  fastify.put('/api/platform/source-quality/config', async (request) => {
    return sourceQuality.updateConfig((request.body ?? {}) as Partial<import('../../services/agents/SourceQualityService.js').SourceQualityConfig>);
  });

  fastify.get('/api/platform/pipelines/status', async () => {
    return platformPipelines.getStatus();
  });

  fastify.post('/api/platform/pipelines/setup', async (request) => {
    const body = (request.body ?? {}) as { enableSchedules?: boolean };
    return platformPipelines.setupExtended(body);
  });

  fastify.post('/api/platform/pipelines/:pipelineId/run', async (request) => {
    const { pipelineId } = request.params as { pipelineId: string };
    if (!(pipelineId in { hotTopics: 1, sourceMonitor: 1, topicTrack: 1 })) {
      throw new Error(`Unknown pipeline: ${pipelineId}`);
    }
    return platformPipelines.runPipeline(pipelineId as 'hotTopics' | 'sourceMonitor' | 'topicTrack');
  });

  fastify.post('/api/platform/business-pipelines/setup', async (request) => {
    const body = (request.body ?? {}) as { enableSchedules?: boolean };
    return businessPipelines.setup(body);
  });

  fastify.get('/api/platform/business-pipelines/status', async () => {
    return businessPipelines.getStatus();
  });

  fastify.post('/api/platform/business-pipelines/:pipelineId/run', async (request) => {
    const { pipelineId } = request.params as { pipelineId: string };
    if (!(pipelineId in BUSINESS_PIPELINES)) {
      throw new Error(`Unknown business pipeline: ${pipelineId}`);
    }
    return businessPipelines.runPipeline(
      pipelineId as keyof typeof BUSINESS_PIPELINES,
      request.body ?? {}
    );
  });

  fastify.get('/api/platform/regression/samples', async () => {
    return regression.listSamples();
  });

  fastify.post('/api/platform/regression/samples', async (request) => {
    return regression.saveSample(request.body as never);
  });

  fastify.delete('/api/platform/regression/samples/:sampleId', async (request) => {
    const { sampleId } = request.params as { sampleId: string };
    return regression.deleteSample(sampleId);
  });

  fastify.post('/api/platform/regression/run', async (request) => {
    const body = (request.body ?? {}) as { sampleIds?: string[] };
    return regression.runSamples(body.sampleIds);
  });

  fastify.get('/api/platform/regression/runs', async (request) => {
    const query = request.query as { limit?: string };
    const limit = Number.parseInt(query.limit || '30', 10) || 30;
    return regression.listRuns(limit);
  });
};
