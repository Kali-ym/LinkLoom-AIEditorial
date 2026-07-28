import type { KnowledgeGateway, MemoryCleanupGateway } from '../../domain/editorial/ports.js';
import type { SystemSettings } from '../../types/config.js';
import type {
  DailyCoverageIngestInput,
  DailyCoverageIngestResult,
  PublicationHistoryQueryInput,
  PublicationHistoryQueryResult,
  PriorCoveragePayload
} from '../../types/dailyCoverage.js';
import {
  addDaysIso,
  buildCoverageRowsFromPublicationItems,
  buildCoverageRowsFromPlan,
  buildCoverageRowsFromMarkdown,
  buildCoverageRowsFromDailyReportJson,
  buildPublicationHistoryQueryResult,
  buildPublicationItemsFromCoverageRows,
  buildPriorCoveragePayload,
  getEditorialCrossDayConfig,
  matchPriorCoverageFromIndex,
  matchPriorCoverageFromPublicationItems,
  prependCoverageManifestToMarkdown
} from '../../utils/dailyCoverageUtils.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import { DailyMemoryCleanupGateway, KnowledgeToolGateway } from './KnowledgeToolGateway.js';

export interface DailyCoverageOrchestratorDeps {
  knowledgeGateway?: KnowledgeGateway;
  memoryCleanupGateway?: MemoryCleanupGateway;
}

/**
 * 跨日覆盖编排器：负责把发布出去的日报落到 DailyCoverage 索引、Publication 历史以及知识库。
 *
 * 知识库 / 记忆访问通过 Port 注入（`KnowledgeGateway` / `MemoryCleanupGateway`），
 * 默认实现 `KnowledgeToolGateway` + `DailyMemoryCleanupGateway` 走 Tool + ServiceContext，
 * 单测可以替换为内存实现而不需要 boot 整个 ServiceContext。
 */
export class DailyCoverageOrchestrator {
  private readonly knowledgeGateway: KnowledgeGateway;
  private readonly memoryCleanupGateway: MemoryCleanupGateway;

  constructor(
    private readonly store: LocalStore,
    private readonly settings: SystemSettings,
    deps: DailyCoverageOrchestratorDeps = {}
  ) {
    this.knowledgeGateway = deps.knowledgeGateway ?? new KnowledgeToolGateway();
    this.memoryCleanupGateway = deps.memoryCleanupGateway ?? new DailyMemoryCleanupGateway();
  }

  async ingestFromPublish(input: DailyCoverageIngestInput): Promise<DailyCoverageIngestResult> {
    const cfg = getEditorialCrossDayConfig(this.settings.EDITORIAL_CONFIG);
    const date = input.date.slice(0, 10);
    const namespace = input.namespace || 'default';
    const ingestedAt = Date.now();

    let rows = input.editorialPlan
      ? buildCoverageRowsFromPlan(date, input.editorialPlan, ingestedAt)
      : [];
    if (rows.length === 0 && input.reportJson && typeof input.reportJson === 'object') {
      rows = buildCoverageRowsFromDailyReportJson(date, input.reportJson, ingestedAt);
    }
    if (rows.length === 0 && input.markdown?.trim()) {
      rows = buildCoverageRowsFromMarkdown(date, input.markdown, ingestedAt);
    }
    await this.store.deleteDailyCoverageByDate(date);
    if (rows.length > 0) {
      await this.store.insertDailyCoverageRows(rows);
    }

    let documentId: string | undefined;
    let knowledgeCategoryId = cfg.knowledgeCategoryId;

    if (input.historyId) {
      await this.store.deletePublicationItemsByHistoryId(input.historyId);
      const publicationItems = buildPublicationItemsFromCoverageRows(
        input.historyId,
        rows,
        namespace
      );
      if (publicationItems.length > 0) {
        await this.store.upsertPublicationItems(publicationItems);
      }
    }

    if (cfg.ingestKnowledge && input.markdown?.trim()) {
      const kbContent = prependCoverageManifestToMarkdown(
        input.markdown,
        date,
        input.editorialPlan
      );
      const kbRes = await this.knowledgeGateway.save({
        content: kbContent,
        categoryName: cfg.knowledgeCategoryName,
        categoryId: cfg.knowledgeCategoryId,
        documentName: `${date}.md`,
        mode: 'upsert'
      });
      documentId = kbRes.documentId;
      knowledgeCategoryId = kbRes.categoryId;
    }

    return {
      documentId,
      knowledgeCategoryId,
      topicCount: new Set(rows.map((r) => r.topic_id)).size,
      urlCount: rows.length
    };
  }

  async fetchPriorCoverage(
    asOfDate: string,
    items: Record<string, unknown>[] = [],
    options?: { semantic?: boolean; semanticTimeoutMs?: number }
  ): Promise<PriorCoveragePayload> {
    const cfg = getEditorialCrossDayConfig(this.settings.EDITORIAL_CONFIG);
    const date = asOfDate.slice(0, 10);
    const startDate = addDaysIso(date, -cfg.lookbackDays);
    const publicationItems = await this.store.listPublicationItemsInRange(startDate, date);
    const indexRows =
      publicationItems.length > 0
        ? buildCoverageRowsFromPublicationItems(publicationItems)
        : await this.store.listDailyCoverageInRange(startDate, date);
    const programMatches =
      publicationItems.length > 0
        ? matchPriorCoverageFromPublicationItems(items, publicationItems, {
            titleThreshold: cfg.titleThreshold,
            asOfDate: date
          })
        : matchPriorCoverageFromIndex(items, indexRows, {
            titleThreshold: cfg.titleThreshold,
            asOfDate: date
          });

    let knowledge_summary: string | undefined;

    const runSemantic = options?.semantic !== false;
    if (runSemantic && items.length > 0) {
      const sampleTitles = items
        .slice(0, 8)
        .map((it) => String(it.title ?? '').trim())
        .filter(Boolean)
        .join('；');
      const queryText = `近${cfg.lookbackDays}日内是否已报道以下主题或类似事件：${sampleTitles}`;

      try {
        const kbCategoryIds = await this.resolveKnowledgeCategoryIds(cfg);
        const kbRes = await this.knowledgeGateway.query({
          query: queryText,
          categoryIds: kbCategoryIds,
          limit: 3
        });
        knowledge_summary = kbRes.answer;
      } catch (err: any) {
        LogService.warn(`Publication history semantic fetch skipped: ${err.message}`);
      }
    }

    return buildPriorCoveragePayload(date, cfg.lookbackDays, indexRows, programMatches, {
      knowledge_summary
    });
  }

