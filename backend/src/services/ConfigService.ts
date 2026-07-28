import { normalizeSettings } from '../config/normalizeSettings.js';
import { SystemSettings } from '../types/config.js';
import { LocalStore } from './LocalStore.js';

export class ConfigService {
  private static instance: ConfigService;
  private settings: SystemSettings;
  private store: LocalStore;

  private constructor(store: LocalStore) {
    this.store = store;
    this.settings = normalizeSettings();
  }

  public static async getInstance(store: LocalStore): Promise<ConfigService> {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService(store);
    } else {
      // 确保单例持有当前 store 引用（同进程通常一致，这里做防御性处理）
      ConfigService.instance.store = store;
    }

    // 每次获取实例时都从持久化层重新加载，避免热重载后读取到旧缓存
    await ConfigService.instance.load();
    return ConfigService.instance;
  }

  /**
   * 加载配置：合并 默认配置 -> 环境变量 -> 数据库持久化配置
   */
  public async load(): Promise<SystemSettings> {
    const storedSettings = await this.store.get('system_settings');
    const envSettings: Partial<SystemSettings> = {};
    if (process.env.SYSTEM_PASSWORD) {
      envSettings.SYSTEM_PASSWORD = process.env.SYSTEM_PASSWORD;
    }
    if (process.env.AUTH_EXPIRE_TIME) {
      envSettings.AUTH_EXPIRE_TIME = process.env.AUTH_EXPIRE_TIME;
    }
    if (process.env.AI_BUILDER_POLICY_SECRET) {
      envSettings.AI_BUILDER_POLICY_SECRET = process.env.AI_BUILDER_POLICY_SECRET;
    }

    this.settings = normalizeSettings({ ...(storedSettings || {}), ...envSettings });

    return this.settings;
  }

  public getSettings(): SystemSettings {
    return this.settings;
  }

  public async updateSettings(newSettings: Partial<SystemSettings>): Promise<void> {
    this.settings = normalizeSettings({ ...this.settings, ...newSettings });
    await this.save();
  }

  private async save(): Promise<void> {
    await this.store.put('system_settings', this.settings);
  }
}
