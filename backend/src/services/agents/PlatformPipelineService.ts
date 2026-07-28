import type { ScheduleTask } from '../../types/schedule.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import { NEWS_PIPELINE } from './NewsPipelineService.js';

export const PLATFORM_PIPELINES = {
  hotTopics: {
    workflowId: 'wf_hot_topics_digest',
    scheduleId: 'sched_hot_topics_digest'
  },
  sourceMonitor: {
    workflowId: 'wf_source_monitor_digest',
    scheduleId: 'sched_source_monitor_digest'
  },
  topicTrack: {
    workflowId: 'wf_topic_track_digest',
    scheduleId: 'sched_topic_track_digest'
  }
} as const;

export interface PlatformPipelineDescriptor {
  id: string;
  label: string;
  description: string;
  workflowId: string;
  scheduleId: string;
  ready: boolean;
  cron?: string;
  enabled?: boolean;
}

export interface PlatformPipelinesStatus {
  newsPipelineReady: boolean;
  pipelines: PlatformPipelineDescriptor[];
}

export class PlatformPipelineService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async getStatus(): Promise<PlatformPipelinesStatus> {
    const schedules = await this.store.listSchedules();
    const pipelines = await Promise.all(
      Object.entries(PLATFORM_PIPELINES).map(async ([id, spec]) => {
        const workflow = await this.store.getWorkflow(spec.workflowId);
        const schedule = schedules.find((item) => item.id === spec.scheduleId);
        return {
          id,
          label: pipelineLabel(id),
          description: pipelineDescription(id),
          workflowId: spec.workflowId,
          scheduleId: spec.scheduleId,
          ready: Boolean(workflow && schedule),
          cron: schedule?.cron,
          enabled: schedule?.enabled
        } satisfies PlatformPipelineDescriptor;
      })
    );

    const newsChain = await this.store.getWorkflow(NEWS_PIPELINE.chainWorkflowId);
    return {
      newsPipelineReady: Boolean(newsChain),
      pipelines
    };
  }

  async setupExtended(options?: { enableSchedules?: boolean }) {
    const created: string[] = [];
    const reused: string[] = [];

    for (const [id, spec] of Object.entries(PLATFORM_PIPELINES)) {
      const workflowCreated = await this.ensureWorkflow(id, spec.workflowId);
      if (workflowCreated) created.push(spec.workflowId);
      else reused.push(spec.workflowId);

      const scheduleCreated = await this.ensureSchedule(id, spec, options?.enableSchedules === true);
      if (scheduleCreated) created.push(spec.scheduleId);
      else reused.push(spec.scheduleId);
    }

    return { status: 'success' as const, created, reused };
  }

  async runPipeline(pipelineId: keyof typeof PLATFORM_PIPELINES) {
    const spec = PLATFORM_PIPELINES[pipelineId];
    const schedule = await this.store.getSchedule(spec.scheduleId);
    if (!schedule) throw new Error(`管线 ${pipelineId} 未部署，请先执行 setup`);
    await this.context.schedulerService.runNow(schedule.id);
    return { status: 'success', message: `已触发 ${pipelineLabel(pipelineId)}` };
  }

  private async ensureWorkflow(id: string, workflowId: string): Promise<boolean> {
    const existing = await this.store.getWorkflow(workflowId);
    if (existing) return false;

    const definition = buildWorkflowDefinition(id, workflowId);
    await this.store.saveWorkflow(definition);
    return true;
  }

  private async ensureSchedule(
    id: string,
    spec: { workflowId: string; scheduleId: string },
    enableSchedules: boolean
  ): Promise<boolean> {
    const existing = await this.store.getSchedule(spec.scheduleId);
    if (existing) return false;

    const schedule: ScheduleTask = {
      id: spec.scheduleId,
      name: pipelineLabel(id),
      description: pipelineDescription(id),
      cron: pipelineCron(id),
      timezone: 'Asia/Shanghai',
      type: 'WORKFLOW',
      targetId: spec.workflowId,
      enabled: enableSchedules,
      execution: {
        timeoutMs: 45 * 60 * 1000,
        retryAttempts: 1,
        retryBackoffMs: 90_000
      }
    };
    await this.store.saveSchedule(schedule);
    if (enableSchedules) this.context.schedulerService.startSchedule(schedule);
    return true;
  }
}

