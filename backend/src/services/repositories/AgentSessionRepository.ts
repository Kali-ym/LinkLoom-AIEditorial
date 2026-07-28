import type { AgentCheckpoint, AgentArtifactRef, AgentSession } from '../agents/engine/AgentSession.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * Session-head + checkpoint + artifact persistence, split out of the monolithic
 * KV blob. The head row carries everything except the (separately stored) event log,
 * checkpoints and artifacts, so saving the head no longer scales with event count.
 */
export type AgentSessionHead = Omit<AgentSession, 'events' | 'checkpoints' | 'artifacts'>;

export class AgentSessionRepository extends BaseRepository {
  /** Upsert the session head (no events / checkpoints / artifacts). */
  async saveHead(head: AgentSessionHead, lastSeq: number): Promise<void> {
    await this.db.run(
      `INSERT INTO agent_sessions
        (run_id, session_id, thread_id, source, status, head, last_seq, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (run_id) DO UPDATE SET
         session_id = excluded.session_id,
         thread_id = excluded.thread_id,
         source = excluded.source,
         status = excluded.status,
         head = excluded.head,
         last_seq = GREATEST(agent_sessions.last_seq, excluded.last_seq),
         updated_at = excluded.updated_at`,
      head.runId,
      head.sessionId,
      head.threadId ?? null,
      head.source ?? null,
      head.status,
      JSON.stringify(head),
      lastSeq,
      head.createdAt ?? null,
      head.updatedAt ?? null
    );
  }

  async getHeadByRunId(runId: string): Promise<AgentSessionHead | null> {
    const row = await this.db.get<{ head: unknown }>(
      'SELECT head FROM agent_sessions WHERE run_id = ?',
      runId
    );
    if (!row) return null;
    return this.parseJson<AgentSessionHead>(row.head as any, null as any);
  }

  async getRunIdsBySessionId(sessionId: string): Promise<string[]> {
    const rows = await this.db.all<{ run_id: string }>(
      'SELECT run_id FROM agent_sessions WHERE session_id = ? ORDER BY created_at ASC, run_id ASC',
      sessionId
    );
    return rows.map((row) => row.run_id);
  }

  async getRunIdsByThreadId(threadId: string): Promise<string[]> {
    const rows = await this.db.all<{ run_id: string }>(
      'SELECT run_id FROM agent_sessions WHERE thread_id = ? ORDER BY created_at ASC, run_id ASC',
      threadId
    );
    return rows.map((row) => row.run_id);
  }

  async listRunIds(): Promise<string[]> {
    const rows = await this.db.all<{ run_id: string }>(
      'SELECT run_id FROM agent_sessions ORDER BY created_at ASC, run_id ASC'
    );
    return rows.map((row) => row.run_id);
  }

  async getLastSeq(runId: string): Promise<number> {
    const row = await this.db.get<{ last_seq: number | null }>(
      'SELECT last_seq FROM agent_sessions WHERE run_id = ?',
      runId
    );
    const value = row?.last_seq;
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  async bumpLastSeq(runId: string, seq: number): Promise<void> {
    await this.db.run(
      'UPDATE agent_sessions SET last_seq = GREATEST(last_seq, ?) WHERE run_id = ?',
      seq,
      runId
    );
  }

  // --- Checkpoints ---

  async saveCheckpoint(checkpoint: AgentCheckpoint): Promise<void> {
    await this.db.run(
      `INSERT INTO agent_checkpoints (run_id, checkpoint_id, session_id, status, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (run_id, checkpoint_id) DO UPDATE SET
         session_id = excluded.session_id,
         status = excluded.status,
         data = excluded.data,
         created_at = excluded.created_at`,
      checkpoint.runId,
      checkpoint.checkpointId,
      checkpoint.sessionId ?? null,
      checkpoint.status ?? null,
      JSON.stringify(checkpoint),
      checkpoint.createdAt ?? null
    );
  }

  async listCheckpoints(runId: string): Promise<AgentCheckpoint[]> {
    const rows = await this.db.all<{ data: unknown }>(
      'SELECT data FROM agent_checkpoints WHERE run_id = ? ORDER BY created_at ASC, checkpoint_id ASC',
      runId
    );
    return rows.map((row) => this.parseJson<AgentCheckpoint>(row.data as any, {} as AgentCheckpoint));
  }

  // --- Artifacts ---

  async saveArtifact(runId: string, artifact: AgentArtifactRef, sessionId?: string): Promise<void> {
    await this.db.run(
      `INSERT INTO agent_artifacts (run_id, artifact_id, session_id, kind, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (run_id, artifact_id) DO UPDATE SET
         session_id = excluded.session_id,
         kind = excluded.kind,
         data = excluded.data,
         created_at = excluded.created_at`,
      runId,
      artifact.artifactId,
      sessionId ?? null,
      artifact.kind ?? null,
      JSON.stringify(artifact),
      artifact.createdAt ?? null
    );
  }

  async listArtifacts(runId: string): Promise<AgentArtifactRef[]> {
    const rows = await this.db.all<{ data: unknown }>(
      'SELECT data FROM agent_artifacts WHERE run_id = ? ORDER BY created_at ASC, artifact_id ASC',
      runId
    );
    return rows.map((row) => this.parseJson<AgentArtifactRef>(row.data as any, {} as AgentArtifactRef));
  }
}
