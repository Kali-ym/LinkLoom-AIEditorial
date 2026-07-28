import { LogService } from '../LogService.js';
import type { PgConnection } from './DatabaseConnection.js';

export class SchemaMigrator {
  constructor(private readonly conn: PgConnection) {}

  async migrate() {
    try {
      await this.conn.exec('CREATE EXTENSION IF NOT EXISTS vector;');
    } catch (err) {
      LogService.warn(`pgvector extension is not available: ${err}`);
    }

    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT,
        expires_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS commit_history (
        id BIGSERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        platform TEXT NOT NULL,
        file_path TEXT NOT NULL,
        commit_message TEXT,
        commit_time BIGINT NOT NULL,
        full_content TEXT
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mcp_configs (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS task_logs (
        id BIGSERIAL PRIMARY KEY,
        task_id TEXT NOT NULL,
        task_name TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration BIGINT,
        status TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        message TEXT,
        result_count INTEGER
      );

      CREATE TABLE IF NOT EXISTS memory_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        entry_count INTEGER DEFAULT 0,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_memories (
        id TEXT PRIMARY KEY,
        agent_id TEXT,
        category_id TEXT,
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 1,
        tags JSONB,
        metadata JSONB,
        created_at BIGINT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES memory_categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS kb_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        document_count INTEGER DEFAULT 0,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS kb_documents (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT,
        chunk_count INTEGER DEFAULT 0,
        metadata JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS kb_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        metadata JSONB,
        FOREIGN KEY (document_id) REFERENCES kb_documents(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS source_data (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT,
        url_norm TEXT,
        description TEXT,
        published_date TEXT,
        source TEXT NOT NULL,
        category TEXT,
        author TEXT,
        metadata JSONB,
        fetched_at BIGINT NOT NULL,
        ingestion_date TEXT,
        adapter_name TEXT,
        status TEXT DEFAULT 'unread'
      );

      CREATE TABLE IF NOT EXISTS source_data_archive (
        id TEXT PRIMARY KEY,
        archived_at BIGINT NOT NULL,
        archive_reason TEXT,
        data JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        prefix TEXT NOT NULL,
        source_fingerprint TEXT,
        verification_token TEXT,
        status TEXT DEFAULT 'pending',
        created_at BIGINT NOT NULL,
        last_used_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS daily_coverage_index (
        id BIGSERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        url_norm TEXT NOT NULL,
        headline TEXT,
        section TEXT,
        importance_rank INTEGER,
        ingested_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hot_event_snapshot (
        id BIGSERIAL PRIMARY KEY,
        generated_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        meta JSONB
      );

      CREATE TABLE IF NOT EXISTS hot_embed_cache (
        content_hash TEXT NOT NULL,
        model_key TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        embedding JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (content_hash, model_key)
      );

      CREATE TABLE IF NOT EXISTS publication_items (
        id BIGSERIAL PRIMARY KEY,
        history_id BIGINT NOT NULL,
        date TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        title TEXT,
        url_norm TEXT NOT NULL,
        section TEXT,
        importance_rank INTEGER,
        metadata JSONB,
        created_at BIGINT NOT NULL,
        FOREIGN KEY (history_id) REFERENCES commit_history(id) ON DELETE CASCADE
      );
    `);

    // --- Indexes ---
    await this.conn.exec(`
      CREATE INDEX IF NOT EXISTS idx_source_data_source ON source_data(source);
      CREATE INDEX IF NOT EXISTS idx_source_data_fetched_at ON source_data(fetched_at);
      CREATE INDEX IF NOT EXISTS idx_source_data_status ON source_data(status);
      CREATE INDEX IF NOT EXISTS idx_source_data_ingestion_date ON source_data(ingestion_date);
      CREATE INDEX IF NOT EXISTS idx_source_data_published_date ON source_data(published_date);
      CREATE INDEX IF NOT EXISTS idx_source_data_url_norm ON source_data(url_norm);
      CREATE INDEX IF NOT EXISTS idx_source_data_ingestion_status ON source_data(ingestion_date, status);
      CREATE INDEX IF NOT EXISTS idx_source_data_adapter_fetched ON source_data(adapter_name, fetched_at);
      CREATE INDEX IF NOT EXISTS idx_source_data_published_source ON source_data(published_date, source);
      CREATE INDEX IF NOT EXISTS idx_daily_coverage_date ON daily_coverage_index(date);
      CREATE INDEX IF NOT EXISTS idx_daily_coverage_url ON daily_coverage_index(url_norm);
      CREATE INDEX IF NOT EXISTS idx_hot_event_snapshot_generated_at
        ON hot_event_snapshot (generated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_hot_embed_cache_model_key
        ON hot_embed_cache (model_key);
      CREATE INDEX IF NOT EXISTS idx_publication_items_history ON publication_items(history_id);
      CREATE INDEX IF NOT EXISTS idx_publication_items_date ON publication_items(date);
      CREATE INDEX IF NOT EXISTS idx_publication_items_url ON publication_items(url_norm);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_publication_items_unique ON publication_items(history_id, topic_id, url_norm);

      CREATE INDEX IF NOT EXISTS idx_source_data_ai_picked ON source_data((metadata->>'ai_picked'));
      CREATE INDEX IF NOT EXISTS idx_source_data_ai_topic ON source_data((metadata->>'ai_topic'));
      CREATE INDEX IF NOT EXISTS idx_source_data_ai_score ON source_data(((metadata->>'ai_score')::numeric));
      CREATE INDEX IF NOT EXISTS idx_source_data_ai_scored_at ON source_data((metadata->>'ai_scored_at'));

      CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON kb_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_agent_memories_category ON agent_memories(category_id);
      CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent_id);
    `);

    // Full-text search indexes
    await this.conn.exec(`
      ALTER TABLE source_data ADD COLUMN IF NOT EXISTS search_vector tsvector;
      ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS search_vector tsvector;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector;
    `);

    await this.conn.exec(`
      CREATE INDEX IF NOT EXISTS idx_source_data_fts ON source_data USING GIN(search_vector);
      CREATE INDEX IF NOT EXISTS idx_agent_memories_fts ON agent_memories USING GIN(search_vector);
      CREATE INDEX IF NOT EXISTS idx_kb_chunks_fts ON kb_chunks USING GIN(search_vector);
    `);

    // --- FTS triggers: keep search_vector in sync on every write ---
    await this.conn.exec(`
      CREATE OR REPLACE FUNCTION source_data_search_vector_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('simple',
          coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,'') || ' ' ||
          coalesce(NEW.metadata->>'ai_summary',''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_source_data_search_vector ON source_data;
      CREATE TRIGGER trg_source_data_search_vector
        BEFORE INSERT OR UPDATE ON source_data
        FOR EACH ROW EXECUTE FUNCTION source_data_search_vector_trigger();

      CREATE OR REPLACE FUNCTION agent_memories_search_vector_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('simple',
          coalesce(NEW.content,'') || ' ' || coalesce(NEW.metadata->>'summary','') || ' ' || coalesce(
            CASE WHEN jsonb_typeof(NEW.tags) = 'array'
              THEN (SELECT string_agg(value::text, ' ') FROM jsonb_array_elements_text(NEW.tags))
              ELSE ''
            END, ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_agent_memories_search_vector ON agent_memories;
      CREATE TRIGGER trg_agent_memories_search_vector
        BEFORE INSERT OR UPDATE ON agent_memories
        FOR EACH ROW EXECUTE FUNCTION agent_memories_search_vector_trigger();

      CREATE OR REPLACE FUNCTION kb_chunks_search_vector_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('simple', coalesce(NEW.content,''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_kb_chunks_search_vector ON kb_chunks;
      CREATE TRIGGER trg_kb_chunks_search_vector
        BEFORE INSERT OR UPDATE ON kb_chunks
        FOR EACH ROW EXECUTE FUNCTION kb_chunks_search_vector_trigger();
    `);

    // Backfill / reconcile all rows (idempotent)
    await this.conn.exec(`
      UPDATE source_data SET search_vector =
        to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(metadata->>'ai_summary',''));
      UPDATE agent_memories SET search_vector =
        to_tsvector('simple', coalesce(content,'') || ' ' || coalesce(metadata->>'summary','') || ' ' || coalesce(
          CASE WHEN jsonb_typeof(tags) = 'array'
            THEN (SELECT string_agg(value::text, ' ') FROM jsonb_array_elements_text(tags))
            ELSE ''
          END, ''));
      UPDATE kb_chunks SET search_vector =
        to_tsvector('simple', coalesce(content,''));
    `);

    await this.conn.exec(`
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_json JSONB;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_model TEXT;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_updated_at BIGINT;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_error TEXT;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS content_hash TEXT;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS index_version TEXT;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_config_hash TEXT;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS chunker_version TEXT;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_provider_id TEXT;
      ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS indexed_at BIGINT;
      CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON kb_chunks ((embedding_json IS NOT NULL));
      CREATE INDEX IF NOT EXISTS idx_kb_chunks_content_hash ON kb_chunks(content_hash);
      CREATE INDEX IF NOT EXISTS idx_kb_chunks_index_version ON kb_chunks(index_version);
    `);

    try {
      await this.conn.exec(`
        ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_vector vector(1024);
        CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding_vector_hnsw
          ON kb_chunks USING hnsw (embedding_vector vector_cosine_ops)
          WHERE embedding_vector IS NOT NULL;
      `);
    } catch (err) {
      LogService.warn(`pgvector schema migration skipped: ${err}`);
    }

    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS rag_embedding_jobs (
        id TEXT PRIMARY KEY,
        chunk_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'knowledge',
        source_id TEXT NOT NULL DEFAULT 'knowledge',
        unit_id TEXT NOT NULL,
        parent_id TEXT,
        index_version TEXT,
        content_hash TEXT NOT NULL,
        target_storage TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        locked_at BIGINT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        FOREIGN KEY (chunk_id) REFERENCES kb_chunks(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES kb_documents(id) ON DELETE CASCADE
      );

      ALTER TABLE rag_embedding_jobs ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'knowledge';
      ALTER TABLE rag_embedding_jobs ADD COLUMN IF NOT EXISTS source_id TEXT DEFAULT 'knowledge';
      ALTER TABLE rag_embedding_jobs ADD COLUMN IF NOT EXISTS unit_id TEXT;
      ALTER TABLE rag_embedding_jobs ADD COLUMN IF NOT EXISTS parent_id TEXT;
      ALTER TABLE rag_embedding_jobs ADD COLUMN IF NOT EXISTS index_version TEXT;
      UPDATE rag_embedding_jobs
      SET source_type = COALESCE(source_type, 'knowledge'),
          source_id = COALESCE(source_id, 'knowledge'),
          unit_id = COALESCE(unit_id, chunk_id),
          parent_id = COALESCE(parent_id, document_id)
      WHERE unit_id IS NULL OR parent_id IS NULL OR source_type IS NULL OR source_id IS NULL;
      ALTER TABLE rag_embedding_jobs ALTER COLUMN source_type SET NOT NULL;
      ALTER TABLE rag_embedding_jobs ALTER COLUMN source_id SET NOT NULL;
      ALTER TABLE rag_embedding_jobs ALTER COLUMN unit_id SET NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_embedding_jobs_source_unique
        ON rag_embedding_jobs(source_type, unit_id, content_hash, target_storage);
      CREATE INDEX IF NOT EXISTS idx_rag_embedding_jobs_legacy_unique
        ON rag_embedding_jobs(chunk_id, content_hash, target_storage);
      CREATE INDEX IF NOT EXISTS idx_rag_embedding_jobs_status_updated
        ON rag_embedding_jobs(status, updated_at);
      CREATE INDEX IF NOT EXISTS idx_rag_embedding_jobs_document
        ON rag_embedding_jobs(document_id);
      CREATE INDEX IF NOT EXISTS idx_rag_embedding_jobs_source
        ON rag_embedding_jobs(source_type, source_id, parent_id, unit_id);

      CREATE TABLE IF NOT EXISTS rag_index_versions (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        chunker_version TEXT,
        embedding_provider_id TEXT,
        embedding_config_hash TEXT,
        eval_result JSONB,
        metadata JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        activated_at BIGINT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_index_versions_source_version
        ON rag_index_versions(source_type, source_id, version);
      CREATE INDEX IF NOT EXISTS idx_rag_index_versions_status
        ON rag_index_versions(status, updated_at);

      CREATE TABLE IF NOT EXISTS rag_query_traces (
        trace_id TEXT PRIMARY KEY,
        request_id TEXT,
        source_type_breakdown JSONB,
        original_query TEXT NOT NULL,
        rewritten_queries JSONB,
        filters JSONB,
        retrieved_unit_ids JSONB,
        reranked_unit_ids JSONB,
        selected_evidence_ids JSONB,
        final_context TEXT,
        answer TEXT,
        citation_ids JSONB,
        latency_ms INTEGER,
        token_usage JSONB,
        metadata JSONB,
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rag_query_traces_created
        ON rag_query_traces(created_at DESC);

      CREATE TABLE IF NOT EXISTS rag_eval_datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        cases JSONB NOT NULL,
        metadata JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rag_eval_runs (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        index_version TEXT,
        scores JSONB NOT NULL,
        summary JSONB NOT NULL,
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rag_eval_runs_dataset
        ON rag_eval_runs(dataset_id, created_at DESC);
    `);

    // --- Agent runtime persistence (events / runs / sessions / checkpoints / artifacts) ---
    // Append-only event log; one row per AgentEvent. Replaces the O(N^2) "rewrite whole
    // session blob on every append" path in LocalStoreAgentSessionStore.
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS agent_events (
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        event_id TEXT NOT NULL,
        session_id TEXT,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        timestamp TEXT,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (run_id, seq)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_events_run_seq ON agent_events(run_id, seq);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_events_run_event ON agent_events(run_id, event_id);

      CREATE TABLE IF NOT EXISTS agent_sessions (
        run_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        thread_id TEXT,
        source TEXT,
        status TEXT NOT NULL,
        head JSONB NOT NULL,
        last_seq INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_session ON agent_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_thread ON agent_sessions(thread_id);

      CREATE TABLE IF NOT EXISTS agent_runs (
        run_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        thread_id TEXT,
        agent_id TEXT,
        workflow_id TEXT,
        source TEXT,
        status TEXT NOT NULL,
        data JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        lease_owner TEXT,
        leased_at BIGINT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status, updated_at);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at DESC);

      CREATE TABLE IF NOT EXISTS agent_checkpoints (
        run_id TEXT NOT NULL,
        checkpoint_id TEXT NOT NULL,
        session_id TEXT,
        status TEXT,
        data JSONB NOT NULL,
        created_at TEXT,
        PRIMARY KEY (run_id, checkpoint_id)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_run ON agent_checkpoints(run_id);

      CREATE TABLE IF NOT EXISTS agent_artifacts (
        run_id TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        session_id TEXT,
        kind TEXT,
        data JSONB NOT NULL,
        created_at TEXT,
        PRIMARY KEY (run_id, artifact_id)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_artifacts_run ON agent_artifacts(run_id);

      -- Durable run queue: SKIP LOCKED claim + stale lease reset + attempts/backoff,
      -- mirroring rag_embedding_jobs. Survives restarts so queued/running work resumes.
      CREATE TABLE IF NOT EXISTS agent_run_queue (
        run_id TEXT PRIMARY KEY,
        session_id TEXT,
        kind TEXT NOT NULL DEFAULT 'run',
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 1,
        available_at BIGINT NOT NULL DEFAULT 0,
        lease_owner TEXT,
        locked_at BIGINT,
        last_error TEXT,
        payload JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent_run_queue_claim
        ON agent_run_queue(status, available_at, priority DESC, updated_at);
      CREATE INDEX IF NOT EXISTS idx_agent_run_queue_lease
        ON agent_run_queue(status, locked_at);
    `);

    // --- Gateway: channel → agent routing (PR2) ---
    // Four-level matching: (channel, account, peer) > (channel, account, *) >
    // (channel, *, peer) > (channel, *, *). NULL means wildcard; '*' is an
    // explicit alias. Highest priority wins; updated_at tiebreak.
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS channel_bindings (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        account_id TEXT,
        peer_id TEXT,
        agent_id TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        description TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        metadata JSONB
      );
      -- Active unique index: only one active rule per (channel, account, peer)
      CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_bindings_unique
        ON channel_bindings(channel, COALESCE(account_id, '*'), COALESCE(peer_id, '*'))
        WHERE is_enabled = TRUE;
      -- Lookup index: channel first, then by priority/recency
      CREATE INDEX IF NOT EXISTS idx_channel_bindings_lookup
        ON channel_bindings(channel, is_enabled, priority DESC, updated_at DESC)
        WHERE is_enabled = TRUE;
      -- Reverse lookup: list all bindings for an agent
      CREATE INDEX IF NOT EXISTS idx_channel_bindings_agent
        ON channel_bindings(agent_id);
    `);

    // --- Gateway: PR3 incremental ---
    // - Make agent_id nullable (binding survives agent deletion)
    // - Add FK to agents(id) with ON DELETE SET NULL
    // - Add agents.is_routable flag (default TRUE; new column for opt-out)
    // - Add gateway_messages table for inbound message audit + run tracking
    await this.conn.exec(`
      ALTER TABLE channel_bindings ALTER COLUMN agent_id DROP NOT NULL;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_channel_bindings_agent'
            AND table_name = 'channel_bindings'
        ) THEN
          ALTER TABLE channel_bindings
            ADD CONSTRAINT fk_channel_bindings_agent
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;
        END IF;
      END$$;

      ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_routable BOOLEAN NOT NULL DEFAULT TRUE;
      CREATE INDEX IF NOT EXISTS idx_agents_routable ON agents(is_routable) WHERE is_routable = TRUE;

      CREATE TABLE IF NOT EXISTS gateway_messages (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        account_id TEXT,
        peer_id TEXT,
        agent_id TEXT,
        binding_id TEXT,
        match_level INTEGER,
        strategy TEXT,
        status TEXT NOT NULL,
        text_length INTEGER,
        error TEXT,
        created_at BIGINT NOT NULL,
        completed_at BIGINT,
        metadata JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_gateway_messages_channel
        ON gateway_messages(channel, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_gateway_messages_agent
        ON gateway_messages(agent_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_gateway_messages_status
        ON gateway_messages(status, created_at DESC);
    `);

    // --- Agent Console: agent ↔ KB/file bindings (M11) ---
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS agent_resource_bindings (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        resource_type TEXT NOT NULL CHECK (resource_type IN ('kb_category','kb_document','file')),
        resource_id TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        metadata JSONB,
        UNIQUE(agent_id, resource_type, resource_id)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_resource_bindings_agent
        ON agent_resource_bindings(agent_id);
    `);

    // --- Agent Console: chat attachment uploads (M12) ---
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS agent_uploads (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        size BIGINT NOT NULL,
        storage_path TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent_uploads_agent
        ON agent_uploads(agent_id, created_at DESC);
    `);

    // --- Agent Console: tool OAuth grants (M14) ---
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS agent_tool_auth_grants (
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        tool_key TEXT NOT NULL,
        granted_at BIGINT NOT NULL,
        metadata JSONB,
        PRIMARY KEY (agent_id, tool_key)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_tool_auth_grants_agent
        ON agent_tool_auth_grants(agent_id);
    `);

    // --- Agent warm sandbox (per-agent pool, P1) ---
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS agent_sandbox_instances (
        agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
        container_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        host_mount_path TEXT NOT NULL,
        status TEXT NOT NULL,
        image TEXT NOT NULL,
        last_used_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        metadata JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_agent_sandbox_instances_status
        ON agent_sandbox_instances(status, last_used_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_sandbox_instances_workspace
        ON agent_sandbox_instances(workspace_id);
    `);

    const nowForBindings = Date.now();
    await this.conn.run(
      `INSERT INTO schema_migrations(version, applied_at)
       VALUES ($1, $2)
       ON CONFLICT (version) DO NOTHING`,
      '2026-06-channel-bindings',
      nowForBindings
    );
    await this.conn.run(
      `INSERT INTO schema_migrations(version, applied_at)
       VALUES ($1, $2)
       ON CONFLICT (version) DO NOTHING`,
      '2026-06-gateway-fk-and-messages',
      Date.now()
    );
    await this.conn.run(
      `INSERT INTO schema_migrations(version, applied_at)
       VALUES ($1, $2)
       ON CONFLICT (version) DO NOTHING`,
      '2026-06-agent-warm-sandbox',
      Date.now()
    );

    // Maintenance: finalize any orphaned running task logs from a previous crash
    const nowIso = new Date().toISOString();
    await this.conn.run(
      `UPDATE task_logs
       SET status = 'interrupted',
           message = '上次进程退出时任务未完成（可能是崩溃或被强制结束）',
           end_time = COALESCE(end_time, $1),
           duration = COALESCE(duration, EXTRACT(EPOCH FROM ($2::timestamptz - start_time::timestamptz))::bigint * 1000)
       WHERE status = 'running'`,
      nowIso,
      nowIso
    );

    const now = Date.now();
    for (const version of ['2026-05-postgresql-migration', '2026-05-fts-triggers', '2026-06-agent-runtime-tables', '2026-06-channel-bindings', '2026-06-gateway-fk-and-messages', '2026-06-agent-warm-sandbox']) {
      await this.conn.run(
        `INSERT INTO schema_migrations(version, applied_at)
         VALUES ($1, $2)
         ON CONFLICT (version) DO NOTHING`,
        version,
        now
      );
    }

    LogService.info('PostgreSQL schema migration completed');
  }
}
