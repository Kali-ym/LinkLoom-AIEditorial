import { BaseAdapter } from '../plugins/base/BaseAdapter.js';
import { SystemSettings } from '../types/config.js';
import type { UnifiedData } from '../types/index.js';
import { IPublisher } from '../types/plugin.js';
import { getISODate } from '../utils/helpers.js';
import { normalizeDailyMarkdown } from '../utils/normalizeDailyMarkdown.js';
import type { AIProvider } from './AIProvider.js';
import { FeedAggregationService, type AggregateOptions } from './FeedAggregationService.js';
import { LocalStore } from './LocalStore.js';
import { LogService } from './LogService.js';
import { cleanupAppTempFiles } from './maintenance/TempFileCleaner.js';
import { PostPublishPipeline } from './PostPublishPipeline.js';

export class TaskService {
  private adapters: BaseAdapter[];
  private publishers: Map<string, IPublisher> = new Map();
  private store: LocalStore;
  private ai?: AIProvider;
  public settings?: SystemSettings;
  private adapterStatus: Record<
    string,
    { lastActive: string; status: string; count: number; category: string }
  > = {};
  private statsCache: { todayCount: number; yesterdayCount: number; lastUpdate: string } | null =
    null;
  private aggregation: FeedAggregationService;

  constructor(
    adapters: BaseAdapter[],
    store: LocalStore,
    ai?: AIProvider,
    publishers: IPublisher[] = [],
    settings?: SystemSettings
  ) {
    this.adapters = adapters;
    this.store = store;
    this.ai = ai;
    this.settings = settings;
    this.aggregation = new FeedAggregationService(store, settings);

    for (const publisher of publishers) {
      this.publishers.set(publisher.id, publisher);
    }

    // 基础初始化
    for (const adapter of this.adapters) {
      this.adapterStatus[adapter.name] = {
        lastActive: '从未运行',
        status: 'idle',
        count: 0,
        category: adapter.category
      };
    }
  }

  /**
   * 尝试从存储中恢复今日的状态（条目数等）
   */
  async initStatus() {
    try {
      const targetDate = getISODate();

      for (const adapter of this.adapters) {
        // 从新表中查询今日该适配器抓取的数据
        const { total } = await this.store.listSourceData({
          adapterName: adapter.name,
          category: adapter.category,
          ingestionDate: targetDate,
          limit: 1
        });

        if (total > 0) {
          this.adapterStatus[adapter.name] = {
            ...this.adapterStatus[adapter.name],
            lastActive: '今日已同步',
            status: 'success',
            count: total
          };
        }
      }
      // 初始加载后清除缓存，强制下次获取时重新计算
      this.statsCache = null;

      // 启动时清理超过 24 小时的临时文件
      cleanupAppTempFiles().catch((err) => LogService.warn(`Temp cleanup failed: ${err.message}`));
    } catch (error) {
      LogService.error(`Failed to initialize adapter status: ${error}`);
    }
  }

  async runDailyIngestion(
    date?: string,
    config?: { foloCookie?: string },
    onProgress?: (progress: number) => Promise<void>
  ): Promise<{ count: number; data: Record<string, UnifiedData[]> }> {
    const targetDate = date || getISODate();
    LogService.info(`Starting ingestion for ${targetDate}`);

    const totalAdapters = this.adapters.length;
    let totalCount = 0;
    for (let i = 0; i < totalAdapters; i++) {
      const adapter = this.adapters[i];
      totalCount += await this.runAdapter(adapter, config, targetDate);
      if (onProgress) {
        await onProgress(Math.round(((i + 1) / totalAdapters) * 100));
      }
    }

    LogService.info(`Ingestion completed for ${targetDate}`);
    const data = await this.getAggregatedData(targetDate, { settings: this.settings });
    return { count: totalCount, data };
  }

