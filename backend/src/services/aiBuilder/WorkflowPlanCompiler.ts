import type {
  AgentDefinition,
  WorkflowDefinition,
  WorkflowInputField,
  WorkflowInputSpec,
  WorkflowStep,
  WorkflowStepType
} from '../../types/agent.js';
import type { AiBuildCatalog, WorkflowPlan, WorkflowPlanStep } from '../../types/aiBuilder.js';
import { registerBuiltinSteps, StepCatalog } from '../agents/steps/index.js';
import { ensureUniqueId, normalizeStringArray, slugifyId } from './AiBuilderUtils.js';

interface CompileContext {
  catalog: AiBuildCatalog;
  createdAgents?: AgentDefinition[];
  workflowId?: string;
  mode?: 'create' | 'update';
}

const CLASSIC_KINDS: ReadonlySet<WorkflowStepType> = new Set(['agent', 'workflow', 'tool']);

function isWorkflowStepType(value: unknown): value is WorkflowStepType {
  return (
    value === 'agent' ||
    value === 'workflow' ||
    value === 'tool' ||
    value === 'adapter' ||
    value === 'store-query' ||
    value === 'store-write' ||
    value === 'kv-write' ||
    value === 'transform' ||
    value === 'batch-iterate'
  );
}

function normalizeResourceRef(step: WorkflowPlanStep): { kind: WorkflowStepType; id?: string } {
  const ref = String(step.resourceRef || '').trim();
  if (ref.includes(':')) {
    const [kind, ...idParts] = ref.split(':');
    const id = idParts.join(':');
    if (isWorkflowStepType(kind) && CLASSIC_KINDS.has(kind)) {
      return { kind, id };
    }
  }
  const kind: WorkflowStepType = isWorkflowStepType(step.kind) ? step.kind : 'agent';
  return { kind, id: ref || undefined };
}

