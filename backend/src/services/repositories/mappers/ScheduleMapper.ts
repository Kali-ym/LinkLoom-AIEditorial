/**
 * ScheduleRepository 的 row ↔ entity 转换。
 * 适配 PostgreSQL JSONB 列：`row.data` 可能是对象或字符串。
 */

interface JsonRow {
  data: string | any;
}

interface TaskLogRow {
  id: number;
  task_id: string;
  task_name: string | null;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  status: string;
  progress: number | null;
  message: string | null;
  result_count: number | null;
}

export interface TaskLogEntity {
  id: number;
  taskId: string;
  taskName: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  status: string;
  progress: number | null;
  message: string | null;
  resultCount: number | null;
}

function safeParse(raw: string | any): any {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Failed to parse schedule row: ${err?.message || err}`);
  }
}

export const ScheduleMapper = {
  toEntity(row: JsonRow | undefined): any | null {
    if (!row) return null;
    return safeParse(row.data);
  },
  toEntityList(rows: JsonRow[]): any[] {
    return rows.map((row) => safeParse(row.data));
  },
  toRow(entity: any): string {
    return JSON.stringify(entity);
  }
};

export const TaskLogMapper = {
  toEntity(row: TaskLogRow): TaskLogEntity {
    return {
      id: row.id,
      taskId: row.task_id,
      taskName: row.task_name,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      status: row.status,
      progress: row.progress,
      message: row.message,
      resultCount: row.result_count
    };
  },
  toEntityList(rows: TaskLogRow[]): TaskLogEntity[] {
    return rows.map((row) => TaskLogMapper.toEntity(row));
  }
};
