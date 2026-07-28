import type {
  KnowledgeGateway,
  KnowledgeQueryInput,
  KnowledgeQueryResult,
  KnowledgeSaveInput,
  KnowledgeSaveResult,
  MemoryCleanupGateway
} from '../../domain/editorial/ports.js';
import { QueryKnowledgeTool } from '../../plugins/builtin/tools/QueryKnowledgeTool.js';
import { SaveKnowledgeTool } from '../../plugins/builtin/tools/SaveKnowledgeTool.js';
import { LogService } from '../LogService.js';
import { createToolExecutionContext } from '../ToolExecutionContext.js';

/**
 * `KnowledgeGateway` 的默认实现：包装现有 `SaveKnowledgeTool` / `QueryKnowledgeTool`，
 * 并通过 `ServiceContext` 解析 KB 分类。
 *
 * 拆出来后，`DailyCoverageOrchestrator` 不再直接 new Tool 也不直接调用 ServiceContext，
 * 单测可以替换为内存版 gateway。
 *
 * 实现说明：自从 Phase B1 起 Tool 不再隐式调 `ServiceContext.getInstance()`，
 * 这里负责从 ServiceContext 构造一个 ToolExecutionContext 并显式注入。
 * ServiceContext 在此 gateway 加载阶段才动态 import，避免循环依赖。
 */
export class KnowledgeToolGateway implements KnowledgeGateway {
  private readonly saveTool = new SaveKnowledgeTool();
  private readonly queryTool = new QueryKnowledgeTool();

  async save(input: KnowledgeSaveInput): Promise<KnowledgeSaveResult> {
    const ctx = await this.buildCtx();
    if (!ctx) {
      return { documentId: undefined, categoryId: undefined };
    }
    const res = await this.saveTool.handler(
      {
        content: input.content,
        categoryName: input.categoryName,
        categoryId: input.categoryId,
        documentName: input.documentName,
        mode: input.mode
      },
      ctx
    );
    return { documentId: res?.documentId, categoryId: res?.categoryId };
  }

  async query(input: KnowledgeQueryInput): Promise<KnowledgeQueryResult> {
    const ctx = await this.buildCtx();
    if (!ctx) {
      return { answer: undefined };
    }
    const res = await this.queryTool.handler(
      {
        query: input.query,
        categoryIds: input.categoryIds,
        limit: input.limit
      },
      ctx
    );
    return { answer: res?.answer ? String(res.answer) : undefined };
  }

  async resolveCategoryIdByName(name: string): Promise<string | undefined> {
    try {
      const { ServiceContext } = await import('../ServiceContext.js');
      const services = await ServiceContext.getInstance();
      const cats = await services.knowledgeBaseService.getCategories();
      const found = cats.find((c) => c.name === name);
      return found?.id;
    } catch (err: any) {
      LogService.warn(`Knowledge category lookup failed: ${err.message}`);
      return undefined;
    }
  }

  private async buildCtx() {
    try {
      const { ServiceContext } = await import('../ServiceContext.js');
      const services = await ServiceContext.getInstance();
      if (!services) return undefined;
      return createToolExecutionContext(services);
    } catch (err: any) {
      LogService.warn(`KnowledgeToolGateway failed to resolve ServiceContext: ${err.message}`);
      return undefined;
    }
  }
}

/**
 * `MemoryCleanupGateway` 的默认实现：调用 ServiceContext.memoryService 清理跨日索引残留。
 */
export class DailyMemoryCleanupGateway implements MemoryCleanupGateway {
  async cleanupDailyCoverage(): Promise<{ deletedEntries: number; deletedCategories: number }> {
    try {
      const { ServiceContext } = await import('../ServiceContext.js');
      const ctx = await ServiceContext.getInstance();
      const categories = await ctx.memoryService.getCategories();
      let deletedEntries = 0;
      let deletedCategories = 0;

      for (const category of categories) {
        const isDailyCategory =
          category.name === '日报跨日索引' ||
          category.id === 'cat_daily_cross_day' ||
          category.description?.includes('日报跨日');

        if (isDailyCategory) {
          const details = await ctx.memoryService.getCategoryDetails(category.id);
          deletedEntries += details?.entries?.length || 0;
          await ctx.memoryService.deleteCategory(category.id);
          deletedCategories++;
          continue;
        }

        const details = await ctx.memoryService.getCategoryDetails(category.id);
        for (const entry of details?.entries || []) {
          const summary = entry.summary || '';
          const isDailyEntry =
            entry.tags?.includes('daily_coverage') ||
            /^日报跨日索引\s+\d{4}-\d{2}-\d{2}/.test(summary) ||
            summary.includes('coverage_manifest');
          if (isDailyEntry) {
            await ctx.memoryService.deleteMemory(entry.id);
            deletedEntries++;
          }
        }
      }

      return { deletedEntries, deletedCategories };
    } catch (err: any) {
      LogService.warn(`Daily coverage memory cleanup skipped: ${err.message}`);
      return { deletedEntries: 0, deletedCategories: 0 };
    }
  }
}
