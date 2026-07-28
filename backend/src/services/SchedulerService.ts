import cron, { type ScheduledTask } from 'node-cron';
import { ScheduleTask, ScheduleRunInputs, ScheduleInputBinding } from '../types/schedule.js';
import { getISODate } from '../utils/helpers.js';
import { setByPath, getByPath } from './agents/workflowExpressions.js';
import type { WorkflowOrchestrationService } from './agents/WorkflowOrchestrationService.js';
import { LocalStore } from './LocalStore.js';
import { LogService } from './LogService.js';
import { TaskService } from './TaskService.js';

const DEFAULT_TIMEZONE = 'Asia/Shanghai';

/** 看门狗每多久扫一次（毫秒）。 */
const WATCHDOG_INTERVAL_MS = 60_000;
/** 一行 task_log 处于 'running' 超过此阈值 = 视为真卡住，强制收尾。 */
const WATCHDOG_STALE_AFTER_MS = 10 * 60_000;
/** 调度器全局并发上限（工作流 / 采集任务共享）。 */
const DEFAULT_MAX_CONCURRENT_SCHEDULES = 2;

/**
 * 重构后的 SchedulerService 只剩两类执行单元：
 *  - INGESTION：调用 TaskService 触发数据源采集
 *  - WORKFLOW：调用 WorkflowOrchestrationService 触发工作流（业务管线都在工作流里）
 *
 * 业务管线由工作流模板提供，需要时从模板显式创建；调度器只运行已经存在的调度配置。
 */
export class SchedulerService {
  private store: LocalStore;
  private taskService: TaskService;
  private cronTasks: Map<string, ScheduledTask> = new Map();
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private shuttingDown = false;
  private runningCount = 0;
  private readonly executionQueue: Array<() => void> = [];

  constructor(
    store: LocalStore,
    taskService: TaskService,
    private workflowOrchestrationService: WorkflowOrchestrationService | null = null
  ) {
    this.store = store;
    this.taskService = taskService;
  }

  async init() {
    const schedules = await this.store.listSchedules();
    LogService.info(`Initializing scheduler... Found ${schedules.length} total tasks in database.`);

    for (const schedule of schedules) {
      if (schedule.enabled) {
        LogService.info(
          `Loading enabled task: ${schedule.name} [${schedule.id}] with cron: ${schedule.cron}`
        );
        this.startSchedule(schedule);
      } else {
        LogService.info(`Skipping disabled task: ${schedule.name} [${schedule.id}]`);
      }
    }

    this.startWatchdog();

    try {
      const healed = await this.store.reconcileStuckRunningTaskLogs();
      if (healed > 0) {
        LogService.info(`Scheduler init: reconciled ${healed} stuck running task_log row(s).`);
      }
    } catch (err: any) {
      LogService.warn(`Scheduler init: reconcile stuck logs failed: ${err?.message || err}`);
    }

    LogService.info(`Scheduler initialized. Active cron tasks: ${this.cronTasks.size}`);
  }

  /**
   * 进程退出时调用：停掉所有 cron，并把仍处于 'running' 的 task_log 主动收尾，
   * 避免被启动期的 SchemaMigrator 兜底扫成"上次进程退出时未完成"。
   */
  async shutdown() {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    this.stopAll();

    try {
      const finalized = await this.store.finalizeRunningTaskLogs({
        status: 'interrupted',
        message: '服务正在优雅退出，未完成的任务被取消'
      });
      if (finalized > 0) {
        LogService.info(`Scheduler shutdown: finalized ${finalized} running task_log row(s).`);
      }
    } catch (err: any) {
      LogService.warn(`Scheduler shutdown: finalize running logs failed: ${err?.message || err}`);
    }
  }

