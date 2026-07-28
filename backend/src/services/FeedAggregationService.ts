import type { SystemSettings } from '../types/config.js';
import type { UnifiedData } from '../types/index.js';
import { getISODate } from '../utils/helpers.js';
import { enumerateShanghaiCalendarDays } from '../utils/shanghaiDateRange.js';
import type { LocalStore } from './LocalStore.js';
import { LogService } from './LogService.js';

export interface AggregateOptions {
  includePreviousDay?: boolean;
  settings?: SystemSettings;
  queryField?: 'published_date' | 'ingestion_date';
  rangeFrom?: string;
  rangeTo?: string;
}

/**
 * 把 TaskService 中的「按日期/字段聚合源数据」逻辑独立出来。
 *
 * 拆分原因：原 TaskService 同时承担采集、发布与聚合查询三种职责（617 行），
 * 把聚合逻辑独立后让 TaskService 更专注于「调度 + 写入」，本服务承担「读 + 归类」。
 */
export class FeedAggregationService {
  constructor(
    private store: LocalStore,
    private defaultSettings?: SystemSettings
  ) {}

  async getAggregatedData(
    date: string,
    options: AggregateOptions = {}
  ): Promise<Record<string, UnifiedData[]>> {
    const settings = options.settings || this.defaultSettings;
    const queryField = options.queryField || settings?.SELECTION_QUERY_FIELD || 'published_date';

    const MAX_FETCH_DAYS = 14;
    let dates: string[] = [];
    if (options.rangeFrom?.trim() && options.rangeTo?.trim()) {
      dates = enumerateShanghaiCalendarDays(options.rangeFrom.trim(), options.rangeTo.trim());
    } else {
      const fetchDays =
        options.includePreviousDay !== false
          ? settings?.SELECTION_FETCH_DAYS
            ? settings.SELECTION_FETCH_DAYS
            : 2
          : 1;
      const targetDate = new Date(date);
      for (let i = 0; i < fetchDays; i++) {
        const d = new Date(targetDate);
        d.setDate(d.getDate() - i);
        dates.push(getISODate(d));
      }
    }
    if (dates.length > MAX_FETCH_DAYS) {
      dates = dates.slice(-MAX_FETCH_DAYS);
      LogService.warn(
        `Selection fetch capped at ${MAX_FETCH_DAYS} days (${dates[0]}..${dates[dates.length - 1]})`
      );
    }

    const data: Record<string, UnifiedData[]> = {};

    const queryOptions: any = {
      limit: dates.length > 1 ? Math.min(5000, 500 * dates.length) : 2000
    };

    if (queryField === 'published_date') {
      queryOptions.publishedDates = dates;
    } else {
      queryOptions.ingestionDates = dates;
    }

    const { items: allItems } = await this.store.listSourceData(queryOptions);

    for (const item of allItems) {
      const cat = item.category || 'default';
      if (!data[cat]) data[cat] = [];
      data[cat].push(item);
    }

    for (const cat in data) {
      data[cat].sort((a, b) => {
        const timeA = a.metadata?.fetched_at || 0;
        const timeB = b.metadata?.fetched_at || 0;
        return timeB - timeA;
      });
    }

    // 「历史存档」作为一种伪源出现在归档页签，避免无提交日空白。
    const historyResult = await this.store.getCommitHistory({ limit: 30 });
    if (historyResult.records.length > 0) {
      data['history'] = historyResult.records.map((record) => ({
        id: `history-${record.id}`,
        title: record.commitMessage || `Archive: ${record.date}`,
        url: '',
        description: (record.fullContent || '').substring(0, 500),
        published_date: new Date(record.commitTime).toISOString(),
        ingestion_date: record.date,
        source: record.platform,
        category: 'history',
        metadata: {
          full_content: record.fullContent,
          archive_date: record.date,
          file_path: record.filePath
        }
      }));
    }

    return data;
  }
}
