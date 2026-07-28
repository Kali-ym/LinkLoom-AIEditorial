import { ConfigService } from '../../../services/ConfigService.js';
import { DailyCoverageOrchestrator } from '../../../services/editorial/DailyCoverageOrchestrator.js';
import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';

export class QueryPublicationHistoryTool extends BaseTool {
  readonly id = 'query_publication_history';
  readonly name = 'query_publication_history';
  readonly displayName = '查询发布历史';
  readonly scope = 'agent' as const;
  readonly description =
    '查询历史存档中的发布覆盖明细，判断候选标题或 URL 是否在近期已发布。Agent 侧去重决策时调用，工作流批量检查请用 query_coverage_index。' +
    '必填：items（候选素材列表）；可选 asOfDate（YYYY-MM-DD）、lookbackDays。';
  readonly parameters = {
    type: 'object',
    properties: {
      asOfDate: {
        type: 'string',
        description: '当前判断日期，格式 YYYY-MM-DD'
      },
      lookbackDays: {
        type: 'number',
        description: '回看天数，默认使用系统跨日配置'
      },
      items: {
        type: 'array',
        description: '候选素材列表',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number', description: '候选素材序号' },
            title: { type: 'string', description: '候选标题' },
            url: { type: 'string', description: '候选 URL' }
          },
          required: ['index']
        }
      },
      titleThreshold: {
        type: 'number',
        description: '标题相似度阈值，默认使用系统跨日配置'
      }
    },
    required: ['asOfDate', 'items']
  };

  async handler(
    args: {
      asOfDate: string;
      lookbackDays?: number;
      items: Array<{ index: number; title?: string; url?: string }>;
      titleThreshold?: number;
    },
    _toolCtx?: ToolExecutionContext
  ) {
    const context = requireToolContext(_toolCtx, this.id).services;
    const configService = await ConfigService.getInstance(context.localStore);
    const orchestrator = new DailyCoverageOrchestrator(
      context.localStore,
      configService.getSettings()
    );
    return await orchestrator.queryPublicationHistory({
      asOfDate: args.asOfDate,
      lookbackDays: args.lookbackDays,
      items: Array.isArray(args.items) ? args.items : [],
      titleThreshold: args.titleThreshold
    });
  }
}
