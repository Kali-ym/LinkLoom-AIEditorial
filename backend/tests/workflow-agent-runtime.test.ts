import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import { QueryKnowledgeTool } from '../src/plugins/builtin/tools/QueryKnowledgeTool.js';
import { SingleAgentStepExecutor } from '../src/services/agents/batch/SingleAgentStepExecutor.js';
import { BatchAgentStepExecutor } from '../src/services/agents/batch/BatchAgentStepExecutor.js';
import { WorkflowStepDispatcher } from '../src/services/agents/runtime/WorkflowStepDispatcher.js';
import type { WorkflowDefinition, WorkflowStep } from '../src/types/agent.js';

function createAgentService(contents: string[]) {
  let index = 0;
  return {
    runAgent: vi.fn().mockImplementation(async () => {
      const content = contents[index] ?? contents[contents.length - 1] ?? '';
      index += 1;
      return {
        content,
        stopReason: 'final',
        trace: {
          runId: `workflow-agent-test-${index}`,
          mode: 'react',
          startedAt: '2026-01-01T00:00:00.000Z',
          rounds: []
        }
      };
    })
  };
}

function createWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: 'workflow-1',
    name: 'Workflow 1',
    description: 'test workflow',
    initialStepId: 'step-1',
    steps: [],
    ...overrides
  };
}

function createInputResolver(input: unknown) {
  return {
    deriveStepInput: vi.fn(() => input),
    resolveStepWorkingInput: vi.fn(() => ({ workingInput: input, preparedInput: undefined }))
  };
}

