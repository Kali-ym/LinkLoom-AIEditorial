import { ToolRegistry } from '../../../registries/ToolRegistry.js';
import type { WorkflowDefinition, WorkflowStep } from '../../../types/agent.js';
import type { RagKnowledgeScope } from '../../../types/rag.js';
import type { LocalStore } from '../../LocalStore.js';
import { LogService } from '../../LogService.js';
import { mergeKnowledgeScopes } from '../../rag/RagScope.js';
import type { TaskService } from '../../TaskService.js';
import type { AgentService } from '../AgentService.js';
import type { BatchAgentStepExecutor } from '../batch/BatchAgentStepExecutor.js';
import { buildToolInput, mergePreparedWithStepOutput } from '../batch/batchUtils.js';
import type { SingleAgentStepExecutor } from '../batch/SingleAgentStepExecutor.js';
import { StepRegistry, type StepExecutionContext } from '../steps/index.js';
import type { WorkflowProgressPayload, WorkflowRunOptions } from '../WorkflowEngine.js';
import { deepClone, truncateFields } from '../workflowExpressions.js';
import type { WorkflowInputResolver } from '../WorkflowInputResolver.js';
import {
  buildWorkflowStepApproval,
  shouldGateWorkflowTool,
  WorkflowStepApprovalRequired
} from '../WorkflowStepApproval.js';

/**
 * 子工作流回调：WorkflowStepDispatcher 不直接持有 WorkflowEngine（避免循环依赖），
 * 而是在构造时拿到一个"运行另一个 workflow"的函数引用。
 */
export type SubWorkflowRunner = (
  workflowId: string,
  input: unknown,
  date: string | undefined,
  options: WorkflowRunOptions | undefined
) => Promise<unknown>;

export interface WorkflowStepDispatcherDeps {
  store: LocalStore;
  agentService: AgentService;
  inputResolver: WorkflowInputResolver;
  batchExecutor: BatchAgentStepExecutor;
  singleAgentExecutor: SingleAgentStepExecutor;
  runSubWorkflow: SubWorkflowRunner;
  /** 由 engine 通过 attachTaskService 注入；StepRegistry 内的 adapter/batch-iterate 需要它 */
  getTaskService: () => TaskService | null;
  /** 当 StepRegistry 调度时回传给业务 step；目前只需 engine 的引用透传到 ctx */
  getWorkflowEngine: () => unknown;
}

function resolveWorkflowKnowledgeScope(
  workflow: WorkflowDefinition,
  step: WorkflowStep,
  runtime: Record<string, unknown>
): RagKnowledgeScope | undefined {
  return mergeKnowledgeScopes(
    mergeKnowledgeScopes(asKnowledgeScope(workflow.metadata?.knowledgeScope), asKnowledgeScope(runtime.knowledgeScope)),
    step.knowledgeScope || asKnowledgeScope(step.config?.knowledgeScope) || asKnowledgeScope(step.metadata?.knowledgeScope)
  );
}

function asKnowledgeScope(value: unknown): RagKnowledgeScope | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value;
}

/**
 * 单步执行派发器（B3 拆分目标）。
 *
 * 负责：
 *  - 解析 step 输入（disabled / payload truncation / preparedInput）；
 *  - 根据 step 类型（StepRegistry / tool / agent / sub-workflow）派发到对应执行器；
 *  - 输出统一日志切片，便于排错。
 *
 * 不负责：runWorkflow 的拓扑驱动、进度上报、heartbeat。
 */
export class WorkflowStepDispatcher {
  constructor(private readonly deps: WorkflowStepDispatcherDeps) {}

