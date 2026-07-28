import { AppError } from '../../domain/errors.js';
import { createAIProvider } from '../AIProvider.js';
import { AIService } from '../AIService.js';
import { LogService } from '../LogService.js';
import type { ServiceContext } from '../ServiceContext.js';
import { resolveProviderConfigForRuntime } from '../settingsSecurity.js';

export class DashboardRouteService {
  constructor(private readonly context: ServiceContext) {}

  getStats() {
    return this.context.taskService.getStats();
  }

  getAdapterStatus() {
    return this.context.taskService.getAdapterStatus();
  }

  async syncAdapter(name: string, body: any) {
    const { date, ...config } = body || {};
    const adapter = this.context.adapterInstances.find((instance: any) => instance.name === name);
    if (adapter && adapter.useProxy !== undefined && config.useProxy === undefined) {
      config.useProxy = adapter.useProxy;
    }

    await this.context.taskService.runSingleAdapterIngestion(name, date, config);
    return { status: 'success' };
  }

  async clearAdapter(name: string, date?: string) {
    await this.context.taskService.clearAdapterData(name, date);
    return { status: 'success' };
  }

  getLogs() {
    return LogService.getLogs();
  }

  async listModels(config: any) {
    const provider = this.createProviderFromConfig(config);
    if (!provider) {
      throw new AppError(400, 'Invalid provider configuration');
    }
    if (!provider.listModels) {
      return [];
    }
    return await provider.listModels();
  }

  async testProvider(config: any) {
    try {
      const provider = this.createProviderFromConfig(config);
      if (!provider) {
        return { status: 'error', message: '无效的提供商配置' };
      }
      const aiService = new AIService(provider, this.context.settings);
      return await aiService.testConnection();
    } catch (error: any) {
      return { status: 'error', message: error.message };
    }
  }

  private createProviderFromConfig(config: any) {
    const resolved = this.effectiveProviderConfig(config);
    const dispatcher = resolved.useProxy === true ? this.context.proxyAgent : undefined;
    return createAIProvider(resolved, dispatcher);
  }

  private effectiveProviderConfig(config: any): Record<string, any> {
    const resolved = resolveProviderConfigForRuntime(
      config || {},
      this.context.settings || ({} as any)
    );
    return {
      ...resolved,
      model: resolved.model || (resolved.models && (resolved.models as string[])[0])
    };
  }
}
