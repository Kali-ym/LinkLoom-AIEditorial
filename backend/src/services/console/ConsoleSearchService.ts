import { AppError } from '../../domain/errors.js';
import type { LocalStore } from '../LocalStore.js';
import type { PgConnection } from '../repositories/DatabaseConnection.js';
import {
  CONSOLE_SEARCH_ACTIONS,
  type ConsoleSearchActionDefinition,
} from './consoleSearchActions.js';

export interface ConsoleSearchHit {
  id: string;
  title: string;
  description?: string;
  agentId?: string;
  agentName?: string;
  agentAvatar?: string;
  agentBackgroundColor?: string;
  updatedAt?: string;
}

export interface ConsoleSearchActionHit extends ConsoleSearchHit {
  type: ConsoleSearchActionDefinition['type'];
}

export interface ConsoleSearchResponse {
  agents: ConsoleSearchHit[];
  topics: ConsoleSearchHit[];
  documents: ConsoleSearchHit[];
  skills: ConsoleSearchHit[];
  actions: ConsoleSearchActionHit[];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function readAgentGradient(agent: { metadata?: Record<string, unknown> }): string | undefined {
  const metadata = agent.metadata;
  const ui = metadata?.ui;
  if (ui && typeof ui === 'object') {
    const gradient = (ui as Record<string, unknown>).gradient;
    if (typeof gradient === 'string' && gradient.trim()) return gradient;
  }
  const legacy = metadata?.agentConsoleGradient;
  return typeof legacy === 'string' && legacy.trim() ? legacy : undefined;
}

function escapeIlikePattern(query: string): string {
  return `%${query.replace(/[%_\\]/g, '\\$&')}%`;
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export class ConsoleSearchService {
  constructor(private readonly store: LocalStore) {}

  async search(
    query: string,
    agentId?: string,
    limit = DEFAULT_LIMIT,
  ): Promise<ConsoleSearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { agents: [], topics: [], documents: [], skills: [], actions: [] };
    }

    const cappedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const conn = this.store.getConnection();
    if (!conn) {
      throw new AppError(501, 'Database connection unavailable for console search');
    }

    if (agentId) {
      const agent = await this.store.getAgent(agentId);
      if (!agent) {
        throw new AppError(404, `agent ${agentId} not found`);
      }
    }

    const pattern = escapeIlikePattern(trimmed);
    const agents = await this.store.listAgents();
    const agentById = new Map(
      agents
        .filter((agent) => !agent.isHidden)
        .map((agent) => [agent.id, agent] as const),
    );

    const [agentHits, topics, documents, skills] = await Promise.all([
      this.searchAgents(query, cappedLimit, agentById),
      this.searchTopics(conn, pattern, agentId, cappedLimit, agentById),
      this.searchDocuments(conn, pattern, cappedLimit),
      this.searchSkills(trimmed, cappedLimit),
    ]);

    const actions = this.searchActions(trimmed, cappedLimit);

    return { agents: agentHits, topics, documents, skills, actions };
  }

  private async searchAgents(
    query: string,
    limit: number,
    agentById: Map<string, { id: string; name: string; description?: string; metadata?: Record<string, unknown> }>,
  ): Promise<ConsoleSearchHit[]> {
    const agents = [...agentById.values()];
    return agents
      .filter((agent) => {
        const haystack = [agent.name, agent.description, agent.id].filter(Boolean).join(' ');
        return matchesQuery(haystack, query);
      })
      .slice(0, limit)
      .map((agent) => ({
        id: agent.id,
        title: agent.name || agent.id,
        description: agent.description || undefined,
        agentAvatar: (agent.name || agent.id).slice(0, 1),
        agentBackgroundColor: readAgentGradient(agent),
      }));
  }

  private async searchTopics(
    conn: PgConnection,
    pattern: string,
    agentId: string | undefined,
    limit: number,
    agentById: Map<string, { id: string; name: string; metadata?: Record<string, unknown> }>,
  ): Promise<ConsoleSearchHit[]> {
    const params: unknown[] = [pattern];
    let agentFilter = '';
    if (agentId) {
      agentFilter = 'AND agent_id = $2';
      params.push(agentId);
    }
    params.push(limit);

    const limitParam = agentId ? '$3' : '$2';
    const rows = await conn.all<{
      session_id: string;
      agent_id: string | null;
      topic_title: string | null;
      prompt: string | null;
      updated_at: string | null;
    }>(
      `SELECT DISTINCT ON (session_id)
         session_id,
         agent_id,
         data->'metadata'->>'topicTitle' AS topic_title,
         data->'input'->>'prompt' AS prompt,
         updated_at
       FROM agent_runs
       WHERE status != 'archived'
         ${agentFilter}
         AND (
           COALESCE(data->'metadata'->>'topicTitle', '') ILIKE $1
           OR COALESCE(data->'input'->>'prompt', '') ILIKE $1
         )
       ORDER BY session_id, updated_at DESC
       LIMIT ${limitParam}`,
      ...params,
    );

    return rows.map((row) => {
      const agent = row.agent_id ? agentById.get(row.agent_id) : undefined;
      const agentName = agent?.name;
      return {
        id: row.session_id,
        title: row.topic_title?.trim() || row.prompt?.slice(0, 80) || row.session_id,
        agentId: row.agent_id ?? undefined,
        agentName,
        agentAvatar: agentName?.slice(0, 1),
        agentBackgroundColor: agent ? readAgentGradient(agent) : undefined,
        updatedAt: row.updated_at ?? undefined,
      };
    });
  }

  private async searchDocuments(
    conn: PgConnection,
    pattern: string,
    limit: number,
  ): Promise<ConsoleSearchHit[]> {
    const rows = await conn.all<{
      id: string;
      name: string;
      file_name: string;
      category_id: string;
    }>(
      `SELECT id, name, file_name, category_id
       FROM kb_documents
       WHERE name ILIKE $1 OR file_name ILIKE $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      pattern,
      limit,
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.name || row.file_name,
      description: row.file_name,
    }));
  }

  private async searchSkills(query: string, limit: number): Promise<ConsoleSearchHit[]> {
    const skills = await this.store.listSkills();
    return skills
      .filter((skill) => {
        const haystack = [skill.name, skill.description, skill.id].filter(Boolean).join(' ');
        return matchesQuery(haystack, query);
      })
      .slice(0, limit)
      .map((skill) => ({
        id: skill.id,
        title: skill.name || skill.id,
        description: skill.description || undefined,
      }));
  }

  private searchActions(query: string, limit: number): ConsoleSearchActionHit[] {
    return CONSOLE_SEARCH_ACTIONS.filter((action) => {
      const haystack = [action.title, action.description, ...action.keywords].join(' ');
      return matchesQuery(haystack, query);
    })
      .slice(0, limit)
      .map((action) => ({
        id: action.id,
        title: action.title,
        description: action.description,
        type: action.type,
      }));
  }
}
