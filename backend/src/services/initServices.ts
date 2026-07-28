import { ProxyAgent } from 'undici';
import { initRegistries } from '../registries/PluginInit.js';
import type { SystemSettings } from '../types/config.js';
import type { IPublisher, IStorageProvider } from '../types/plugin.js';
import { AgentService } from './agents/AgentService.js';
import { MCPService } from './agents/MCPService.js';
import { PromptRegistry } from './agents/prompt/registry/PromptRegistry.js';
import { SkillService } from './agents/SkillService.js';
import { syncSkillsFromFilesystem } from './agents/SkillSyncService.js';
import { WorkflowEngine } from './agents/WorkflowEngine.js';
import { WorkspaceStateService } from './agents/workspace/WorkspaceStateService.js';
import { AIProvider } from './AIProvider.js';
import { AIService } from './AIService.js';
import { WorkflowTemplateRouteService } from './api/WorkflowTemplateRouteService.js';
import { bootstrapCoreServices } from './bootstrap/CoreServicesBootstrap.js';
import { bootstrapSettings } from './bootstrap/SettingsBootstrap.js';
import { bootstrapToolRuntime } from './bootstrap/ToolRuntimeBootstrap.js';
import { ConfigService } from './ConfigService.js';
import { EditorialAgentsService } from './editorial/EditorialAgentsService.js';
import { EDITORIAL_PROMPTS } from './editorial/editorialPrompts.js';
import { ExecutionService } from './ExecutionService.js';
import { ImportService } from './ImportService.js';
import { InteropService } from './interop/InteropService.js';
import { KnowledgeBaseService } from './knowledge/KnowledgeBaseService.js';
import { LocalStore } from './LocalStore.js';
import { LogService } from './LogService.js';
import { MediaProxyService } from './MediaProxyService.js';
import { MemoryService } from './memory/MemoryService.js';
import { PluginMetadataService } from './plugins/PluginMetadataService.js';
import { PromptService } from './PromptService.js';
import { SchedulerService } from './SchedulerService.js';
import { normalizeStoredWorkflows } from './seeders/WorkflowNormalizationSeeder.js';
import { TaskService } from './TaskService.js';
import { TranslationService } from './TranslationService.js';
import { WebBrowsingService } from './web/WebBrowsingService.js';
import { resolveOutboundProxyAgent } from './web/resolveOutboundProxy.js';

export interface AppServices {
  settings: SystemSettings;
  configService: ConfigService;
  aiProvider: AIProvider | undefined;
  aiService: AIService | null;
  translationService: TranslationService;
  importService: ImportService;
  promptService: PromptService;
  taskService: TaskService;
  schedulerService: SchedulerService;
  agentService: AgentService | null;
  memoryService: MemoryService;
  knowledgeBaseService: KnowledgeBaseService;
  mcpService: MCPService;
  workflowEngine: WorkflowEngine | null;
  workflowRunRegistry: import('./agents/WorkflowRunRegistry.js').LocalStoreWorkflowRunRegistry;
  workflowOrchestrationService: import('./agents/WorkflowOrchestrationService.js').WorkflowOrchestrationService | null;
  skillService: SkillService;
  interopService: InteropService;
  executionService: ExecutionService;
  pluginMetadataService: PluginMetadataService;
  mediaProxyService: MediaProxyService;
  workspaceStateService: WorkspaceStateService | null;
  webBrowsingService: WebBrowsingService;
  adapterInstances: any[];
  publisherInstances: IPublisher[];
  storageInstances: IStorageProvider[];
  proxyAgent?: ProxyAgent;
}

export async function initServices(store: LocalStore): Promise<AppServices> {
  await initRegistries();

  const promptService = PromptService.getInstance();
  await promptService.loadTemplates();

  // 把 editorial 结构化 prompt 注册到 registry,供 workflow 模板通过
  // structuredPromptRef: 'topic_copilot' 等引用
  const registry = PromptRegistry.getInstance();
  for (const [id, prompt] of Object.entries(EDITORIAL_PROMPTS)) {
    registry.registerStructuredPrompt(id, prompt);
  }

  const { configService, settings, proxyAgent, aiProvider } = await bootstrapSettings(store);
  bootstrapToolRuntime(settings);

  const core = await bootstrapCoreServices(store, settings, aiProvider, proxyAgent);

  if (core.agentService) {
    await normalizeStoredWorkflows(store);
    await new WorkflowTemplateRouteService(store, settings).repairMissingTemplateAgents();
  }

  await syncSkillsFromFilesystem(store, core.skillService);

  if (core.agentService) {
    const editorialAgents = new EditorialAgentsService(store);
    await editorialAgents.ensureBuiltinAgents();
  }

  core.taskService
    .initStatus()
    .catch((err) => LogService.error(`Failed to init task status: ${err?.message || err}`));
  core.schedulerService
    .init()
    .catch((err) => LogService.error(`Failed to init scheduler: ${err?.message || err}`));

  const workspaceStateService = core.agentService
    ? new WorkspaceStateService(
        (runId) => core.agentService!.getRunSession(runId),
        (session) => core.agentService!.saveRunSession(session),
      )
    : null;

  const webBrowsingService = new WebBrowsingService({
    jinaApiKey: process.env.JINA_API_KEY,
    dispatcher: resolveOutboundProxyAgent(proxyAgent),
  });

  return {
    settings,
    configService,
    aiProvider,
    promptService,
    proxyAgent,
    workspaceStateService,
    webBrowsingService,
    ...core
  };
}
