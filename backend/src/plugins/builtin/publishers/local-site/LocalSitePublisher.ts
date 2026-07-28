import {
  DAILY_REPORT_JSON_INDEX_KEY,
  DAILY_REPORT_JSON_KEY_PREFIX
} from '../../../../config/businessEnums.js';
import type { IKVStore } from '../../../../domain/ports/store.js';
import { PublisherMetadata } from '../../../../registries/PublisherRegistry.js';
import { LogService } from '../../../../services/LogService.js';
import type { IPublisher, PublisherRuntime } from '../../../../types/plugin.js';
import { getISODate, parseJsonLenient } from '../../../../utils/helpers.js';

/**
 * 本地站点（Next.js Web）发布器。
 *
 * Hugo 时代是把 Markdown 写到本地文件系统，再触发构建；现在前端是 `web/` 这个
 * Next.js 应用，直接从后端 KV (`daily_report_json:<date>`) 拉取结构化日报渲染。
 * 因此本发布器的职责就是：把传入的 JSON 报告写入 KV，并维护日期索引；点击
 * 「提交」之后刷新 `/daily` 即可看到最新内容。
 *
 * 入参兼容三种：
 *   - options.report           最优先：完整的 DailyReportJson 对象
 *   - options.daily_report_json  admin 端在 result 上沿用的字段名
 *   - content                  字符串 JSON，会做 lenient 解析；其它字符串会被拒绝
 */
export interface LocalSiteConfig {
  /** 站点访问地址，仅用于回链展示（结尾自动补 `/`）。 */
  baseURL?: string;
  /** 兼容历史配置；当前实现忽略该字段。 */
  buildAfterPublish?: boolean;
}

interface PublishOptions {
  date?: string;
  title?: string;
  report?: unknown;
  daily_report_json?: unknown;
  message?: string;
  /** 兼容字段；如未提供 report/JSON 字符串会被忽略。 */
  buildAfterPublish?: boolean;
}

interface PublishedReport {
  /** ISO 日期 (YYYY-MM-DD) */
  date?: string;
  [key: string]: unknown;
}

export class LocalSitePublisher implements IPublisher {
  static metadata: PublisherMetadata = {
    id: 'local_site',
    name: '本地站点',
    description: '将结构化日报写入本地 KV，供 web 前端 (/daily) 直接渲染',
    icon: 'public',
    configFields: [
      {
        key: 'baseURL',
        label: 'Web 站点访问地址',
        type: 'text',
        default: 'http://localhost:3000/',
        required: false
      },
      {
        key: 'buildAfterPublish',
        label: '提交后是否触发站点构建（保留字段，当前 Next.js 实现不需要）',
        type: 'boolean',
        default: false,
        required: false
      }
    ]
  };

  id = 'local_site';
  name = '本地站点';
  description = LocalSitePublisher.metadata.description;
  icon = LocalSitePublisher.metadata.icon;
  configFields = LocalSitePublisher.metadata.configFields;

  private store?: IKVStore;

  constructor(public config: LocalSiteConfig = {}) {}

  bindRuntime(runtime: PublisherRuntime) {
    this.store = runtime.store as IKVStore;
  }

  async publish(content: unknown, options: PublishOptions = {}) {
    const report = this.resolveReport(content, options);
    if (!report || typeof report !== 'object') {
      throw new Error(
        '本地站点发布器需要结构化日报对象（请使用 JSON 版日报工作流生成的 daily_report_json）'
      );
    }

    const date = this.resolveDate(report, options);
    if (!date) {
      throw new Error(
        '本地站点发布器无法确定日期，请在 options.date 或 report.date 中提供 YYYY-MM-DD'
      );
    }

    const normalizedReport: PublishedReport = { ...(report as PublishedReport), date };
    if (!this.store) {
      throw new Error(
        'LocalSitePublisher 未绑定 store；PluginRuntime.bindRuntime 应在实例化后调用。'
      );
    }
    const store = this.store;

    const kvKey = `${DAILY_REPORT_JSON_KEY_PREFIX}${date}`;
    await store.put(kvKey, normalizedReport);

    const indexRaw = await store.get(DAILY_REPORT_JSON_INDEX_KEY);
    const existing = Array.isArray(indexRaw)
      ? indexRaw.filter((v): v is string | { date: string; storyCount?: number } => {
          if (typeof v === 'string') return true;
          return typeof v === 'object' && v !== null && typeof v.date === 'string';
        })
      : [];

    const storyCount =
      typeof normalizedReport.stats === 'object' && normalizedReport.stats !== null
        ? (normalizedReport.stats as any).totalStories
        : undefined;

    const newEntry: string | { date: string; storyCount?: number } =
      typeof storyCount === 'number' ? { date, storyCount } : date;

    // Remove old entry for this date (whether string or object) and prepend new
    const filtered = existing.filter((v) =>
      typeof v === 'string' ? v !== date : (v as any).date !== date
    );
    const nextIndex = [newEntry, ...filtered].sort((a, b) => {
      const da = typeof a === 'string' ? a : (a as any).date;
      const db = typeof b === 'string' ? b : (b as any).date;
      return da < db ? 1 : -1;
    });
    await store.put(DAILY_REPORT_JSON_INDEX_KEY, nextIndex);

    const baseURL = (this.config.baseURL || '').replace(/\/?$/, '/');
    const viewUrl = baseURL ? `${baseURL}daily/${date}` : '';
    LogService.info(`Published daily report JSON to KV: ${kvKey}`);

    return {
      success: true,
      kvKey,
      indexKey: DAILY_REPORT_JSON_INDEX_KEY,
      date,
      filePath: kvKey,
      viewUrl
    };
  }

  getItemUrl(item: { filePath?: string; date?: string } = {}) {
    const baseURL = (this.config.baseURL || '').replace(/\/?$/, '/');
    if (!baseURL) return '';
    let date = item.date || '';
    if (!date && item.filePath?.startsWith(DAILY_REPORT_JSON_KEY_PREFIX)) {
      date = item.filePath.slice(DAILY_REPORT_JSON_KEY_PREFIX.length);
    }
    if (!date) return '';
    return `${baseURL}daily/${date}`;
  }

  private resolveReport(content: unknown, options: PublishOptions): unknown {
    if (options.report && typeof options.report === 'object') return options.report;
    if (options.daily_report_json && typeof options.daily_report_json === 'object') {
      return options.daily_report_json;
    }
    if (content && typeof content === 'object') return content;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      if (!trimmed) return null;
      try {
        return parseJsonLenient(trimmed);
      } catch {
        return null;
      }
    }
    return null;
  }

  private resolveDate(report: unknown, options: PublishOptions): string {
    const fromOptions = typeof options.date === 'string' ? options.date.slice(0, 10) : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromOptions)) return fromOptions;
    const fromReport =
      report && typeof report === 'object' && typeof (report as PublishedReport).date === 'string'
        ? ((report as PublishedReport).date as string).slice(0, 10)
        : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromReport)) return fromReport;
    return getISODate();
  }
}
