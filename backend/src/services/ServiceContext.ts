import { ToolRegistry } from '../registries/ToolRegistry.js';
import { SystemSettings } from '../types/config.js';
import { AIProvider } from './AIProvider.js';
import { GatewayService } from './gateway/GatewayService.js';
import { initServices, AppServices } from './initServices.js';
import { LocalStore } from './LocalStore.js';
import { LogService } from './LogService.js';
import { createToolExecutionContext } from './ToolExecutionContext.js';

export class ServiceContext {
  private static instance: ServiceContext;
  private store: LocalStore;
  private services!: AppServices;

  private constructor(store: LocalStore) {
    this.store = store;
  }

  public static async getInstance(store?: LocalStore): Promise<ServiceContext> {
    if (!ServiceContext.instance && store) {
      ServiceContext.instance = new ServiceContext(store);
      await ServiceContext.instance.reload();
    }
    return ServiceContext.instance;
  }

  public async reload() {
    LogService.info('Reloading services with latest configuration...');

    const previousServices = this.services;
    const nextServices = await initServices(this.store);

    if (previousServices?.schedulerService) {
      previousServices.schedulerService.stopAll();
    }
    if (previousServices?.mcpService) {
      await previousServices.mcpService.disconnectAll();
    }

    this.services = nextServices;

    // 让 ToolRegistry 在工具未显式接收 ctx 时能从最新 ServiceContext 构造默认 ctx，
    // 替代旧的 `await ServiceContext.getInstance()` 散落写法。
    ToolRegistry.getInstance().setDefaultContextSupplier(async () =>
      createToolExecutionContext(this)
    );
  }

  public get taskService() {
    return this.services.taskService;
  }

  public get localStore() {
    return this.store;
  }

  public get schedulerService() {
    return this.services.schedulerService;
  }

  public get translationService() {
    return this.services.translationService;
  }

  public get importService() {
    return this.services.importService;
  }

  public get aiProvider(): AIProvider | undefined {
    return this.services.aiProvider;
  }

  public get settings(): SystemSettings {
    return this.services.settings;
  }

  public get configService() {
    return this.services.configService;
  }

  public get agentService() {
    return this.services.agentService;
  }

  public get memoryService() {
    return this.services.memoryService;
  }

  public get knowledgeBaseService() {
    return this.services.knowledgeBaseService;
  }

  public get mcpService() {
    return this.services.mcpService;
  }

  public get skillService() {
    return this.services.skillService;
  }

  public get interopService() {
    return this.services.interopService;
  }

  public get executionService() {
    return this.services.executionService;
  }

  public get pluginMetadataService() {
    return this.services.pluginMetadataService;
  }

  public get mediaProxyService() {
    return this.services.mediaProxyService;
  }

  public get workspaceStateService() {
    return this.services.workspaceStateService;
  }

  public get webBrowsingService() {
    return this.services.webBrowsingService;
  }

  public get workflowEngine() {
    return this.services.workflowEngine;
  }

  public get workflowRunRegistry() {
    return this.services.workflowRunRegistry;
  }

  public get workflowOrchestrationService() {
    return this.services.workflowOrchestrationService;
  }

  public get proxyAgent() {
    return this.services.proxyAgent;
  }

  public get adapterInstances() {
    return this.services.adapterInstances;
  }

  public get publisherInstances() {
    return this.services.publisherInstances;
  }

  public get storageInstances() {
    return this.services.storageInstances;
  }

  // --- PR3: Agent Gateway ---
  // Lazily constructed because we need the PgConnection that the local store
  // exposes; it isn't guaranteed to be ready before reload() finishes in all
  // tests. ServiceContext.getInstance().gateway is the supported entry point.
  public get gateway(): GatewayService {
    if (!this._gateway) {
      const conn = this.store.getConnection?.();
      if (!conn) {
        throw new Error('PgConnection not available; gateway disabled.');
      }
      const agentService = this.agentService;
      if (!agentService) {
        throw new Error('AgentService not initialized; gateway disabled.');
      }
      this._gateway = new GatewayService({
        conn,
        agentService,
        systemAgentId: process.env.LINKLOOM_GATEWAY_SYSTEM_AGENT_ID,
      });
    }
    return this._gateway;
  }
  private _gateway: GatewayService | undefined;
}
