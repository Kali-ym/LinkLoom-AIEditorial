/**
 * Seeds a paused agent run with pending permission into the live LocalStore DB.
 * Used for M2 HITL API E2E when LLM won't reliably trigger tool calls.
 *
 * Usage: DATABASE_URL=... node backend/scripts/seed-m2-paused-run.mjs
 * Prints JSON: { runId, sessionId, permissionId }
 */
import { BaseTool } from '../dist/plugins/base/BaseTool.js';
import { ToolRegistry } from '../dist/registries/ToolRegistry.js';
import { ReActAgentEngine } from '../dist/services/agents/engine/ReActAgentEngine.js';
import { LocalStoreAgentSessionStore } from '../dist/services/agents/engine/AgentSessionStore.js';
import { LocalStoreAgentRunRegistry } from '../dist/services/agents/engine/AgentRunRegistry.js';
import { LocalStore } from '../dist/services/LocalStore.js';
import { resolveDatabaseUrl } from '../dist/config/runtimeEnv.js';

class M2SeedEchoTool extends BaseTool {
  id = 'm2_seed_echo';
  name = 'm2_seed_echo';
  description = 'Echo for M2 HITL seed';
  scope = 'agent';
  parameters = {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text']
  };

  async handler(args) {
    return { echoed: args.text || '' };
  }
}

const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || resolveDatabaseUrl();

const store = new LocalStore(databaseUrl);
await store.init();

const toolRegistry = ToolRegistry.getInstance();
toolRegistry.registerTool(new M2SeedEchoTool());

const sessionStore = new LocalStoreAgentSessionStore(store);
const runRegistry = new LocalStoreAgentRunRegistry(store);
const engine = new ReActAgentEngine(undefined, sessionStore, runRegistry);

const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const runId = `run_m2_seed_${suffix}`;
const sessionId = `session_m2_seed_${suffix}`;

const agentDef = {
  id: 'm2-seed-agent',
  name: 'M2 Seed Agent',
  description: 'Seeded paused run for HITL E2E',
  systemPrompt: 'test',
  providerId: 'seed',
  model: 'seed',
  temperature: 0,
  toolIds: ['m2_seed_echo'],
  skillIds: [],
  mcpServerIds: [],
  runtime: { mode: 'react', maxRounds: 3, returnTrace: true }
};

const spec = {
  runId,
  sessionId,
  source: 'm2-seed',
  agentDef,
  input: {
    prompt: 'run gated tool',
    messages: [{ role: 'user', content: 'run gated tool' }]
  },
  tools: [
    {
      id: 'm2_seed_echo',
      name: 'm2_seed_echo',
      description: 'Echo tool',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text']
      },
      scope: 'agent'
    }
  ],
  mcpConfigs: [],
  skillInstructions: [],
  permissionPolicy: { defaultEffect: 'ask', rules: [] },
  metadata: { agentId: 'm2-seed-agent', suite: 'm2-hitl-seed' }
};

const provider = {
  name: 'seed-provider',
  calls: 0,
  async generateContent() {
    this.calls += 1;
    return {
      content: '',
      tool_calls: [
        {
          id: 'call-m2-seed-1',
          name: 'm2_seed_echo',
          arguments: { text: 'awaiting approval' }
        }
      ]
    };
  }
};

const result = await engine.run(spec, {
  runtimeOptions: {
    agentDef,
    provider,
    tools: spec.tools,
    mcpConfigs: [],
    mcpService: { getTools: async () => [], callTool: async () => ({}) },
    toolRegistry,
    messages: spec.input.messages,
    silent: true
  }
});

if (result.stopReason !== 'permission_required') {
  console.error('Expected permission_required, got:', result.stopReason);
  process.exit(1);
}

const session = await engine.getSessionByRunId(runId);
if (!session?.pendingPermission) {
  console.error('No pending permission on seeded session');
  process.exit(1);
}

console.log(
  JSON.stringify({
    runId,
    sessionId,
    permissionId: session.pendingPermission.permissionId,
    hitlRequestId: session.pendingHitl?.requestId ?? session.pendingPermission.permissionId,
    toolName: session.pendingPermission.subject.toolName,
    status: session.status
  })
);
