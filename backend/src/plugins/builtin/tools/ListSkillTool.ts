import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../services/ToolExecutionContext.js';
import type { SkillMetadata } from '../../../types/skill.js';
import { BaseTool } from '../../base/BaseTool.js';

type ListSkillArgs = {
  query?: unknown;
  q?: unknown;
  search?: unknown;
  limit?: number;
};

function normalizeQuery(args: ListSkillArgs | string | null | undefined): string {
  if (typeof args === 'string') return args.trim();
  if (!args || typeof args !== 'object') return '';
  for (const key of ['query', 'q', 'search'] as const) {
    const value = args[key];
    if (value !== undefined && value !== null) {
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
  }
  return '';
}

function matchesQuery(skill: SkillMetadata, query: string): boolean {
  if (!query) return true;
  const haystack = `${skill.id} ${skill.name} ${skill.description}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function toSearchResult(skill: SkillMetadata) {
  return {
    id: skill.id,
    name: skill.name,
    title: skill.name,
    description: skill.description,
  };
}

export class ListSkillTool extends BaseTool {
  readonly id = 'list_skill';
  readonly name = 'list_skill';
  readonly displayName = '列出技能';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出本地技能目录中可用的 Agent Skills，可按关键词过滤。在 read_skill 之前探索有哪些技能时调用。' +
    '可选 query/q/search 过滤；可选 limit（默认 20，最大 100）。';
  readonly parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Optional search text to filter skills by id, name, or description',
      },
      q: {
        type: 'string',
        description: 'Alias of query',
      },
      search: {
        type: 'string',
        description: 'Alias of query',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of skills to return (default 20)',
        default: 20,
      },
    },
  };

  async handler(args: ListSkillArgs | string, toolCtx?: ToolExecutionContext) {
    const context = requireToolContext(toolCtx, this.id);
    const query = normalizeQuery(args);
    const argsObject = typeof args === 'object' && args ? args : undefined;
    const limit =
      typeof argsObject?.limit === 'number' && Number.isFinite(argsObject.limit) && argsObject.limit > 0
        ? Math.min(Math.floor(argsObject.limit), 100)
        : 20;

    const skills = this.filterExposedSkills(context, query, limit);

    return {
      query: query || undefined,
      results: skills,
      count: skills.length,
    };
  }

  private filterExposedSkills(
    context: ToolExecutionContext,
    query: string,
    limit: number,
  ) {
    const allowed = context.exposedSkillIds;
    return context.services.skillService
      .listSkillMetadata()
      .filter((skill) => {
        if (allowed && !allowed.includes(skill.id)) return false;
        return matchesQuery(skill, query);
      })
      .slice(0, limit)
      .map(toSearchResult);
  }
}
