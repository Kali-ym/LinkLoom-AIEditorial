import type { ProxyAgent } from 'undici';
import { AdapterRegistry } from '../../registries/AdapterRegistry.js';
import { PublisherRegistry } from '../../registries/PublisherRegistry.js';
import { StorageRegistry } from '../../registries/StorageRegistry.js';
import type { SystemSettings } from '../../types/config.js';
import type { IPublisher, IStorageProvider } from '../../types/plugin.js';
import type { AgentService } from '../agents/AgentService.js';
import type { WorkflowEngine } from '../agents/WorkflowEngine.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import type { TranslationService } from '../TranslationService.js';
import { PluginAvailabilityService } from './PluginAvailabilityService.js';
import { PluginConfigValidator } from './PluginConfigValidator.js';

export interface PluginRuntimeDeps {
  proxyAgent?: ProxyAgent;
  translationService?: TranslationService;
  agentService?: AgentService | null;
  workflowEngine?: WorkflowEngine | null;
  /** Publisher 实例化后 bindRuntime 用到的 store。 */
  store?: LocalStore;
}

export interface PluginRuntimeInstances {
  adapterInstances: any[];
  publisherInstances: IPublisher[];
  storageInstances: IStorageProvider[];
}

export class PluginRuntime {
  constructor(
    settings: SystemSettings,
    private readonly deps: PluginRuntimeDeps = {}
  ) {
    this.settings = new PluginConfigValidator().validateSettings(settings);
    this.availability = new PluginAvailabilityService(this.settings);
  }

  private readonly settings: SystemSettings;
  private readonly availability: PluginAvailabilityService;

  initialize(): PluginRuntimeInstances {
    return {
      adapterInstances: this.initAdapters(),
      publisherInstances: this.initPublishers(),
      storageInstances: this.initStorages()
    };
  }

  private initAdapters(): any[] {
    const instances: any[] = [];
    const configs = this.settings.ADAPTERS || [];
    const registry = AdapterRegistry.getInstance();

    for (const config of configs) {
      if (!config.enabled) continue;

      if (!this.availability.isAdapterEnabled(config.adapterType)) {
        LogService.info(
          `Adapter type ${config.adapterType} is disabled in CLOSED_PLUGINS, skipping`
        );
        continue;
      }

      const AdapterClass = registry.get(config.adapterType);
      if (!AdapterClass) {
        LogService.warn(`Adapter type ${config.adapterType} not found in registry`);
        continue;
      }

      for (const item of config.items || []) {
        if (!item.enabled) continue;
        try {
          const adapter = new (AdapterClass as any)(item.name, item.category, {
            ...item,
            fetchDays: config.fetchDays
          });

          if (typeof adapter.setAgentService === 'function' && this.deps.agentService) {
            adapter.setAgentService(this.deps.agentService);
          }
          if (typeof adapter.setWorkflowEngine === 'function' && this.deps.workflowEngine) {
            adapter.setWorkflowEngine(this.deps.workflowEngine);
          }

          adapter.apiUrl = config.apiUrl;
          adapter.adapterConfigId = config.id;
          if (config.foloCookie) adapter.foloCookie = config.foloCookie;
          adapter.dispatcher = item.useProxy ? this.deps.proxyAgent : undefined;

          if (this.deps.translationService) {
            adapter.translationService = this.deps.translationService;
            adapter.enableTranslation = item.enableTranslation;
          }

          instances.push(adapter);
        } catch (e) {
          LogService.error(
            `Failed to init adapter ${item.name} of type ${config.adapterType}: ${e}`
          );
        }
      }
    }
    return instances;
  }

  private initPublishers(): IPublisher[] {
    const instances: IPublisher[] = [];
    const registry = PublisherRegistry.getInstance();
    const configs = this.settings.PUBLISHERS || [];

    for (const pubConfig of configs) {
      if (!pubConfig.enabled) continue;

      if (!this.availability.isPublisherEnabled(pubConfig.id)) {
        LogService.info(`Publisher ${pubConfig.id} is disabled in CLOSED_PLUGINS, skipping`);
        continue;
      }

      const PublisherClass = registry.get(pubConfig.id);
      if (PublisherClass) {
        try {
          const instance = new PublisherClass(pubConfig.config);
          if (typeof instance.bindRuntime === 'function' && this.deps.store) {
            instance.bindRuntime({ store: this.deps.store });
          }
          instances.push(instance);
        } catch (e) {
          LogService.error(`Failed to init publisher ${pubConfig.id}: ${e}`);
        }
      } else {
        LogService.warn(`Publisher ${pubConfig.id} not found in registry`);
      }
    }

    return instances;
  }

  private initStorages(): IStorageProvider[] {
    const instances: IStorageProvider[] = [];
    const registry = StorageRegistry.getInstance();
    const configs = this.settings.STORAGES || [];

    for (const storageConfig of configs) {
      if (!storageConfig.enabled) continue;

      if (!this.availability.isStorageEnabled(storageConfig.id)) {
        LogService.info(`Storage ${storageConfig.id} is disabled in CLOSED_PLUGINS, skipping`);
        continue;
      }

      const StorageClass = registry.get(storageConfig.id);
      if (StorageClass) {
        try {
          instances.push(new StorageClass(storageConfig.config));
        } catch (e) {
          LogService.error(`Failed to init storage ${storageConfig.id}: ${e}`);
        }
      } else {
        LogService.warn(`Storage ${storageConfig.id} not found in registry`);
      }
    }

    return instances;
  }
}
