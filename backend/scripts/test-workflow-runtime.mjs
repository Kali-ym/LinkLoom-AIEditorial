import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WorkflowEngine } from '../dist/services/agents/WorkflowEngine.js';
import {
  computeTemplateHash,
  withTemplateMetadata
} from '../dist/services/seeders/templateMetadata.js';
import { ToolRegistry } from '../dist/registries/ToolRegistry.js';

function createTestPassthroughTool() {
  return {
    id: 'test_passthrough',
    name: 'test_passthrough',
    displayName: 'Test Passthrough',
    scope: 'workflow',
    description: 'Returns tool args for workflow runtime tests',
    parameters: { type: 'object', properties: {} },
    async handler(args) {
      return args;
    }
  };
}

const settings = {
  ACTIVE_AI_PROVIDER_ID: 'mock',
  AI_PROVIDERS: [{ id: 'mock', models: ['mock-model'] }],
  EDITORIAL_CONFIG: {}
};

function createStore(workflow) {
  const workflows = new Map(workflow ? [[workflow.id, workflow]] : []);
  const agents = new Map();
  const kv = new Map([['system_settings', settings]]);
  return {
    async getWorkflow(id) {
      return workflows.get(id);
    },
    async saveWorkflow(value) {
      workflows.set(value.id, value);
    },
    async listWorkflows() {
      return [...workflows.values()];
    },
    async getAgent(id) {
      return agents.get(id);
    },
    async saveAgent(value) {
      agents.set(value.id, value);
    },
    async listAgents() {
      return [...agents.values()];
    },
    async get(key) {
      return kv.get(key);
    },
    async put(key, value) {
      kv.set(key, value);
    },
    workflows,
    agents,
    kv
  };
}

async function testDefaultDagStillRuns() {
  const workflow = {
    id: 'wf_default',
    name: 'Default',
    description: '',
    initialStepId: 'a',
    steps: [{ id: 'a', type: 'agent', agentId: 'echo', inputMap: {}, nextStepIds: [] }]
  };
  const store = createStore(workflow);
  const agentService = {
    async runAgent(_agentId, input) {
      return { content: `echo:${input}` };
    }
  };
  const engine = new WorkflowEngine(store, agentService, {});
  const result = await engine.runWorkflow('wf_default', 'hello');
  assert.equal(result, 'echo:hello');
}

