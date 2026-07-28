import { WorkflowDefinition, WorkflowStep } from '../../types/agent.js';
import { AIProvider } from '../AIProvider.js';
import { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import type { TaskService } from '../TaskService.js';
import { AgentService } from './AgentService.js';
import { BatchAgentStepExecutor } from './batch/BatchAgentStepExecutor.js';
import { SingleAgentStepExecutor } from './batch/SingleAgentStepExecutor.js';
import { WorkflowStepDispatcher } from './runtime/WorkflowStepDispatcher.js';
import {
  getStepDisplayName,
  getTerminalStepIds,
  isResponseEmpty
} from './runtime/workflowTopology.js';
import { registerBuiltinSteps } from './steps/index.js';
import { getByPath, renderTemplate, resolveRef, setByPath } from './workflowExpressions.js';
import {
  mergeWorkflowRuntimeOptions,
  type WorkflowRunCheckpoint
} from './WorkflowStepApproval.js';
import { WorkflowInputResolver } from './WorkflowInputResolver.js';

/** 仅顶层工作流（_depth===0）会触发 onProgress，避免子工作流刷屏 */
export interface WorkflowProgressPayload {
  type: string;
  workflowId?: string;
  stepId?: string;
  stepIds?: string[];
  agentId?: string;
  agentName?: string;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface WorkflowRunOptions {
  onProgress?: (payload: WorkflowProgressPayload) => void;
  runtimeOptions?: Record<string, unknown>;
  _depth?: number;
}

export class WorkflowEngine {
  private store: LocalStore;
  private agentService: AgentService;
  private aiProvider: AIProvider;
  private inputResolver = new WorkflowInputResolver();
  private taskService: TaskService | null = null;
  private batchExecutor: BatchAgentStepExecutor;
  private singleAgentExecutor: SingleAgentStepExecutor;
  private dispatcher: WorkflowStepDispatcher;

  constructor(store: LocalStore, agentService: AgentService, aiProvider: AIProvider) {
    this.store = store;
    this.agentService = agentService;
    this.aiProvider = aiProvider;
    this.batchExecutor = new BatchAgentStepExecutor(agentService);
    this.singleAgentExecutor = new SingleAgentStepExecutor(agentService);
    this.dispatcher = new WorkflowStepDispatcher({
      store: this.store,
      agentService: this.agentService,
      inputResolver: this.inputResolver,
      batchExecutor: this.batchExecutor,
      singleAgentExecutor: this.singleAgentExecutor,
      runSubWorkflow: (workflowId, input, date, options) =>
        this.runWorkflow(workflowId, input, date, options),
      getTaskService: () => this.taskService,
      getWorkflowEngine: () => this
    });
    registerBuiltinSteps();
  }

  /**
   * 因为 TaskService 在创建顺序上晚于 WorkflowEngine（适配器需要 engine），
   * 这里提供延迟注入。AdapterStep / batch-iterate 内部访问 ctx.taskService。
   */
  attachTaskService(taskService: TaskService) {
    this.taskService = taskService;
  }

  getTaskService(): TaskService | null {
    return this.taskService;
  }

  async runWorkflow(
    workflowId: string,
    initialInput: any,
    date?: string,
    options?: WorkflowRunOptions
  ): Promise<any> {
    const normalizedOptions = this.normalizeRunOptions(options);

    const workflow = await this.store.getWorkflow(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const depth = normalizedOptions._depth ?? 0;
    const emit = (p: WorkflowProgressPayload) => {
      if (depth === 0) normalizedOptions.onProgress?.(p);
    };

    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    if (depth === 0 && normalizedOptions.onProgress) {
      heartbeatTimer = setInterval(() => {
        emit({ type: 'heartbeat', workflowId, ts: Date.now() });
      }, 20_000);
    }

    LogService.info(`Starting workflow: ${workflow.name}${date ? ` for date: ${date}` : ''}`);

    try {
      const stepMap = new Map<string, WorkflowStep>();
      for (const step of workflow.steps) {
        stepMap.set(step.id, step);
      }

      const agentNameMap = new Map<string, string>();
      if (depth === 0 && normalizedOptions.onProgress) {
        const agentIds = new Set<string>();
        for (const s of workflow.steps) {
          if (s.agentId) agentIds.add(s.agentId);
        }
        for (const aid of agentIds) {
          const ag = await this.store.getAgent(aid);
          if (ag?.name) agentNameMap.set(aid, ag.name);
        }
      }

      // Build dependency graph: for each step, collect which step IDs it depends on
      const dependencies = this.inputResolver.buildDependencyGraph(workflow);
      // Build reverse map: step -> list of steps that follow it
      const successors = this.inputResolver.buildSuccessorMap(workflow);

      const stepResults: Record<string, any> = {
        start: initialInput,
        __context: {
          date,
          runtimeOptions: normalizedOptions.runtimeOptions || {}
        }
      };

      const completed = new Set<string>();
      // Track in-degree (number of unresolved dependencies) for each step
      const inDegree = new Map<string, number>();

      for (const step of workflow.steps) {
        inDegree.set(step.id, (dependencies.get(step.id) || []).length);
      }

      // Collect initial ready steps (zero dependencies)
      let readyQueue: string[] = [];
      for (const step of workflow.steps) {
        if ((inDegree.get(step.id) || 0) === 0) {
          readyQueue.push(step.id);
        }
      }

      let finalOutput: any = null;
      let workflowError: Error | null = null;

      while (readyQueue.length > 0) {
        LogService.info(`Parallel batch: [${readyQueue.join(', ')}]`);

        emit({ type: 'batch', workflowId, stepIds: [...readyQueue] });
        for (const stepId of readyQueue) {
          const st = stepMap.get(stepId)!;
          const stepLabel = getStepDisplayName(st, agentNameMap);
          emit({
            type: 'step_start',
            workflowId,
            stepId,
            displayName: stepLabel,
            agentId: st.agentId,
            agentName: stepLabel
          });
        }

        // Execute all ready steps in parallel
        const batchResults = await Promise.allSettled(
          readyQueue.map((stepId) =>
            this.dispatcher.executeStep(
              workflow,
              stepMap.get(stepId)!,
              stepResults,
              dependencies.get(stepId) || [],
              date,
              normalizedOptions,
              emit
            )
          )
        );

        // Process results and find next ready steps
        const nextReady: string[] = [];
        let shouldInterrupt = false;

        for (let i = 0; i < readyQueue.length; i++) {
          const stepId = readyQueue[i];
          const result = batchResults[i];
          const st = stepMap.get(stepId)!;
          let stepOutput: unknown;

          if (result.status === 'fulfilled') {
            stepOutput = result.value;
            stepResults[stepId] = stepOutput;
            this.applyOutputMap(st, stepOutput, stepResults, workflow, date, normalizedOptions);
            finalOutput = stepOutput;

            if (isResponseEmpty(stepOutput)) {
              const succs = successors.get(stepId) || [];
              emit({
                type: 'step_done',
                workflowId,
                stepId,
                displayName: getStepDisplayName(st, agentNameMap),
                agentId: st.agentId,
                success: succs.length === 0,
                error: succs.length > 0 ? 'empty_response' : undefined
              });
              if (succs.length > 0) {
                LogService.warn(
                  `Workflow ${workflowId} interrupted at step ${stepId}: Empty response received.`
                );
                workflowError = new Error(
                  `Workflow step ${stepId} returned an empty response before successor steps could run`
                );
                shouldInterrupt = true;
                break;
              } else {
                LogService.info(
                  `Workflow ${workflowId} step ${stepId} returned empty response but has no successors. Continuing.`
                );
              }
            } else {
              const routerMeta = this.getRouterStepMeta(st, stepOutput);
              emit({
                type: 'step_done',
                workflowId,
                stepId,
                displayName: getStepDisplayName(st, agentNameMap),
                agentId: st.agentId,
                success: true,
                ...routerMeta
              });
            }
          } else {
            LogService.error(`Workflow step ${stepId} failed: ${result.reason}`);
            stepResults[stepId] = { error: String(result.reason) };
            finalOutput = stepResults[stepId];
            emit({
              type: 'step_done',
              workflowId,
              stepId,
              displayName: getStepDisplayName(st, agentNameMap),
              agentId: st.agentId,
              success: false,
              error: String(result.reason)
            });
            workflowError =
              result.reason instanceof Error ? result.reason : new Error(String(result.reason));
            shouldInterrupt = true;
            break;
          }

          completed.add(stepId);

          const nextIds = this.resolveSuccessorStepIds(st, stepOutput, successors);
          for (const nextId of nextIds) {
            const newDeg = (inDegree.get(nextId) || 1) - 1;
            inDegree.set(nextId, newDeg);
            if (newDeg === 0 && !completed.has(nextId)) {
              nextReady.push(nextId);
            }
          }
        }

        if (shouldInterrupt) {
          break;
        }

        readyQueue = nextReady;
      }

      if (workflowError) {
        throw workflowError;
      }

      const terminalIds = this.getTerminalStepIds(workflow);
      if (terminalIds.length === 1) {
        const sinkId = terminalIds[0];
        if (completed.has(sinkId) && stepResults[sinkId] !== undefined) {
          return await this.finalizeWorkflowOutput(
            workflow,
            stepResults[sinkId],
            stepResults,
            date,
            normalizedOptions
          );
        }
      }

      return await this.finalizeWorkflowOutput(
        workflow,
        finalOutput,
        stepResults,
        date,
        normalizedOptions
      );
    } finally {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    }
  }

  /** 无出边（不指向其它工作流步骤）的步骤 id，通常为流水线终点 */
  private getTerminalStepIds(workflow: WorkflowDefinition): string[] {
    return getTerminalStepIds(workflow, this.inputResolver);
  }

  private finalizeWorkflowOutput(
    workflow: WorkflowDefinition,
    finalOutput: unknown,
    stepResults: Record<string, any>,
    date?: string,
    options?: WorkflowRunOptions
  ): unknown {
    if (workflow.outputSpec === undefined) return finalOutput;
    const scope = this.inputResolver.buildScope(stepResults, workflow, date, options, finalOutput);
    scope.output = finalOutput;
    return renderTemplate(workflow.outputSpec, scope);
  }

  async continueFromCheckpoint(
    workflowId: string,
    checkpoint: WorkflowRunCheckpoint,
    approvedStepId: string,
    approvedStepOutput: unknown,
    options?: WorkflowRunOptions
  ): Promise<unknown> {
    const normalizedOptions = this.normalizeRunOptions(options, checkpoint.runtimeOptions);

    const workflow = await this.store.getWorkflow(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const depth = normalizedOptions._depth ?? 0;
    const emit = (p: WorkflowProgressPayload) => {
      if (depth === 0) normalizedOptions.onProgress?.(p);
    };

    const stepMap = new Map<string, WorkflowStep>();
    for (const step of workflow.steps) {
      stepMap.set(step.id, step);
    }

    const agentNameMap = new Map<string, string>();
    if (depth === 0 && normalizedOptions.onProgress) {
      const agentIds = new Set<string>();
      for (const s of workflow.steps) {
        if (s.agentId) agentIds.add(s.agentId);
      }
      for (const aid of agentIds) {
        const ag = await this.store.getAgent(aid);
        if (ag?.name) agentNameMap.set(aid, ag.name);
      }
    }

    const dependencies = this.inputResolver.buildDependencyGraph(workflow);
    const successors = this.inputResolver.buildSuccessorMap(workflow);
    const stepResults: Record<string, any> = { ...checkpoint.stepResults };
    const approvedStep = stepMap.get(approvedStepId);
    if (!approvedStep) throw new Error(`Workflow step ${approvedStepId} not found`);

    stepResults[approvedStepId] = approvedStepOutput;
    this.applyOutputMap(approvedStep, approvedStepOutput, stepResults, workflow, checkpoint.date, normalizedOptions);

    const completed = new Set<string>([...checkpoint.completedStepIds, approvedStepId]);
    const inDegree = new Map<string, number>();
    for (const step of workflow.steps) {
      inDegree.set(step.id, (dependencies.get(step.id) || []).length);
    }
    for (const stepId of completed) {
      for (const nextId of successors.get(stepId) || []) {
        inDegree.set(nextId, (inDegree.get(nextId) || 1) - 1);
      }
    }

    let readyQueue: string[] = [];
    for (const step of workflow.steps) {
      if ((inDegree.get(step.id) || 0) === 0 && !completed.has(step.id)) {
        readyQueue.push(step.id);
      }
    }

    let finalOutput: any = approvedStepOutput;
    let workflowError: Error | null = null;

    while (readyQueue.length > 0) {
      LogService.info(`Parallel batch (resume): [${readyQueue.join(', ')}]`);
      emit({ type: 'batch', workflowId, stepIds: [...readyQueue] });
      for (const stepId of readyQueue) {
        const st = stepMap.get(stepId)!;
        const stepLabel = getStepDisplayName(st, agentNameMap);
        emit({
          type: 'step_start',
          workflowId,
          stepId,
          displayName: stepLabel,
          agentId: st.agentId,
          agentName: stepLabel
        });
      }

      const batchResults = await Promise.allSettled(
        readyQueue.map((stepId) =>
          this.dispatcher.executeStep(
            workflow,
            stepMap.get(stepId)!,
            stepResults,
            dependencies.get(stepId) || [],
            checkpoint.date,
            normalizedOptions,
            emit
          )
        )
      );

      const nextReady: string[] = [];
      let shouldInterrupt = false;

      for (let i = 0; i < readyQueue.length; i++) {
        const stepId = readyQueue[i];
        const result = batchResults[i];
        const st = stepMap.get(stepId)!;
        let stepOutput: unknown;

        if (result.status === 'fulfilled') {
          stepOutput = result.value;
          stepResults[stepId] = stepOutput;
          this.applyOutputMap(st, stepOutput, stepResults, workflow, checkpoint.date, normalizedOptions);
          finalOutput = stepOutput;

          if (isResponseEmpty(stepOutput)) {
            const succs = successors.get(stepId) || [];
            emit({
              type: 'step_done',
              workflowId,
              stepId,
              displayName: getStepDisplayName(st, agentNameMap),
              agentId: st.agentId,
              success: succs.length === 0,
              error: succs.length > 0 ? 'empty_response' : undefined
            });
            if (succs.length > 0) {
              workflowError = new Error(
                `Workflow step ${stepId} returned an empty response before successor steps could run`
              );
              shouldInterrupt = true;
              break;
            }
          } else {
            const routerMeta = this.getRouterStepMeta(st, stepOutput);
            emit({
              type: 'step_done',
              workflowId,
              stepId,
              displayName: getStepDisplayName(st, agentNameMap),
              agentId: st.agentId,
              success: true,
              ...routerMeta
            });
          }
        } else {
          stepResults[stepId] = { error: String(result.reason) };
          finalOutput = stepResults[stepId];
          emit({
            type: 'step_done',
            workflowId,
            stepId,
            displayName: getStepDisplayName(st, agentNameMap),
            agentId: st.agentId,
            success: false,
            error: String(result.reason)
          });
          workflowError =
            result.reason instanceof Error ? result.reason : new Error(String(result.reason));
          shouldInterrupt = true;
          break;
        }

        completed.add(stepId);
        const nextIds = this.resolveSuccessorStepIds(st, stepOutput, successors);
        for (const nextId of nextIds) {
          const newDeg = (inDegree.get(nextId) || 1) - 1;
          inDegree.set(nextId, newDeg);
          if (newDeg === 0 && !completed.has(nextId)) {
            nextReady.push(nextId);
          }
        }
      }

      if (shouldInterrupt) break;
      readyQueue = nextReady;
    }

    if (workflowError) throw workflowError;

    const terminalIds = this.getTerminalStepIds(workflow);
    if (terminalIds.length === 1) {
      const sinkId = terminalIds[0];
      if (completed.has(sinkId) && stepResults[sinkId] !== undefined) {
        return await this.finalizeWorkflowOutput(
          workflow,
          stepResults[sinkId],
          stepResults,
          checkpoint.date,
          normalizedOptions
        );
      }
    }

    return await this.finalizeWorkflowOutput(
      workflow,
      finalOutput,
      stepResults,
      checkpoint.date,
      normalizedOptions
    );
  }

  private normalizeRunOptions(
    options?: WorkflowRunOptions,
    extraRuntime?: Record<string, unknown>
  ): WorkflowRunOptions {
    return {
      ...options,
      runtimeOptions: mergeWorkflowRuntimeOptions({
        ...(extraRuntime ?? {}),
        ...(options?.runtimeOptions ?? {})
      })
    };
  }

  private getRouterStepMeta(
    step: WorkflowStep,
    stepOutput: unknown
  ): { selectedBranch?: string; selectedNextStepIds?: string[] } {
    if (step.type !== 'router' || !stepOutput || typeof stepOutput !== 'object') {
      return {};
    }
    const out = stepOutput as Record<string, unknown>;
    return {
      selectedBranch: typeof out.selectedBranch === 'string' ? out.selectedBranch : undefined,
      selectedNextStepIds: Array.isArray(out.selectedNextStepIds)
        ? (out.selectedNextStepIds as string[])
        : undefined
    };
  }

  private resolveSuccessorStepIds(
    step: WorkflowStep,
    stepOutput: unknown,
    successors: Map<string, string[]>
  ): string[] {
    if (step.type === 'router' && stepOutput && typeof stepOutput === 'object') {
      const selected = (stepOutput as Record<string, unknown>).selectedNextStepIds;
      if (Array.isArray(selected)) {
        return selected.filter((id): id is string => typeof id === 'string' && id.length > 0);
      }
    }
    return successors.get(step.id) || [];
  }

  private applyOutputMap(
    step: WorkflowStep,
    output: unknown,
    stepResults: Record<string, any>,
    workflow: WorkflowDefinition,
    date?: string,
    options?: WorkflowRunOptions
  ) {
    if (!step.outputMap || Object.keys(step.outputMap).length === 0) return;
    const scope = this.inputResolver.buildScope(
      { ...stepResults, [step.id]: output },
      workflow,
      date,
      options,
      output
    );
    scope.output = output;
    for (const [targetPath, sourceRef] of Object.entries(step.outputMap)) {
      const value =
        sourceRef === 'output' || sourceRef === '$.output'
          ? output
          : sourceRef.startsWith('$')
            ? resolveRef(sourceRef, scope)
            : getByPath(scope, sourceRef);
      setByPath(stepResults, targetPath, value);
    }
  }
}
