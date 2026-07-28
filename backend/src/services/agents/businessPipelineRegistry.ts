import type {
  BusinessPipelineAcceptanceStatus,
  BusinessPipelineId,
  BusinessPipelineInputContract,
  BusinessPipelineOutputContract,
  BusinessPipelineRunMetadata,
  BusinessPipelineStatus
} from '../../types/businessPipeline.js';

export const BUSINESS_PIPELINES: Record<BusinessPipelineId, { workflowId: string; scheduleId: string }> = {
  eventFollowup: {
    workflowId: 'wf_event_followup',
    scheduleId: 'sched_event_followup'
  },
  dailyQualityGate: {
    workflowId: 'wf_daily_quality_gate',
    scheduleId: 'sched_daily_quality_gate'
  },
  breakingFlash: {
    workflowId: 'wf_breaking_flash',
    scheduleId: 'sched_breaking_flash'
  },
  channelDerivative: {
    workflowId: 'wf_channel_derivative',
    scheduleId: 'sched_channel_derivative'
  },
  weeklyNewsletter: {
    workflowId: 'wf_weekly_newsletter',
    scheduleId: 'sched_weekly_newsletter'
  },
  factCheck: {
    workflowId: 'wf_fact_check',
    scheduleId: 'sched_fact_check'
  }
} as const;

export interface BusinessPipelineDescriptor {
  id: BusinessPipelineId;
  label: string;
  description: string;
  workflowId: string;
  scheduleId: string;
  ready: boolean;
  cron?: string;
  enabled?: boolean;
  explicitEntryReady: boolean;
  defaultRouteEnabled: false;
  scheduleEnabled: false;
  status: BusinessPipelineStatus;
  acceptanceStatus: BusinessPipelineAcceptanceStatus;
  inputContract?: BusinessPipelineInputContract;
  outputContract?: BusinessPipelineOutputContract;
}

export interface BusinessPipelinesStatus {
  pipelines: BusinessPipelineDescriptor[];
  editorialAgentsReady: boolean;
  rebuildRequired: boolean;
  explicitEntryReady: BusinessPipelineId[];
  message: string;
}

export function listBusinessPipelineDescriptors(): BusinessPipelineDescriptor[] {
  return (Object.entries(BUSINESS_PIPELINES) as Array<
    [BusinessPipelineId, (typeof BUSINESS_PIPELINES)[BusinessPipelineId]]
  >).map(([id, spec]) => ({
    id,
    label: businessPipelineLabel(id),
    description: businessPipelineDescription(id),
    workflowId: spec.workflowId,
    scheduleId: spec.scheduleId,
    ready: false,
    enabled: false,
    explicitEntryReady: isExplicitEntryReady(id),
    defaultRouteEnabled: false,
    scheduleEnabled: false,
    status: businessPipelineStatus(id),
    acceptanceStatus: businessPipelineAcceptanceStatus(id),
    inputContract: businessPipelineInputContract(id),
    outputContract: businessPipelineOutputContract(id)
  }));
}

export function explicitRunMetadata(id: BusinessPipelineId): BusinessPipelineRunMetadata {
  return {
    mode: 'explicit',
    defaultRouteEnabled: false,
    scheduleEnabled: false,
    acceptanceStatus: businessPipelineAcceptanceStatus(id)
  };
}

export function isExplicitEntryReady(id: BusinessPipelineId): boolean {
  return id === 'eventFollowup' || id === 'dailyQualityGate';
}

export function businessPipelineStatus(id: BusinessPipelineId): BusinessPipelineStatus {
  return isExplicitEntryReady(id) ? 'explicit_entry_ready' : 'rebuild_required';
}

export function businessPipelineAcceptanceStatus(id: BusinessPipelineId): BusinessPipelineAcceptanceStatus {
  return isExplicitEntryReady(id) ? 'code_added_pending_validation' : 'not_started';
}

function businessPipelineInputContract(id: BusinessPipelineId): BusinessPipelineInputContract | undefined {
  if (id === 'eventFollowup') {
    return {
      required: ['date', 'topicKey', 'candidates[].title'],
      optional: [
        'summary',
        'commit',
        'candidates[].url',
        'candidates[].source',
        'candidates[].publishedAt',
        'candidates[].factFingerprint'
      ],
      notes: 'commit 默认为 true；传 false 时只做差异判断，不写入续报状态 KV。'
    };
  }

  if (id === 'dailyQualityGate') {
    return {
      required: ['report'],
      optional: ['policy.minSources', 'policy.blockOnWarnings'],
      notes: '显式入口会开启质检策略；结果只返回结构化质检结论，不自动阻塞日报主链路。'
    };
  }

  return undefined;
}

function businessPipelineOutputContract(id: BusinessPipelineId): BusinessPipelineOutputContract | undefined {
  if (id === 'eventFollowup') {
    return {
      fields: ['status', 'persisted', 'decision', 'reason', 'newItems', 'duplicateItems', 'evidence', 'nextState', 'issues'],
      notes: '成功时只读写 event_followup_state:* 与 event_followup:* 专属 KV；输入无效时返回 invalid_input，不写入 KV。'
    };
  }

  if (id === 'dailyQualityGate') {
    return {
      fields: ['status', 'approved', 'requiresApproval', 'issueCount', 'errorCount', 'warningCount', 'issues'],
      notes: '仅生成确定性质检结果；输入无效时返回 invalid_input；是否接人工审批由后续显式编排决定。'
    };
  }

  return undefined;
}

function businessPipelineLabel(id: BusinessPipelineId) {
  if (id === 'eventFollowup') return '事件续报专刊';
  if (id === 'dailyQualityGate') return '日报确定性质检';
  if (id === 'breakingFlash') return '突发快讯';
  if (id === 'channelDerivative') return '多渠道衍生';
  if (id === 'weeklyNewsletter') return '垂直周刊';
  if (id === 'factCheck') return '双 Agent 事实审稿';
  return id;
}

function businessPipelineDescription(id: BusinessPipelineId) {
  if (id === 'eventFollowup') {
    return '代码入口已补：基于上一轮状态和本轮候选素材判断新发/续报/重复，默认只通过显式调用运行。';
  }
  if (id === 'dailyQualityGate') {
    return '代码入口已补：对日报 JSON 做确定性质检，输出是否需要审批，不默认阻塞主链路。';
  }
  if (id === 'breakingFlash') return '仍隔离：原实现只落查询结果，尚未形成快讯生成链路。';
  if (id === 'channelDerivative') return '仍隔离：待日报产物与渠道格式契约稳定后重建。';
  if (id === 'weeklyNewsletter') return '仍隔离：待周刊模板与验收样本补齐后重建。';
  if (id === 'factCheck') return '仍隔离：原合并与问题统计未闭环，不能作为质检结论。';
  return '仍隔离：等待重新设计和验收。';
}