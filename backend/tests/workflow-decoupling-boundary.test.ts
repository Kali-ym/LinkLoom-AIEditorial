import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FeedRouteService } from '../src/services/api/FeedRouteService.js';
import { registerBuiltinSteps, StepCatalog } from '../src/services/agents/steps/index.js';

function readText(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

function readJson(relativePath: string) {
  return JSON.parse(readText(relativePath));
}

describe('workflow business decoupling boundaries', () => {
  it('keeps store-write defaults generic', () => {
    registerBuiltinSteps();
    const storeWrite = StepCatalog.getInstance().get('store-write');
    const serialized = JSON.stringify({
      defaultConfig: storeWrite.defaultConfig,
      configSchema: storeWrite.configSchema
    });

    expect(storeWrite.defaultConfig).toMatchObject({ allowedKeys: [], stamp: null });
    expect(serialized).not.toContain('ai_score');
    expect(serialized).not.toContain('ai_scored_at');
    expect(serialized).not.toContain('ai_topic');
    expect(serialized).not.toContain('source_meta');
  });

  it('keeps store-query defaults generic and pushes scoring query semantics into templates', () => {
    registerBuiltinSteps();
    const storeQuery = StepCatalog.getInstance().get('store-query');
    const serialized = JSON.stringify({
      defaultConfig: storeQuery.defaultConfig,
      configSchema: storeQuery.configSchema
    });

    expect(serialized).not.toContain('ai_score');
    expect(serialized).not.toContain('ai_scored_at');
    expect(serialized).not.toContain('ai_picked');
    expect(serialized).not.toContain('onlyUnscored');
    expect(serialized).not.toContain('onlyScored');
    expect(serialized).not.toContain('minScore');
    expect(serialized).toContain('metadataFilters');
    expect(serialized).toContain('orderMetadataPath');
  });

  it('keeps kv-write defaults generic and pushes Daily keys into templates', () => {
    registerBuiltinSteps();
    const kvWrite = StepCatalog.getInstance().get('kv-write');
    const serialized = JSON.stringify({
      defaultConfig: kvWrite.defaultConfig,
      configSchema: kvWrite.configSchema
    });

    expect(kvWrite.defaultConfig).toMatchObject({
      key: '',
      value: '$.current',
      indexKey: '',
      indexValue: ''
    });
  });

  it('declares Feed scoring query fields in workflow templates', () => {
    const standaloneScoring = readJson('backend/templates/feed-scoring-pipeline.json');
    const bundled = readJson('backend/templates/feed-pipelines.json');

    const scoringWorkflows = [standaloneScoring, bundled].map((template) =>
      template.workflows.find(
        (workflow: any) =>
          workflow.metadata?.kind === 'scoring-pipeline' ||
          workflow.id === '{{scoringPipelineWorkflowId}}'
      )
    );
    for (const workflow of scoringWorkflows) {
      const queryStep = workflow.steps.find((step: any) => step.id === 'query');
      expect(queryStep.config.filter.metadataFilters).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'ai_scored_at', op: 'notExists' })])
      );
      expect(JSON.stringify(queryStep.config)).not.toContain('onlyUnscored');
    }
  });

  it('scoring pipelines end with rebuild_hot snapshot tool step', () => {
    const standaloneScoring = readJson('backend/templates/feed-scoring-pipeline.json');
    const bundled = readJson('backend/templates/feed-pipelines.json');

    const scoringWorkflows = [standaloneScoring, bundled].map((template) =>
      template.workflows.find(
        (workflow: any) =>
          workflow.metadata?.kind === 'scoring-pipeline' ||
          workflow.id === '{{scoringPipelineWorkflowId}}'
      )
    );

    for (const workflow of scoringWorkflows) {
      expect(workflow).toBeTruthy();
      const write = workflow.steps.find((step: any) => step.id === 'write');
      const rebuild = workflow.steps.find((step: any) => step.id === 'rebuild_hot');
      expect(write.nextStepIds).toEqual(['rebuild_hot']);
      expect(rebuild).toMatchObject({
        id: 'rebuild_hot',
        type: 'tool',
        toolId: 'rebuild_hot_snapshot'
      });
      expect(rebuild.nextStepIds ?? []).toEqual([]);
    }
  });

  it('declares Daily JSON KV keys and numeric coverage variables in report templates', () => {
    const summaryTemplate = readJson('backend/templates/ai-daily-report-json-from-summary.json');
    const rawTemplate = readJson('backend/templates/ai-daily-report-json-from-raw.json');

    for (const template of [summaryTemplate, rawTemplate]) {
      const workflow = template.workflows[0];
      const coverageStep = workflow.steps.find((step: any) => step.id === 'coverage');
      const assembleStep = workflow.steps.find((step: any) => step.id === 'assemble');

      expect(coverageStep.inputTemplate).toMatchObject({
        namespace: '{{coverageNamespace}}',
        lookbackDays: '{{lookbackDays}}'
      });
      expect(assembleStep.inputTemplate).toMatchObject({
        kvKeyPrefix: '{{reportKvKeyPrefix}}',
        kvIndexKey: '{{reportKvIndexKey}}'
      });
      expect(template.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'lookbackDays', defaultValue: 7 }),
          expect.objectContaining({ id: 'reportKvKeyPrefix', defaultValue: 'daily_report_json:' }),
          expect.objectContaining({
            id: 'reportKvIndexKey',
            defaultValue: 'daily_report_json_index'
          })
        ])
      );
      expect(
        typeof template.variables.find((variable: any) => variable.id === 'lookbackDays')
          ?.defaultValue
      ).toBe('number');
    }
  });

  it('keeps AI Builder core catalog independent from LinkLoom business enums', () => {
    const catalogService = readText('backend/src/services/aiBuilder/AiBuilderCatalogService.ts');
    const domainProvider = readText(
      'backend/src/services/aiBuilder/AiBuilderDomainCatalogProvider.ts'
    );
    const prompts = readText('backend/src/services/aiBuilder/prompts/aiBuilderPrompts.ts');
    const appProvider = readText('backend/src/services/api/LinkLoomDomainCatalogProvider.ts');

    expect(catalogService).not.toContain('../../config/businessEnums');
    expect(catalogService).not.toContain('LinkLoomDomainCatalogProvider');
    expect(domainProvider).not.toContain('../../config/businessEnums');
    expect(domainProvider).not.toContain('LinkLoomDomainCatalogProvider');
    expect(prompts).not.toContain('catalog.businessEnums');
    expect(prompts).not.toContain('feedSourceTypes');
    expect(prompts).not.toContain('scoringMetadataKeys');
    expect(prompts).not.toContain('dailyReportJsonKeyTemplate');
    expect(appProvider).toContain('../../config/businessEnums');
  });

  it('keeps transform step free of Feed/Daily field semantics', () => {
    const source = readText('backend/src/services/agents/steps/TransformStep.ts');

    expect(source).not.toContain('ai_score');
    expect(source).not.toContain('ai_summary');
    expect(source).not.toContain('material_brief');
    expect(source).not.toContain('source_meta');
  });

  it('does not auto-install default agents, workflows, or schedules at service startup', () => {
    const source = readText('backend/src/services/initServices.ts');

    expect(source).not.toContain('seedDefaultAgents');
    expect(source).not.toContain('seedDefaultFeedWorkflows');
    expect(source).not.toContain('seedDefaultSchedules');
    expect(source).toContain('WorkflowTemplateRouteService');
  });

  it('declares Feed scoring writeback fields in workflow templates', () => {
    const standaloneTemplate = readJson('backend/templates/feed-scoring-pipeline.json');
    const bundledTemplate = readJson('backend/templates/feed-pipelines.json');

    for (const template of [standaloneTemplate, bundledTemplate]) {
      const scoringWorkflow = template.workflows.find(
        (workflow: any) =>
          workflow.metadata?.kind === 'scoring-pipeline' ||
          workflow.id === '{{scoringPipelineWorkflowId}}'
      );
      const writeStep = scoringWorkflow.steps.find((step: any) => step.id === 'write');
      const writeConfig = writeStep.config.child.config;

      expect(writeConfig.allowedKeys).toEqual(
        expect.arrayContaining(['ai_score', 'ai_summary', 'ai_topic', 'source_meta'])
      );
      expect(writeConfig.stamp).toBe('ai_scored_at');
    }
  });

  it('keeps summary daily mapping declared in workflow template instead of legacy tool', () => {
    const template = readJson('backend/templates/ai-daily-report-json-from-summary.json');
    const workflow = template.workflows[0];
    const materialBrief = workflow.steps.find((step: any) => step.id === 'material_brief');
    const serialized = JSON.stringify(template);

    expect(serialized).not.toContain('map_ai_summary_to_brief');
    expect(materialBrief).toMatchObject({ type: 'transform' });
    expect(materialBrief.config.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'mapArray' }),
        expect.objectContaining({ op: 'wrapResult' })
      ])
    );
    expect(JSON.stringify(materialBrief)).toContain('$.item.metadata.ai_summary');
    expect(JSON.stringify(materialBrief)).toContain('$.item.metadata.ai_score');
    expect(JSON.stringify(materialBrief)).toContain('$.item.metadata.ai_picked');
    expect(JSON.stringify(materialBrief)).toContain('$.item.metadata.ai_scored_at');
    expect(JSON.stringify(materialBrief)).toContain('$.item.metadata.key_facts');
    expect(JSON.stringify(materialBrief)).toContain('$.item.metadata.entities');
    expect(JSON.stringify(materialBrief)).toContain('$.item.metadata.numbers');
    expect(JSON.stringify(materialBrief)).toContain('$.item.metadata.ai_relevance_hint');
    expect(JSON.stringify(materialBrief)).toContain('$.item.metadata.event_signature');
    expect(JSON.stringify(materialBrief)).toContain('$.item.metadata.source_meta');
  });

  it('keeps Daily JSON prompt contract focused on scored facts and minimal digest output', () => {
    const prompt = readText('backend/src/prompts/daily-pipeline.md');

    expect(prompt).toContain('本步骤只处理原文或长描述输入');
    expect(prompt).toContain('UNEXPECTED_SUMMARY_INPUT');
    expect(prompt).toContain('只使用输入条目里能直接支持的信息');
    expect(prompt).toContain('`ai_score` 只作为排序参考，不是唯一标准');
    expect(prompt).toContain('`source_summary`、`key_facts`、`numbers` 是正文事实主来源');
    expect(prompt).toContain(
      '不要输出 `sections`、`items`、`body`、`body_md`、`source_items`、`metadata` 等额外顶层字段'
    );
  });

  it('lets Feed admin patch and reset metadata fields declared by workflow or request', async () => {
    const item = {
      id: 'item-1',
      metadata: {
        custom_score: 1,
        custom_label: 'old',
        custom_scored_at: '2026-03-14T00:00:00.000Z',
        untouched: true
      }
    };
    const store = {
      async getSourceData(id: string) {
        return id === item.id ? item : null;
      },
      async updateSourceDataMetadata(_id: string, metadata: Record<string, unknown>) {
        item.metadata = metadata as any;
      },
      async listWorkflows() {
        return [
          {
            metadata: { kind: 'scoring-pipeline' },
            steps: [
              {
                id: 'write',
                type: 'batch-iterate',
                config: {
                  child: {
                    type: 'store-write',
                    config: {
                      allowedKeys: ['custom_score', 'custom_label'],
                      stamp: 'custom_scored_at'
                    }
                  }
                }
              }
            ]
          }
        ];
      }
    };
    const service = new FeedRouteService(store as any, {} as any);

    await service.patchScoring('item-1', {
      metadata: { custom_score: 9, blocked: 'no' }
    });

    expect(item.metadata).toMatchObject({
      custom_score: 9,
      custom_label: 'old',
      custom_scored_at: '2026-03-14T00:00:00.000Z',
      untouched: true
    });
    expect(item.metadata).not.toHaveProperty('blocked');

    await service.resetScoring('item-1', { keys: ['custom_score'], stamp: false });
    expect(item.metadata).not.toHaveProperty('custom_score');
    expect(item.metadata).toMatchObject({
      custom_label: 'old',
      custom_scored_at: '2026-03-14T00:00:00.000Z',
      untouched: true
    });
  });
});
