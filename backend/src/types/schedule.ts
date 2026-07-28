/**
 * 调度任务（Scheduled Task）类型定义。
 *
 * 本版本将原先的多种业务化任务类型收敛为两种基础执行单元：
 *  - INGESTION：触发数据源采集（一个适配器或全部适配器）
 *  - WORKFLOW：触发一个工作流（业务管线全部下沉至 WorkflowEngine）
 *
 */

export type ScheduleTaskType = 'INGESTION' | 'WORKFLOW';

/**
 * 单个入参绑定。
 *  - static：直接使用 value
 *  - variable：使用 expression 在运行时解析，支持 ${date} / ${yesterday} / ${now} / ${env.X}
 */
export interface ScheduleInputBinding {
  source: 'static' | 'variable';
  value?: unknown;
  expression?: string;
}

/**
 * 调度任务的入参集合。
 * - values: 直接的键值对（key 对应工作流 inputSpec 字段或适配器 configField key）。
 * - bindings: 同样按 key 索引，但声明该 key 是「静态值」还是「运行时变量表达式」。
 *   未在 bindings 中出现的 key，按 values[key] 静态使用。
 */
export interface ScheduleRunInputs {
  values?: Record<string, unknown>;
  bindings?: Record<string, ScheduleInputBinding>;
}

export interface ScheduleTaskExecution {
  /** 超时（毫秒），0 或未设置代表不限制。 */
  timeoutMs?: number;
  /** 失败策略；当前 SchedulerService 仅记录状态，不联动其他任务，预留扩展。 */
  failurePolicy?: 'stop' | 'continue';
  /** 失败后重试次数（不含首次执行），默认 0。 */
  retryAttempts?: number;
  /** 重试退避基数（毫秒），实际等待 = backoff * attempt。 */
  retryBackoffMs?: number;
}

export interface ScheduleTask {
  id: string;
  name: string;
  description?: string;
  cron: string;
  timezone?: string;
  type: ScheduleTaskType;
  /**
   * 执行对象 ID：
   *  - type=INGESTION：适配器名（或 `all`）
   *  - type=WORKFLOW：工作流 ID
   */
  targetId: string;
  inputs?: ScheduleRunInputs;
  execution?: ScheduleTaskExecution;
  enabled: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'error' | 'interrupted';
  lastError?: string;
  /** 下一次预计触发时间（ISO 字符串），由调度器在启动/保存时计算并持久化。 */
  nextRun?: string;
  updatedAt?: number;
}

export interface TaskLog {
  id: number;
  taskId: string;
  taskName: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'running' | 'success' | 'error' | 'interrupted';
  progress?: number;
  message?: string;
  resultCount?: number;
}
