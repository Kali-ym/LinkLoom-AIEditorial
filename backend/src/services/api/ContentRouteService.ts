import crypto from 'crypto';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { normalizeSettings } from '../../config/normalizeSettings.js';
import { AppError } from '../../domain/errors.js';
import { getISODate } from '../../utils/helpers.js';
import { parseOPML } from '../../utils/opml.js';
import { ConfigService } from '../ConfigService.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import { PluginConfigValidator } from '../plugins/PluginConfigValidator.js';
import type { ServiceContext } from '../ServiceContext.js';

export class ContentRouteService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async importContent(mode: string, categoryId: string, payload: any) {
    if (!mode || !categoryId || !payload) {
      throw new AppError(400, '缺少必要参数 (mode, categoryId, payload)');
    }

    if (mode === 'URL') {
      const item = await this.context.importService.importFromUrl(payload.url, categoryId);
      this.context.taskService.clearCache();
      return { status: 'success', data: item };
    }
    if (mode === 'TEXT') {
      const item = await this.context.importService.importFromText(
        payload.title,
        payload.content,
        categoryId
      );
      this.context.taskService.clearCache();
      return { status: 'success', data: item };
    }
    if (mode === 'JSON') {
      const count = await this.context.importService.importFromJson(payload.json, categoryId);
      this.context.taskService.clearCache();
      return { status: 'success', count };
    }