async function testAgentBatchExecutionModeRunsInternally() {
  const workflow = {
    id: 'wf_agent_batch',
    name: 'Agent batch',
    description: '',
    initialStepId: 'route',
    steps: [
      {
        id: 'route',
        type: 'agent',
        displayName: '素材路由',
        agentId: 'router',
        inputTemplate: { items: '$.start.items' },
        execution: { mode: 'batch', batchSize: 2, mergeStrategy: 'jsonArrayMerge' },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  const agentService = {
    async runAgent(_agentId, input) {
      const parsed = JSON.parse(input);
      return {
        content: JSON.stringify({
          items: parsed.items.map((item) => ({ ...item, routed: true }))
        })
      };
    }
  };
  const engine = new WorkflowEngine(store, agentService, {});
  const result = await engine.runWorkflow('wf_agent_batch', {
    items: [{ title: 'A' }, { title: 'B' }, { title: 'C' }]
  });
  assert.equal(result.count, 3);
  assert.equal(result.items[0].routed, true);
}

async function testBatchExecutionDoesNotMutateSourceItems() {
  const workflow = {
    id: 'wf_agent_batch_mutation',
    name: 'Agent batch mutation',
    description: '',
    initialStepId: 'batch',
    outputSpec: {
      originalCount: '$.start.items.length',
      firstOriginalTitle: '$.start.items[0].title',
      resultCount: '$.batch.count'
    },
    steps: [
      {
        id: 'batch',
        type: 'agent',
        agentId: 'mutator',
        inputTemplate: { items: '$.start.items' },
        execution: { mode: 'batch', batchSize: 1, mergeStrategy: 'jsonArrayMerge' },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  const agentService = {
    async runAgent(_agentId, input) {
      const parsed = JSON.parse(input);
      parsed.items[0].title = `changed:${parsed.items[0].title}`;
      return { content: JSON.stringify({ items: parsed.items }) };
    }
  };
  const engine = new WorkflowEngine(store, agentService, {});
  const result = await engine.runWorkflow('wf_agent_batch_mutation', {
    items: [{ title: 'A' }, { title: 'B' }]
  });
  assert.equal(result.originalCount, 2);
  assert.equal(result.firstOriginalTitle, 'A');
  assert.equal(result.resultCount, 2);
}

async function testBatchTargetPathDoesNotMutateUpstreamInput() {
  ToolRegistry.getInstance().registerTool(createTestPassthroughTool());
  const workflow = {
    id: 'wf_agent_batch_target_immutability',
    name: 'Agent batch target immutability',
    description: '',
    initialStepId: 'plan',
    outputSpec: {
      upstreamTopicCount: '$.plan.topics.length',
      batchCount: '$.brief.count'
    },
    steps: [
      {
        id: 'plan',
        type: 'tool',
        toolId: 'test_passthrough',
        inputTemplate: {
          topics: '$.start.topics'
        },
        nextStepIds: ['brief']
      },
      {
        id: 'brief',
        type: 'agent',
        agentId: 'brief',
        inputTemplate: '$.plan',
        execution: {
          mode: 'batch',
          itemsPath: '$.topics',
          batchTargetPath: '$.topics',
          inputTemplate: '$.input',
          batchSize: 2,
          mergeStrategy: 'jsonArrayMerge'
        },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  const agentService = {
    async runAgent(_agentId, input) {
      const parsed = JSON.parse(input);
      return {
        content: JSON.stringify({ items: parsed.topics.map((topic) => ({ title: topic.title })) })
      };
    }
  };
  const engine = new WorkflowEngine(store, agentService, {});
  const result = await engine.runWorkflow('wf_agent_batch_target_immutability', {
    topics: [{ title: 'A' }, { title: 'B' }, { title: 'C' }]
  });
  assert.equal(result.upstreamTopicCount, 3);
  assert.equal(result.batchCount, 3);
}

async function testBatchJsonArrayMergeRetriesParseFailure() {
  const workflow = {
    id: 'wf_agent_batch_parse_retry',
    name: 'Agent batch parse retry',
    description: '',
    initialStepId: 'route',
    steps: [
      {
        id: 'route',
        type: 'agent',
        agentId: 'router',
        inputTemplate: { items: '$.start.items' },
        execution: {
          mode: 'batch',
          batchSize: 2,
          mergeStrategy: 'jsonArrayMerge',
          onBatchParseError: 'retry',
          maxBatchRetries: 1,
          reindexField: 'index'
        },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  let call = 0;
  let correctionMessages;
  const agentService = {
    async runAgent(_agentId, input, _date, options = {}) {
      call += 1;
      const parsed = JSON.parse(input);
      if (call === 1) return { content: '{"items":[{"title":"broken"' };
      if (call === 2) correctionMessages = options.messages;
      return {
        content: JSON.stringify({ items: parsed.items.map((item) => ({ ...item, routed: true })) })
      };
    }
  };
  const engine = new WorkflowEngine(store, agentService, {});
  const result = await engine.runWorkflow('wf_agent_batch_parse_retry', {
    items: [{ title: 'A' }, { title: 'B' }, { title: 'C' }]
  });
  assert.equal(result.count, 3);
  assert.equal(result.items[0].title, 'A');
  assert.equal(result.items[0].routed, true);
  assert.equal(result.items[0].index, 1);
  assert.equal(result.items[2].routed, true);
  assert.equal(result.items[2].index, 3);
  assert.equal(call, 3);
  assert.equal(Array.isArray(correctionMessages), true);
  assert.equal(correctionMessages[0].role, 'user');
  assert.equal(correctionMessages[1].role, 'assistant');
  assert.equal(correctionMessages[1].content, '{"items":[{"title":"broken"');
  assert.match(correctionMessages[2].content, /failed deterministic workflow validation/);
  assert.match(correctionMessages[2].content, /Expected input item count: 2/);
}

async function testBatchJsonArrayMergeSplitsCountMismatch() {
  const workflow = {
    id: 'wf_agent_batch_count_split',
    name: 'Agent batch count split',
    description: '',
    initialStepId: 'route',
    steps: [
      {
        id: 'route',
        type: 'agent',
        agentId: 'router',
        inputTemplate: { items: '$.start.items' },
        execution: {
          mode: 'batch',
          batchSize: 4,
          mergeStrategy: 'jsonArrayMerge',
          onBatchItemCountMismatch: 'splitAndRetry',
          maxBatchRetries: 0
        },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  const calls = [];
  const agentService = {
    async runAgent(_agentId, input) {
      const parsed = JSON.parse(input);
      calls.push(parsed.items.map((item) => item.title).join(''));
      if (parsed.items.length > 1) {
        return {
          content: JSON.stringify({
            items: parsed.items.slice(0, 1).map((item) => ({ ...item, routed: true }))
          })
        };
      }
      return {
        content: JSON.stringify({ items: parsed.items.map((item) => ({ ...item, routed: true })) })
      };
    }
  };
  const engine = new WorkflowEngine(store, agentService, {});
  const result = await engine.runWorkflow('wf_agent_batch_count_split', {
    items: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }]
  });
  assert.equal(result.count, 4);
  assert.deepEqual(
    result.items.map((item) => item.title),
    ['A', 'B', 'C', 'D']
  );
  assert.equal(
    result.items.every((item) => item.routed === true),
    true
  );
  assert.deepEqual(calls, ['ABCD', 'AB', 'A', 'B', 'CD', 'C', 'D']);
}

async function testBatchJsonArrayMergeFailsSingleItemInsteadOfFallback() {
  const workflow = {
    id: 'wf_agent_batch_single_failure',
    name: 'Agent batch single failure',
    description: '',
    initialStepId: 'brief',
    steps: [
      {
        id: 'brief',
        type: 'agent',
        agentId: 'brief',
        inputTemplate: { items: '$.start.items' },
        execution: {
          mode: 'batch',
          batchSize: 2,
          mergeStrategy: 'jsonArrayMerge',
          onBatchParseError: 'splitAndRetry',
          maxBatchRetries: 0,
          minBatchSize: 1
        },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  const agentService = {
    async runAgent(_agentId, _input) {
      return { content: '{"items":[{"title":"broken"' };
    }
  };
  const engine = new WorkflowEngine(store, agentService, {});
  await assert.rejects(
    () =>
      engine.runWorkflow('wf_agent_batch_single_failure', {
        items: [{ headline: 'A' }, { headline: 'B' }]
      }),
    /failed parse validation/
  );
}

async function testProjectArrayTruncatesLongFields() {
  ToolRegistry.getInstance().registerTool(createTestPassthroughTool());
  const workflow = {
    id: 'wf_project_array',
    name: 'Project array',
    description: '',
    initialStepId: 'shape',
    steps: [
      {
        id: 'shape',
        type: 'tool',
        toolId: 'test_passthrough',
        inputTransform: {
          operations: [
            {
              op: 'projectArray',
              path: '$.current.items',
              fields: ['index', 'title', 'description', 'metadata.content_html'],
              fieldLimits: {
                description: 6,
                'metadata.content_html': 8
              }
            },
            {
              op: 'wrapResult',
              template: {
                count: '$.current.length',
                items: '$.current'
              }
            }
          ]
        },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  const engine = new WorkflowEngine(
    store,
    {
      async runAgent() {
        throw new Error('not expected');
      }
    },
    {}
  );
  const result = await engine.runWorkflow('wf_project_array', {
    items: [
      {
        index: 1,
        title: 'A',
        description: 'abcdefghijklmnop',
        metadata: { content_html: '<p>abcdefghijklmnop</p>' },
        status: 'unread'
      }
    ]
  });
  assert.equal(result.count, 1);
  assert.equal(result.items[0].description, 'abcde…');
  assert.equal(result.items[0].metadata.content_html, '<p>abcd…');
  assert.equal(result.items[0].status, undefined);
}

async function testSingleAgentJsonPlanCoverageSelfCorrects() {
  const workflow = {
    id: 'wf_single_plan_retry',
    name: 'Single plan retry',
    description: '',
    initialStepId: 'plan',
    steps: [
      {
        id: 'plan',
        type: 'agent',
        agentId: 'planner',
        inputTemplate: { count: '$.start.items.length', items: '$.start.items' },
        execution: {
          mode: 'single',
          validateJsonObject: true,
          validateCoverage: {
            inputItemsPath: '$.items',
            outputCollections: ['topics', 'dropped'],
            sourceItemsField: 'source_items',
            idField: 'index'
          },
          maxAgentRetries: 1
        },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  let call = 0;
  let correctionMessages;
  const agentService = {
    async runAgent(_agentId, _input, _date, options = {}) {
      call += 1;
      if (call === 1) {
        return {
          content: JSON.stringify({
            input_count: 2,
            output_topic_count: 1,
            editorial_log: {
              received: 2,
              dedup_removed: 0,
              tier1_dropped: 0,
              tier3_kept: 0,
              tier5_kept: 1,
              clusters_formed: 0,
              topics_kept: 1
            },
            topics: [
              {
                topic_id: 't1',
                action: 'keep',
                headline: 'A',
                ai_relevance_tier: 5,
                importance_rank: 1,
                importance_reason: '',
                suggested_section: '产品发布/更新',
                source_items: [{ index: 1, title: 'A', url: 'https://a.com' }]
              }
            ],
            dropped: []
          })
        };
      }
      correctionMessages = options.messages;
      return {
        content: JSON.stringify({
          input_count: 2,
          output_topic_count: 2,
          editorial_log: {
            received: 2,
            dedup_removed: 0,
            tier1_dropped: 0,
            tier3_kept: 0,
            tier5_kept: 2,
            clusters_formed: 0,
            topics_kept: 2
          },
          topics: [
            {
              topic_id: 't1',
              action: 'keep',
              headline: 'A',
              ai_relevance_tier: 5,
              importance_rank: 1,
              importance_reason: '',
              suggested_section: '产品发布/更新',
              source_items: [{ index: 1, title: 'A', url: 'https://a.com' }]
            },
            {
              topic_id: 't2',
              action: 'keep',
              headline: 'B',
              ai_relevance_tier: 5,
              importance_rank: 2,
              importance_reason: '',
              suggested_section: '产品发布/更新',
              source_items: [{ index: 2, title: 'B', url: 'https://b.com' }]
            }
          ],
          dropped: []
        })
      };
    }
  };
  const engine = new WorkflowEngine(store, agentService, {});
  const result = await engine.runWorkflow('wf_single_plan_retry', {
    items: [
      { index: 1, title: 'A', url: 'https://a.com' },
      { index: 2, title: 'B', url: 'https://b.com' }
    ]
  });
  assert.equal(call, 2);
  assert.equal(JSON.parse(result).topics.length, 2);
  assert.equal(Array.isArray(correctionMessages), true);
  assert.match(correctionMessages[2].content, /Every required identifier must appear exactly once/);
  assert.match(correctionMessages[2].content, /missing indices: 2/);
}

async function testSingleAgentPlanCoverageAcceptsCompactSourceItems() {
  const workflow = {
    id: 'wf_single_plan_compact',
    name: 'Single plan compact',
    description: '',
    initialStepId: 'plan',
    steps: [
      {
        id: 'plan',
        type: 'agent',
        agentId: 'planner',
        inputTemplate: { count: '$.start.items.length', items: '$.start.items' },
        execution: {
          mode: 'single',
          validateJsonObject: true,
          validateCoverage: {
            inputItemsPath: '$.items',
            outputCollections: ['topics', 'dropped'],
            sourceItemsField: 'source_items',
            idField: 'index'
          },
          maxAgentRetries: 0
        },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  const agentService = {
    async runAgent() {
      return {
        content: JSON.stringify({
          input_count: 2,
          output_topic_count: 1,
          editorial_log: {
            received: 2,
            dedup_removed: 0,
            tier1_dropped: 0,
            tier3_kept: 0,
            tier5_kept: 2,
            clusters_formed: 1,
            topics_kept: 1
          },
          topics: [
            {
              topic_id: 't1',
              action: 'merge',
              headline: 'AB',
              ai_relevance_tier: 5,
              importance_rank: 1,
              importance_reason: '',
              suggested_section: '产品发布/更新',
              source_items: [1, 2]
            }
          ],
          dropped: []
        })
      };
    }
  };
  const engine = new WorkflowEngine(store, agentService, {});
  const result = await engine.runWorkflow('wf_single_plan_compact', {
    items: [
      { index: 1, title: 'A', url: 'https://a.com' },
      { index: 2, title: 'B', url: 'https://b.com' }
    ]
  });
  assert.equal(JSON.parse(result).topics[0].source_items.length, 2);
}

async function testInputTransformOnToolStep() {
  ToolRegistry.getInstance().registerTool(createTestPassthroughTool());
  const workflow = {
    id: 'wf_input_transform_tool',
    name: 'Input transform tool',
    description: '',
    initialStepId: 'shape',
    outputSpec: {
      mode: '$.shape.mode',
      count: '$.shape.count'
    },
    steps: [
      {
        id: 'shape',
        type: 'tool',
        toolId: 'test_passthrough',
        inputTemplate: {
          items: '$.start.items',
          mode: '$.__runtimeOptions.mode'
        },
        inputTransform: {
          operations: [
            { op: 'default', path: 'mode', value: 'standard' },
            { op: 'set', path: 'count', value: '$.current.items.length' }
          ]
        },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  const engine = new WorkflowEngine(
    store,
    {
      async runAgent() {
        throw new Error('not expected');
      }
    },
    {}
  );
  const result = await engine.runWorkflow(
    'wf_input_transform_tool',
    { items: [{ title: 'A' }, { title: 'B' }] },
    '2026-05-20',
    { runtimeOptions: { mode: 'weekly' } }
  );
  assert.equal(result.mode, 'weekly');
  assert.equal(result.count, 2);
}

async function testInputTransformFeedsDownstreamRefs() {
  ToolRegistry.getInstance().registerTool(createTestPassthroughTool());
  const workflow = {
    id: 'wf_input_transform_downstream',
    name: 'Input transform downstream',
    description: '',
    initialStepId: 'coverage',
    steps: [
      {
        id: 'coverage',
        type: 'tool',
        toolId: 'test_passthrough',
        inputTransform: {
          operations: [
            { op: 'parseJson' },
            { op: 'default', path: 'items', value: '$.current' },
            {
              op: 'wrapResult',
              template: {
                items: '$.current.items',
                headlineMaxTopics: 5
              }
            }
          ]
        },
        inputTemplate: {
          items: '$.input.items'
        },
        nextStepIds: ['consumer']
      },
      {
        id: 'consumer',
        type: 'tool',
        toolId: 'test_passthrough',
        inputTemplate: {
          items: '$.coverage.items',
          headlineMaxTopics: '$.coverage.headlineMaxTopics',
          count: '$.coverage.items.length'
        },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  const engine = new WorkflowEngine(
    store,
    {
      async runAgent() {
        throw new Error('not expected');
      }
    },
    {}
  );
  const result = await engine.runWorkflow('wf_input_transform_downstream', {
    items: [{ title: 'A' }, { title: 'B' }]
  });
  assert.equal(result.count, 2);
  assert.equal(result.headlineMaxTopics, 5);
}

async function testInputScopeFallsBackToStartWithoutInputStep() {
  ToolRegistry.getInstance().registerTool(createTestPassthroughTool());
  const workflow = {
    id: 'wf_input_scope_start',
    name: 'Input scope start',
    description: '',
    initialStepId: 'coverage',
    steps: [
      {
        id: 'coverage',
        type: 'tool',
        toolId: 'test_passthrough',
        inputTransform: {
          operations: [
            {
              op: 'wrapResult',
              template: {
                items: '$.input.items',
                summary: 'coverage-result'
              }
            }
          ]
        },
        inputTemplate: {
          items: '$.input.items'
        },
        nextStepIds: ['dedup']
      },
      {
        id: 'dedup',
        type: 'tool',
        toolId: 'test_passthrough',
        inputTemplate: {
          items: '$.coverage.items',
          coverage: '$.coverage.summary',
          count: '$.coverage.items.length'
        },
        nextStepIds: []
      }
    ]
  };
  const store = createStore(workflow);
  const engine = new WorkflowEngine(
    store,
    {
      async runAgent() {
        throw new Error('not expected');
      }
    },
    {}
  );
  const result = await engine.runWorkflow('wf_input_scope_start', {
    items: [{ title: 'A' }, { title: 'B' }]
  });
  assert.equal(result.count, 2);
  assert.equal(result.coverage, 'coverage-result');
}

async function testNoCodeSeededDailyBusinessObjects() {
  const store = createStore();
  assert.equal(await store.getAgent('daily_ingest_router'), undefined);
  assert.equal(await store.getWorkflow('wf_daily_linkloom_full'), undefined);
}

async function testDailyTemplateContainsAgentsAndFullWorkflow() {
  const template = JSON.parse(
    fs.readFileSync(
      new URL('../templates/ai-daily-report-json-from-raw.json', import.meta.url),
      'utf8'
    )
  );
  assert.equal(template.agents.length, 6);
  assert.equal(template.workflows.length, 1);
  const workflow = template.workflows[0];
  const stepIds = workflow.steps.map((step) => step.id);
  for (const id of [
    'coverage',
    'dedup',
    'material_brief',
    'route',
    'plan',
    'reconcile_plan',
    'brief',
    'digest_json',
    'meta',
    'assemble'
  ]) {
    assert.ok(stepIds.includes(id), `missing step ${id}`);
  }
  const reservedStepIds = new Set([
    'input',
    'current',
    'start',
    'output',
    'steps',
    '__steps',
    '__context',
    '__date',
    '__runtimeOptions',
    '__workflow'
  ]);
  for (const id of stepIds) {
    assert.equal(
      reservedStepIds.has(id),
      false,
      `template step id uses reserved workflow scope key: ${id}`
    );
  }
  const coverage = workflow.steps.find((step) => step.id === 'coverage');
  assert.ok(coverage?.inputTransform?.operations?.some((op) => op.op === 'parseJson'));
  assert.equal(workflow.initialStepId, 'coverage');
  assert.ok(
    workflow.steps.some(
      (step) =>
        step.id === 'material_brief' && step.type === 'agent' && step.execution?.mode === 'batch'
    )
  );
  assert.ok(
    workflow.steps.some(
      (step) => step.id === 'route' && step.type === 'agent' && step.execution?.mode === 'batch'
    )
  );
  assert.ok(
    workflow.steps.some(
      (step) => step.id === 'plan' && step.type === 'agent' && step.execution?.mode === 'single'
    )
  );
  assert.ok(
    workflow.steps.some(
      (step) => step.id === 'brief' && step.type === 'agent' && step.execution?.mode === 'batch'
    )
  );
  const materialBrief = workflow.steps.find((step) => step.id === 'material_brief');
  const route = workflow.steps.find((step) => step.id === 'route');
  const plan = workflow.steps.find((step) => step.id === 'plan');
  const reconcile = workflow.steps.find((step) => step.id === 'reconcile_plan');
  const brief = workflow.steps.find((step) => step.id === 'brief');
  assert.equal(materialBrief?.execution?.onBatchParseError, 'splitAndRetry');
  assert.equal(materialBrief?.execution?.onBatchItemCountMismatch, 'splitAndRetry');
  assert.equal(materialBrief?.execution?.itemFields.includes('metadata.content_html'), true);
  assert.equal(materialBrief?.execution?.itemFieldLimits['metadata.content_html'], 1800);
  assert.equal(JSON.stringify(route?.inputTemplate).includes('material_brief'), true);
  assert.equal(JSON.stringify(plan?.inputTemplate).includes('material_brief'), true);
  assert.equal(plan?.execution?.validateCoverage?.inputItemsPath, '$.items');
  assert.deepEqual(plan?.execution?.validateCoverage?.outputCollections, ['topics', 'dropped']);
  assert.equal(JSON.stringify(reconcile?.inputTemplate).includes('routeItems'), true);
  assert.equal(JSON.stringify(reconcile?.inputTemplate).includes('materialItems'), true);
  assert.equal(route?.execution?.onBatchParseError, 'splitAndRetry');
  assert.equal(route?.execution?.onBatchItemCountMismatch, 'splitAndRetry');
  assert.equal(route?.execution?.fallbackItemDefaults, undefined);
  assert.equal(brief?.execution?.onBatchParseError, 'splitAndRetry');
  assert.equal(brief?.execution?.onBatchItemCountMismatch, 'splitAndRetry');
  assert.equal(brief?.execution?.fallbackItemTemplate, undefined);
  assert.equal(
    workflow.steps.some((step) => step.toolId === 'batch_agent_runner'),
    false
  );
  assert.equal(
    workflow.steps.some(
      (step) => step.type === 'transform' || step.type === 'event' || step.type === 'finalize'
    ),
    false
  );
  assert.deepEqual(workflow.outputSpec, {
    report: '$.assemble.report',
    editorialPlan: '$.reconcile_plan.plan'
  });
  assert.ok(workflow.steps.some((step) => step.toolId === 'build_daily_report_json'));
}

async function testTemplateInstantiationShape() {
  const template = JSON.parse(
    fs.readFileSync(
      new URL('../templates/ai-daily-report-json-from-raw.json', import.meta.url),
      'utf8'
    )
  );
  const variables = Object.fromEntries(
    (template.variables || []).map((v) => [v.id, v.defaultValue ?? ''])
  );
  const applyVariables = (value) => {
    if (typeof value === 'string') {
      return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) =>
        String(variables[key] ?? '')
      );
    }
    if (Array.isArray(value)) return value.map(applyVariables);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [key, applyVariables(val)])
      );
    return value;
  };
  const expanded = applyVariables(template);
  const store = createStore();
  for (const agent of expanded.agents) {
    await store.saveAgent(
      withTemplateMetadata({ ...agent, systemPrompt: `prompt:${agent.id}` }, `test:${agent.id}`)
    );
  }
  for (const workflow of expanded.workflows) {
    await store.saveWorkflow(withTemplateMetadata(workflow, `test:${workflow.id}`));
  }
  assert.equal((await store.listAgents()).length, 6);
  assert.equal((await store.listWorkflows()).length, 1);
  assert.equal(Boolean(computeTemplateHash(expanded)), true);
  const workflow = await store.getWorkflow('wf_ai_daily_report_json_from_raw');
  assert.equal(workflow.steps.length >= 10, true);
  assert.equal(
    workflow.steps.some((step) => step.toolId === 'batch_agent_runner'),
    false
  );
  assert.equal(workflow.steps.find((step) => step.id === 'route')?.execution?.mode, 'batch');
  assert.equal(workflow.steps.find((step) => step.id === 'plan')?.execution?.mode, 'single');
}

function testEngineHasNoDailyBusinessRuntimeStrings() {
  const source = fs.readFileSync(
    new URL('../dist/services/agents/WorkflowEngine.js', import.meta.url),
    'utf8'
  );
  for (const token of [
    'wf_daily_linkloom_full',
    'daily_editorial',
    'validatePlanCoverage',
    'editorialPlanMerge',
    'd1_5',
    'daily_editorial_plan',
    'daily_meta_footer'
  ]) {
    assert.equal(source.includes(token), false, `WorkflowEngine still contains ${token}`);
  }
}

await testDefaultDagStillRuns();
await testAgentBatchExecutionModeRunsInternally();
await testBatchExecutionDoesNotMutateSourceItems();
await testBatchTargetPathDoesNotMutateUpstreamInput();
await testBatchJsonArrayMergeRetriesParseFailure();
await testBatchJsonArrayMergeSplitsCountMismatch();
await testBatchJsonArrayMergeFailsSingleItemInsteadOfFallback();
await testProjectArrayTruncatesLongFields();
await testSingleAgentJsonPlanCoverageSelfCorrects();
await testSingleAgentPlanCoverageAcceptsCompactSourceItems();
await testInputTransformOnToolStep();
await testInputTransformFeedsDownstreamRefs();
await testInputScopeFallsBackToStartWithoutInputStep();
await testNoCodeSeededDailyBusinessObjects();
await testDailyTemplateContainsAgentsAndFullWorkflow();
await testTemplateInstantiationShape();
testEngineHasNoDailyBusinessRuntimeStrings();

console.log('Workflow configurability tests passed.');