  /**
   * 运行单个适配器并更新存储
   */
  /**
   * 按 ADAPTERS 配置 id 批量运行同一数据源下的全部已启用条目（如 follow-api → 全部 Folo 订阅）。
   */
  async runAdapterConfigIngestion(
    configId: string,
    date?: string,
    config?: any,
    onProgress?: (progress: number) => Promise<void>
  ): Promise<{ count: number; data: Record<string, UnifiedData[]> }> {
    const targetDate = date || getISODate();
    const matching = this.adapters.filter(
      (adapter) => (adapter as any).adapterConfigId === configId
    );
    if (matching.length === 0) {
      throw new Error(`Adapter config ${configId} not found or has no enabled items`);
    }

    LogService.info(
      `Running adapter config ${configId} (${matching.length} item(s)) with extra config: ${JSON.stringify(config)}`
    );

    let totalCount = 0;
    for (let i = 0; i < matching.length; i++) {
      totalCount += await this.runAdapter(matching[i], config, targetDate);
      if (onProgress) {
        await onProgress(Math.round(((i + 1) / matching.length) * 100));
      }
    }

    const data = await this.getAggregatedData(targetDate, { settings: this.settings });
    return { count: totalCount, data };
  }

  async runSingleAdapterIngestion(
    adapterName: string,
    date?: string,
    config?: any,
    onProgress?: (progress: number) => Promise<void>
  ): Promise<{ count: number; data: Record<string, UnifiedData[]> }> {
    const targetDate = date || getISODate();
    const adapter = this.adapters.find((a) => a.name === adapterName);
    if (!adapter) throw new Error(`Adapter ${adapterName} not found`);

    LogService.info(
      `Manually triggering adapter: ${adapterName} with extra config: ${JSON.stringify(config)}`
    );

    if (onProgress) await onProgress(10);
    // 运行适配器，它会更新自己的存储键
    const count = await this.runAdapter(adapter, config, targetDate);
    if (onProgress) await onProgress(100);

    const data = await this.getAggregatedData(targetDate, { settings: this.settings });
    return { count, data };
  }

  /**
   * 清空单个适配器的数据
   */
  async clearAdapterData(adapterName: string, date?: string) {
    const targetDate = date || getISODate();
    const adapter = this.adapters.find((a) => a.name === adapterName);
    if (!adapter) throw new Error(`Adapter ${adapterName} not found`);

    await this.store.deleteSourceDataByFilter({
      adapterName: adapterName,
      category: adapter.category,
      ingestionDate: targetDate
    });

    // 更新内存中的状态
    this.adapterStatus[adapterName] = {
      ...this.adapterStatus[adapterName],
      status: 'idle',
      count: 0
    };

    // 数据变动，清除统计缓存
    this.statsCache = null;

    LogService.info(`Cleared data for adapter ${adapterName} on ${targetDate}`);
  }

  private async runAdapter(
    adapter: BaseAdapter,
    extraConfig?: any,
    targetDate?: string
  ): Promise<number> {
    const date = targetDate || getISODate();
    LogService.info(`Running adapter: ${adapter.name}`);

    this.adapterStatus[adapter.name] = {
      lastActive: new Date().toISOString(),
      status: 'running',
      count: this.adapterStatus[adapter.name]?.count || 0,
      category: adapter.category
    };

    try {
      const adapterConfig: any = {
        foloCookie: (adapter as any).foloCookie || extraConfig?.foloCookie,
        ...extraConfig
      };

      adapterConfig.apiUrl = extraConfig?.apiUrl || (adapter as any).apiUrl;
      adapterConfig.useProxy = extraConfig?.useProxy || (adapter as any).useProxy;

      let newData = await adapter.fetchAndTransform(adapterConfig);

      // 主键统一由仓储层按 URL 派生，这里仅追加每日榜单需要的日期后缀
      if (adapter.appendDateToId) {
        LogService.info(
          `[TaskService] Adapter ${adapter.name} has appendDateToId enabled. Appending date suffix to IDs.`
        );
        newData = newData.map((item) => ({
          ...item,
          id: `${item.id}-${date}`
        }));
      }

      // 使用新表存储数据
      const addedCount = await this.store.saveSourceDataBatch(newData, date, adapter.name);

      LogService.info(
        `[TaskService] Adapter ${adapter.name} finished. New items in this run: ${addedCount} (Total fetched: ${newData.length})`
      );

      // 更新内存中的状态
      const memStatus = this.adapterStatus[adapter.name];
      if (memStatus) {
        memStatus.lastActive = new Date().toISOString();
        memStatus.status = 'success';
        // 此处 count 将在下一次 getAdapterStatus 调用时从数据库中刷新最准确的今日总量
      }

      // 数据变动，清除缓存
      this.statsCache = null;
      return addedCount;
    } catch (error: any) {
      LogService.error(`Adapter ${adapter.name} failed: ${error.message}`);
      this.adapterStatus[adapter.name] = {
        lastActive: new Date().toISOString(),
        status: 'error',
        count: this.adapterStatus[adapter.name]?.count || 0,
        category: adapter.category
      };
      throw error;
    }
  }

