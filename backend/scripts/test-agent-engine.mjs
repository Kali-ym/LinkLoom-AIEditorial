import assert from 'node:assert/strict';
import { BaseTool } from '../dist/plugins/base/BaseTool.js';
import { ToolRegistry } from '../dist/registries/ToolRegistry.js';
import { ReActAgentEngine } from '../dist/services/agents/engine/ReActAgentEngine.js';

class EvalEchoTool extends BaseTool {
  id = 'eval_engine_echo';
  name = 'eval_engine_echo';
  description = 'Echoes input for eval harness';
  scope = 'agent';
  parameters = {
    type: 'object',
    properties: {
      text: { type: 'string' }
    },
    required: ['text']
  };

  async handler(args) {
    return { echoed: args.text || '' };
  }
}

function createProvider(responses) {
  let index = 0;
  return {
    name: 'eval-provider',
    async generateContent() {
      return responses[index++] ?? responses[responses.length - 1];
    }
  };
}

function createAgent(overrides = {}) {
  return {
    id: 'eval-engine-agent',
    name: 'Eval Engine Agent',
    description: 'Engine regression agent',
    systemPrompt: 'You are an eval agent.',
    providerId: undefined,
    model: 'eval-model',
    temperature: 0,
    toolIds: ['eval_engine_echo'],
    skillIds: [],
    mcpServerIds: [],
    runtime: {
      mode: 'react',
      maxRounds: 4,
      returnTrace: true,
      maxRepeatedToolErrors: 2,
      stopOnRepeatedToolError: true
    },
    ...overrides
  };
}

function createSpec(agentDef, overrides = {}) {
  const runId = overrides.runId || `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const sessionId = overrides.sessionId || `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    runId,
    sessionId,
    source: 'eval',
    agentDef,
    input: {
      prompt: overrides.prompt || 'run eval',
      messages: [
        {
          role: 'user',
          content: overrides.prompt || 'run eval'
        }
      ]
    },
    tools: [
      {
        id: 'eval_engine_echo',
        name: 'eval_engine_echo',
        description: 'Echo tool',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        },
        scope: 'agent'
      }
    ],
    mcpConfigs: [],
    skillInstructions: [],
    metadata: {
      suite: 'eval-harness-engine'
    },
    ...overrides
  };
}

function findEvent(events, type) {
  return events.find((event) => event.type === type);
}

async function testRunAndReplay() {
  const toolRegistry = ToolRegistry.getInstance();
  toolRegistry.registerTool(new EvalEchoTool());

  const engine = new ReActAgentEngine();
  const agentDef = createAgent();
  const provider = createProvider([
    {
      content: '',
      tool_calls: [
        {
          id: 'call-1',
          name: 'eval_engine_echo',
          arguments: { text: 'hello' }
        }
      ]
    },
    {
      content: 'final answer'
    }
  ]);
  const spec = createSpec(agentDef, { prompt: 'hello' });

  const result = await engine.run(spec, {
    runtimeOptions: {
      agentDef,
      provider,
      tools: spec.tools,
      mcpConfigs: [],
      mcpService: { callTool: async () => ({}) },
      toolRegistry,
      messages: spec.input.messages,
      silent: true
    }
  });

  assert.equal(result.content, 'final answer');
  assert.equal(result.stopReason, 'final');
  assert.equal(result.trace.rounds.length, 2);
  assert.equal(result.trace.rounds[0].toolCalls[0].name, 'eval_engine_echo');
  assert.deepEqual(result.trace.rounds[0].observations[0].data, { echoed: 'hello' });

  const session = await engine.getSessionByRunId(spec.runId);
  assert(session);
  assert.equal(session.status, 'succeeded');
  assert.equal(session.output?.stopReason, 'final');
  assert.equal(findEvent(session.events, 'run_started')?.type, 'run_started');
  assert.equal(findEvent(session.events, 'run_finished')?.type, 'run_finished');
  assert.equal(findEvent(session.events, 'tool_finished')?.type, 'tool_finished');
}

async function testPermissionPauseAndResume() {
  const toolRegistry = ToolRegistry.getInstance();
  toolRegistry.registerTool(new EvalEchoTool());

  const engine = new ReActAgentEngine();
  const agentDef = createAgent({
    runtime: {
      mode: 'react',
      maxRounds: 2,
      returnTrace: true,
      maxRepeatedToolErrors: 2,
      stopOnRepeatedToolError: true
    }
  });
  const provider = createProvider([
    {
      content: '',
      tool_calls: [
        {
          id: 'call-2',
          name: 'eval_engine_echo',
          arguments: { text: 'pause me' }
        }
      ]
    }
  ]);
  const spec = createSpec(agentDef, {
    prompt: 'pause me',
    runId: `run_perm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    sessionId: `session_perm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    permissionPolicy: {
      defaultEffect: 'ask',
      rules: []
    }
  });

  const result = await engine.run(spec, {
    runtimeOptions: {
      agentDef,
      provider,
      tools: spec.tools,
      mcpConfigs: [],
      mcpService: { callTool: async () => ({}) },
      toolRegistry,
      messages: spec.input.messages,
      silent: true
    }
  });

  assert.equal(result.stopReason, 'permission_required');
  assert.match(result.content, /Permission required:/);

  const session = await engine.getSessionByRunId(spec.runId);
  assert(session);
  assert.equal(session.status, 'paused');
  assert(session.pendingPermission);
  assert.equal(session.pendingPermission.subject.toolName, 'eval_engine_echo');
  assert.equal(findEvent(session.events, 'permission_required')?.type, 'permission_required');
  assert.equal(findEvent(session.events, 'run_paused')?.type, 'run_paused');

  const resumed = await engine.resume(spec.sessionId, {
    decision: {
      permissionId: session.pendingPermission.permissionId,
      effect: 'allow',
      resolvedBy: 'human',
      resolvedAt: new Date().toISOString()
    }
  });

  assert.equal(resumed.stopReason, 'resume_pending_execution');
  assert.equal(resumed.metadata?.resumeMode, 'decision_recorded');

  const replaySession = await engine.getSessionByRunId(spec.runId);
  assert(replaySession);
  assert.equal(replaySession.pendingPermission, undefined);
  assert.equal(findEvent(replaySession.events, 'permission_resolved')?.type, 'permission_resolved');
}

await testRunAndReplay();
await testPermissionPauseAndResume();

console.log('Agent engine eval harness passed.');