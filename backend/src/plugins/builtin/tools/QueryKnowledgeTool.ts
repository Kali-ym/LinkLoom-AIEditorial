import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../services/ToolExecutionContext.js';
import {
  explicitKnowledgeFilter,
  knowledgeScopeToRagSourceFilter,
  mergeRagSourceFilters
} from '../../../services/rag/RagScope.js';
import { BaseTool } from '../../base/BaseTool.js';

type QueryKnowledgeArgs = {
  query?: unknown;
  q?: unknown;
  keyword?: unknown;
  keywords?: unknown;
  text?: unknown;
  question?: unknown;
  content?: unknown;
  search?: unknown;
  term?: unknown;
  categoryIds?: string[];
  limit?: number;
};

const QUERY_ALIASES: Array<keyof QueryKnowledgeArgs> = [
  'query',
  'q',
  'keyword',
  'keywords',
  'text',
  'question',
  'content',
  'search',
  'term'
];

function normalizeQueryInput(args: QueryKnowledgeArgs | string | null | undefined): string {
  if (typeof args === 'string') return args.trim();
  if (!args || typeof args !== 'object') return '';

  for (const key of QUERY_ALIASES) {
    const value = args[key];
    if (Array.isArray(value)) {
      const joined = value
        .filter((item) => item !== undefined && item !== null)
        .join(' ')
        .trim();
      if (joined) return joined;
      continue;
    }
    if (value !== undefined && value !== null) {
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
  }

  return '';
}

export class QueryKnowledgeTool extends BaseTool {
  readonly id = 'query_knowledge';
  readonly name = 'query_knowledge';
  readonly displayName = '检索知识库';
  readonly scope = 'both' as const;
  readonly description =
    '从专业知识库（PDF/Word/Markdown 文档）检索与问题相关的片段与事实。需要查阅上传文档、制度或规范时调用，个人长期记忆请用 query_memory。' +
    '必填：query（或 q/keyword/keywords/text/question/content/search/term 别名）；可选 categoryIds、limit。';
  readonly uiHints = {
    argumentAliases: {
      query: ['q', 'keyword', 'keywords', 'text', 'question', 'content', 'search', 'term']
    }
  };
  readonly parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '必填：具体的查询词或问题（例如：“公司关于加班的补贴政策是什么？”）'
      },
      q: {
        type: 'string',
        description: 'query 的兼容别名'
      },
      keyword: {
        type: 'string',
        description: 'query 的兼容别名'
      },
      keywords: {
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: 'query 的兼容别名'
      },
      text: {
        type: 'string',
        description: 'query 的兼容别名'
      },
      question: {
        type: 'string',
        description: 'query 的兼容别名'
      },
      content: {
        type: 'string',
        description: 'query 的兼容别名'
      },
      categoryIds: {
        type: 'array',
        items: { type: 'string' },
        description: '可选：限定检索的分类 ID 列表'
      },
      limit: {
        type: 'number',
        description: '返回相关结果的数量限制',
        default: 3
      }
    },
    required: ['query']
  };

  async handler(args: QueryKnowledgeArgs | string, _toolCtx?: ToolExecutionContext) {
    const query = normalizeQueryInput(args);
    if (!query) {
      throw new Error(
        'query_knowledge 缺少 query 参数，请使用 { "query": "要检索的问题或关键词" } 重新调用。'
      );
    }

    const toolContext = requireToolContext(_toolCtx, this.id);
    const argsObject = typeof args === 'object' && args ? args : undefined;
    const explicitFilter = explicitKnowledgeFilter({
      categoryIds: argsObject?.categoryIds
    });
    const sourceFilter = mergeRagSourceFilters(
      knowledgeScopeToRagSourceFilter(toolContext.knowledgeScope),
      explicitFilter
    );
    const result = await toolContext.services.knowledgeBaseService.queryKnowledgeDetailed(query, {
      categoryIds: argsObject?.categoryIds,
      sourceFilter,
      limit: argsObject?.limit,
      fallbackFormat: 'context'
    });

    return result;
  }
}
