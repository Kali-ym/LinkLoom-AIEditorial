import { AdapterRegistry } from '../../registries/AdapterRegistry.js';
import { PublisherRegistry } from '../../registries/PublisherRegistry.js';
import { StorageRegistry } from '../../registries/StorageRegistry.js';
import { ToolRegistry } from '../../registries/ToolRegistry.js';
import type { SystemSettings } from '../../types/config.js';

export class PluginAvailabilityService {
  private readonly closedPlugins: Set<string>;

  constructor(settings: Pick<SystemSettings, 'CLOSED_PLUGINS'>) {
    this.closedPlugins = new Set(settings.CLOSED_PLUGINS || []);
  }

  isAdapterEnabled(adapterType: string) {
    return !this.closedPlugins.has(adapterType);
  }

  isPublisherEnabled(id: string) {
    return !this.closedPlugins.has(id);
  }

  isStorageEnabled(id: string) {
    return !this.closedPlugins.has(id);
  }

  isToolEnabled(id: string) {
    return !this.closedPlugins.has(id);
  }

  isKnownPluginId(id: string) {
    return (
      AdapterRegistry.getInstance().list().includes(id) ||
      PublisherRegistry.getInstance().list().includes(id) ||
      StorageRegistry.getInstance().list().includes(id) ||
      ToolRegistry.getInstance().getAll().includes(id)
    );
  }
}
