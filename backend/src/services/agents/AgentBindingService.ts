import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import { markCustomized } from '../seeders/templateMetadata.js';
import type { AgentResourceBindingInput, AgentResourceType } from './agentBindingTypes.js';
import { AgentBindingStore } from './AgentBindingStore.js';
import { isAgentResourceType } from './agentBindingTypes.js';

export class AgentBindingService {
  private readonly store: AgentBindingStore;

  constructor(
    private readonly localStore: LocalStore,
    private readonly context: ServiceContext,
  ) {
    const conn = localStore.getConnection();
    if (!conn) {
      throw new Error('PgConnection not available for AgentBindingService');
    }
    this.store = new AgentBindingStore(conn);
  }

  async listBindings(agentId: string) {
    await this.assertAgentExists(agentId);
    const bindings = await this.store.list(agentId);
    return { bindings };
  }

  async addBinding(agentId: string, input: AgentResourceBindingInput) {
    await this.assertAgentExists(agentId);
    if (!isAgentResourceType(input.resourceType)) {
      throw new Error(`invalid resourceType: ${String(input.resourceType)}`);
    }
    if (!input.resourceId?.trim()) {
      throw new Error('resourceId is required');
    }

    const binding = await this.store.upsert(agentId, {
      resourceType: input.resourceType,
      resourceId: input.resourceId.trim(),
      metadata: input.metadata,
    });

    if (input.resourceType === 'kb_category') {
      await this.syncAgentKnowledgeCategoryIds(agentId);
    }

    await this.context.reload();
    return { binding };
  }

  async removeBinding(agentId: string, bindingId: string) {
    await this.assertAgentExists(agentId);
    const existing = await this.store.get(bindingId);
    if (!existing || existing.agentId !== agentId) {
      return { status: 'not_found' as const };
    }

    await this.store.deleteById(agentId, bindingId);

    if (existing.resourceType === 'kb_category') {
      await this.syncAgentKnowledgeCategoryIds(agentId);
    }

    await this.context.reload();
    return { status: 'deleted' as const };
  }

  async removeBindingByResource(
    agentId: string,
    resourceType: AgentResourceType,
    resourceId: string,
  ) {
    await this.assertAgentExists(agentId);
    const removed = await this.store.deleteByResource(agentId, resourceType, resourceId);
    if (removed && resourceType === 'kb_category') {
      await this.syncAgentKnowledgeCategoryIds(agentId);
    }
    if (removed) {
      await this.context.reload();
    }
    return { status: removed ? ('deleted' as const) : ('not_found' as const) };
  }

  private async assertAgentExists(agentId: string): Promise<void> {
    const agents = await this.localStore.listAgents();
    if (!agents.some((agent: { id: string }) => agent.id === agentId)) {
      throw new Error(`agent ${agentId} not found`);
    }
  }

  private async syncAgentKnowledgeCategoryIds(agentId: string): Promise<void> {
    const categoryIds = await this.store.listResourceIds(agentId, 'kb_category');
    const agents = await this.localStore.listAgents();
    const agent = agents.find((item: { id: string }) => item.id === agentId);
    if (!agent) return;

    await this.localStore.saveAgent(
      markCustomized({
        ...agent,
        knowledgeCategoryIds: categoryIds,
      }),
    );
  }
}