function buildWorkflowDefinition(id: string, workflowId: string) {
  if (id === 'hotTopics') {
    return {
      id: workflowId,
      name: '热点聚合摘要',
      description: '查询近 24h 高分素材，聚合热点主题并写入 KV 索引',
      initialStepId: 'query',
      metadata: { kind: 'hot-topics-pipeline' },
      steps: [
        {
          id: 'query',
          type: 'store-query',
          displayName: '查询高分素材',
          config: {
            filter: {
              sinceHours: 24,
              metadataFilters: [{ path: 'ai_score', op: 'gte', value: 75 }]
            },
            limit: 120,
            orderBy: 'metadataDesc',
            orderMetadataPath: 'ai_score'
          },
          nextStepIds: ['persist']
        },
        {
          id: 'persist',
          type: 'kv-write',
          displayName: '落盘热点索引',
          config: {
            key: 'hot_topics_digest:${__date}',
            value: '$.query',
            indexKey: 'hot_topics_digest_index',
            requireApproval: false
          },
          nextStepIds: []
        }
      ]
    };
  }

  if (id === 'sourceMonitor') {
    return {
      id: workflowId,
      name: '指定来源监控',
      description: '按来源白名单（平台来源质量配置）监控近 12h 新增素材',
      initialStepId: 'query',
      metadata: { kind: 'source-monitor-pipeline' },
      steps: [
        {
          id: 'query',
          type: 'store-query',
          displayName: '查询监控来源素材',
          config: {
            filter: { sinceHours: 12 },
            limit: 200,
            orderBy: 'fetchedDesc'
          },
          nextStepIds: ['persist']
        },
        {
          id: 'persist',
          type: 'kv-write',
          displayName: '落盘监控快照',
          config: {
            key: 'source_monitor_snapshot:${__date}',
            value: '$.query',
            indexKey: 'source_monitor_index'
          },
          nextStepIds: []
        }
      ]
    };
  }

  return {
    id: workflowId,
    name: '主题追踪摘要',
    description: '追踪带 ai_tags 的素材并写入主题追踪索引',
    initialStepId: 'query',
    metadata: { kind: 'topic-track-pipeline' },
    steps: [
      {
        id: 'query',
        type: 'store-query',
        displayName: '查询已打标签素材',
        config: {
          filter: {
            sinceHours: 48,
            metadataFilters: [{ path: 'ai_tags', op: 'exists' }]
          },
          limit: 200,
          orderBy: 'fetchedDesc'
        },
        nextStepIds: ['persist']
      },
      {
        id: 'persist',
        type: 'kv-write',
        displayName: '落盘主题追踪',
        config: {
          key: 'topic_track_digest:${__date}',
          value: '$.query',
          indexKey: 'topic_track_index'
        },
        nextStepIds: []
      }
    ]
  };
}

function pipelineLabel(id: string): string {
  if (id === 'hotTopics') return '热点聚合';
  if (id === 'sourceMonitor') return '来源监控';
  return '主题追踪';
}

function pipelineDescription(id: string): string {
  if (id === 'hotTopics') return '聚合近 24h 高分 AI 资讯热点';
  if (id === 'sourceMonitor') return '监控白名单来源的新增素材';
  return '追踪带标签素材的主题演化';
}

function pipelineCron(id: string): string {
  if (id === 'hotTopics') return '30 9,15 * * *';
  if (id === 'sourceMonitor') return '0 */4 * * *';
  return '0 10 * * *';
}
