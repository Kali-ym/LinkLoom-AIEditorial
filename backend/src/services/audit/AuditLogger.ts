import { LogService } from '../LogService.js';

/**
 * 审计日志条目。
 *
 * 设计目标：吸收上一版 P5「高危操作审计日志」要求 —— 每次 Tool 调用产出一行结构化日志，
 * 用于事后回放、安全审查、CCR 回滚。本期不引入新存储，先复用 LogService（A 阶段
 * 后续会换成 pino）。
 */
export interface AuditEntry {
  /** ToolRegistry / WorkflowEngine 调用链 id。缺省由 callTool 自动填入。 */
  runId?: string;
  toolId: string;
  actor?: string;
  /** 入参（脱敏后的摘要 / 简化值）。 */
  args?: unknown;
  /** 结果摘要；调用失败时 `error` 字段记原始错误。 */
  result?: unknown;
  error?: unknown;
  /** 调用耗时（ms）。 */
  durationMs?: number;
}

export interface AuditLogger {
  log(entry: AuditEntry): void;
}

/** 默认实现：单行 JSON 写到 LogService.info。便于 grep / 后续接入聚合系统。 */
export class LogServiceAuditLogger implements AuditLogger {
  log(entry: AuditEntry): void {
    try {
      const compact = compactEntry(entry);
      LogService.info(`audit ${JSON.stringify(compact)}`);
    } catch (err) {
      LogService.warn(`AuditLogger failed to serialize entry: ${(err as Error)?.message ?? err}`);
    }
  }
}

const ARG_SUMMARY_LIMIT = 600;
const RESULT_SUMMARY_LIMIT = 400;

function compactEntry(entry: AuditEntry): Record<string, unknown> {
  return {
    toolId: entry.toolId,
    runId: entry.runId,
    actor: entry.actor,
    args: summarize(entry.args, ARG_SUMMARY_LIMIT),
    result: entry.error !== undefined ? undefined : summarize(entry.result, RESULT_SUMMARY_LIMIT),
    error: summarizeError(entry.error),
    durationMs: entry.durationMs
  };
}

function summarize(value: unknown, limit: number): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > limit ? `${value.slice(0, limit)}…` : value;
  try {
    const json = JSON.stringify(value);
    if (!json) return undefined;
    return json.length > limit ? `${json.slice(0, limit)}…` : JSON.parse(json);
  } catch {
    return String(value).slice(0, limit);
  }
}

function summarizeError(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  return summarize(value, RESULT_SUMMARY_LIMIT);
}
