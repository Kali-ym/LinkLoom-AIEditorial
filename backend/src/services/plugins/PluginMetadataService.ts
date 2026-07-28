import { AdapterRegistry } from '../../registries/AdapterRegistry.js';
import { PublisherRegistry } from '../../registries/PublisherRegistry.js';
import { StorageRegistry } from '../../registries/StorageRegistry.js';
import { ToolRegistry } from '../../registries/ToolRegistry.js';

export class PluginMetadataService {
  listAll() {
    return {
      adapters: AdapterRegistry.getInstance().listMetadata(),
      publishers: PublisherRegistry.getInstance().listMetadata(),
      storages: StorageRegistry.getInstance().listMetadata(),
      tools: ToolRegistry.getInstance().listMetadata()
    };
  }
}