  async queryPublicationHistory(
    input: PublicationHistoryQueryInput
  ): Promise<PublicationHistoryQueryResult> {
    const cfg = getEditorialCrossDayConfig(this.settings.EDITORIAL_CONFIG);
    const asOfDate = input.asOfDate.slice(0, 10);
    const namespace = input.namespace || 'default';
    const lookbackDays = Math.min(Math.max(input.lookbackDays ?? cfg.lookbackDays, 1), 365);
    const startDate = addDaysIso(asOfDate, -lookbackDays);
    const publicationItems = (
      await this.store.listPublicationItemsInRange(startDate, asOfDate)
    ).filter((item) => String(item.metadata?.namespace || 'default') === namespace);
    const matches = matchPriorCoverageFromPublicationItems(input.items as any[], publicationItems, {
      titleThreshold: input.titleThreshold ?? cfg.titleThreshold,
      asOfDate
    });
    return buildPublicationHistoryQueryResult(asOfDate, lookbackDays, publicationItems, matches);
  }

  async getPriorUrls(asOfDate: string): Promise<string[]> {
    const cfg = getEditorialCrossDayConfig(this.settings.EDITORIAL_CONFIG);
    const date = asOfDate.slice(0, 10);
    const startDate = addDaysIso(date, -cfg.lookbackDays);
    const urls = await this.store.listPublicationUrlsInRange(startDate, date);
    return urls.length > 0 ? urls : this.store.listDailyCoverageUrlsInRange(startDate, date);
  }

  async backfillFromHistory(options?: { limit?: number; dryRun?: boolean }): Promise<{
    processed: number;
    skipped: number;
    dates: string[];
    errors: string[];
    dryRun: boolean;
    itemCount: number;
    deletedDailyMemoryEntries: number;
    deletedDailyMemoryCategories: number;
  }> {
    const limit = Math.min(Math.max(options?.limit ?? 60, 1), 500);
    const dryRun = options?.dryRun === true;
    const cfg = getEditorialCrossDayConfig(this.settings.EDITORIAL_CONFIG);
    const { records } = await this.store.getCommitHistory({ limit });
    const dates: string[] = [];
    const errors: string[] = [];
    let processed = 0;
    let skipped = 0;
    let itemCount = 0;
    let deletedDailyMemoryEntries = 0;
    let deletedDailyMemoryCategories = 0;

    for (const record of records) {
      const markdown = String(record.full_content ?? '').trim();
      if (!markdown) {
        skipped++;
        continue;
      }
      const date = String(record.date ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        skipped++;
        continue;
      }
      try {
        const indexRows = await this.store.listDailyCoverageInRange(date, addDaysIso(date, 1));
        let parsedReport: Record<string, unknown> | undefined;
        if (markdown.startsWith('{')) {
          try {
            const parsed = JSON.parse(markdown);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              parsedReport = parsed as Record<string, unknown>;
            }
          } catch {
            parsedReport = undefined;
          }
        }
        const rows =
          indexRows.length > 0
            ? indexRows
            : parsedReport
              ? buildCoverageRowsFromDailyReportJson(date, parsedReport, Date.now())
              : buildCoverageRowsFromMarkdown(date, markdown, Date.now());
        itemCount += rows.length;
        if (!dryRun) {
          await this.store.deletePublicationItemsByHistoryId(record.id);
          await this.store.upsertPublicationItems(
            buildPublicationItemsFromCoverageRows(record.id, rows, 'default')
          );
          if (cfg.ingestKnowledge && markdown.trim()) {
            const kbContent = prependCoverageManifestToMarkdown(markdown, date, undefined);
            await this.knowledgeGateway.save({
              content: kbContent,
              categoryName: cfg.knowledgeCategoryName,
              categoryId: cfg.knowledgeCategoryId,
              documentName: `${date}.md`,
              mode: 'upsert'
            });
          }
        }
        dates.push(date);
        processed++;
      } catch (err: any) {
        errors.push(`${date}: ${err.message}`);
      }
    }

    if (!dryRun) {
      const cleanup = await this.memoryCleanupGateway.cleanupDailyCoverage();
      deletedDailyMemoryEntries = cleanup.deletedEntries;
      deletedDailyMemoryCategories = cleanup.deletedCategories;
    }

    return {
      processed,
      skipped,
      dates: [...new Set(dates)],
      errors,
      dryRun,
      itemCount,
      deletedDailyMemoryEntries,
      deletedDailyMemoryCategories
    };
  }

  private async resolveKnowledgeCategoryIds(
    cfg: ReturnType<typeof getEditorialCrossDayConfig>
  ): Promise<string[] | undefined> {
    if (cfg.knowledgeCategoryId) return [cfg.knowledgeCategoryId];
    const id = await this.knowledgeGateway.resolveCategoryIdByName(cfg.knowledgeCategoryName);
    return id ? [id] : undefined;
  }
}
