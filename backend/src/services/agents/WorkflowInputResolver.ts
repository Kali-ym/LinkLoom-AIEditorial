import { ToolRegistry } from '../../registries/ToolRegistry.js';
import { WorkflowDefinition, WorkflowStep } from '../../types/agent.js';
import type { WorkflowRunOptions } from './WorkflowEngine.js';
import {
  getByPath,
  renderTemplate,
  resolveRef,
  runTransform,
  setByPath
} from './workflowExpressions.js';

export interface WorkflowStepDryRunResult {
  rawInput: unknown;
  transformedInput?: unknown;
  finalInput: unknown;
  errors: string[];
}

export class WorkflowInputResolver {
  buildScope(
    stepResults: Record<string, any>,
    workflow: WorkflowDefinition,
    date?: string,
    options?: WorkflowRunOptions,
    input?: unknown
  ): Record<string, unknown> {
    const hasCurrentInput = arguments.length >= 5;
    const hasInputStep = Object.prototype.hasOwnProperty.call(stepResults, 'input');
    const workflowInput = hasInputStep ? stepResults.input : stepResults.start;
    return {
      ...stepResults,
      input: hasCurrentInput ? input : workflowInput,
      current: hasCurrentInput ? input : workflowInput,
      __input: input,
      start: stepResults.start,
      steps: stepResults,
      __steps: stepResults,
      __context: stepResults.__context || {},
      __workflow: { id: workflow.id, name: workflow.name, metadata: workflow.metadata || {} },
      __date: date,
      __runtimeOptions: options?.runtimeOptions || {}
    };
  }

  hasInputTransform(step: WorkflowStep): boolean {
    const ops = step.inputTransform?.operations;
    return Array.isArray(ops) && ops.length > 0;
  }

  applyInputTransform(
    step: WorkflowStep,
    stepInput: unknown,
    stepResults: Record<string, any>,
    workflow: WorkflowDefinition,
    date?: string,
    options?: WorkflowRunOptions
  ): unknown {
    const scope = this.buildScope(stepResults, workflow, date, options, stepInput);
    return runTransform(stepInput, step.inputTransform?.operations || [], scope);
  }

  resolveStepWorkingInput(
    step: WorkflowStep,
    rawStepInput: unknown,
    stepResults: Record<string, any>,
    workflow: WorkflowDefinition,
    date?: string,
    options?: WorkflowRunOptions
  ): { workingInput: unknown; preparedInput?: unknown } {
    if (!this.hasInputTransform(step)) {
      return { workingInput: rawStepInput };
    }
    const preparedInput = this.applyInputTransform(
      step,
      rawStepInput,
      stepResults,
      workflow,
      date,
      options
    );
    let workingInput = preparedInput;
    if (step.inputTemplate !== undefined) {
      const scope = this.buildScope(stepResults, workflow, date, options, preparedInput);
      workingInput = renderTemplate(step.inputTemplate, scope);
    }
    return { workingInput, preparedInput };
  }

  deriveStepInput(
    step: WorkflowStep,
    stepResults: Record<string, any>,
    predecessors: string[],
    workflow: WorkflowDefinition,
    date?: string,
    options?: WorkflowRunOptions
  ): any {
    const scope = this.buildScope(stepResults, workflow, date, options);
    if (step.inputTemplate !== undefined && !this.hasInputTransform(step)) {
      return renderTemplate(step.inputTemplate, scope);
    }

    const validInputMap = step.inputMap
      ? Object.fromEntries(Object.entries(step.inputMap).filter(([k, v]) => k && v))
      : {};
    if (Object.keys(validInputMap).length > 0) {
      const mapped: Record<string, any> = {};
      for (const [targetPath, sourceRef] of Object.entries(validInputMap)) {
        const value = this.resolveInputSource(sourceRef, stepResults, scope);
        setByPath(mapped, targetPath, value);
      }
      return mapped;
    }

    if (predecessors.length === 0) return stepResults.start;
    if (predecessors.length === 1) return stepResults[predecessors[0]];
    return Object.fromEntries(predecessors.map((predId) => [predId, stepResults[predId]]));
  }

  resolveInputSource(
    sourceRef: string,
    stepResults: Record<string, any>,
    scope: Record<string, unknown>
  ): unknown {
    if (sourceRef in stepResults) return stepResults[sourceRef];
    if (sourceRef.startsWith('$')) return resolveRef(sourceRef, scope);
    return getByPath(scope, sourceRef);
  }

