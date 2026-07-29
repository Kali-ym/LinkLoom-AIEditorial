import { AgentBindingService } from '../agents/AgentBindingService.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import { AgentRunService } from '../api/AgentRunService.js';
import { LogService } from '../LogService.js';

export type ConsoleBootstrapQuery = {
  agentId?: string;
  topicId?: string;
};

/**
 * Aggregates the cold-start reads Agent Console previously stampeded as many
 * parallel GETs (/api/agents, bindings×N, kb categories, agent-runs×N, messages).
 */
export class ConsoleBootstrapService {
  private readonly agentRuns: AgentRunService;
  private readonly bindings: AgentBindingService;

  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext,
  ) {
    this.agentRuns = new AgentRunService(store, context);
    this.bindings = new AgentBindingService(store, context);
  }

  async bootstrap(query: ConsoleBootstrapQuery = {}) {
    const agents = await this.agentRuns.listVisibleAgents();
    const preferredAgentId =
      typeof query.agentId === 'string' && query.agentId.trim() ? query.agentId.trim() : '';
    const activeAgentId =
      preferredAgentId && agents.some((agent: { id?: string }) => agent.id === preferredAgentId)
        ? preferredAgentId
        : (agents.find((agent: { id?: string; isHidden?: boolean }) => agent?.id && !agent.isHidden)
            ?.id ??
          agents[0]?.id ??
          '');

    const preferredTopicId =
      typeof query.topicId === 'string' && query.topicId.trim() ? query.topicId.trim() : '';

    const [kbCategories, agentRunsPage, globalRunsPage, bindingsByAgentId, activeSessionMessages] =
      await Promise.all([
        this.store.listKBCategories().catch((error) => {
          LogService.warn(
            `console bootstrap kb categories failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          return [] as unknown[];
        }),
        activeAgentId
          ? this.agentRuns.listRuns(
              { agentId: activeAgentId },
              { field: 'updatedAt', order: 'desc' },
              0,
              40,
            )
          : Promise.resolve({ items: [], total: 0, offset: 0, limit: 40 }),
        this.agentRuns.listRuns(undefined, { field: 'updatedAt', order: 'desc' }, 0, 80),
        this.loadBindingsForAgents(
          agents.map((agent: { id: string }) => agent.id).filter(Boolean),
        ),
        this.loadActiveSessionMessages(preferredTopicId, activeAgentId),
      ]);

    return {
      ok: true as const,
      agents,
      kbCategories,
      bindingsByAgentId,
      agentRuns: agentRunsPage,
      globalRuns: globalRunsPage,
      activeAgentId,
      activeTopicId: preferredTopicId || activeSessionMessages?.sessionId || '',
      activeSessionMessages,
    };
  }

  private async loadBindingsForAgents(agentIds: string[]) {
    const entries = await Promise.all(
      agentIds.map(async (agentId) => {
        try {
          const result = await this.bindings.listBindings(agentId);
          return [agentId, result.bindings ?? []] as const;
        } catch (error) {
          LogService.warn(
            `console bootstrap bindings failed for ${agentId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return [agentId, []] as const;
        }
      }),
    );
    return Object.fromEntries(entries);
  }

  private async loadActiveSessionMessages(topicOrSessionId: string, agentId: string) {
    let sessionId = topicOrSessionId;
    if (!sessionId && agentId) {
      const page = await this.agentRuns.listRuns(
        { agentId },
        { field: 'updatedAt', order: 'desc' },
        0,
        20,
      );
      sessionId = page.items.find((run) => run.sessionId)?.sessionId ?? '';
    }
    if (!sessionId) return null;

    try {
      return await this.agentRuns.getSessionMessages(sessionId);
    } catch (error) {
      LogService.warn(
        `console bootstrap messages failed for ${sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
