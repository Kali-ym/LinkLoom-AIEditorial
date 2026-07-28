import { AppError } from '../../domain/errors.js';
import { WechatService } from '../../plugins/builtin/publishers/wechat/WechatService.js';
import { normalizeDailyViewUrl } from '../../utils/helpers.js';
import { ConfigService } from '../ConfigService.js';
import { DailyCoverageOrchestrator } from '../editorial/DailyCoverageOrchestrator.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';

export class PublishingRouteService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async publish(id: string, content: string | undefined, options: any) {
    if (!content) {
      throw new AppError(400, 'Missing content');
    }
    const result = await this.context.taskService.publish(id, content, options);
    return { status: 'success', data: result };
  }

  async listCommitHistory(query: any) {
    const result = await this.context.taskService.getCommitHistory({
      date: query.date,
      platform: query.platform,
      limit: query.limit ? parseInt(query.limit) : 20,
      offset: query.offset ? parseInt(query.offset) : 0,
      search: query.search
    });

    const commits = result.records.map((record) => ({
      ...record,
      viewUrl: this.resolveCommitViewUrl(record)
    }));

    return { commits, total: result.total };
  }

  async deleteCommitHistory(id: string) {
    await this.context.taskService.deleteCommitHistory(parseInt(id));
    return { status: 'success' };
  }

  async listPublicationItems(historyId: string) {
    const id = parseInt(historyId);
    if (!Number.isFinite(id)) {
      throw new AppError(400, 'Invalid history id');
    }
    const items = await this.store.listPublicationItemsByHistoryId(id);
    return { items };
  }

  async queryPublicationItems(body: any) {
    const configService = await ConfigService.getInstance(this.store);
    const orchestrator = new DailyCoverageOrchestrator(this.store, configService.getSettings());
    return await orchestrator.queryPublicationHistory({
      asOfDate: body?.asOfDate || new Date().toISOString().slice(0, 10),
      namespace: body?.namespace || 'default',
      lookbackDays: body?.lookbackDays,
      items: Array.isArray(body?.items) ? body.items : [],
      titleThreshold: body?.titleThreshold
    });
  }

  async backfillPublicationItems(body: any) {
    const configService = await ConfigService.getInstance(this.store);
    const orchestrator = new DailyCoverageOrchestrator(this.store, configService.getSettings());
    return await orchestrator.backfillFromHistory({
      limit: body?.limit,
      dryRun: body?.dryRun === true
    });
  }

  async republish(id: string) {
    const recordId = parseInt(id);
    const record = await this.store.getCommitHistoryById(recordId);
    if (!record) {
      throw new AppError(404, 'History record not found');
    }

    const publisher = this.findPublisherForPlatform(record.platform);
    if (!publisher) {
      throw new AppError(
        400,
        `Publisher for platform ${record.platform} not found or not configured`
      );
    }

    const options = {
      title: record.commitMessage,
      filePath: record.filePath,
      date: record.date
    };

    const result = await this.context.taskService.publish(
      publisher.id,
      record.fullContent,
      options
    );
    return { status: 'success', data: result };
  }

  async uploadWechatMaterial(url?: string) {
    if (!url) {
      throw new AppError(400, 'Missing url');
    }
    const wechatService = WechatService.getInstance();
    if (!wechatService) {
      throw new Error('Wechat Service not initialized');
    }
    return await wechatService.uploadResource(url);
  }

  private resolveCommitViewUrl(record: { platform: string; filePath?: string; date?: string }) {
    const publisher = this.findPublisherForPlatform(record.platform, true);
    let viewUrl = publisher?.getItemUrl?.(record) || '';
    if (!viewUrl && this.isLocalSitePlatform(record.platform)) {
      const localPublisher = this.context.publisherInstances.find((p) => p.id === 'local_site');
      viewUrl = localPublisher?.getItemUrl?.(record) || '';
    }
    return normalizeDailyViewUrl(viewUrl);
  }

  private isLocalSitePlatform(platform: string) {
    const platformLower = platform.toLowerCase().trim();
    return (
      platformLower === 'local_site' ||
      platformLower === 'local site' ||
      platformLower === '本地站点'
    );
  }

  private findPublisherForPlatform(platform: string, includeGithubAlias = false) {
    const platformLower = platform.toLowerCase().trim();
    return this.context.publisherInstances.find((publisher) => {
      const id = publisher.id.toLowerCase();
      const name = publisher.name.toLowerCase();
      if (id === platformLower || name === platformLower) return true;
      if (includeGithubAlias && platformLower === 'github' && publisher.id === 'github') {
        return true;
      }
      if (id === 'local_site' && this.isLocalSitePlatform(platform)) {
        return true;
      }
      return false;
    });
  }
}
