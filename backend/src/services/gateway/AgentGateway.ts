import type { AgentService } from '../agents/AgentService.js';
import { LogService } from '../LogService.js';
import { ChannelBindingStore } from './ChannelBindingStore.js';
import { GatewayMessageRepository } from './GatewayMessageRepository.js';
import {
  DEFAULT_SYSTEM_AGENT_ID,
  type GatewayCompletedPayload,
  type GatewayEvent,
  type GatewayHandle,
  type GatewayResolution,
  type IncomingMessage,
} from './gatewayTypes.js';

export interface AgentGatewayOptions {
  /** Default agent_id used when no binding matches AND caller didn't pass
   *  `req.metadata.fallbackAgentId`. The DB-level fallback in ChannelBindingStore
   *  is the configured route, but Gateway keeps a hard backstop so that the
   *  system never 502s on a misconfigured gateway. */
  systemAgentId?: string;
}

export interface AgentGatewayDeps {
  bindingStore: ChannelBindingStore;
  agentService: AgentService;
  messageRepo: GatewayMessageRepository;
  options?: AgentGatewayOptions;
  /** Optional agent existence check; default = trust binding's agentId. */
  agentExists?: (agentId: string) => Promise<boolean>;
  /** Optional override for fallback agent per request. */
  resolveFallbackAgentId?: (req: IncomingMessage) => string;
}

const TOO_LARGE_TEXT = 200_000; // 200KB — beyond this refuse to dispatch.

export class AgentGateway {
  private readonly bindingStore: ChannelBindingStore;
  private readonly agentService: AgentService;
  private readonly messageRepo: GatewayMessageRepository;
  private readonly systemAgentId: string;
  private readonly agentExists: (id: string) => Promise<boolean>;
  private readonly resolveFallbackAgentId: (req: IncomingMessage) => string;

  constructor(deps: AgentGatewayDeps) {
    this.bindingStore = deps.bindingStore;
    this.agentService = deps.agentService;
    this.messageRepo = deps.messageRepo;
    this.systemAgentId = deps.options?.systemAgentId ?? DEFAULT_SYSTEM_AGENT_ID;
    this.agentExists = deps.agentExists ?? (async () => true);
    this.resolveFallbackAgentId =
      deps.resolveFallbackAgentId ??
      ((req) =>
        (req.metadata?.fallbackAgentId as string | undefined) ?? this.systemAgentId);
  }

  /**
   * Resolve a message to an agent without running it. Returns the message id
   * (already persisted) and the resolution. If no rule matches and no fallback
   * applies, returns resolution: null.
   */
  async resolve(req: IncomingMessage): Promise<{
    messageId: string;
    resolution: GatewayResolution | null;
  }> {
    if (!req.channel) {
      throw new Error('channel is required');
    }
    if (!req.text || req.text.length === 0) {
      throw new Error('text is required');
    }
    if (req.text.length > TOO_LARGE_TEXT) {
      throw new Error(`text exceeds ${TOO_LARGE_TEXT} chars`);
    }

    const fallbackAgentId = this.resolveFallbackAgentId(req);
    const r = await this.bindingStore.resolve(
      { channel: req.channel, accountId: req.accountId, peerId: req.peerId },
      { fallbackAgentId }
    );
    if (!r) {
      const msg = await this.messageRepo.create({
        channel: req.channel,
        accountId: req.accountId ?? null,
        peerId: req.peerId ?? null,
        resolution: null,
        textLength: req.text.length,
        status: 'unrouted',
        metadata: req.metadata,
      });
      return { messageId: msg.id, resolution: null };
    }
    const resolution: GatewayResolution = {
      agentId: r.agentId,
      bindingId: r.bindingId,
      matchLevel: r.matchLevel,
      strategy: r.strategy,
      fallback: r.strategy === 'fallback',
    };
    const msg = await this.messageRepo.create({
      channel: req.channel,
      accountId: req.accountId ?? null,
      peerId: req.peerId ?? null,
      resolution,
      textLength: req.text.length,
      status: 'pending',
      metadata: req.metadata,
    });
    return { messageId: msg.id, resolution };
  }

  /**
   * Handle a message end-to-end: persist + resolve + dispatch via AgentService.
   * Returns a `GatewayHandle` with both the event stream (for SSE) and a
   * `result` promise (for sync mode).
   */
  async handleMessage(req: IncomingMessage): Promise<GatewayHandle> {
    const { messageId, resolution } = await this.resolve(req);

    if (!resolution) {
      // Unrouted path — emit one synthetic event so callers can stream
      // a consistent shape, and resolve the result promise with status='unrouted'.
      const resultPromise = Promise.resolve<GatewayCompletedPayload>({ status: 'unrouted' });
      async function* emptyEvents(): AsyncIterable<GatewayEvent> {
        yield {
          type: 'gateway.completed',
          runId: '',
          status: 'failed',
          error: 'unrouted: no matching binding and no fallback agent configured',
        };
      }
      return {
        messageId,
        runId: null,
        resolution: null,
        events: emptyEvents(),
        result: resultPromise,
      };
    }

    // Validate the agent exists (optional; if not, fall back to system).
    let agentIdToUse = resolution.agentId;
    if (!(await this.agentExists(agentIdToUse))) {
      LogService.warn(
        `[AgentGateway] resolved agent_id="${agentIdToUse}" not found; using system fallback`
      );
      agentIdToUse = this.systemAgentId;
    }

    const runId = `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const startEvent: GatewayEvent = {
      type: 'gateway.started',
      messageId,
      runId,
      resolution: { ...resolution, agentId: agentIdToUse },
    };

    await this.messageRepo.markStarted(messageId);

    // The AgentService API runs the agent and returns either a result (sync)
    // or an async iterator of events (stream). PR3 keeps it simple: we run
    // synchronously, collecting text into the result. Future PR can switch
    // to streaming when AgentService exposes a public stream API.
    let output = '';
    let usage: GatewayCompletedPayload['usage'] | undefined;
    let runError: string | undefined;

    try {
      const r = await this.agentService.runAgent(agentIdToUse, req.text, undefined, {
        runSource: 'gateway',
        metadata: {
          gatewayMessageId: messageId,
          gatewayChannel: req.channel,
          gatewayAccountId: req.accountId ?? undefined,
          gatewayPeerId: req.peerId ?? undefined,
          gatewayBindingId: resolution.bindingId ?? undefined,
          gatewayStrategy: resolution.strategy,
        },
      });
      output = (r as { output?: string }).output ?? '';
      const u = (r as { usage?: { promptTokens: number; completionTokens: number; cost: number } }).usage;
      if (u) usage = u;
    } catch (err) {
      runError = (err as Error).message;
    }

    const finalStatus: 'completed' | 'failed' = runError ? 'failed' : 'completed';
    const completedEvent: GatewayEvent = {
      type: 'gateway.completed',
      runId,
      status: finalStatus,
      error: runError,
      usage,
    };
    await this.messageRepo.markCompleted(messageId, {
      status: finalStatus,
      error: runError,
    });

    const resultPromise = Promise.resolve<GatewayCompletedPayload>({
      status: finalStatus,
      output,
      error: runError,
      usage,
    });

    async function* oneShotEvents(): AsyncIterable<GatewayEvent> {
      yield startEvent;
      if (output) yield { type: 'agent.text.delta', text: output };
      yield completedEvent;
    }

    return {
      messageId,
      runId,
      resolution: { ...resolution, agentId: agentIdToUse },
      events: oneShotEvents(),
      result: resultPromise,
    };
  }
}
