import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergePreparedWithStepOutput } from '../src/services/agents/batch/batchUtils.js';
import { WorkflowInputResolver } from '../src/services/agents/WorkflowInputResolver.js';
import { DigestContextService } from '../src/services/editorial/DigestContextService.js';

const resolver = new WorkflowInputResolver();

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8'));
}

function createDigestContext(values: Record<string, unknown>) {
  return new DigestContextService({
    async get(key: string) {
      return values[key];
    }
  } as never).getDigestContext('2026-06-06');
}

const workflow = {
  id: 'wf_test',
  name: 'Resolver Test',
  description: '',
  initialStepId: 'coverage',
  steps: [
    {
      id: 'coverage',
      type: 'tool' as const,
      toolId: 'missing_tool_for_test',
      inputTransform: {
        operations: [
          { op: 'parseJson' },
          { op: 'default', path: 'items', value: '$.current' },
          { op: 'set', path: 'editorialMode', value: '$.__runtimeOptions.editorialMode' },
          {
            op: 'set',
            path: 'pipelineHints',
            value: '$.__runtimeOptions.digestContext.suggestedDailyOneXTopics'
          },
          { op: 'default', path: 'pipelineHints', value: [] },
          { op: 'default', path: 'editorialMode', value: 'standard' },
          {
            op: 'wrapResult',
            template: {
              items: '$.current.items',
              editorialMode: '$.current.editorialMode',
              pipelineHints: '$.current.pipelineHints'
            }
          }
        ]
      },
      inputTemplate: {
        items: '$.current.items',
        mode: '$.current.editorialMode',
        pipelineHints: '$.current.pipelineHints',
        date: '$.__date'
      },
      nextStepIds: ['brief']
    },
    {
      id: 'brief',
      type: 'agent' as const,
      agentId: 'agent_brief',
      inputTemplate: { items: '$.coverage.items' },
      nextStepIds: ['qa']
    },
    {
      id: 'qa',
      type: 'agent' as const,
      agentId: 'agent_qa',
      inputMap: { fragments: '$.brief', original: 'coverage' },
      nextStepIds: []
    }
  ]
};

describe('WorkflowInputResolver', () => {
  describe('buildDependencyGraph', () => {
    it('resolves step dependencies correctly', () => {
      const deps = resolver.buildDependencyGraph(workflow);
      expect(deps.get('brief')).toEqual(['coverage']);
      expect(deps.get('qa')).toEqual(['brief', 'coverage']);
    });
  });

  describe('dryRunStep', () => {
    it('transforms coverage step input with parseJson, default, set, wrapResult', () => {
      const coverage = resolver.dryRunStep({
        workflow,
        stepId: 'coverage',
        input: JSON.stringify({ items: [{ title: 'A' }] }),
        date: '2026-05-21',
        options: { runtimeOptions: { editorialMode: 'conservative' } }
      });

      expect(coverage.rawInput).toEqual(JSON.stringify({ items: [{ title: 'A' }] }));
      expect(coverage.transformedInput).toEqual({
        items: [{ title: 'A' }],
        editorialMode: 'conservative',
        pipelineHints: []
      });
      expect(coverage.finalInput).toEqual({
        items: [{ title: 'A' }],
        mode: 'conservative',
        pipelineHints: [],
        date: '2026-05-21'
      });
      expect(coverage.errors.some((error: string) => error.includes('Tool not found'))).toBe(true);
    });

    it('injects DigestContext topics into pipeline hints', () => {
      const coverage = resolver.dryRunStep({
        workflow,
        stepId: 'coverage',
        input: JSON.stringify({ items: [{ title: 'A' }] }),
        date: '2026-05-21',
        options: {
          runtimeOptions: {
            editorialMode: 'standard',
            digestContext: {
              suggestedDailyOneXTopics: ['开源模型更新', 'AI Agent 工具链']
            }
          }
        }
      });

      expect(coverage.transformedInput).toMatchObject({
        pipelineHints: ['开源模型更新', 'AI Agent 工具链']
      });
      expect(coverage.finalInput).toMatchObject({
        pipelineHints: ['开源模型更新', 'AI Agent 工具链']
      });
    });

    it('passes real DigestContext KV samples into daily report plan pipeline_hints', async () => {
      const reportTemplate = readJson('backend/templates/ai-daily-report-json-from-raw.json');
      const reportWorkflow = reportTemplate.workflows[0];
      const inputItems = [
        {
          title: 'Agent 工具链发布',
          url: 'https://example.com/agent-tooling',
          source: '官方源'
        }
      ];
      const digestContext = await createDigestContext({
        'hot_topics_digest:2026-06-06': {
          items: [
            {
              metadata: {
                translated_title: '高分开源模型发布',
                source: '官方源',
                ai_score: 95,
                url: 'https://example.com/high'
              }
            }
          ]
        },
        'source_monitor_snapshot:2026-06-06': {
          items: [{ title: '官方更新 A', source: '官方源' }]
        },
        'topic_track_digest:2026-06-06': {
          items: [
            { title: 'Agent 工具链更新', metadata: { ai_tags: ['AI Agent', '开源模型'] } },
            { title: '推理模型进展', ai_tags: 'AI Agent, 推理模型' }
          ]
        }
      });

      const coverage = resolver.dryRunStep({
        workflow: reportWorkflow,
        stepId: 'coverage',
        input: JSON.stringify({ items: inputItems }),
        date: '2026-06-06',
        options: { runtimeOptions: { digestContext } }
      });
      const coverageOutput = mergePreparedWithStepOutput(coverage.transformedInput, {
        coverage: [],
        historicalUrls: []
      });
      const plan = resolver.dryRunStep({
        workflow: reportWorkflow,
        stepId: 'plan',
        date: '2026-06-06',
        stepResults: {
          coverage: coverageOutput,
          dedup: { items: inputItems, dedup_log: [] },
          material_brief: { count: inputItems.length, items: inputItems }
        }
      });

      expect(digestContext.stale).toBe(false);
      expect(coverage.transformedInput).toMatchObject({
        pipelineHints: ['AI Agent', '开源模型', '推理模型']
      });
      expect(plan.errors).toEqual([]);
      expect(plan.finalInput).toMatchObject({
        pipeline_hints: ['AI Agent', '开源模型', '推理模型']
      });
    });

    it('resolves qa step inputMap from step results', () => {
      const qa = resolver.dryRunStep({
        workflow,
        stepId: 'qa',
        input: { ignored: true },
        stepResults: {
          coverage: { items: [1, 2] },
          brief: { items: [1] }
        }
      });

      expect(qa.rawInput).toEqual({
        fragments: { items: [1] },
        original: { items: [1, 2] }
      });
      expect(qa.finalInput).toEqual(qa.rawInput);
      expect(qa.errors).toEqual([]);
    });
  });
});