  collectStepRefs(step: WorkflowStep, stepIds: Set<string>): string[] {
    const refs = new Set<string>();
    const scan = (value: unknown) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        const normalized = trimmed.replace(/^\$\.?/, '');
        const first = normalized.split(/[.[\]]/).filter(Boolean)[0];
        if (stepIds.has(trimmed)) refs.add(trimmed);
        if (first && stepIds.has(first)) refs.add(first);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(scan);
        return;
      }
      if (value && typeof value === 'object') {
        Object.values(value as Record<string, unknown>).forEach(scan);
      }
    };
    scan(step.inputMap || {});
    scan(step.inputTemplate);
    scan(step.inputTransform || {});
    return [...refs];
  }

  buildDependencyGraph(workflow: WorkflowDefinition): Map<string, string[]> {
    const stepIds = new Set(workflow.steps.map((s) => s.id));
    const deps = new Map<string, string[]>();

    for (const step of workflow.steps) {
      deps.set(step.id, []);
    }

    for (const step of workflow.steps) {
      const nextIds = step.nextStepIds || [];
      for (const nextId of nextIds) {
        if (stepIds.has(nextId)) {
          const list = deps.get(nextId) || [];
          if (!list.includes(step.id)) {
            list.push(step.id);
            deps.set(nextId, list);
          }
        }
      }
    }

    for (const step of workflow.steps) {
      const list = deps.get(step.id) || [];
      for (const sourceStepId of this.collectStepRefs(step, stepIds)) {
        if (sourceStepId !== step.id && !list.includes(sourceStepId)) {
          list.push(sourceStepId);
        }
      }
      deps.set(step.id, list);
    }

    return deps;
  }

  buildSuccessorMap(workflow: WorkflowDefinition): Map<string, string[]> {
    const succs = new Map<string, string[]>();
    const stepIds = new Set(workflow.steps.map((s) => s.id));

    for (const step of workflow.steps) {
      succs.set(step.id, []);
    }

    for (const step of workflow.steps) {
      const nextIds = step.nextStepIds || [];
      for (const nextId of nextIds) {
        if (stepIds.has(nextId)) {
          const list = succs.get(step.id) || [];
          if (!list.includes(nextId)) {
            list.push(nextId);
            succs.set(step.id, list);
          }
        }
      }
    }

    for (const step of workflow.steps) {
      const refs = this.collectStepRefs(step, stepIds);
      for (const ref of refs) {
        if (!stepIds.has(ref) || ref === step.id) continue;
        const list = succs.get(ref) || [];
        if (!list.includes(step.id)) list.push(step.id);
        succs.set(ref, list);
      }
    }

    return succs;
  }

  dryRunStep(args: {
    workflow: WorkflowDefinition;
    stepId: string;
    input?: unknown;
    stepResults?: Record<string, any>;
    date?: string;
    options?: WorkflowRunOptions;
  }): WorkflowStepDryRunResult {
    const errors: string[] = [];
    const step = args.workflow.steps.find((s) => s.id === args.stepId);
    if (!step) {
      return {
        rawInput: undefined,
        finalInput: undefined,
        errors: [`Step ${args.stepId} not found`]
      };
    }

    const stepResults: Record<string, any> = {
      start: args.input,
      __context: {
        date: args.date,
        runtimeOptions: args.options?.runtimeOptions || {}
      },
      ...(args.stepResults || {})
    };
    if (!Object.prototype.hasOwnProperty.call(stepResults, 'start')) stepResults.start = args.input;

    const dependencies = this.buildDependencyGraph(args.workflow);
    const predecessors = dependencies.get(step.id) || [];
    for (const predId of predecessors) {
      if (!Object.prototype.hasOwnProperty.call(stepResults, predId)) {
        errors.push(`Missing result for predecessor step: ${predId}`);
      }
    }

    let rawInput: unknown;
    let transformedInput: unknown;
    let finalInput: unknown;

    try {
      rawInput = this.deriveStepInput(
        step,
        stepResults,
        predecessors,
        args.workflow,
        args.date,
        args.options
      );
    } catch (error) {
      errors.push(
        `Failed to derive step input: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      const resolved = this.resolveStepWorkingInput(
        step,
        rawInput,
        stepResults,
        args.workflow,
        args.date,
        args.options
      );
      finalInput = resolved.workingInput;
      transformedInput = resolved.preparedInput;
    } catch (error) {
      errors.push(
        `Failed to apply input transform: ${error instanceof Error ? error.message : String(error)}`
      );
      finalInput = rawInput;
    }

    const stepType = step.type || (step.toolId ? 'tool' : step.workflowId ? 'workflow' : 'agent');
    if (stepType === 'tool' || step.toolId) {
      if (!step.toolId) errors.push(`Workflow step ${step.id} is type=tool but has no toolId`);
      if (step.toolId && !ToolRegistry.getInstance().getTool(step.toolId)) {
        errors.push(`Tool not found: ${step.toolId}`);
      }
    }

    return {
      rawInput,
      transformedInput,
      finalInput,
      errors
    };
  }
}
