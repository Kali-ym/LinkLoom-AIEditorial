import type { Agent, Workflow, WorkflowStep } from '../../../services/agentService';

type TemplateVariableDef = { id: string; name: string; defaultValue?: unknown; description?: string };

const AGENT_ROLE_SUFFIXES = [
  'material_brief',
  'ingest_router',
  'editorial_plan',
  'brief_batch',
  'qa',
  'reconcile_plan'
];

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, val == null ? '' : String(val)])
  );
}

function coerceNumber(raw: string, fallback: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferAgentPrefix(agentId: string) {
  for (const suffix of AGENT_ROLE_SUFFIXES) {
    const token = `_${suffix}`;
    if (agentId.endsWith(token)) return agentId.slice(0, -token.length);
  }
  const parts = agentId.split('_');
  return parts.length > 1 ? parts.slice(0, -1).join('_') : agentId;
}

function patchCoverageStep(step: WorkflowStep, values: Record<string, string>): WorkflowStep {
  if (step.toolId !== 'query_coverage_index') return step;
  const next: WorkflowStep = { ...step };
  if (next.inputTemplate && typeof next.inputTemplate === 'object') {
    next.inputTemplate = {
      ...(next.inputTemplate as Record<string, unknown>),
      namespace: values.coverageNamespace,
      lookbackDays: coerceNumber(values.lookbackDays, 7)
    };
  }
  if (Array.isArray(next.inputTransform?.operations)) {
    next.inputTransform = {
      ...next.inputTransform,
      operations: next.inputTransform.operations.map(op => {
        if (op.op === 'set' && op.path === 'headlineMaxTopics') {
          return { ...op, value: coerceNumber(values.headlineMaxTopics, Number(op.value) || 5) };
        }
        if (op.op === 'set' && op.path === 'mergeMaxSources') {
          return { ...op, value: coerceNumber(values.mergeMaxSources, Number(op.value) || 4) };
        }
        return op;
      })
    };
  }
  return next;
}

function patchNormalizeStep(step: WorkflowStep, values: Record<string, string>): WorkflowStep {
  if (step.toolId !== 'normalize_report_markdown') return step;
  if (!step.inputTemplate || typeof step.inputTemplate !== 'object') return step;
  return {
    ...step,
    inputTemplate: {
      ...(step.inputTemplate as Record<string, unknown>),
      titleTemplate: values.titleTemplate,
      linkTitleTemplate: values.linkTitleTemplate,
      descriptionDefault: values.descriptionDefault
    }
  };
}

function patchBatchExecution(step: WorkflowStep, values: Record<string, string>): WorkflowStep {
  if (!step.execution || step.execution.batchSize == null) return step;
  return {
    ...step,
    execution: {
      ...step.execution,
      batchSize: coerceNumber(values.batchSize, Number(step.execution.batchSize) || 10)
    }
  };
}

export function parseTemplateIdFromWorkflow(workflow: Workflow): string | null {
  const meta = workflow.metadata as Record<string, unknown> | undefined;
  if (typeof meta?.templateId === 'string' && meta.templateId.trim()) return meta.templateId.trim();
  const source = String(meta?.templateSource || '');
  const match = source.match(/^workflow-template:([^:]+):/);
  return match?.[1] || null;
}

export function extractTemplateVariableValues(
  workflow: Workflow,
  variableDefs: TemplateVariableDef[],
  agents: Agent[]
): Record<string, string> {
  const stored = asStringRecord(workflow.templateVariables);
  const values = Object.fromEntries(
    variableDefs.map(def => [def.id, stored[def.id] ?? String(def.defaultValue ?? '')])
  );

  values.reportName = workflow.name || values.reportName;
  values.workflowId = workflow.id || values.workflowId;
  values.descriptionDefault = workflow.description || values.descriptionDefault;

  const coverage = workflow.steps.find(step => step.toolId === 'query_coverage_index');
  if (coverage?.inputTemplate && typeof coverage.inputTemplate === 'object') {
    const tpl = coverage.inputTemplate as Record<string, unknown>;
    if (tpl.namespace != null) values.coverageNamespace = String(tpl.namespace);
    if (tpl.lookbackDays != null) values.lookbackDays = String(tpl.lookbackDays);
  }
  if (Array.isArray(coverage?.inputTransform?.operations)) {
    for (const op of coverage.inputTransform.operations) {
      if (op.op === 'set' && op.path === 'headlineMaxTopics' && op.value != null) {
        values.headlineMaxTopics = String(op.value);
      }
      if (op.op === 'set' && op.path === 'mergeMaxSources' && op.value != null) {
        values.mergeMaxSources = String(op.value);
      }
    }
  }

  const batchStep = workflow.steps.find(step => step.execution?.batchSize != null);
  if (batchStep?.execution?.batchSize != null) {
    values.batchSize = String(batchStep.execution.batchSize);
  }

  const normalize = workflow.steps.find(step => step.toolId === 'normalize_report_markdown');
  if (normalize?.inputTemplate && typeof normalize.inputTemplate === 'object') {
    const tpl = normalize.inputTemplate as Record<string, unknown>;
    if (tpl.titleTemplate != null) values.titleTemplate = String(tpl.titleTemplate);
    if (tpl.linkTitleTemplate != null) values.linkTitleTemplate = String(tpl.linkTitleTemplate);
    if (tpl.descriptionDefault != null) values.descriptionDefault = String(tpl.descriptionDefault);
  }

  const agentStep = workflow.steps.find(step => step.agentId);
  if (agentStep?.agentId) {
    if (!values.agentPrefix) values.agentPrefix = inferAgentPrefix(agentStep.agentId);
    const agent = agents.find(item => item.id === agentStep.agentId);
    if (agent) {
      if (agent.providerId) values.providerId = agent.providerId;
      if (agent.model) values.model = agent.model;
    }
  }

  return values;
}

export function applyTemplateVariableValues(
  workflow: Workflow,
  agents: Agent[],
  values: Record<string, string>
): { workflow: Workflow; updatedAgents: Agent[] } {
  const agentIds = new Set(workflow.steps.map(step => step.agentId).filter(Boolean) as string[]);
  const nextWorkflow: Workflow = {
    ...workflow,
    name: values.reportName || workflow.name,
    description: values.descriptionDefault || workflow.description,
    templateVariables: {
      reportName: values.reportName,
      coverageNamespace: values.coverageNamespace,
      lookbackDays: values.lookbackDays,
      batchSize: values.batchSize,
      headlineMaxTopics: values.headlineMaxTopics,
      mergeMaxSources: values.mergeMaxSources,
      titleTemplate: values.titleTemplate,
      linkTitleTemplate: values.linkTitleTemplate,
      descriptionDefault: values.descriptionDefault,
      providerId: values.providerId,
      model: values.model,
      agentPrefix: values.agentPrefix,
      workflowId: values.workflowId
    },
    steps: workflow.steps
      .map(step => patchCoverageStep(step, values))
      .map(step => patchNormalizeStep(step, values))
      .map(step => patchBatchExecution(step, values))
  };

  const updatedAgents = agents
    .filter(agent => agentIds.has(agent.id))
    .map(agent => ({
      ...agent,
      providerId: values.providerId || agent.providerId,
      model: values.model || agent.model
    }));

  return { workflow: nextWorkflow, updatedAgents };
}
