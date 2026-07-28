import { IKnowledgeBaseService } from '../../types/knowledge.js';
import type { SystemSettings } from '../../types/config.js';
import { AgentService } from '../agents/AgentService.js';
import { LocalStore } from '../LocalStore.js';
import { DatabaseKnowledgeService } from './DatabaseKnowledgeService.js';

/** 知识库服务：PostgreSQL 后端（经 LocalStore / KnowledgeRepository）。 */
export class KnowledgeBaseService
  extends DatabaseKnowledgeService
  implements IKnowledgeBaseService
{
  constructor(
    store: LocalStore,
    agentService: AgentService | null,
    getSettings: () => SystemSettings | null | undefined = () => null
  ) {
    super(store, agentService, getSettings);
  }
}