    throw new AppError(400, '不支持的导入模式');
  }

  async regenerateContent(id: string, body: any) {
    const agentId = body.agentId;
    const prompt = body.prompt;
    const type = body.type;
    const content = body.content;
    const date = body.date || id;

    if (type !== 'cover') {
      throw new AppError(400, 'Unsupported regenerate type');
    }

    if (!agentId) {
      throw new AppError(400, 'Missing agentId');
    }

    const input =
      prompt && content
        ? `${prompt}\n\n[分隔符]:\n${content}`
        : prompt || content || '请为文章生成一张封面图';

    const result = await this.context.executionService.executeAI(agentId, input, date);
    return await this.normalizeCoverResult(result);
  }

  getAggregatedContent(query: { date?: string; rangeFrom?: string; rangeTo?: string }) {
    const targetDate = query.date || getISODate();
    return this.context.taskService.getAggregatedData(targetDate, {
      settings: this.context.settings,
      rangeFrom: query.rangeFrom,
      rangeTo: query.rangeTo
    });
  }

  async deleteContent(id: string) {
    await this.context.taskService.deleteSourceData(id);
    return { status: 'success' };
  }

  async readTempImage(filePath?: string) {
    if (!filePath) {
      throw new AppError(400, 'Missing path parameter');
    }
    const result = await this.context.mediaProxyService.readTempImage(filePath);
    this.assertMediaResult(result);
    return result;
  }

  async fetchProxyImage(url?: string) {
    if (!url) {
      throw new AppError(400, 'Missing url parameter');
    }
    const result = await this.context.mediaProxyService.fetchImage(url);
    this.assertMediaResult(result);
    return result;
  }

  async importOpml(opmlContent: string | undefined, adapterId?: string) {
    if (!opmlContent) {
      throw new AppError(400, '缺少 opmlContent 参数');
    }

    const feeds = parseOPML(opmlContent);
    if (feeds.length === 0) {
      throw new AppError(400, '未在 OPML 中找到任何 RSS 订阅源');
    }

    // 走 ConfigService 单一入口读 system_settings，避免直接访问 KV blob。
    const configService = await ConfigService.getInstance(this.store);
    const currentSettings: any = { ...configService.getSettings() };
    const adapters = currentSettings.ADAPTERS || [];

    let rssAdapterConfig = adapterId
      ? adapters.find((adapter: any) => adapter.id === adapterId)
      : adapters.find((adapter: any) => adapter.adapterType === 'RSSAdapter');

    if (!rssAdapterConfig) {
      rssAdapterConfig = {
        id: 'rss-bulk-import',
        name: 'RSS 批量导入',
        adapterType: 'RSSAdapter',
        enabled: true,
        apiUrl: '',
        items: []
      };
      adapters.push(rssAdapterConfig);
    }

    const newItems = feeds.map((feed) => ({
      id: `rss-${crypto.createHash('md5').update(feed.xmlUrl).digest('hex').substring(0, 12)}`,
      name: feed.title,
      enabled: true,
      useProxy: false,
      category: feed.category || 'rss',
      rssUrl: feed.xmlUrl,
      limit: 20
    }));

    const existingUrls = new Set(rssAdapterConfig.items.map((item: any) => item.rssUrl));
    for (const item of newItems) {
      if (!existingUrls.has(item.rssUrl)) {
        rssAdapterConfig.items.push(item);
      }
    }

    const normalizedSettings = new PluginConfigValidator().validateSettings(
      normalizeSettings({ ...currentSettings, ADAPTERS: adapters })
    );
    await configService.updateSettings(normalizedSettings);
    await this.context.reload();

    return { status: 'success', count: feeds.length, added: newItems.length };
  }

  private async normalizeCoverResult(result: any) {
    const urls: string[] = [];

    if (result.data?.urls && Array.isArray(result.data.urls)) {
      urls.push(...result.data.urls);
    } else if (result.data?.url) {
      urls.push(result.data.url);
    }

    if (result.data?.html && urls.length === 0) {
      return { status: 'success', html: result.data.html, isHtml: true };
    }

    const imgUrlMatches = result.content.match(
      /https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|gif|webp|avif)(?:[?#][^\s)]*)?/gi
    );
    if (imgUrlMatches) {
      for (const match of imgUrlMatches) {
        if (!urls.includes(match)) urls.push(match);
      }
    }

    const base64Matches = result.content.match(/data:image\/[a-zA-Z+]+;base64,[a-zA-Z0-9+/=]+/gi);
    if (base64Matches) {
      for (const match of base64Matches) {
        if (!urls.includes(match)) urls.push(match);
      }
    }

    const isLikelyHtml = /<\/(p|div|section|h[1-6]|table|ul|ol|img|br)>/i.test(result.content);
    if (urls.length === 0 && !isLikelyHtml) {
      const generalHttpMatches = result.content.match(/https?:\/\/[^\s)]+/gi);
      if (generalHttpMatches) {
        for (const match of generalHttpMatches) {
          if (!urls.includes(match)) urls.push(match);
        }
      }
    }

    if (urls.length > 0) {
      const processedUrls = await Promise.all(urls.map((url) => this.persistBase64Image(url)));
      const uniqueUrls = Array.from(new Set(processedUrls));
      return { status: 'success', url: uniqueUrls[0], urls: uniqueUrls };
    }

    if (isLikelyHtml || result.data?.html || result.data?.content?.includes('<')) {
      return {
        status: 'success',
        html: result.data?.html || result.data?.content || result.content,
        isHtml: true
      };
    }

    throw new Error('AI 未能成功生成图片 URL 或渲染内容');
  }

  private assertMediaResult(result: any) {
    if (result?.statusCode) {
      throw new AppError(result.statusCode, result.error || 'Media request failed');
    }
  }

  private async persistBase64Image(url: string) {
    if (!url.startsWith('data:image/')) return url;

    try {
      const matches = url.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (!matches) return url;

      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `ai_cover_${crypto.randomBytes(8).toString('hex')}.jpg`;
      const fullPath = path.resolve(os.tmpdir(), filename);

      await sharp(buffer).jpeg({ quality: 80 }).toFile(fullPath);
      LogService.info(`Saved base64 image to temp file: ${fullPath}`);
      return fullPath;
    } catch (error: any) {
      LogService.error(`Failed to save base64 image: ${error.message}`);
      return url;
    }
  }
}
