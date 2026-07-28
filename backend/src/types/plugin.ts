export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select' | 'boolean' | 'textarea' | 'executor';
  options?: string[];
  default?: any;
  required?: boolean;
  scope?: 'adapter' | 'item'; // 增加作用域区分
}

/**
 * Publisher 运行时依赖。
 * PluginRuntime 在 publisher 实例化之后调用 `bindRuntime`（如果实现了），
 * 让 publisher 拿到 store / settings 等运行时依赖，避免内部再 `await ServiceContext.getInstance()`。
 *
 * 字段保持最小：仅暴露 publisher 真正用到的能力。需要更多依赖时，按需扩展，
 * 但**不要**把整个 ServiceContext 注入回来。
 */
export interface PublisherRuntime {
  // 为了避免在 types/plugin.ts 引入对 services 层的 import，这里用 unknown 占位；
  // 实现侧（LocalSitePublisher 等）按需向下转型为具体 Port。
  store: unknown;
}

export interface IPublisher {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  configFields: ConfigField[];
  publish(content: any, options?: any): Promise<any>;
  getItemUrl?(item: any): string;
  /** 由 PluginRuntime 在实例化之后调用；可选。 */
  bindRuntime?(runtime: PublisherRuntime): void;
}

export interface IStorageProvider {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  configFields: ConfigField[];
  upload(localPath: string, targetPath: string): Promise<string | null>;
}
