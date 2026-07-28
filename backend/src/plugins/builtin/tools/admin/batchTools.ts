import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { FeedRouteService } from '../../../../services/api/FeedRouteService.js';
import { PublishingRouteService } from '../../../../services/api/PublishingRouteService.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };

class BatchResetScoringTool extends BaseTool {
  readonly id = 'batch_reset_scoring';
  readonly name = 'batch_reset_scoring';
  readonly displayName = '批量重置评分';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '批量重置多条新闻的 AI 评分。必填 newsIds(新闻 id 数组)。' +
    '逐条调用 resetScoring,返回成功/失败分项结果。调用前应先调 list_scored_news 确认条目。';
  readonly parameters = {
    type: 'object',
    properties: {
      newsIds: {
        type: 'array',
        items: { type: 'string' },
        description: '要重置评分的新闻 id 列表',
      },
    },
    required: ['newsIds'],
  };

  async handler(args: { newsIds: string[] }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    const feedService = new FeedRouteService(store, services);
    const succeeded: Array<{ newsId: string; changed?: boolean }> = [];
    const failed: Array<{ newsId: string; message: string }> = [];

    for (const newsId of args.newsIds) {
      try {
        const result = await feedService.resetScoring(newsId);
        succeeded.push({ newsId, changed: result.changed });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        failed.push({ newsId, message });
      }
    }

    return {
      ok: failed.length === 0,
      total: args.newsIds.length,
      succeededCount: succeeded.length,
      failedCount: failed.length,
      succeeded,
      failed,
      hint: failed.length > 0 ? '部分条目重置失败,可逐条调 update_news_score 重试' : undefined,
    };
  }
}

class BackfillPublicationItemsTool extends BaseTool {
  readonly id = 'backfill_publication_items';
  readonly name = 'backfill_publication_items';
  readonly displayName = '回填发布条目';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '从历史发布记录回填 publication items 覆盖数据。可选 limit(处理条数上限)、dryRun(true=仅预览不写库)。';
  readonly parameters = {
    type: 'object',
    properties: {
      limit: { type: 'number', description: '处理条数上限(可选)' },
      dryRun: { type: 'boolean', description: 'true=仅预览不写库(可选)' },
    },
  };

  async handler(
    args: { limit?: number; dryRun?: boolean },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new PublishingRouteService(store, services);
      const result = await service.backfillPublicationItems({
        limit: args.limit,
        dryRun: args.dryRun,
      });
      return { ok: true, ...result, dryRun: args.dryRun === true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'BACKFILL_PUBLICATION_ITEMS_FAILED',
        message,
        hint: '可在 /history 页面查看发布记录',
      };
    }
  }
}

export const batchTools: BaseTool[] = [
  new BatchResetScoringTool(),
  new BackfillPublicationItemsTool(),
];
