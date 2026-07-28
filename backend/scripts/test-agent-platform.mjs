import assert from 'node:assert/strict';
import { BaseTool } from '../dist/plugins/base/BaseTool.js';
import { ToolRegistry } from '../dist/registries/ToolRegistry.js';
import { AgentRunService } from '../dist/services/api/AgentRunService.js';
import { AgentService } from '../dist/services/agents/AgentService.js';
import {
  agentEventContextFromSpec,
  mapAiBuilderStreamToAgentEvents,
  mapTraceToAgentEvents,
  mapWorkflowProgressToAgentEvents
} from '../dist/services/agents/engine/AgentEventMapper.js';
import {
  previewWorkflowToolPermission,
  shouldGateWorkflowTool
} from '../dist/services/agents/WorkflowStepApproval.js';

class PlatformEchoTool extends BaseTool {
  id = 'platform_echo';
  name = 'platform_echo';
  description = 'Echoes input for platform eval';
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

function createProvider() {
  let streamIndex = 0;
  const runResponses = [
    {
      content: '',
      tool_calls: [
        {
          id: 'platform-call-1',
          name: 'platform_echo',
          arguments: { text: 'trace me' }
        }
      ]
    },
    {
      content: 'platform final'
    }
  ];

  return {
    name: 'platform-provider',
    async generateContent() {
      return runResponses[streamIndex++] ?? runResponses[runResponses.length - 1];
    },
    async *streamContent() {
      for (const chunk of runResponses) {
        yield chunk;
      }
    }
  };
}

function createAgent() {
  return {
    id: 'platform-agent',
    name: 'Platform Agent',
    description: 'Platform regression agent',
    systemPrompt: 'You are a platform eval agent.',
    providerId: undefined,
    model: 'platform-model',
    temperature: 0,
    toolIds: ['platform_echo'],
    skillIds: [],
    mcpServerIds: [],
    runtime: {
      mode: 'react',
      maxRounds: 3,
      returnTrace: true,
      maxRepeatedToolErrors: 2,
      stopOnRepeatedToolError: true
    }
  };
}

function createStore(agent) {
  const kv = new Map([
    [
      'system_settings',
      {
        ACTIVE_AI_PROVIDER_ID: 'none',
        AI_PROVIDERS: [],
        CLOSED_PLUGINS: []
      }
    ]
  ]);
  return {
    async getAgent() {
      return agent;
    },
    async get(key) {
      return kv.get(key);
    },
    async put(key, value) {
      kv.set(key, value);
    },
    async getMCPConfig() {
      return undefined;
    },
    async listAgents() {
      return [agent];
    },
    async listWorkflows() {
      return [];
    },
    async deleteAgent() {
      return undefined;
    },
    async saveAgent() {
      return undefined;
    },
    async listMCPConfigs() {
      return [];
    },
    async close() {
      return undefined;
    }
  };
}

async function collect(iterable) {
  const items = [];
  for await (const item of iterable) items.push(item);
  return items;
}

async function runPlatformAgentRoundTrip() {
  const toolRegistry = ToolRegistry.getInstance();
  toolRegistry.registerTool(new PlatformEchoTool());

  const agent = createAgent();
  const provider = createProvider();
  const store = createStore(agent);
  const skillService = {
    buildSkillsPrompt: async () => ''
  };
  const mcpService = {
    getTools: async () => [],
    callTool: async () => ({})
  };
  const service = new AgentService(store, provider, skillService, mcpService);
  const runService = new AgentRunService(store, {
    agentService: service,
    reload: async () => undefined,
    aiProvider: provider,
    proxyAgent: undefined
  });

  let runSpec;
  const result = await service.runAgent('platform-agent', 'trace me', undefined, {
    silent: true,
    onRunCreated: (spec) => {
      runSpec = spec;
    }
  });

  assert(runSpec);
  assert.equal(result.content, 'platform final');
  assert.equal(result.stopReason, 'final');
  assert.equal(result.trace.rounds.length, 2);

  const traceEvents = mapTraceToAgentEvents(result.trace, agentEventContextFromSpec(runSpec, {
    suite: 'platform'
  }));
  const traceEventTypes = traceEvents.map((event) => event.type);
  assert(traceEventTypes.includes('tool_call_requested'));
  assert(traceEventTypes.includes('observation_added'));

  const status = await runService.getRunStatus(runSpec.runId);
  assert.equal(status.runId, runSpec.runId);
  assert.equal(status.status, 'succeeded');
  assert.equal(status.output?.stopReason, 'final');

  const events = await runService.getRunEvents(runSpec.runId);
  const eventTypes = events.map((event) => event.type);
  assert(events.length > 0);
  assert.equal(eventTypes[0], 'run_queued');
  assert(eventTypes.includes('run_started'));
  assert.equal(events.at(-1).type, 'run_finished');

  const streamed = await collect(runService.streamRunEvents(runSpec.runId));
  assert.deepEqual(
    streamed.map((event) => event.type),
    events.map((event) => event.type)
  );

  const trace = await runService.getRunTrace(runSpec.runId);
  assert.equal(trace.runId, runSpec.runId);
  assert.equal(trace.events.length, events.length);

  const replay = await runService.replayRun(runSpec.runId);
  assert.equal(replay.originalRunId, runSpec.runId);
  assert.equal(replay.original.status, 'succeeded');
  assert.equal(replay.original.output?.stopReason, 'final');

  const streamEvents = await collect(
    service.streamAgent('platform-agent', 'trace me', undefined, { silent: true, noTools: false })
  );
  assert(streamEvents.some((event) => event.type === 'tool_start'));
  assert(streamEvents.some((event) => event.type === 'final_trace'));
}

function testWorkflowAndBuilderMappings() {
  const ctx = {
    runId: 'run_mapping_eval',
    sessionId: 'session_mapping_eval',
    metadata: { source: 'eval' }
  };

  const workflowEvents = mapWorkflowProgressToAgentEvents(
    {
      type: 'step_start',
      stepId: 'step-1',
      name: 'Collect',
      status: 'running'
    },
    ctx
  );
  assert.equal(workflowEvents[0].type, 'custom');
  assert.equal(workflowEvents[0].payload.name, 'workflow_step_start');

  const builderCheckpointEvents = mapAiBuilderStreamToAgentEvents(
    {
      type: 'checkpoint',
      checkpoint: { id: 'cp-1', summary: '保存中间结果' }
    },
    ctx
  );
  assert.equal(builderCheckpointEvents[0].type, 'checkpoint_saved');

  const builderSummaryEvents = mapAiBuilderStreamToAgentEvents(
    {
      type: 'context_summary',
      summary: '压缩上下文'
    },
    ctx
  );
  assert.equal(builderSummaryEvents[0].type, 'context_compacted');
}

function testWorkflowStepApprovalGate() {
  const publishPreview = previewWorkflowToolPermission('publish_to_wechat');
  assert.equal(publishPreview.effect, 'ask');
  assert.equal(shouldGateWorkflowTool('publish_to_wechat'), true);

  const assemblePreview = previewWorkflowToolPermission('build_daily_report_json');
  assert.equal(assemblePreview.effect, 'ask');
  assert.equal(shouldGateWorkflowTool('build_daily_report_json'), true);

  const queryPreview = previewWorkflowToolPermission('query_knowledge');
  assert.equal(queryPreview.effect, 'allow');
  assert.equal(shouldGateWorkflowTool('query_knowledge'), false);
  assert.equal(shouldGateWorkflowTool('build_daily_report_json', { skipWorkflowApproval: true }), false);
}

testWorkflowStepApprovalGate();
await testWorkflowAndBuilderMappings();
await runPlatformAgentRoundTrip();

console.log('Agent platform eval harness passed.');