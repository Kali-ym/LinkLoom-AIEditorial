import { normalizeSettings } from '../../config/normalizeSettings.js';
import { AppError } from '../../domain/errors.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import { PluginConfigValidator } from '../plugins/PluginConfigValidator.js';
import type { ServiceContext } from '../ServiceContext.js';
import {
  applyAuthoritativeArraySnapshots,
  maskSettingsForResponse,
  mergeSettingsUpdate
} from '../settingsSecurity.js';

export class SettingsRouteService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  getSettings() {
    return maskSettingsForResponse(this.context.settings || ({} as any));
  }

  getPluginMetadata() {
    return this.context.pluginMetadataService.listAll();
  }

  async saveSettings(newSettings: any) {
    const currentSettings =
      this.context.settings || (await this.store.get('system_settings')) || {};
    const merged = mergeSettingsUpdate(currentSettings, newSettings);
    const updatedSettings = applyAuthoritativeArraySnapshots(currentSettings, newSettings, merged);

    LogService.info(
      `Saving settings - CLOSED_PLUGINS before: ${JSON.stringify(currentSettings.CLOSED_PLUGINS || [])}`
    );
    LogService.info(
      `Saving settings - CLOSED_PLUGINS after: ${JSON.stringify(updatedSettings.CLOSED_PLUGINS || [])}`
    );

    const normalizedSettings = new PluginConfigValidator().validateSettings(
      normalizeSettings(updatedSettings)
    );
    await this.store.put('system_settings', normalizedSettings);

    const savedSettings = await this.store.get('system_settings');
    LogService.info(
      `Saved settings - CLOSED_PLUGINS verified: ${JSON.stringify(savedSettings.CLOSED_PLUGINS || [])}`
    );

    await this.context.reload();
    return { status: 'success' };
  }

  async listApiKeys(isApiKeyAuth: boolean) {
    this.assertNotApiKeyAuth(isApiKeyAuth);
    return await this.store.listApiKeys();
  }

  async createApiKey(isApiKeyAuth: boolean, name: string | undefined, status?: string) {
    this.assertNotApiKeyAuth(isApiKeyAuth);
    if (!name) {
      throw new AppError(400, 'Missing name');
    }
    return await this.context.interopService.createApiKey({ name, status: status || 'active' });
  }

  async updateApiKey(isApiKeyAuth: boolean, id: string, data: any) {
    this.assertNotApiKeyAuth(isApiKeyAuth);
    await this.context.interopService.updateApiKey(id, data);
    return { status: 'success' };
  }

  async deleteApiKey(isApiKeyAuth: boolean, id: string) {
    this.assertNotApiKeyAuth(isApiKeyAuth);
    await this.store.deleteApiKey(id);
    return { status: 'success' };
  }

  private assertNotApiKeyAuth(isApiKeyAuth: boolean) {
    if (isApiKeyAuth) {
      throw new AppError(403, 'Forbidden');
    }
  }
}
