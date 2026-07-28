import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';

type QueryMemoryArgs = {
  query?: unknown;
  q?: unknown;
  keyword?: unknown;
  keywords?: unknown;
  text?: unknown;
  question?: unknown;
  content?: unknown;
  search?: unknown;
  term?: unknown;
  limit?: number;
  minImportance?: number;
  categoryIds?: string[];
  tags?: string[];
};

const QUERY_ALIASES: Array<keyof QueryMemoryArgs> = [
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

function normalizeQueryInput(args: QueryMemoryArgs | string | null | undefined): string {
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

export class QueryMemoryTool extends BaseTool {
  readonly id = 'query_memory';
  readonly name = 'query_memory';
  readonly displayName = '检索记忆';
  readonly scope = 'both' as const;
  readonly description =
    '从长期记忆库检索用户偏好、编辑规则、历史任务结论等持久化记忆。需要回忆用户设定或过往决策时调用，文档知识请用 query_knowledge。' +
    '必填：query（或 q/keyword/keywords/text/question/content/search/term 别名）；可选 limit、minImportance、tags、categoryIds。';
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
        description:
          '必填：关键词或自然语言描述（例如：“用户喜欢的编程语言是什么？”）。建议搜索完整的意图以获得更准确的深度匹配结果。'
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
      limit: {
        type: 'number',
        description: '检索记录的最大数量限制',
        default: 5
      },
      minImportance: {
        type: 'number',
        description: '最低重要度 (1-5)',
        default: 1
      },
      categoryIds: {
        type: 'array',
        items: { type: 'string' },
        description: '可选：限定记忆分类 ID'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '可选：按标签过滤'
      }
    },
    required: ['query']
  };

  async handler(args: QueryMemoryArgs | string, _toolCtx?: ToolExecutionContext) {
    const query = normalizeQueryInput(args);
    if (!query) {
      throw new Error(
        'query_memory 缺少 query 参数，请使用 { "query": "要检索的问题或关键词" } 重新调用。'
      );
    }

    const context = requireToolContext(_toolCtx, this.id).services;
    const result = await context.memoryService.queryMemory(query, {
      limit: typeof args === 'object' && args ? args.limit : undefined,
      minImportance: typeof args === 'object' && args ? args.minImportance : undefined,
      categoryIds: typeof args === 'object' && args ? args.categoryIds : undefined,
      tags: typeof args === 'object' && args ? args.tags : undefined
    });

    return {
      summary: result
    };
  }
}
