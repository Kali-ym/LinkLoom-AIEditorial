import { IMemoryService } from '../../types/memory.js';
import { AgentService } from '../agents/AgentService.js';
import { LocalStore } from '../LocalStore.js';
import { DatabaseMemoryService } from './DatabaseMemoryService.js';

/** Memory 服务：PostgreSQL 后端（经 LocalStore / MemoryRepository）。 */
export class MemoryService extends DatabaseMemoryService implements IMemoryService {
  constructor(store: LocalStore, agentService: AgentService | null) {
    super(store, agentService);
  }
}
