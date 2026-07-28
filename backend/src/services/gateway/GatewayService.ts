import type { AgentService } from '../agents/AgentService.js';
import { LogService } from '../LogService.js';
import type { PgConnection } from '../repositories/DatabaseConnection.js';
import { AgentGateway } from './AgentGateway.js';
import { ChannelBindingStore } from './ChannelBindingStore.js';
import { GatewayMessageRepository } from './GatewayMessageRepository.js';
import { DEFAULT_SYSTEM_AGENT_ID } from './gatewayTypes.js';

export interface GatewayServiceDeps {
  conn: PgConnection;
  agentService: AgentService;
  /** Optional override for the default agent to use when no binding matches
   *  and no per-request fallback is set. */
  systemAgentId?: string;
}

/**
 * Composition root for the gateway surface. Owns the binding store + message
 * repo + AgentGateway; exposes them as a single object so route handlers and
 * ServiceContext don't need to know the wiring details.
 */
export class GatewayService {
  readonly bindingStore: ChannelBindingStore;
  readonly messageRepo: GatewayMessageRepository;
  readonly gateway: AgentGateway;

  constructor(deps: GatewayServiceDeps) {
    this.bindingStore = new ChannelBindingStore(deps.conn);
    this.messageRepo = new GatewayMessageRepository(deps.conn);
    this.gateway = new AgentGateway({
      bindingStore: this.bindingStore,
      agentService: deps.agentService,
      messageRepo: this.messageRepo,
      options: { systemAgentId: deps.systemAgentId ?? DEFAULT_SYSTEM_AGENT_ID },
    });
    LogService.info(
      `[GatewayService] initialized (systemAgentId=${deps.systemAgentId ?? DEFAULT_SYSTEM_AGENT_ID})`
    );
  }
}
