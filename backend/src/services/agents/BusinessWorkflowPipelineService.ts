import type { BusinessPipelineId, BusinessPipelineRunResult } from '../../types/businessPipeline.js';
import { EditorialAgentsService } from '../editorial/EditorialAgentsService.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import {
  BUSINESS_PIPELINES,
  explicitRunMetadata,
  listBusinessPipelineDescriptors,
  type BusinessPipelinesStatus
} from './businessPipelineRegistry.js';
import { runDailyQualityGateBusinessPipeline } from './DailyQualityGateBusinessPipeline.js';
import { runEventFollowupBusinessPipeline } from './EventFollowupBusinessPipeline.js';

export { BUSINESS_PIPELINES };

export class BusinessWorkflowPipelineService {
  private readonly editorialAgents: EditorialAgentsService;

  constructor(
    private readonly store: LocalStore,
    _context: ServiceContext
  ) {
    this.editorialAgents = new EditorialAgentsService(store);
    void _context;
  }

  async getStatus(): Promise<BusinessPipelinesStatus> {
    const pipelines = listBusinessPipelineDescriptors();
    const topicCopilot = await this.store.getAgent('topic_copilot');
    return {
      pipelines,
      editorialAgentsReady: Boolean(topicCopilot),
      rebuildRequired: true,
      explicitEntryReady: pipelines
        .filter((pipeline) => pipeline.explicitEntryReady)
        .map((pipeline) => pipeline.id),
      message: '业务工作流默认部署仍隔离；B1 事件续报与 B6 日报质检已补显式入口，代码待统一验收。'
    };
  }

  async setup(_options?: { enableSchedules?: boolean; seedRegression?: boolean }) {
    const created = await this.editorialAgents.ensureBuiltinAgents();
    return {
      status: 'disabled' as const,
      created,
      reused: [] as string[],
      message: '仅初始化编辑类 Agent；业务工作流默认部署仍关闭，避免创建未验收管线。'
    };
  }

  async runPipeline(
    pipelineId: keyof typeof BUSINESS_PIPELINES,
    input?: unknown
  ): Promise<BusinessPipelineRunResult> {
    if (pipelineId === 'eventFollowup') {
      return runEventFollowupBusinessPipeline(this.store, input);
    }

    if (pipelineId === 'dailyQualityGate') {
      return runDailyQualityGateBusinessPipeline(input);
    }

    return {
      status: 'disabled',
      pipelineId: pipelineId as BusinessPipelineId,
      message: '该业务管线仍处于隔离重建状态，未提供显式执行入口。',
      ...explicitRunMetadata(pipelineId)
    };
  }
}
