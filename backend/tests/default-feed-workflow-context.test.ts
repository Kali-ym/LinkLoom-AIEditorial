import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FEED_SCORING_AGENT_ID,
  FEED_SCORING_PIPELINE_WORKFLOW_ID
} from '../src/services/agents/defaultAgentIds.js';
import { WorkflowTemplateRouteService } from '../src/services/api/WorkflowTemplateRouteService.js';

function readFeedPipelinesTemplate() {
  const templatePath = path.resolve(process.cwd(), 'backend/templates/feed-pipelines.json');
  return JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
}

function workflowFromTemplate(kind: string) {
  const template = readFeedPipelinesTemplate();
  return template.workflows.find((workflow: any) => workflow.metadata?.kind === kind);
}

function createMemoryStore() {
  const kv = new Map<string, any>();
  const agents = new Map<string, any>();
  const workflows = new Map<string, any>();

  return {
    kv,
    agents,
    workflows,
    async get(key: string) {
      return kv.get(key);
    },
    async put(key: string, value: any) {
      kv.set(key, value);
    },
    async getAgent(id: string) {
      return agents.get(id) || null;
    },
    async saveAgent(agent: any) {
      agents.set(agent.id, agent);
    },
    async listAgents() {
      return Array.from(agents.values());
    },
    async getWorkflow(id: string) {
      return workflows.get(id) || null;
    },
    async saveWorkflow(workflow: any) {
      workflows.set(workflow.id, workflow);
    },
    async listWorkflows() {
      return Array.from(workflows.values());
    }
  };
}

const settings = {
  ACTIVE_AI_PROVIDER_ID: 'test-provider',
  AI_PROVIDERS: [
    {
      id: 'test-provider',
      name: 'Test Provider',
      type: 'OPENAI',
      apiUrl: '',
      apiKey: '',
      models: ['test-model'],
      enabled: true,
      useProxy: false
    }
  ]
} as any;

describe('default feed workflow context wiring', () => {
  it('keeps feed pipeline template as the default workflow source', () => {
    const template = readFeedPipelinesTemplate();

    expect(template.agents.every((agent: any) => agent.toolIds.includes('query_memory'))).toBe(
      true
    );
    expect(template.agents.every((agent: any) => agent.toolIds.includes('query_knowledge'))).toBe(
      true
    );

    const scoringWorkflow = workflowFromTemplate('scoring-pipeline');
    const stepIds = scoringWorkflow.steps.map((step: any) => step.id);
    expect(stepIds).toEqual(['query', 'memory_context', 'knowledge_context', 'score', 'write', 'rebuild_hot']);
    expect(scoringWorkflow.steps.find((step: any) => step.id === 'query')?.nextStepIds).toEqual([
      'memory_context',
      'knowledge_context'
    ]);

    const scoringMemoryStep = scoringWorkflow.steps.find(
      (step: any) => step.id === 'memory_context'
    );
    const scoringKnowledgeStep = scoringWorkflow.steps.find(
      (step: any) => step.id === 'knowledge_context'
    );
    expect(scoringMemoryStep.inputTransform.operations[0]).toMatchObject({
      op: 'projectArray',
      fields: ['title', 'source', 'description', 'category', 'author']
    });
    expect(scoringKnowledgeStep.inputTransform.operations[0]).toMatchObject({
      op: 'projectArray',
      fields: ['title', 'source', 'description', 'category', 'author']
    });

    const scoreStep = scoringWorkflow.steps.find((step: any) => step.id === 'score');
    expect(scoreStep.config.child).toMatchObject({ type: 'agent', id: '{{scoringAgentId}}' });
    expect(scoreStep.config.child.inputTemplate).toMatchObject({
      id: '$.item.id',
      memory_context: '$.memory_context.summary',
      knowledge_context: '$.knowledge_context.answer'
    });

    const writeStep = scoringWorkflow.steps.find((step: any) => step.id === 'write');
    const writeConfig = writeStep.config.child.config;
    expect(writeConfig.allowedKeys).toContain('ai_score');
    expect(writeConfig.allowedKeys).toContain('source_meta');
    expect(writeConfig.stamp).toBe('ai_scored_at');
  });

  it('creates feed workflows explicitly from the feed-pipelines template', async () => {
    const store = createMemoryStore();
    const templateService = new WorkflowTemplateRouteService(store as any, settings);

    await templateService.instantiate('feed-pipelines', {
      conflictStrategy: 'reuse',
      variables: { providerId: settings.ACTIVE_AI_PROVIDER_ID }
    });

    const scoringAgent = store.agents.get(FEED_SCORING_AGENT_ID);
    const scoringWorkflow = store.workflows.get(FEED_SCORING_PIPELINE_WORKFLOW_ID);

    expect(scoringAgent).toMatchObject({
      id: FEED_SCORING_AGENT_ID,
      providerId: 'test-provider',
      model: 'test-model'
    });
    expect(store.agents.size).toBe(1);
    expect(store.workflows.size).toBe(1);
    expect(scoringWorkflow.metadata).toMatchObject({
      kind: 'scoring-pipeline',
      templateSource: 'workflow-template:feed-pipelines:workflow:feed_scoring_pipeline_workflow'
    });

    const scoreStep = scoringWorkflow.steps.find((step: any) => step.id === 'score');
    expect(scoreStep.config.child.id).toBe(FEED_SCORING_AGENT_ID);
  });

  it('preserves numeric Daily report variables when instantiating report templates', async () => {
    for (const templateId of [
      'ai-daily-report-json-from-summary',
      'ai-daily-report-json-from-raw'
    ]) {
      const store = createMemoryStore();
      const templateService = new WorkflowTemplateRouteService(store as any, settings);

      await templateService.instantiate(templateId, {
        conflictStrategy: 'reuse',
        variables: { providerId: settings.ACTIVE_AI_PROVIDER_ID }
      });

      const [workflow] = Array.from(store.workflows.values());
      const coverageStep = workflow.steps.find((step: any) => step.id === 'coverage');

      expect(workflow.templateVariables).toMatchObject({
        lookbackDays: 7,
        batchSize: 10
      });
      expect(coverageStep.inputTemplate).toMatchObject({
        namespace: 'ai-daily',
        lookbackDays: 7
      });
      expect(typeof workflow.templateVariables.lookbackDays).toBe('number');
      expect(typeof coverageStep.inputTemplate.lookbackDays).toBe('number');
    }
  });
});
