import { BaseRepository } from './BaseRepository.js';
import { ScheduleMapper, TaskLogMapper } from './mappers/ScheduleMapper.js';

export class ScheduleRepository extends BaseRepository {
  async saveSchedule(schedule: any): Promise<void> {
    const now = Date.now();
    schedule.updatedAt = now;
    await this.db.run(
      `INSERT INTO schedules (id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      schedule.id,
      ScheduleMapper.toRow(schedule),
      now
    );
  }

  async getSchedule(id: string): Promise<any> {
    const row = await this.db.get('SELECT data FROM schedules WHERE id = ?', id);
    return ScheduleMapper.toEntity(row);
  }

  async listSchedules(): Promise<any[]> {
    const rows = await this.db.all('SELECT data FROM schedules ORDER BY updated_at DESC');
    return ScheduleMapper.toEntityList(rows);
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.db.run('DELETE FROM schedules WHERE id = ?', id);
  }

  async saveTaskLog(log: any): Promise<number> {
    const result = await this.db.run(
      `INSERT INTO task_logs (task_id, task_name, start_time, end_time, duration, status, progress, message, result_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      log.taskId,
      log.taskName,
      log.startTime,
      log.endTime,
      log.duration,
      log.status,
      log.progress || 0,
      log.message,
      log.resultCount
    );
    return result.lastID || 0;
  }

  async updateTaskLog(log: {
    id: number;
    endTime?: string;
    duration?: number;
    status?: string;
    progress?: number;
    message?: string;
    resultCount?: number;
  }): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (log.endTime !== undefined) {
      sets.push(`end_time = $${idx++}`);
      params.push(log.endTime);
    }
    if (log.duration !== undefined) {
      sets.push(`duration = $${idx++}`);
      params.push(log.duration);
    }
    if (log.status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(log.status);
    }
    if (log.progress !== undefined) {
      sets.push(`progress = $${idx++}`);
      params.push(log.progress);
    }
    if (log.message !== undefined) {
      sets.push(`message = $${idx++}`);
      params.push(log.message);
    }
    if (log.resultCount !== undefined) {
      sets.push(`result_count = $${idx++}`);
      params.push(log.resultCount);
    }
    if (sets.length === 0) return;
    params.push(log.id);

    const isRunningPatch = log.status === 'running';
    const where = isRunningPatch
      ? ` WHERE id = $${idx} AND status = 'running' AND end_time IS NULL`
      : ` WHERE id = $${idx}`;
    await this.db.run(`UPDATE task_logs SET ${sets.join(', ')}${where}`, ...params);
  }

  async reconcileStuckRunningTaskLogs(): Promise<number> {
    const nowIso = new Date().toISOString();
    const result = await this.db.run(
      `UPDATE task_logs
       SET status = 'success',
           end_time = COALESCE(end_time, $1),
           duration = COALESCE(
             duration,
             EXTRACT(EPOCH FROM ($2::timestamptz - start_time::timestamptz))::bigint * 1000
           ),
           message = CASE
             WHEN message IS NULL OR TRIM(message) = '' THEN '执行成功'
             ELSE message
           END
       WHERE status = 'running' AND (end_time IS NOT NULL OR progress >= 100)`,
      nowIso,
      nowIso
    );
    return result.changes;
  }

  async finalizeRunningTaskLogs(params: {
    status: 'interrupted' | 'error';
    message: string;
    olderThanIso?: string;
  }): Promise<number> {
    const nowIso = new Date().toISOString();
    const args: any[] = [params.status, params.message, nowIso, nowIso];

    let sql =
      'UPDATE task_logs SET status = $1, message = $2, end_time = $3, ' +
      '    duration = EXTRACT(EPOCH FROM ($4::timestamptz - start_time::timestamptz))::bigint * 1000 ' +
      "WHERE status = 'running'";

    if (params.olderThanIso) {
      sql += ' AND start_time < $5';
      args.push(params.olderThanIso);
    }

    const result = await this.db.run(sql, ...args);
    return result.changes;
  }

  async listTaskLogs(options?: {
    limit?: number;
    offset?: number;
    taskId?: string;
  }): Promise<any[]> {
    let query = 'SELECT * FROM task_logs';
    const params: any[] = [];
    if (options?.taskId) {
      query += ' WHERE task_id = ?';
      params.push(options.taskId);
    }
    query += ' ORDER BY start_time DESC';
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = await this.db.all(query, ...params);
    return TaskLogMapper.toEntityList(rows);
  }
}
