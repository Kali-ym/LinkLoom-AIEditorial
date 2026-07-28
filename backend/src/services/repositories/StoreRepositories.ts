import { AgentRepository } from './AgentRepository.js';
import { AgentSandboxInstanceRepository } from './AgentSandboxInstanceRepository.js';
import { AgentEventRepository } from './AgentEventRepository.js';
import { AgentRunQueueRepository } from './AgentRunQueueRepository.js';
import { AgentRunRepository } from './AgentRunRepository.js';
import { AgentSessionRepository } from './AgentSessionRepository.js';
import { ApiKeyRepository } from './ApiKeyRepository.js';
import { ConfigRepository } from './ConfigRepository.js';
import { DailyCoverageRepository } from './DailyCoverageRepository.js';
import type { PgConnection } from './DatabaseConnection.js';
import { HistoryRepository } from './HistoryRepository.js';
import { HotEventSnapshotRepository } from './HotEventSnapshotRepository.js';
import { HotEmbedCacheRepository } from './HotEmbedCacheRepository.js';
import { KnowledgeRepository } from './KnowledgeRepository.js';
import { MemoryRepository } from './MemoryRepository.js';
import { PublicationHistoryRepository } from './PublicationHistoryRepository.js';
import { ScheduleRepository } from './ScheduleRepository.js';
import { SourceDataRepository } from './SourceDataRepository.js';

export { AgentSandboxInstanceRepository } from './AgentSandboxInstanceRepository.js';
export { AgentEventRepository } from './AgentEventRepository.js';
export { AgentRunQueueRepository } from './AgentRunQueueRepository.js';
export { AgentRunRepository } from './AgentRunRepository.js';
export { AgentSessionRepository } from './AgentSessionRepository.js';
export { DailyCoverageRepository } from './DailyCoverageRepository.js';
export { HotEventSnapshotRepository } from './HotEventSnapshotRepository.js';
export { HotEmbedCacheRepository } from './HotEmbedCacheRepository.js';
export { ApiKeyRepository } from './ApiKeyRepository.js';
export { ConfigRepository } from './ConfigRepository.js';
export { HistoryRepository } from './HistoryRepository.js';
export { KnowledgeRepository } from './KnowledgeRepository.js';
export { MemoryRepository } from './MemoryRepository.js';
export { PublicationHistoryRepository } from './PublicationHistoryRepository.js';
export { ScheduleRepository } from './ScheduleRepository.js';
export { SourceDataRepository } from './SourceDataRepository.js';

export interface StoreRepositories {
  config: ConfigRepository;
  sourceData: SourceDataRepository;
  history: HistoryRepository;
  agents: AgentRepository;
  agentSandboxInstances: AgentSandboxInstanceRepository;
  agentEvents: AgentEventRepository;
  agentRuns: AgentRunRepository;
  agentRunQueue: AgentRunQueueRepository;
  agentSessions: AgentSessionRepository;
  schedules: ScheduleRepository;
  knowledge: KnowledgeRepository;
  memory: MemoryRepository;
  publicationHistory: PublicationHistoryRepository;
  apiKeys: ApiKeyRepository;
  dailyCoverage: DailyCoverageRepository;
  hotEventSnapshot: HotEventSnapshotRepository;
  hotEmbedCache: HotEmbedCacheRepository;
}

export function createStoreRepositories(conn: PgConnection, dataDir: string): StoreRepositories {
  return {
    config: new ConfigRepository(conn),
    sourceData: new SourceDataRepository(conn),
    history: new HistoryRepository(conn),
    agents: new AgentRepository(conn, dataDir),
    agentSandboxInstances: new AgentSandboxInstanceRepository(conn),
    agentEvents: new AgentEventRepository(conn),
    agentRuns: new AgentRunRepository(conn),
    agentRunQueue: new AgentRunQueueRepository(conn),
    agentSessions: new AgentSessionRepository(conn),
    schedules: new ScheduleRepository(conn),
    knowledge: new KnowledgeRepository(conn),
    memory: new MemoryRepository(conn),
    publicationHistory: new PublicationHistoryRepository(conn),
    apiKeys: new ApiKeyRepository(conn),
    dailyCoverage: new DailyCoverageRepository(conn),
    hotEventSnapshot: new HotEventSnapshotRepository(conn),
    hotEmbedCache: new HotEmbedCacheRepository(conn)
  };
}