describe('Workflow agent runtime entrypoints', () => {
  it('runs single agent steps through AgentService.runAgent and keeps workflow output as content', async () => {
    const agentService = createAgentService(['plain content']);
    const executor = new SingleAgentStepExecutor(agentService as any);
    const step: WorkflowStep = {
      id: 'single-step',
      type: 'agent',
      agentId: 'agent-1',
      agentOptions: {
        noTools: true,
        noSkills: true
      }
    };

    const output = await executor.run(step, 'input text', { source: 'workflow' }, '2026-01-01', {
      silent: true,
      noTools: step.agentOptions?.noTools,
      noSkills: step.agentOptions?.noSkills
    });

    expect(output).toBe('plain content');
    expect(agentService.runAgent).toHaveBeenCalledWith('agent-1', 'input text', '2026-01-01', {
      silent: true,
      noTools: true,
      noSkills: true,
      runSource: 'workflow',
      metadata: {
        stepId: 'single-step',
        agentId: 'agent-1'
      },
      messages: undefined
    });
  });

  it('keeps single agent self-correction on the same AgentService.runAgent entrypoint', async () => {
    const agentService = createAgentService(['not json', '{"ok":true}']);
    const executor = new SingleAgentStepExecutor(agentService as any);
    const step: WorkflowStep = {
      id: 'single-correction-step',
      type: 'agent',
      agentId: 'agent-1',
      execution: {
        validateJsonObject: true,
        maxAgentRetries: 1
      }
    };

    const output = await executor.run(step, 'input text', { source: 'workflow' }, undefined, {
      silent: true
    });

    expect(output).toBe('{"ok":true}');
    expect(agentService.runAgent).toHaveBeenCalledTimes(2);
    expect(agentService.runAgent.mock.calls[1][3]).toMatchObject({
      silent: true,
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'input text' }),
        expect.objectContaining({ role: 'assistant' }),
        expect.objectContaining({ role: 'user' })
      ])
    });
  });

  it('runs batch agent steps through AgentService.runAgent without exposing trace in step output', async () => {
    const agentService = createAgentService(['[{"title":"a"},{"title":"b"}]', '[{"title":"c"}]']);
    const executor = new BatchAgentStepExecutor(agentService as any);
    const step: WorkflowStep = {
      id: 'batch-step',
      type: 'agent',
      agentId: 'agent-1',
      agentOptions: {
        noTools: true,
        noSkills: true
      },
      execution: {
        mode: 'batch',
        batchSize: 2,
        validateBatchItemCount: true
      }
    };
    const input = [{ title: 'a' }, { title: 'b' }, { title: 'c' }];

    const output = await executor.run(step, input, '2026-01-01', undefined);

    expect(output).toEqual({
      count: 3,
      items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }]
    });
    expect(agentService.runAgent).toHaveBeenCalledTimes(2);
    expect(agentService.runAgent.mock.calls[0][0]).toBe('agent-1');
    expect(agentService.runAgent.mock.calls[0][2]).toBe('2026-01-01');
    expect(agentService.runAgent.mock.calls[0][3]).toMatchObject({
      silent: true,
      noTools: true,
      noSkills: true
    });
    expect(output).not.toHaveProperty('trace');
    expect(output).not.toHaveProperty('stopReason');
  });

  it('passes workflow step knowledgeScope into direct tool calls', async () => {
    const toolRegistry = ToolRegistry.getInstance();
    toolRegistry.registerTool(new QueryKnowledgeTool());
    const calls: Array<{ query: string; options: Record<string, unknown> }> = [];
    toolRegistry.setDefaultContextSupplier(async () => ({
      services: {
        knowledgeBaseService: {
          async queryKnowledgeDetailed(query: string, options: Record<string, unknown>) {
            calls.push({ query, options });
            return { answer: `knowledge:${query}` };
          }
        }
      }
    }) as any);
    const agentService = createAgentService([]);
    const dispatcher = new WorkflowStepDispatcher({
      store: {} as any,
      agentService: agentService as any,
      inputResolver: createInputResolver({ query: 'workflow direct scope' }) as any,
      batchExecutor: new BatchAgentStepExecutor(agentService as any),
      singleAgentExecutor: new SingleAgentStepExecutor(agentService as any),
      runSubWorkflow: vi.fn(),
      getTaskService: () => null,
      getWorkflowEngine: () => null
    });
    const workflow = createWorkflow({
      metadata: {
        knowledgeScope: {
          allowedCategoryIds: ['workflow-cat'],
          scopeSource: 'workflow'
        }
      }
    });
    const step: WorkflowStep = {
      id: 'tool-scope-step',
      type: 'tool',
      toolId: 'query_knowledge',
      knowledgeScope: {
        allowedCategoryIds: ['workflow-cat'],
        allowedDocumentIds: ['step-doc'],
        scopeSource: 'step'
      }
    };

    const output = await dispatcher.executeStep(
      workflow,
      step,
      {},
      [],
      undefined,
      undefined,
      undefined
    );

    expect(output).toEqual({ answer: 'knowledge:workflow direct scope' });
    expect(calls[0].options).toMatchObject({
      fallbackFormat: 'context',
      sourceFilter: {
        parentIds: ['step-doc'],
        metadata: expect.objectContaining({
          categoryIds: ['workflow-cat'],
          documentIds: ['step-doc'],
          mergedScope: true
        })
      }
    });
  });

  it('passes workflow step knowledgeScope into nested single agent calls', async () => {
    const agentService = createAgentService(['scoped output']);
    const dispatcher = new WorkflowStepDispatcher({
      store: {} as any,
      agentService: agentService as any,
      inputResolver: createInputResolver('input text') as any,
      batchExecutor: new BatchAgentStepExecutor(agentService as any),
      singleAgentExecutor: new SingleAgentStepExecutor(agentService as any),
      runSubWorkflow: vi.fn(),
      getTaskService: () => null,
      getWorkflowEngine: () => null
    });
    const step: WorkflowStep = {
      id: 'agent-scope-step',
      type: 'agent',
      agentId: 'agent-1',
      knowledgeScope: {
        allowedCategoryIds: ['step-cat'],
        scopeSource: 'step'
      }
    };

    const output = await dispatcher.executeStep(
      createWorkflow(),
      step,
      {},
      [],
      undefined,
      {
        runtimeOptions: {
          knowledgeScope: {
            allowedCategoryIds: ['step-cat', 'runtime-cat'],
            allowedDocumentIds: ['runtime-doc'],
            scopeSource: 'workflow'
          }
        }
      },
      undefined
    );

    expect(output).toBe('scoped output');
    expect(agentService.runAgent.mock.calls[0][3]).toMatchObject({
      toolContextExtras: {
        knowledgeScope: {
          allowedCategoryIds: ['step-cat'],
          allowedDocumentIds: ['runtime-doc'],
          scopeSource: 'step'
        }
      }
    });
  });

  it('passes workflow step knowledgeScope into nested batch agent calls', async () => {
    const agentService = createAgentService(['[{"title":"a"}]']);
    const dispatcher = new WorkflowStepDispatcher({
      store: {} as any,
      agentService: agentService as any,
      inputResolver: createInputResolver([{ title: 'a' }]) as any,
      batchExecutor: new BatchAgentStepExecutor(agentService as any),
      singleAgentExecutor: new SingleAgentStepExecutor(agentService as any),
      runSubWorkflow: vi.fn(),
      getTaskService: () => null,
      getWorkflowEngine: () => null
    });
    const step: WorkflowStep = {
      id: 'batch-scope-step',
      type: 'agent',
      agentId: 'agent-1',
      execution: {
        mode: 'batch',
        batchSize: 1
      },
      knowledgeScope: {
        allowedCategoryIds: ['batch-cat'],
        scopeSource: 'step'
      }
    };

    const output = await dispatcher.executeStep(
      createWorkflow(),
      step,
      {},
      [],
      undefined,
      undefined,
      undefined
    );

    expect(output).toEqual({ count: 1, items: [{ title: 'a' }] });
    expect(agentService.runAgent.mock.calls[0][3]).toMatchObject({
      toolContextExtras: {
        knowledgeScope: {
          allowedCategoryIds: ['batch-cat'],
          scopeSource: 'step'
        }
      }
    });
  });
});
