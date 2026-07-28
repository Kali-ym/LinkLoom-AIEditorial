import type { WorkflowDefinition, WorkflowStep } from '../../types/agent.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';

const NORMALIZATION_FLAG = 'workflow_compat_normalized_v1';

const DEPRECATED_BATCH_POLICIES = new Set(['useInputBatch', 'skipBatch', 'reconcileByPosition']);

type BatchPolicyKey = 'onBatchParseError' | 'onBatchItemCountMismatch';

function normalizeBatchPolicy(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (DEPRECATED_BATCH_POLICIES.has(value)) return 'splitAndRetry';
  return value;
}

function normalizeDedupeConfig(config: Record<string, unknown>): boolean {
  let changed = false;

  if (config.input !== undefined) {
    if (config.items === undefined) {
      config.items = config.input;
    }
    delete config.input;
    changed = true;
  }

  if (Array.isArray(config.crossDayUrls)) {
    const historical = Array.isArray(config.historicalUrls) ? config.historicalUrls : [];
    config.historicalUrls = [...historical, ...config.crossDayUrls];
    delete config.crossDayUrls;
    changed = true;
  }

  return changed;
}

function normalizeStepExecution(execution: WorkflowStep['execution']): boolean {
  if (!execution) return false;
  let changed = false;
  const exec = execution as Record<BatchPolicyKey, unknown>;
  for (const key of ['onBatchParseError', 'onBatchItemCountMismatch'] as const) {
    const normalized = normalizeBatchPolicy(exec[key]);
    if (normalized && normalized !== exec[key]) {
      exec[key] = normalized;
      changed = true;
    }
  }
  return changed;
}

function normalizeStep(step: WorkflowStep): boolean {
  let changed = false;

  const legacyNextId = (step as WorkflowStep & { nextStepId?: string }).nextStepId;
  if (legacyNextId) {
    const ids = new Set(step.nextStepIds || []);
    ids.add(legacyNextId);
    step.nextStepIds = [...ids];
    delete (step as { nextStepId?: string }).nextStepId;
    changed = true;
  }

  if (normalizeStepExecution(step.execution)) {
    changed = true;
  }

  const toolId = step.toolId || (step.type === 'tool' ? String(step.config?.toolId || '') : '');
  if ((step.type === 'tool' || toolId) && toolId === 'deduplicate_items' && step.config) {
    if (normalizeDedupeConfig(step.config)) {
      changed = true;
    }
  }

  const child = step.config?.child;
  if (child && typeof child === 'object' && !Array.isArray(child)) {
    const childExec = (child as { execution?: WorkflowStep['execution'] }).execution;
    if (childExec && normalizeStepExecution(childExec)) {
      changed = true;
    }
  }

  return changed;
}

export function normalizeWorkflowDefinition(workflow: WorkflowDefinition): boolean {
  if (!workflow.steps?.length) return false;
  let changed = false;
  for (const step of workflow.steps) {
    if (normalizeStep(step)) changed = true;
  }
  return changed;
}

export async function normalizeStoredWorkflows(store: LocalStore): Promise<number> {
  const flagged = await store.get(NORMALIZATION_FLAG);
  if (flagged) return 0;

  const workflows = await store.listWorkflows();
  let migrated = 0;

  for (const raw of workflows) {
    const workflow = raw as WorkflowDefinition;
    if (!normalizeWorkflowDefinition(workflow)) continue;
    try {
      await store.saveWorkflow(workflow);
      migrated++;
      LogService.info(`[WorkflowNormalization] Updated workflow: ${workflow.id}`);
    } catch (err: any) {
      LogService.warn(
        `[WorkflowNormalization] save failed for ${workflow.id}: ${err?.message || err}`
      );
    }
  }

  await store.put(NORMALIZATION_FLAG, true);
  if (migrated > 0) {
    LogService.info(`[WorkflowNormalization] Migrated ${migrated} workflow(s).`);
  }
  return migrated;
}