  /**
   * 周期性看门狗：'running' 超过 WATCHDOG_STALE_AFTER_MS 的行视为真卡死
   * （比如 AI 调用挂起、网络永远阻塞），主动以 error 收尾，避免误导用户。
   */
  private startWatchdog() {
    if (this.watchdogTimer) return;
    this.watchdogTimer = setInterval(() => {
      const cutoffIso = new Date(Date.now() - WATCHDOG_STALE_AFTER_MS).toISOString();
      this.store
        .reconcileStuckRunningTaskLogs()
        .then((healed) => {
          if (healed > 0)
            LogService.info(
              `[Scheduler watchdog] reconciled ${healed} stuck running task_log row(s).`
            );
        })
        .catch((err) =>
          LogService.warn(`[Scheduler watchdog] reconcile failed: ${err?.message || err}`)
        );

      this.store
        .finalizeRunningTaskLogs({
          status: 'error',
          message: `任务运行超过 ${Math.round(WATCHDOG_STALE_AFTER_MS / 60_000)} 分钟仍未上报完成，已被看门狗终止`,
          olderThanIso: cutoffIso
        })
        .then((n) => {
          if (n > 0)
            LogService.warn(`[Scheduler watchdog] reaped ${n} stale running task_log row(s).`);
        })
        .catch((err) =>
          LogService.warn(`[Scheduler watchdog] sweep failed: ${err?.message || err}`)
        );
    }, WATCHDOG_INTERVAL_MS);
    if (typeof (this.watchdogTimer as any).unref === 'function') {
      (this.watchdogTimer as any).unref();
    }
  }

  startSchedule(schedule: ScheduleTask) {
    this.stopSchedule(schedule.id);

    if (!cron.validate(schedule.cron)) {
      LogService.error(`Invalid cron expression for task ${schedule.name}: ${schedule.cron}`);
      return;
    }

    try {
      const task = cron.schedule(
        schedule.cron,
        async () => {
          LogService.info(`Cron trigger fired for task: ${schedule.name}`);
          void this.enqueueExecution(() => this.executeTask(schedule)).catch((err) => {
            LogService.error(`Error in executed task ${schedule.name}: ${err}`);
          });
        },
        {
          timezone: schedule.timezone || DEFAULT_TIMEZONE
        }
      );

      this.cronTasks.set(schedule.id, task);
      this.persistNextRun(schedule, task).catch((err) =>
        LogService.warn(`Persist nextRun for ${schedule.id} failed: ${err?.message || err}`)
      );
      LogService.info(`Scheduled task started: ${schedule.name} (${schedule.cron})`);
    } catch (error) {
      LogService.error(`Failed to start schedule ${schedule.name}: ${error}`);
    }
  }

  stopSchedule(id: string) {
    const task = this.cronTasks.get(id);
    if (task) {
      try {
        const stopResult = task.stop();
        if (stopResult && typeof (stopResult as Promise<unknown>).catch === 'function') {
          (stopResult as Promise<unknown>).catch(() => undefined);
        }
      } catch {
        // ignore
      }
      this.cronTasks.delete(id);
      LogService.info(`Scheduled task stopped: ${id}`);
    }
  }

  stopAll() {
    LogService.info(`Stopping all ${this.cronTasks.size} scheduled tasks...`);
    for (const [, task] of this.cronTasks.entries()) {
      try {
        void task.stop();
      } catch {
        // ignore
      }
    }
    this.cronTasks.clear();
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  async runNow(scheduleId: string) {
    const schedule = await this.store.getSchedule(scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);
    return this.enqueueExecution(() => this.executeTask(schedule));
  }

  private enqueueExecution(task: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      const run = () => {
        this.runningCount += 1;
        task()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.runningCount -= 1;
            this.drainExecutionQueue();
          });
      };

      if (this.runningCount < DEFAULT_MAX_CONCURRENT_SCHEDULES) {
        run();
        return;
      }

