import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { AppError } from '../../../../domain/errors.js';
import { PublishingRouteService } from '../../../../services/api/PublishingRouteService.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };
const HIGH: ToolExecutionPolicy = { readonly: false, riskLevel: 'high' };

class GetCommitHistoryTool extends BaseTool {
  readonly id = 'get_commit_history';
  readonly name = 'get_commit_history';
  readonly displayName = '查发布历史';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出发布/提交历史记录。可选 date/platform/limit(默认20)/offset(默认0)/search 筛选。';
  readonly parameters = {
    type: 'object',
    properties: {
      date: { type: 'string', description: '发布日期 YYYY-MM-DD(可选)' },
      platform: { type: 'string', description: '发布平台(可选)' },
      limit: { type: 'number', description: '返回条数,默认 20' },
      offset: { type: 'number', description: '偏移量,默认 0' },
      search: { type: 'string', description: '搜索关键词(可选)' },
    },
  };

  async handler(
    args: {
      date?: string;
      platform?: string;
      limit?: number;
      offset?: number;
      search?: string;
    },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const publishingService = new PublishingRouteService(store, services);
      const result = await publishingService.listCommitHistory({
        date: args.date,
        platform: args.platform,
        limit: args.limit,
        offset: args.offset,
        search: args.search,
      });
      return { ok: true, commits: result.commits, total: result.total };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_COMMIT_HISTORY_FAILED',
        message,
        hint: '可在 /history 页面查看发布历史',
      };
    }
  }
}

class GetPublicationItemsTool extends BaseTool {
  readonly id = 'get_publication_items';
  readonly name = 'get_publication_items';
  readonly displayName = '查发布条目';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description = '查询单次发布历史下的覆盖/发布条目明细。必填 historyId(发布历史记录 id)。';
  readonly parameters = {
    type: 'object',
    properties: { historyId: { type: 'string', description: '发布历史记录 id' } },
    required: ['historyId'],
  };

  async handler(args: { historyId: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const publishingService = new PublishingRouteService(store, services);
      const result = await publishingService.listPublicationItems(args.historyId);
      return { ok: true, items: result.items };
    } catch (e: unknown) {
      if (e instanceof AppError) {
        return {
          ok: false,
          errorCode: e.statusCode === 400 ? 'INVALID_INPUT' : 'GET_PUBLICATION_ITEMS_FAILED',
          message: e.message,
        };
      }
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_PUBLICATION_ITEMS_FAILED',
        message,
        hint: '调 get_commit_history 确认 historyId',
      };
    }
  }
}

class RepublishReportTool extends BaseTool {
  readonly id = 'republish_report';
  readonly name = 'republish_report';
  readonly displayName = '重新发布';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '根据历史记录重新发布日报到原渠道。必填 id(发布历史记录 id)。执行前应先调 get_commit_history 让用户确认。';
  readonly parameters = {
    type: 'object',
    properties: { id: { type: 'string', description: '发布历史记录 id' } },
    required: ['id'],
  };

  async handler(args: { id: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const publishingService = new PublishingRouteService(store, services);
      const result = await publishingService.republish(args.id);
      return { ok: true, ...result };
    } catch (e: unknown) {
      if (e instanceof AppError) {
        return {
          ok: false,
          errorCode: e.statusCode === 404 ? 'NOT_FOUND' : 'REPUBLISH_REPORT_FAILED',
          message: e.message,
        };
      }
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'REPUBLISH_REPORT_FAILED',
        message,
        hint: '可在 /history 页面重新发布',
      };
    }
  }
}

class DeleteCommitHistoryTool extends BaseTool {
  readonly id = 'delete_commit_history';
  readonly name = 'delete_commit_history';
  readonly displayName = '删除发布存档';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description =
    '删除一条发布历史存档(高危,不可撤销)。必填 id(发布历史记录 id)。执行前应先调 get_commit_history 让用户确认。';
  readonly parameters = {
    type: 'object',
    properties: { id: { type: 'string', description: '发布历史记录 id' } },
    required: ['id'],
  };

  async handler(args: { id: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const publishingService = new PublishingRouteService(store, services);
      await publishingService.deleteCommitHistory(args.id);
      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'DELETE_COMMIT_HISTORY_FAILED',
        message,
        hint: '确认 id 正确且记录存在',
      };
    }
  }
}

export const historyTools: BaseTool[] = [
  new GetCommitHistoryTool(),
  new GetPublicationItemsTool(),
  new RepublishReportTool(),
  new DeleteCommitHistoryTool(),
];
