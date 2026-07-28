import { describe, expect, it } from 'vitest';
import type { AiBuildCatalog, AiBuildPlan, WorkflowPlan } from '../src/types/aiBuilder.js';
import { AiBuildValidator } from '../src/services/aiBuilder/AiBuildValidator.js';
import { WorkflowPlanCompiler } from '../src/services/aiBuilder/WorkflowPlanCompiler.js';

const catalog: AiBuildCatalog = {
  agents: [
    {
      id: 'agent_scoring',
      name: '评分智能体',
      description: '逐条评分候选内容',
      toolIds: [],
      skillIds: [],
      mcpServerIds: []
    }
  ],
  tools: [],
  skills: [],
  workflows: [],
  defaults: { providerId: 'test-provider', model: 'test-model' }
};

const pipelinePlan: WorkflowPlan = {
  id: 'daily_pipeline',
  name: '日报管线',
  description: '采集候选、整理输入、逐条评分、写回并落日报',
  steps: [
    {
      id: 'query',
      goal: '查询候选素材',
      kind: 'store-query',
      produces: ['query.items'],
      configOverrides: {
        limit: 20,
        filter: { ingestionDate: '${date}' }
      }
    },
    {
      id: 'shape',
      goal: '整理评分输入',
      kind: 'transform',
      consumes: ['query.items'],
      produces: ['shaped.items'],
      configOverrides: {
        operations: [{ op: 'wrapResult', key: 'items' }]
      }
    },
    {
      id: 'score',
      goal: '逐条评分',
      kind: 'batch-iterate',
      consumes: ['shaped.items'],
      produces: ['score.results'],
      configOverrides: {
        itemsPath: '$.shape.items',
        child: {
          type: 'agent',
          id: 'agent_scoring',
          inputTemplate: '$.item'
        }
      }
    },
    {
      id: 'persist_score',
      goal: '写回评分 metadata',
      kind: 'store-write',
      consumes: ['score.results'],
      produces: ['persisted.items'],
      configOverrides: {
        id: '$.item.id',
        patch: '$.item.parsed',
        allowedKeys: ['ai_score', 'ai_topic']
      }
    },
    {
      id: 'persist_digest',
      goal: '落地日报',
      kind: 'kv-write',
      consumes: ['persisted.items'],
      produces: ['digest.key'],
      configOverrides: {
        key: 'daily_report_json:${date}',
        value: '$.current',
        indexKey: 'daily_report_json_index',
        indexValue: '${date}'
      }
    }
  ]
};

describe('AI Builder pipeline DSL', () => {
  it('compiles pipeline configOverrides with StepCatalog defaults', () => {
    const compiler = new WorkflowPlanCompiler();
    const workflow = compiler.compile(pipelinePlan, { catalog });

    expect(workflow.steps.map((step) => step.type)).toEqual([
      'store-query',
      'transform',
      'batch-iterate',
      'store-write',
      'kv-write'
    ]);
    expect(workflow.steps[0].config).toMatchObject({
      limit: 20,
      orderBy: 'fetchedDesc',
      filter: { ingestionDate: '${date}' }
    });
    expect(workflow.steps[1].config).toMatchObject({
      operations: [{ op: 'wrapResult', key: 'items' }]
    });
    expect(workflow.steps[2].config).toMatchObject({
      concurrency: 1,
      onItemFailure: 'skip',
      itemsPath: '$.shape.items',
      child: { type: 'agent', id: 'agent_scoring', inputTemplate: '$.item' }
    });
    expect(workflow.steps[3].config).toMatchObject({
      id: '$.item.id',
      allowedKeys: ['ai_score', 'ai_topic']
    });
    expect(workflow.steps[4].config).toMatchObject({
      key: 'daily_report_json:${date}',
      value: '$.current',
      indexKey: 'daily_report_json_index',
      indexValue: '${date}'
    });
    for (const step of workflow.steps) {
      expect(step.agentId).toBeUndefined();
      expect(step.workflowId).toBeUndefined();
      expect(step.toolId).toBeUndefined();
    }
  });

  it('accepts transform as an AI Builder workflowPlan pipeline step', () => {
    const validator = new AiBuildValidator();
    const plan: AiBuildPlan = {
      id: 'plan_pipeline',
      target: 'workflow',
      mode: 'create',
      summary: '创建日报管线',
      questions: [],
      warnings: [],
      resourceChanges: [],
      workflowPlan: pipelinePlan,
      validation: { status: 'invalid', errors: [] }
    };

    expect(validator.validatePlan(plan, catalog).errors).toEqual([]);
  });
});
