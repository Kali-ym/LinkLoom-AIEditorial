import { parseJsonLenient } from '../shared/json.js';
import type { SystemSettings } from '../types/config.js';
import type { EditorialPlan } from '../types/dailyEditorial.js';
import type { IPublisher } from '../types/plugin.js';
import { dailyReportJsonToMarkdown } from '../utils/dailyReportJsonToMarkdown.js';
import { ConfigService } from './ConfigService.js';
import { DailyCoverageOrchestrator } from './editorial/DailyCoverageOrchestrator.js';
import type { LocalStore } from './LocalStore.js';
import { LogService } from './LogService.js';

export interface PostPublishHookOptions {
  historyId: number;
  publisherId: string;
  publisher: IPublisher;
  content: unknown;
  payload: unknown;
  isJsonPayload: boolean;
  options: any;
  historyDate: string;
}

/**
 * 发布完成后的副作用流水线：写入跨日覆盖索引、入知识库。
 *
 * 之前嵌在 TaskService.publish 内的 ~80 行 try/catch，独立到这里以减少 TaskService 体积，
 * 让 publish 路径只负责「调发布器 + 写提交历史」，副作用集中可测。
 */
export class PostPublishPipeline {
  constructor(
    private store: LocalStore,
    private settings?: SystemSettings
  ) {}

  /**
   * 异步收尾：成功不抛出，失败仅记日志（不影响主发布成功状态）。
   * 返回 `coverage` 字段或 undefined。
   */
  async runIngestCoverage(input: PostPublishHookOptions): Promise<unknown | undefined> {
    if (input.options?.ingestCoverage === false) return undefined;
    try {
      const settings = this.settings || (await ConfigService.getInstance(this.store)).getSettings();
      const orchestrator = new DailyCoverageOrchestrator(this.store, settings);
      const editorialPlan = input.options?.editorialPlan as EditorialPlan | undefined;
      let markdown = '';
      let plan = editorialPlan;
      let report: unknown;

      if (input.publisherId === 'local_site') {
        report =
          input.options?.report ??
          input.options?.daily_report_json ??
          (typeof input.content === 'string' ? parseJsonLenient(input.content) : input.content);
        if (report && typeof report === 'object' && !Array.isArray(report)) {
          const reportObj = report as Record<string, unknown>;
          markdown = dailyReportJsonToMarkdown(reportObj);
          plan = plan ?? (reportObj.editorialPlan as EditorialPlan | undefined);
        }
      } else if (
        typeof input.payload === 'string' &&
        input.payload.trim() &&
        !input.isJsonPayload
      ) {
        markdown = input.payload;
      }

      const reportJson =
        input.publisherId === 'local_site' &&
        report &&
        typeof report === 'object' &&
        !Array.isArray(report)
          ? (report as Record<string, unknown>)
          : undefined;

      if (markdown.trim() || plan || reportJson) {
        return await orchestrator.ingestFromPublish({
          historyId: input.historyId,
          date: input.historyDate.slice(0, 10),
          namespace: input.options?.coverageNamespace || input.options?.namespace || 'default',
          editorialPlan: plan,
          reportJson,
          markdown,
          platform: input.publisher.name || input.publisherId
        });
      }
    } catch (err: any) {
      LogService.warn(`Daily coverage ingest failed: ${err.message}`);
    }
    return undefined;
  }
}
