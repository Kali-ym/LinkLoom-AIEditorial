import { AdapterRegistry } from '../../registries/AdapterRegistry.js';
import { PublisherRegistry } from '../../registries/PublisherRegistry.js';
import { StorageRegistry } from '../../registries/StorageRegistry.js';
import type {
  AdapterConfig,
  PublisherConfig,
  StorageConfig,
  SystemSettings
} from '../../types/config.js';
import { LogService } from '../LogService.js';
import { PluginAvailabilityService } from './PluginAvailabilityService.js';

export class PluginConfigValidator {
  validateSettings(settings: SystemSettings): SystemSettings {
    return {
      ...settings,
      ADAPTERS: this.validateAdapters(settings.ADAPTERS || []),
      PUBLISHERS: this.validatePublishers(settings.PUBLISHERS || []),
      STORAGES: this.validateStorages(settings.STORAGES || []),
      CLOSED_PLUGINS: this.validateClosedPlugins(settings.CLOSED_PLUGINS || [])
    };
  }

  private validateAdapters(configs: AdapterConfig[]): AdapterConfig[] {
    const registry = AdapterRegistry.getInstance();
    return configs.filter((config) => {
      const ok = Boolean(config?.adapterType && registry.get(config.adapterType));
      if (!ok)
        LogService.warn(
          `Ignoring invalid adapter config: ${config?.adapterType || config?.id || 'unknown'}`
        );
      return ok;
    });
  }

  private validatePublishers(configs: PublisherConfig[]): PublisherConfig[] {
    const registry = PublisherRegistry.getInstance();
    return configs.filter((config) => {
      const ok = Boolean(config?.id && registry.get(config.id));
      if (!ok) LogService.warn(`Ignoring invalid publisher config: ${config?.id || 'unknown'}`);
      return ok;
    });
  }

  private validateStorages(configs: StorageConfig[]): StorageConfig[] {
    const registry = StorageRegistry.getInstance();
    return configs.filter((config) => {
      const ok = Boolean(config?.id && registry.get(config.id));
      if (!ok) LogService.warn(`Ignoring invalid storage config: ${config?.id || 'unknown'}`);
      return ok;
    });
  }

  private validateClosedPlugins(ids: string[]): string[] {
    const availability = new PluginAvailabilityService({ CLOSED_PLUGINS: [] });

    return ids.filter((id) => {
      const ok = availability.isKnownPluginId(id);
      if (!ok) LogService.warn(`Ignoring invalid closed plugin id: ${id}`);
      return ok;
    });
  }
}