  async executeStep(
    workflow: WorkflowDefinition,
    step: WorkflowStep,
    stepResults: Record<string, unknown>,
    predecessors: string[],
    date: string | undefined,
    options: WorkflowRunOptions | undefined,
    emit: ((payload: WorkflowProgressPayload) => void) | undefined
  ): Promise<unknown> {
    LogService.info(`Executing workflow step: ${step.id}`);

    const { inputResolver } = this.deps;

    if (step.enabled === false) {
      LogService.info(`[Workflow ${step.id}] Step is disabled, skipping (pass-through).`);
      return inputResolver.deriveStepInput(
        step,
        stepResults,
        predecessors,
        workflow,
        date,
        options
      );
    }

    const rawStepInput = inputResolver.deriveStepInput(
      step,
      stepResults,
      predecessors,
      workflow,
      date,
      options
    );
    const { workingInput, preparedInput } = inputResolver.resolveStepWorkingInput(
      step,
      rawStepInput,
      stepResults,
      workflow,
      date,
      options
    );
    const agentInput: unknown = step.execution?.payloadFieldLimits
      ? truncateFields(deepClone(workingInput), step.execution.payloadFieldLimits)
      : workingInput;
    const inputText =
      typeof agentInput === 'string' ? agentInput : (JSON.stringify(agentInput) ?? '');
    const stepType = step.type || (step.toolId ? 'tool' : step.workflowId ? 'workflow' : 'agent');
    const runtime = (options?.runtimeOptions ?? {});
    const knowledgeScope = resolveWorkflowKnowledgeScope(workflow, step, runtime);

    let output: unknown = null;

    const registry = StepRegistry.getInstance();
    if (registry.has(stepType)) {
      const taskService = this.deps.getTaskService();
      if ((stepType === 'adapter' || stepType === 'batch-iterate') && !taskService) {
        throw new Error(
          `Workflow step ${step.id} (type=${stepType}) requires TaskService to be attached to WorkflowEngine`
        );
      }
      const stepCtx: StepExecutionContext = {
        store: this.deps.store,
        agentService: this.deps.agentService,
        taskService: taskService as TaskService,
        workflowEngine: this.deps.getWorkflowEngine() as never,
        date,
        emit,
        runOptions: options,
        workflow,
        step,
        resolvedInput: workingInput,
        stepResults
      };
      output = await registry.execute(stepType, stepCtx);
      this.logOutput(step, output);
      return output;
    }

    if (stepType === 'tool' || step.toolId) {
      const toolInput = buildToolInput(workingInput);
      LogService.info(
        `[Workflow ${step.id}] Input: ${inputText.slice(0, 1000)}${inputText.length > 1000 ? '...(truncated)' : ''}`
      );
      if (date && toolInput.date === undefined) toolInput.date = date;
      toolInput.stepLabel = toolInput.stepLabel || `Workflow ${step.id}`;
      if (!step.toolId) throw new Error(`Workflow step ${step.id} is type=tool but has no toolId`);

      if (shouldGateWorkflowTool(step.toolId, runtime)) {
        const workflowRunId = runtime.workflowRunId as string | undefined;
        if (!workflowRunId) {
          throw new Error(
            `Workflow step ${step.id} (${step.toolId}) requires approval but workflowRunId is missing`
          );
        }
        throw new WorkflowStepApprovalRequired(
          buildWorkflowStepApproval({
            workflowRunId,
            workflowId: workflow.id,
            workflowName: workflow.name,
            step,
            toolId: step.toolId,
            toolInput,
            stepResults,
            date,
            runtimeOptions: runtime
          })
        );
      }

      const toolResult = await ToolRegistry.getInstance().callTool(
        step.toolId,
        toolInput,
        knowledgeScope ? { knowledgeScope } : undefined
      );
      output =
        preparedInput !== undefined
          ? mergePreparedWithStepOutput(preparedInput, toolResult)
          : toolResult;
    } else if (stepType === 'agent' || step.agentId) {
      const agentOpts = {
        silent: true,
        ...(step.agentOptions || {}),
        runSource: 'workflow' as const,
        metadata: {
          workflowRunId: runtime.workflowRunId,
          workflowId: runtime.workflowId ?? workflow.id,
          stepId: step.id
        },
        toolContextExtras: knowledgeScope ? { knowledgeScope } : undefined
      };
      LogService.info(
        `[Workflow ${step.id}] Input: ${inputText.slice(0, 1000)}${inputText.length > 1000 ? '...(truncated)' : ''}`
      );
      if (!step.agentId)
        throw new Error(`Workflow step ${step.id} is type=agent but has no agentId`);
      if (step.execution?.mode === 'batch') {
        output = await this.deps.batchExecutor.run(step, workingInput, date, emit, {
          metadata: agentOpts.metadata,
          toolContextExtras: agentOpts.toolContextExtras
        });
      } else {
        output = await this.deps.singleAgentExecutor.run(
          step,
          inputText,
          workingInput,
          date,
          agentOpts
        );
      }
    } else if (stepType === 'workflow' || step.workflowId) {
      LogService.info(
        `[Workflow ${step.id}] Input: ${inputText.slice(0, 1000)}${inputText.length > 1000 ? '...(truncated)' : ''}`
      );
      if (!step.workflowId)
        throw new Error(`Workflow step ${step.id} is type=workflow but has no workflowId`);
      output = await this.deps.runSubWorkflow(step.workflowId, workingInput, date, {
        ...options,
        _depth: (options?._depth ?? 0) + 1,
        runtimeOptions: {
          ...(options?.runtimeOptions ?? {}),
          parentWorkflowStepId: step.id,
          parentWorkflowId: workflow.id,
          knowledgeScope,
          parentStepResultsSnapshot: { ...stepResults },
          parentDate: date
        }
      });
    } else {
      throw new Error(
        `Workflow step ${step.id} has unsupported step type: ${String(step.type || 'unknown')}`
      );
    }

    this.logOutput(step, output);
    return output;
  }

  private logOutput(step: WorkflowStep, output: unknown): void {
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    LogService.info(
      `[Workflow ${step.id}] Output: ${outputStr?.slice(0, 1000)}${(outputStr?.length || 0) > 1000 ? '...(truncated)' : ''}`
    );
  }
}
