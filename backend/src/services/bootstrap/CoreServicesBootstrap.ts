import { ProxyAgent } from 'undici';
import type { SystemSettings } from '../../types/config.js';
import type { IPublisher, IStorageProvider } from '../../types/plugin.js';
import { AgentService } from '../agents/AgentService.js';
import { LocalStoreAgentRunRegistry } from '../agents/engine/AgentRunRegistry.js';
import { MCPService } from '../agents/MCPService.js';
import { SkillService } from '../agents/SkillService.js';
import { WorkflowEngine } from '../agents/WorkflowEngine.js';
import { WorkflowOrchestrationService } from '../agents/WorkflowOrchestrationService.js';
import { LocalStoreWorkflowRunRegistry } from '../agents/WorkflowRunRegistry.js';
import type { AIProvider } from '../AIProvider.js';
import { AIService } from '../AIService.js';
import { ExecutionService } from '../ExecutionService.js';
import { ImportService } from '../ImportService.js';
import { InteropService } from '../interop/InteropService.js';
import { KnowledgeBaseService } from '../knowledge/KnowledgeBaseService.js';
import { AgentSandboxIdleReaper } from '../agents/sandbox/AgentSandboxIdleReaper.js';
import { createAgentSandboxRuntime } from '../agents/sandbox/AgentSandboxRuntime.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import { MediaProxyService } from '../MediaProxyService.js';
import { MemoryService } from '../memory/MemoryService.js';
import { RagEmbeddingJobRunner } from '../rag/RagEmbeddingJobRunner.js';
import { PluginMetadataService } from '../plugins/PluginMetadataService.js';
import { PluginRuntime } from '../plugins/PluginRuntime.js';
import { SchedulerService } from '../SchedulerService.js';
import { TaskService } from '../TaskService.js';
import { TranslationService } from '../TranslationService.js';

export interface CoreServices {
  aiService: AIService | null;
  translationService: TranslationService;
  importService: ImportService;
  taskService: TaskService;
  schedulerService: SchedulerService;
  agentService: AgentService | null;
  memoryService: MemoryService;
  knowledgeBaseService: KnowledgeBaseService;
  mcpService: MCPService;
  workflowEngine: WorkflowEngine | null;
  workflowRunRegistry: LocalStoreWorkflowRunRegistry;
  workflowOrchestrationService: WorkflowOrchestrationService | null;
  skillService: SkillService;
  interopService: InteropService;
  executionService: ExecutionService;
  pluginMetadataService: PluginMetadataService;
  mediaProxyService: MediaProxyService;
  adapterInstances: any[];
  publisherInstances: IPublisher[];
  storageInstances: IStorageProvider[];
}

export async function bootstrapCoreServices(
  store: LocalStore,
  settings: SystemSettings,
  aiProvider: AIProvider | undefined,
  proxyAgent?: ProxyAgent
): Promise<CoreServices> {
  const aiService = aiProvider ? new AIService(aiProvider, settings) : null;
  const translationService = new TranslationService(aiProvider);
  const importService = new ImportService(store);

  const skillService = new SkillService();
  await skillService.init();

  const mcpService = new MCPService(proxyAgent);
  const runRegistry = new LocalStoreAgentRunRegistry(store);
  const agentService = aiProvider
    ? new AgentService(store, aiProvider, skillService, mcpService, proxyAgent, runRegistry, settings)
    : null;

  const queueLeaseStaleMs = resolvePositiveMs(settings.AGENT_RUN_CONFIG?.queueLeaseStaleMs, 60_000);

  // Deterministic startup recovery order:
  // 1) requeue stale durable leases;
  // 2) mark only true orphan runs as interrupted;
  // 3) start listeners/workers.
  // This prevents the same run from being marked failed while its queue row is also
  // reset back to pending and later claimed by a worker.
  const agentRunQueueRepo = (store as { repositories?: { agentRunQueue?: { resetStaleLeases: (ms: number) => Promise<number> } } })
    .repositories?.agentRunQueue;
  if (agentRunQueueRepo) {
    try {
      const count = await agentRunQueueRepo.resetStaleLeases(queueLeaseStaleMs);
      if (count > 0) LogService.info(`Reclaimed ${count} stale agent run queue lease(s) on startup`);
    } catch (err: any) {
      LogService.warn(`Agent run queue stale lease reset failed: ${err?.message || err}`);
    }
  }

  try {
    const recovered = await runRegistry.recoverInterruptedRuns([], { queueLeaseStaleMs });
    if (recovered.length > 0) {
      LogService.info(`Recovered ${recovered.length} interrupted agent run(s) on startup`);
    }
  } catch (err: any) {
    LogService.warn(`Agent run interruption recovery failed: ${err?.message || err}`);
  }

  if (agentService) {
    agentService
      .startEventChannel()
      .catch((err) => LogService.warn(`Agent run event channel start failed: ${err?.message || err}`));
    agentService.startRunQueueWorker();
  }

  const memoryService = new MemoryService(store, agentService);
  const knowledgeBaseService = new KnowledgeBaseService(store, agentService, () => settings);
  new RagEmbeddingJobRunner(store, () => settings)
    .resetStaleJobs()
    .catch((err) => LogService.warn(`RAG stale embedding jobs reset failed: ${err?.message || err}`));

  const sandboxRuntime = createAgentSandboxRuntime(store);
  if (sandboxRuntime) {
    sandboxRuntime.pool
      .reconcile()
      .catch((err) => LogService.warn(`Agent sandbox reconcile failed: ${err?.message || err}`));
    new AgentSandboxIdleReaper({
      pool: sandboxRuntime.pool,
      store: sandboxRuntime.store
    }).start();
  }

  const workflowEngine =
    agentService && aiProvider ? new WorkflowEngine(store, agentService, aiProvider) : null;
  const workflowRunRegistry = new LocalStoreWorkflowRunRegistry(store);
  const workflowOrchestrationService = workflowEngine
    ? new WorkflowOrchestrationService(store, workflowEngine, workflowRunRegistry)
    : null;

  const { adapterInstances, publisherInstances, storageInstances } = new PluginRuntime(settings, {
    proxyAgent,
    translationService,
    agentService,
    workflowEngine,
    store
  }).initialize();

  const taskService = new TaskService(
    adapterInstances,
    store,
    aiProvider,
    publisherInstances,
    settings
  );
  if (workflowEngine) {
    workflowEngine.attachTaskService(taskService);
  }
  const schedulerService = new SchedulerService(store, taskService, workflowOrchestrationService);
  const interopService = new InteropService(
    store,
    agentService,
    skillService,
    workflowEngine,
    schedulerService,
    settings
  );
  const executionService = new ExecutionService({ settings, agentService, workflowEngine });
  const pluginMetadataService = new PluginMetadataService();
  const mediaProxyService = new MediaProxyService(proxyAgent);

  return {
    aiService,
    translationService,
    importService,
    taskService,
    schedulerService,
    agentService,
    memoryService,
    knowledgeBaseService,
    mcpService,
    workflowEngine,
    workflowRunRegistry,
    workflowOrchestrationService,
    skillService,
    interopService,
    executionService,
    pluginMetadataService,
    mediaProxyService,
    adapterInstances,
    publisherInstances,
    storageInstances
  };
}

function resolvePositiveMs(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}
