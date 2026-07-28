import type { WorkflowDefinition, WorkflowStep, WorkflowStepType } from '../../../types/agent.js';
import type { LocalStore } from '../../LocalStore.js';
import type { TaskService } from '../../TaskService.js';
import type { AgentService } from '../AgentService.js';
import type {
  WorkflowEngine,
  WorkflowProgressPayload,
  WorkflowRunOptions
} from '../WorkflowEngine.js';

/**
 * 业务步骤的执行上下文，传给每个 StepExecutor。
 *
 * 之所以把 workflowEngine 设为可选并以 getter 方式注入，是为了让
 * BatchIterateStep / WorkflowStep 在递归调用时不引发循环依赖。
 */
export interface StepExecutionContext {
  store: LocalStore;
  agentService: AgentService | null;
  taskService: TaskService;
  workflowEngine: WorkflowEngine;
  date?: string;
  emit?: (payload: WorkflowProgressPayload) => void;
  runOptions?: WorkflowRunOptions;
  workflow: WorkflowDefinition;
  step: WorkflowStep;
  /** 已渲染后的步骤入参（input/inputTemplate/inputMap 的最终值）。 */
  resolvedInput: unknown;
  /** 整张工作流的步骤结果。 */
  stepResults: Record<string, any>;
}

export type StepExecutor = (ctx: StepExecutionContext) => Promise<unknown>;

/**
 * 业务步骤注册中心。WorkflowEngine 在调度步骤时优先在此查找 type
 * 对应的 executor；找不到再回落到 agent/workflow/tool 默认分支。
 */
export class StepRegistry {
  private static instance: StepRegistry | null = null;
  private executors = new Map<WorkflowStepType, StepExecutor>();

  static getInstance(): StepRegistry {
    if (!StepRegistry.instance) {
      StepRegistry.instance = new StepRegistry();
    }
    return StepRegistry.instance;
  }

  register(type: WorkflowStepType, executor: StepExecutor) {
    this.executors.set(type, executor);
  }

  has(type: WorkflowStepType | undefined): boolean {
    if (!type) return false;
    return this.executors.has(type);
  }

  async execute(type: WorkflowStepType, ctx: StepExecutionContext): Promise<unknown> {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`No step executor registered for type "${type}"`);
    }
    return executor(ctx);
  }
}