function pathFromProducedField(field: string): { stepId?: string; fieldPath: string } {
  const [stepId, ...rest] = field.split('.');
  return { stepId, fieldPath: rest.join('.') };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 把 LLM 给出的 inputSchema 规范成 WorkflowInputSpec（如果可能）。
 * 其它任意 schema 形态保持原样写入，确保对历史 plan 兼容。
 */
function normalizeInputSpec(schema: unknown): WorkflowInputSpec | unknown {
  if (!isPlainObject(schema)) return schema;
  if (Array.isArray((schema as any).fields)) {
    const fields = (schema as any).fields
      .filter(isPlainObject)
      .map((field: any) => {
        const normalized: WorkflowInputField = {
          key: String(field.key || ''),
          label: String(field.label || field.key || ''),
          type: (field.type as WorkflowInputField['type']) || 'string'
        };
        if (typeof field.description === 'string') normalized.description = field.description;
        if (typeof field.required === 'boolean') normalized.required = field.required;
        if (field.default !== undefined) normalized.default = field.default;
        if (Array.isArray(field.options)) normalized.options = field.options;
        if (typeof field.allowVariables === 'boolean')
          normalized.allowVariables = field.allowVariables;
        if (typeof field.group === 'string') normalized.group = field.group;
        if (typeof field.placeholder === 'string') normalized.placeholder = field.placeholder;
        if (typeof field.min === 'number') normalized.min = field.min;
        if (typeof field.max === 'number') normalized.max = field.max;
        return normalized;
      })
      .filter((field: WorkflowInputField) => field.key);
    const next: WorkflowInputSpec = { fields };
    if (typeof (schema as any).allowExtraJson === 'boolean') {
      next.allowExtraJson = (schema as any).allowExtraJson;
    }
    return next;
  }
  return schema;
}

function mergeStepConfig(
  defaults: Record<string, unknown> | undefined,
  planStep: WorkflowPlanStep
): Record<string, unknown> | undefined {
  const overrides = isPlainObject(planStep.configOverrides) ? planStep.configOverrides : undefined;
  const fullConfig = isPlainObject(planStep.config) ? planStep.config : undefined;
  if (!defaults && !overrides && !fullConfig) return undefined;
  if (fullConfig && !overrides) {
    return { ...(defaults || {}), ...fullConfig };
  }
  if (overrides && !fullConfig) {
    return { ...(defaults || {}), ...overrides };
  }
  if (fullConfig && overrides) {
    return { ...(defaults || {}), ...fullConfig, ...overrides };
  }
  return defaults ? { ...defaults } : undefined;
}

export class WorkflowPlanCompiler {
  constructor() {
    registerBuiltinSteps();
  }

  compile(plan: WorkflowPlan, context: CompileContext): WorkflowDefinition {
    const existingIds = new Set<string>();
    const workflowId = ensureUniqueId(
      context.workflowId || plan.id || slugifyId(plan.name || 'workflow', 'workflow'),
      existingIds
    );

    const steps = this.compileSteps(plan, context);
    return {
      id: workflowId,
      name: plan.name || workflowId,
      description: plan.description || '',
      initialStepId: steps[0]?.id || 'step_1',
      inputSpec: normalizeInputSpec(plan.inputSchema) as WorkflowInputSpec | undefined,
      outputSpec: plan.outputSchema,
      steps,
      metadata: {
        aiBuilder: {
          generatedBy: 'workflow-builder',
          contract: {
            inputSchema: plan.inputSchema,
            outputSchema: plan.outputSchema
          }
        }
      }
    };
  }

  private compileSteps(plan: WorkflowPlan, context: CompileContext): WorkflowStep[] {
    const catalog = StepCatalog.getInstance();
    const usedStepIds = new Set<string>();
    const planSteps = plan.steps || [];
    const compiledStepIds = planSteps.map((planStep, index) => {
      const rawId = String(planStep.id || '').trim();
      const baseId = rawId
        ? slugifyId(rawId, `step_${index + 1}`)
        : slugifyId(planStep.goal || `step_${index + 1}`, 'step');
      return ensureUniqueId(baseId, usedStepIds);
    });
    const steps = planSteps.map((planStep, index) => {
      const stepId = compiledStepIds[index];
      const { kind, id } = normalizeResourceRef(planStep);
      const workflowStep: WorkflowStep = {
        id: stepId,
        type: kind,
        displayName: planStep.goal || stepId,
        nextStepIds: [],
        enabled: true,
        inputTemplate: this.buildInputTemplate(planStep, planSteps, index, compiledStepIds),
        execution: planStep.execution,
        agentOptions: planStep.agentOptions
      };

      if (kind === 'tool') workflowStep.toolId = id;
      if (kind === 'workflow') workflowStep.workflowId = id;
      if (kind === 'agent') workflowStep.agentId = id || this.findCreatedAgentId(planStep, context);

      if (!CLASSIC_KINDS.has(kind)) {
        const defaults = catalog.get(kind)?.defaultConfig;
        const merged = mergeStepConfig(defaults, planStep);
        if (merged && Object.keys(merged).length > 0) {
          workflowStep.config = merged;
        }
      }

      workflowStep.metadata = {
        aiBuilder: {
          goal: planStep.goal,
          consumes: normalizeStringArray(planStep.consumes),
          produces: normalizeStringArray(planStep.produces)
        }
      };

      this.stripEmptyWorkflowStepFields(workflowStep);
      return workflowStep;
    });

    if (steps.length === 0) {
      steps.push({
        id: 'step_1',
        type: 'agent',
        displayName: '处理输入',
        agentId: context.createdAgents?.[0]?.id || context.catalog.agents[0]?.id || '',
        nextStepIds: [],
        enabled: true,
        inputTemplate: '$.input'
      });
    }

    const producerByField = this.buildProducerMap(plan.steps || [], steps);
    steps.forEach((step, index) => {
      const next = new Set<string>();
      const currentPlanStep = plan.steps[index];
      const currentProduces = normalizeStringArray(currentPlanStep?.produces);
      for (let j = index + 1; j < planSteps.length; j += 1) {
        const laterConsumes = normalizeStringArray(planSteps[j]?.consumes);
        if (
          laterConsumes.some(
            (field) =>
              currentProduces.includes(field) || producerByField.get(field)?.stepId === step.id
          )
        ) {
          next.add(steps[j].id);
        }
      }
      if (next.size === 0 && index < steps.length - 1) {
        next.add(steps[index + 1].id);
      }
      step.nextStepIds = [...next];
    });

    return steps;
  }

  private buildProducerMap(planSteps: WorkflowPlanStep[], compiledSteps: WorkflowStep[]) {
    const producerByField = new Map<string, { stepId: string; path: string }>();
    planSteps.forEach((planStep, index) => {
      for (const field of normalizeStringArray(planStep.produces)) {
        producerByField.set(field, { stepId: compiledSteps[index]?.id, path: field });
      }
    });
    return producerByField;
  }

  private buildInputTemplate(
    planStep: WorkflowPlanStep,
    allSteps: WorkflowPlanStep[],
    index: number,
    compiledStepIds: string[]
  ): unknown {
    const consumes = normalizeStringArray(planStep.consumes);
    if (consumes.length === 0) return index === 0 ? '$.input' : undefined;

    const template: Record<string, string> = {};
    for (const field of consumes) {
      const producerIndex = allSteps.findIndex(
        (candidate, candidateIndex) =>
          candidateIndex < index && normalizeStringArray(candidate.produces).includes(field)
      );

      if (producerIndex >= 0) {
        const sourceStepId = compiledStepIds[producerIndex] || `step_${producerIndex + 1}`;
        const { fieldPath } = pathFromProducedField(field);
        template[field.replace(/\./g, '_')] = fieldPath
          ? `$.${sourceStepId}.${fieldPath}`
          : `$.${sourceStepId}`;
      } else {
        template[field.replace(/\./g, '_')] = `$.input.${field}`;
      }
    }

    if (Object.keys(template).length === 1) {
      return Object.values(template)[0];
    }
    return template;
  }

  private findCreatedAgentId(
    planStep: WorkflowPlanStep,
    context: CompileContext
  ): string | undefined {
    if (!planStep.needsNewAgent) return undefined;
    const normalizedGoal = (planStep.goal || '').toLowerCase();
    return (
      context.createdAgents?.find(
        (agent) =>
          agent.description?.toLowerCase().includes(normalizedGoal) ||
          agent.name?.toLowerCase().includes(normalizedGoal)
      )?.id || context.createdAgents?.[0]?.id
    );
  }

  private stripEmptyWorkflowStepFields(step: WorkflowStep) {
    if (!step.execution || Object.keys(step.execution).length === 0) delete step.execution;
    if (!step.agentOptions || Object.keys(step.agentOptions).length === 0) delete step.agentOptions;
    if (step.inputTemplate === undefined) delete step.inputTemplate;
    if (step.config && Object.keys(step.config).length === 0) delete step.config;
    delete (step as any).inputMap;
    delete (step as any).outputMap;
    delete (step as any).toolParams;
  }
}
