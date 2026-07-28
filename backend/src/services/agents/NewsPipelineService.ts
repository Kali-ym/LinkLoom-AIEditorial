import type { ScheduleTask } from '../../types/schedule.js';
import { WorkflowTemplateRouteService } from '../api/WorkflowTemplateRouteService.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import type { WorkflowRun } from './WorkflowRun.js';

export const NEWS_PIPELINE = {
  templateId: 'ai-daily-report-json-from-raw',
  reportWorkflowId: 'wf_ai_daily_report_json_from_raw',
  chainWorkflowId: 'wf_news_production_chain',
  ingestionScheduleId: 'sched_news_ingestion',
  productionScheduleId: 'sched_news_production'
} as const;

export interface NewsPipelineStep {
  id: string;
  label: string;
  kind: 'ingestion' | 'query' | 'workflow' | 'agent' | 'tool' | 'publish';
  workflowStepId?: string;
}

export interface NewsPipelineStatus {
  ready: boolean;
  templateInstalled: boolean;
  reportWorkflowId?: string;
  chainWorkflowId?: string;
  ingestionSchedule?: Pick<ScheduleTask, 'id' | 'enabled' | 'cron' | 'lastRun' | 'lastStatus'>;
  productionSchedule?: Pick<ScheduleTask, 'id' | 'enabled' | 'cron' | 'lastRun' | 'lastStatus'>;
  pipelineSteps: NewsPipelineStep[];
  lastProductionRun?: Pick<WorkflowRun, 'workflowRunId' | 'status' | 'failedStepId' | 'createdAt' | 'error'>;
}

export interface NewsPipelineSetupResult {
  status: 'success';
  created: string[];
  reused: string[];
  reportWorkflowId: string;
  chainWorkflowId: string;
}

const PIPELINE_STEPS: NewsPipelineStep[] = [
  { id: 'ingest', label: '抓取', kind: 'ingestion' },
  { id: 'fetch', label: '素材查询', kind: 'query', workflowStepId: 'fetch' },
  { id: 'dedup', label: '去重', kind: 'tool', workflowStepId: 'dedup' },
  { id: 'material_brief', label: '摘要', kind: 'agent', workflowStepId: 'material_brief' },
  { id: 'route', label: '标签路由', kind: 'agent', workflowStepId: 'route' },
  { id: 'plan', label: '编辑审核', kind: 'agent', workflowStepId: 'plan' },
  { id: 'publish', label: '组装发布', kind: 'publish', workflowStepId: 'assemble' }
];

export class NewsPipelineService {
  private readonly templateService: WorkflowTemplateRouteService;

  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {
    this.templateService = new WorkflowTemplateRouteService(store, context.settings);
  }

  async getStatus(): Promise<NewsPipelineStatus> {
    const reportWorkflow = await this.store.getWorkflow(NEWS_PIPELINE.reportWorkflowId);
    const chainWorkflow = await this.store.getWorkflow(NEWS_PIPELINE.chainWorkflowId);
    const schedules = await this.store.listSchedules();
    const ingestionSchedule = schedules.find((item) => item.id === NEWS_PIPELINE.ingestionScheduleId);
    const productionSchedule = schedules.find((item) => item.id === NEWS_PIPELINE.productionScheduleId);

    const runs = await this.context.workflowRunRegistry.list(
      { workflowId: NEWS_PIPELINE.chainWorkflowId },
      0,
      1
    );
    const lastProductionRun = runs.items[0];

    const templateInstalled = Boolean(reportWorkflow);
    const ready = templateInstalled && Boolean(chainWorkflow) && Boolean(productionSchedule);

    return {
      ready,
      templateInstalled,
      reportWorkflowId: reportWorkflow?.id,
      chainWorkflowId: chainWorkflow?.id,
      ingestionSchedule: ingestionSchedule ? pickSchedule(ingestionSchedule) : undefined,
      productionSchedule: productionSchedule ? pickSchedule(productionSchedule) : undefined,
      pipelineSteps: PIPELINE_STEPS,
      lastProductionRun: lastProductionRun
        ? {
            workflowRunId: lastProductionRun.workflowRunId,
            status: lastProductionRun.status,
            failedStepId: lastProductionRun.failedStepId,
            createdAt: lastProductionRun.createdAt,
            error: lastProductionRun.error
          }
        : undefined
    };
  }