      this.executionQueue.push(run);
    });
  }

  private drainExecutionQueue() {
    while (
      this.runningCount < DEFAULT_MAX_CONCURRENT_SCHEDULES &&
      this.executionQueue.length > 0
    ) {
      const next = this.executionQueue.shift();
      next?.();
    }
  }

  /**
   * 计算下一次触发时间并写回 schedule.nextRun。
   */
  private async persistNextRun(schedule: ScheduleTask, task: ScheduledTask) {
    try {
      const next = task.getNextRun?.();
      if (next instanceof Date && !Number.isNaN(next.getTime())) {
        const current = await this.store.getSchedule(schedule.id);
        if (current) {
          current.nextRun = next.toISOString();
          await this.store.saveSchedule(current);
        }
      }
    } catch (err: any) {
      LogService.warn(`getNextRun for ${schedule.id} threw: ${err?.message || err}`);
    }
  }

  private async executeTask(schedule: ScheduleTask) {
    LogService.info(`Executing scheduled task: ${schedule.name} (${schedule.type})`);

    const startTime = new Date().toISOString();
    const logId = await this.store.saveTaskLog({
      taskId: schedule.id,
      taskName: schedule.name,
      startTime,
      status: 'running',
      progress: 0
    });

    let finalized = false;
    let progressChain: Promise<void> = Promise.resolve();

    const enqueueProgress = (fn: () => Promise<void>) => {
      if (finalized) return;
      progressChain = progressChain.then(fn).catch((err) => {
        LogService.warn(`Task log progress update failed: ${err?.message || err}`);
      });
    };

    const onProgress = (_p: number): Promise<void> => {
      enqueueProgress(async () => {
        if (finalized) return;
        await this.store.updateTaskLog({ id: logId, progress: _p, status: 'running' });
      });
      return progressChain;
    };

    const onWorkflowProgress = (payload: any) => {
      enqueueProgress(async () => {
        if (finalized) return;
        const progress = typeof payload?.progress === 'number' ? payload.progress : undefined;
        const message = typeof payload?.message === 'string' ? payload.message : undefined;
        const patch: Parameters<LocalStore['updateTaskLog']>[0] = { id: logId, status: 'running' };
        if (progress !== undefined) patch.progress = progress;
        if (message !== undefined) patch.message = message;
        await this.store.updateTaskLog(patch);
      });
    };

    try {
      let resultCount = 0;
      let message = '';

      const resolved = this.resolveInputs(schedule);
      const runDate = (resolved.values?.date as string) || getISODate();

      switch (schedule.type) {
        case 'INGESTION': {
          const adapter = schedule.targetId;
          if (!adapter || adapter === 'all') {
            const result = await this.taskService.runDailyIngestion(
              runDate,
              resolved.values?.extraConfig as any,
              onProgress
            );
            resultCount = result.count;
            message = `全量采集完成（${result.count} 条）`;
          } else {
            const extraConfig = resolved.values?.extraConfig ?? resolved.values;
            const adapterConfigIds = (this.taskService.settings?.ADAPTERS || []).map(
              (item) => item.id
            );
            const result = adapterConfigIds.includes(adapter)
              ? await this.taskService.runAdapterConfigIngestion(
                  adapter,
                  runDate,
                  extraConfig,
                  onProgress
                )
              : await this.taskService.runSingleAdapterIngestion(
                  adapter,
                  runDate,
                  extraConfig,
                  onProgress
                );
            resultCount = result.count;
            message = adapterConfigIds.includes(adapter)
              ? `数据源 ${adapter} 采集完成（${result.count} 条）`
              : `适配器 ${adapter} 采集完成（${result.count} 条）`;
          }
          break;
        }
        case 'WORKFLOW': {
          if (!this.workflowOrchestrationService) {
            throw new Error('Workflow Engine not initialized');
          }
          const retryAttempts = Math.max(0, schedule.execution?.retryAttempts ?? 0);
          const retryBackoffMs = Math.max(1000, schedule.execution?.retryBackoffMs ?? 5000);
          const timeoutMs = schedule.execution?.timeoutMs;
          let output: unknown;
          let lastError: unknown;

          for (let attempt = 0; attempt <= retryAttempts; attempt++) {
            try {
              output = await this.workflowOrchestrationService.run({
                workflowId: schedule.targetId,
                input: resolved.values,
                date: runDate,
                source: 'scheduler',
                scheduleId: schedule.id,
                timeoutMs,
                onProgress: onWorkflowProgress
              });
              lastError = undefined;
              break;
            } catch (error) {
              lastError = error;
              if (attempt >= retryAttempts) throw error;
              const waitMs = retryBackoffMs * (attempt + 1);
              LogService.warn(
                `Scheduled workflow ${schedule.name} failed attempt ${attempt + 1}/${retryAttempts + 1}; retrying in ${waitMs}ms`
              );
              await sleep(waitMs);
            }
          }

          if (lastError) {
            throw lastError instanceof Error ? lastError : new Error(String(lastError));
          }
          message = `工作流 ${schedule.targetId} 执行完成`;
          resultCount = this.estimateResultCount(output);
          break;
        }
        default:
          throw new Error(
            `Unsupported task type: ${schedule.type}. 该旧类型尚未迁移，请到「调度中心」重新配置。`
          );
      }

      await progressChain;

      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      finalized = true;
      await this.store.updateTaskLog({
        id: logId,
        endTime,
        duration,
        status: 'success',
        progress: 100,
        message: message || '执行成功',
        resultCount
      });

      schedule.lastRun = startTime;
      schedule.lastStatus = 'success';
      await this.store.saveSchedule(schedule);
    } catch (error: any) {
      LogService.error(`Scheduled task ${schedule.name} failed: ${error.message}`);

      await progressChain;

      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      finalized = true;
      await this.store.updateTaskLog({
        id: logId,
        endTime,
        duration,
        status: 'error',
        message: error.message
      });

      schedule.lastRun = startTime;
      schedule.lastStatus = 'error';
      schedule.lastError = error.message;
      await this.store.saveSchedule(schedule);
    }
  }

  /**
   * 把 schedule.inputs 中的 binding 解析出最终值。
   * - static：直接用 value
   * - variable：使用 expression 解析（支持 ${date}/${yesterday}/${now}/${env.X}/${prev.lastRunAt}）
   */
  private resolveInputs(schedule: ScheduleTask): { values: Record<string, unknown> } {
    const inputs: ScheduleRunInputs = schedule.inputs || {};
    const values: Record<string, unknown> = JSON.parse(JSON.stringify(inputs.values || {}));

    const bindings = inputs.bindings || {};
    for (const [key, binding] of Object.entries(bindings)) {
      const resolved = this.resolveBinding(binding, schedule);
      setByPath(values, key, resolved);
    }

    // 字符串模板内同样支持 ${date} 等变量
    return {
      values: this.renderVariablesDeep(values, this.buildVarScope(schedule)) as Record<
        string,
        unknown
      >
    };
  }

  private resolveBinding(binding: ScheduleInputBinding, schedule: ScheduleTask): unknown {
    if (!binding) return undefined;
    if (binding.source === 'static') return binding.value;
    if (binding.source === 'variable') {
      const expr = (binding.expression || '').trim();
      if (!expr) return undefined;
      return this.evaluateVariableExpression(expr, schedule);
    }
    return undefined;
  }

  private evaluateVariableExpression(expr: string, schedule: ScheduleTask): unknown {
    const scope = this.buildVarScope(schedule);

    if (/^\$\{[^}]+\}$/.test(expr)) {
      const name = expr.slice(2, -1).trim();
      return getByPath(scope, name);
    }
    return expr.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      const v = getByPath(scope, String(varName).trim());
      return v === undefined || v === null ? '' : String(v);
    });
  }

  private buildVarScope(schedule: ScheduleTask): Record<string, unknown> {
    const now = new Date();
    return {
      date: getISODate(now),
      today: getISODate(now),
      yesterday: getISODate(new Date(now.getTime() - 86400_000)),
      tomorrow: getISODate(new Date(now.getTime() + 86400_000)),
      now: now.toISOString(),
      timestamp: now.getTime(),
      env: process.env,
      prev: {
        lastRunAt: schedule.lastRun,
        lastStatus: schedule.lastStatus
      }
    };
  }

  private renderVariablesDeep(value: unknown, scope: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
        const v = getByPath(scope, String(varName).trim());
        return v === undefined || v === null ? '' : String(v);
      });
    }
    if (Array.isArray(value)) return value.map((v) => this.renderVariablesDeep(v, scope));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          this.renderVariablesDeep(v, scope)
        ])
      );
    }
    return value;
  }

  private estimateResultCount(output: unknown): number {
    if (!output) return 0;
    if (typeof output === 'object') {
      const rec = output as Record<string, unknown>;
      if (typeof rec.count === 'number') return rec.count;
      if (typeof rec.processed === 'number') return rec.processed;
      if (Array.isArray(rec.items)) return rec.items.length;
      if (Array.isArray(rec.results)) return rec.results.length;
    }
    return 1;
  }

  getActiveTasks() {
    return Array.from(this.cronTasks.keys());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
