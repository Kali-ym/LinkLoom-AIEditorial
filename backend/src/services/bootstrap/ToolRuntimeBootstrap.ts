import { ToolRegistry } from '../../registries/ToolRegistry.js';
import type { SystemSettings } from '../../types/config.js';
import { LogService } from '../LogService.js';
import { PluginAvailabilityService } from '../plugins/PluginAvailabilityService.js';

export function bootstrapToolRuntime(settings?: Pick<SystemSettings, 'CLOSED_PLUGINS'>) {
  const toolRegistry = ToolRegistry.getInstance();
  const availability = new PluginAvailabilityService(settings || { CLOSED_PLUGINS: [] });
  for (const toolId of toolRegistry.getAll()) {
    if (!availability.isToolEnabled(toolId)) {
      LogService.info(`Tool ${toolId} is disabled in CLOSED_PLUGINS, skipping`);
      continue;
    }

    const ToolClass = toolRegistry.get(toolId);
    const metadata = toolRegistry.getMetadata(toolId);
    if (!ToolClass) {
      LogService.warn(`Tool ${toolId} has no registered constructor, skipping`);
      continue;
    }

    try {
      const instance = new (ToolClass as any)();
      if (metadata) {
        instance.isBuiltin = metadata.isBuiltin;
      }
      toolRegistry.registerTool(instance);
    } catch (error: any) {
      LogService.error(
        `Failed to init tool ${toolId} (${ToolClass.name || 'anonymous'}): ${error.message}`
      );
    }
  }
}
