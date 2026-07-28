import type { ScheduleTask } from '../../../services/scheduleService';

/** 调度任务类型标签（INGESTION / WORKFLOW）。 */
export const TYPE_LABEL: Record<string, string> = {
  INGESTION: '数据源采集',
  WORKFLOW: '工作流编排'
};

export const STATUS_LABEL: Record<string, string> = {
  success: '已成功',
  error: '已失败',
  running: '执行中',
  interrupted: '已中断'
};

export const FAILURE_POLICY_LABEL: Record<
  NonNullable<ScheduleTask['execution']>['failurePolicy'] & string,
  string
> = {
  stop: '出错后停止',
  continue: '出错后继续'
};

export const VARIABLE_OPTIONS: Array<{ value: string; label: string; description?: string }> = [
  { value: '${date}', label: '${date}', description: '运行当天的日期（YYYY-MM-DD）' },
  { value: '${today}', label: '${today}', description: '同 ${date}' },
  { value: '${yesterday}', label: '${yesterday}', description: '昨天的日期' },
  { value: '${tomorrow}', label: '${tomorrow}', description: '明天的日期' },
  { value: '${now}', label: '${now}', description: '运行时刻的 ISO 字符串' },
  { value: '${prev.lastRunAt}', label: '${prev.lastRunAt}', description: '上次运行时间' }
];

export const CRON_PRESETS: Array<{ label: string; value: string }> = [
  { label: '每小时整点', value: '0 * * * *' },
  { label: '每天 09:30', value: '30 9 * * *' },
  { label: '每天 08:00', value: '0 8 * * *' },
  { label: '每 30 分钟', value: '*/30 * * * *' },
  { label: '每周一 09:00', value: '0 9 * * 1' },
  { label: '每月 1 日 09:00', value: '0 9 1 * *' }
];