  async getStats() {
    const today = getISODate();

    // 获取最后一次提交时间和平台
    const lastCommitHistory = await this.store.getCommitHistory({ limit: 1 });
    const lastCommitTime =
      lastCommitHistory.records.length > 0
        ? new Date(lastCommitHistory.records[0].commitTime).toISOString()
        : null;
    const lastCommitPlatform =
      lastCommitHistory.records.length > 0 ? lastCommitHistory.records[0].platform : null;

    // 如果缓存存在且日期未变，直接返回
    if (this.statsCache && this.statsCache.lastUpdate === today) {
      return {
        todayCount: this.statsCache.todayCount,
        yesterdayCount: this.statsCache.yesterdayCount,
        aiStatus: 'healthy',
        lastCommit: lastCommitTime,
        lastCommitPlatform: lastCommitPlatform,
        uptime: process.uptime()
      };
    }

    // 重新计算：仪表盘统计应始终基于抓取日期 (ingestion_date)，不受筛选设置影响
    const allTodayData = await this.getAggregatedData(today, {
      includePreviousDay: false,
      queryField: 'ingestion_date'
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = getISODate(yesterday);
    const allYesterdayData = await this.getAggregatedData(yesterdayDate, {
      includePreviousDay: false,
      queryField: 'ingestion_date'
    });

    const stats = {
      todayCount: Object.entries(allTodayData)
        .filter(([key]) => key !== 'history')
        .reduce((sum, [, items]) => sum + items.length, 0),
      yesterdayCount: Object.entries(allYesterdayData)
        .filter(([key]) => key !== 'history')
        .reduce((sum, [, items]) => sum + items.length, 0),
      lastUpdate: today
    };

    this.statsCache = stats;

    return {
      ...stats,
      aiStatus: 'healthy',
      lastCommit: lastCommitTime,
      lastCommitPlatform: lastCommitPlatform,
      uptime: process.uptime()
    };
  }

  getAdapters() {
    return this.adapters;
  }

  async getAdapterStatus() {
    const status: Record<string, any> = {};
    const targetDate = getISODate();

    for (const adapter of this.adapters) {
      // 实时查询今日该适配器抓取的数据总量，确保显示准确
      const { total } = await this.store.listSourceData({
        adapterName: adapter.name,
        category: adapter.category,
        ingestionDate: targetDate,
        limit: 1
      });

      // 获取当前适配器的实际配置值
      const currentConfig: Record<string, any> = {};
      if (adapter.configFields) {
        for (const field of adapter.configFields) {
          // 优先从实例属性获取，其次从 itemConfig 获取，最后使用默认值
          currentConfig[field.key] =
            (adapter as any)[field.key] ??
            (adapter as any).itemConfig?.[field.key] ??
            field.default;
        }
      }

      const memStatus = this.adapterStatus[adapter.name];

      status[adapter.name] = {
        ...memStatus,
        count: total,
        type: (adapter as any).constructor.name,
        // 直接从适配器实例获取配置字段元数据
        configFields: adapter.configFields || [],
        // 包含当前配置值
        currentConfig
      };

      // 同步更新内存中的 count，保证一致性
      if (memStatus) {
        memStatus.count = total;
        if (total > 0 && memStatus.lastActive === '从未运行') {
          memStatus.lastActive = '今日已同步';
          memStatus.status = 'success';
        }
      }
    }
    return status;
  }

  /** 聚合指定日期的所有适配器数据；委派到 FeedAggregationService。 */
  async getAggregatedData(date: string, options: AggregateOptions = {}) {
    return this.aggregation.getAggregatedData(date, { settings: this.settings, ...options });
  }

  /**
   * 根据分数、日期、分类或关键词查询数据
   */
  async queryData(options: {
    minScore?: number;
    date?: string;
    publishedDates?: string[];
    category?: string;
    search?: string;
    limit?: number;
  }) {
    return await this.store.listSourceData({
      minScore: options.minScore,
      ingestionDate: options.date,
      publishedDates: options.publishedDates,
      category: options.category,
      search: options.search,
      limit: options.limit || 50
    });
  }

  /**
   * 统一发布接口
   */
  async publish(publisherId: string, content: any, options: any) {
    const publisher = this.publishers.get(publisherId);
    if (!publisher) throw new Error(`Publisher ${publisherId} not found or not configured`);

    let payload = content;
    // 仅在 Markdown 形态的发布器上做日报正文归一化；本地站点等 JSON 发布器跳过。
    const isJsonPayload =
      typeof payload === 'string'
        ? /^\s*[[{]/.test(payload)
        : payload !== null && typeof payload === 'object';
    if (
      typeof payload === 'string' &&
      payload.includes('AI资讯日报') &&
      !isJsonPayload &&
      publisherId !== 'local_site'
    ) {
      let publishDate = options?.date || options?.displayDate || getISODate();
      if (typeof publishDate === 'string') {
        publishDate = publishDate.replace(/\//g, '-').slice(0, 10);
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
        payload = normalizeDailyMarkdown(payload, { date: publishDate });
      }
    }

    const result = await publisher.publish(payload, options);

    if (options?.skipHistory) {
      return result;
    }

    // 保存提交历史记录
    // 根据不同的平台，构造历史记录
    let historyDate = options.date || options.displayDate || getISODate();
    if (typeof historyDate === 'string') {
      historyDate = historyDate.replace(/\//g, '-');
    }

    const historyId = await this.saveCommitHistory({
      date: historyDate,
      platform: publisher.name || publisherId,
      filePath: result.media_id || result.filePath || '',
      commitMessage: options.title || options.message || `Published to ${publisherId}`,
      fullContent: typeof content === 'string' ? content : JSON.stringify(content)
    });

    // 跨日覆盖索引 + 知识库入库：副作用收敛在 PostPublishPipeline。
    const coverage = await new PostPublishPipeline(this.store, this.settings).runIngestCoverage({
      historyId,
      publisherId,
      publisher,
      content,
      payload,
      isJsonPayload,
      options,
      historyDate
    });
    if (coverage !== undefined) {
      return { ...result, coverage };
    }

    return result;
  }

  /**
   * 保存提交历史记录
   */
  async saveCommitHistory(record: {
    date: string;
    platform: string;
    filePath: string;
    commitMessage?: string;
    fullContent?: string;
  }): Promise<number> {
    return await this.store.saveCommitHistory(record);
  }

  /**
   * 获取提交历史记录
   */
  async getCommitHistory(options?: {
    date?: string;
    dates?: string[];
    platform?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }) {
    return await this.store.getCommitHistory(options);
  }

  /**
   * 获取所有已提交的日期列表
   */
  async getCommittedDates() {
    return await this.store.getCommittedDates();
  }

  /**
   * 删除提交历史记录
   */
  async deleteCommitHistory(id: number) {
    return await this.store.deleteCommitHistory(id);
  }

  /**
   * 清除统计缓存
   */
  public clearCache() {
    this.statsCache = null;
  }

  /**
   * 删除原始数据或历史记录
   */
  async deleteSourceData(id: string) {
    // 数据变动，清除统计缓存
    this.statsCache = null;

    if (id.startsWith('history-')) {
      const historyId = parseInt(id.replace('history-', ''));
      return await this.store.deleteCommitHistory(historyId);
    }
    return await this.store.deleteSourceData(id);
  }
}