  async setup(options?: {
    providerId?: string;
    model?: string;
    enableSchedules?: boolean;
  }): Promise<NewsPipelineSetupResult> {
    const created: string[] = [];
    const reused: string[] = [];

    const instantiate = await this.templateService.instantiate(NEWS_PIPELINE.templateId, {
      conflictStrategy: 'reuse',
      variables: {
        providerId: options?.providerId ?? '',
        model: options?.model ?? ''
      }
    });
    created.push(...instantiate.createdAgents, ...instantiate.createdWorkflows);
    reused.push(...instantiate.reusedAgents, ...instantiate.reusedWorkflows);

    const reportWorkflowId =
      instantiate.createdWorkflows[0] ||
      instantiate.reusedWorkflows[0] ||
      NEWS_PIPELINE.reportWorkflowId;

    const chainCreated = await this.ensureChainWorkflow(reportWorkflowId);
    if (chainCreated) created.push(NEWS_PIPELINE.chainWorkflowId);
    else reused.push(NEWS_PIPELINE.chainWorkflowId);

    const scheduleCreated = await this.ensureSchedules(options?.enableSchedules === true);
    created.push(...scheduleCreated.created);
    reused.push(...scheduleCreated.reused);

    return {
      status: 'success',
      created,
      reused,
      reportWorkflowId,
      chainWorkflowId: NEWS_PIPELINE.chainWorkflowId
    };
  }

  async runProductionNow(): Promise<{ status: string; message: string }> {
    const schedule = await this.store.getSchedule(NEWS_PIPELINE.productionScheduleId);
    if (!schedule) {
      throw new Error('新闻生产调度未配置，请先执行一键部署');
    }
    await this.context.schedulerService.runNow(schedule.id);
    return { status: 'success', message: '已触发新闻生产编排链' };
  }

  private async ensureChainWorkflow(reportWorkflowId: string): Promise<boolean> {
    const existing = await this.store.getWorkflow(NEWS_PIPELINE.chainWorkflowId);
    if (existing) return false;

    await this.store.saveWorkflow({
      id: NEWS_PIPELINE.chainWorkflowId,
      name: '新闻生产编排链',
      description: '抓取待处理素材 → 去重 → 摘要 → 标签 → 审核 → 发布（调用 JSON 日报工作流）',
      initialStepId: 'fetch',
      metadata: {
        kind: 'news-production-chain',
        reportWorkflowId,
        templateId: NEWS_PIPELINE.templateId
      },
      steps: [
        {
          id: 'fetch',
          type: 'store-query',
          displayName: '查询待处理素材',
          config: {
            filter: {
              sinceHours: 36,
              metadataFilters: [{ path: 'ai_scored_at', op: 'exists' }]
            },
            limit: 300,
            orderBy: 'fetchedDesc'
          },
          nextStepIds: ['report']
        },
        {
          id: 'report',
          type: 'workflow',
          displayName: '日报生成发布',
          workflowId: reportWorkflowId,
          inputTemplate: {
            items: '$.fetch.items'
          },
          nextStepIds: []
        }
      ]
    });
    return true;
  }

  private async ensureSchedules(enableSchedules: boolean) {
    const created: string[] = [];
    const reused: string[] = [];

    const ingestionExisting = await this.store.getSchedule(NEWS_PIPELINE.ingestionScheduleId);
    if (!ingestionExisting) {
      const ingestion: ScheduleTask = {
        id: NEWS_PIPELINE.ingestionScheduleId,
        name: '新闻素材采集',
        description: '每日抓取全部数据源，为日报生产准备素材',
        cron: '0 6 * * *',
        timezone: 'Asia/Shanghai',
        type: 'INGESTION',
        targetId: 'all',
        enabled: enableSchedules,
        execution: {
          timeoutMs: 30 * 60 * 1000,
          retryAttempts: 1,
          retryBackoffMs: 60_000
        }
      };
      await this.store.saveSchedule(ingestion);
      if (enableSchedules) this.context.schedulerService.startSchedule(ingestion);
      created.push(ingestion.id);
    } else {
      reused.push(ingestionExisting.id);
    }

    const productionExisting = await this.store.getSchedule(NEWS_PIPELINE.productionScheduleId);
    if (!productionExisting) {
      const production: ScheduleTask = {
        id: NEWS_PIPELINE.productionScheduleId,
        name: '新闻日报生产',
        description: '查询素材并执行 JSON 日报工作流（去重→摘要→审核→发布）',
        cron: '0 8 * * *',
        timezone: 'Asia/Shanghai',
        type: 'WORKFLOW',
        targetId: NEWS_PIPELINE.chainWorkflowId,
        enabled: enableSchedules,
        inputs: {
          values: {},
          bindings: {
            date: { source: 'variable', expression: '${date}' }
          }
        },
        execution: {
          timeoutMs: 90 * 60 * 1000,
          retryAttempts: 1,
          retryBackoffMs: 120_000
        }
      };
      await this.store.saveSchedule(production);
      if (enableSchedules) this.context.schedulerService.startSchedule(production);
      created.push(production.id);
    } else {
      reused.push(productionExisting.id);
    }

    return { created, reused };
  }
}

function pickSchedule(schedule: ScheduleTask) {
  return {
    id: schedule.id,
    enabled: schedule.enabled,
    cron: schedule.cron,
    lastRun: schedule.lastRun,
    lastStatus: schedule.lastStatus
  };
}
