import type { WorkflowStep } from '../services/agentService';

export function getNextStepIds(step: WorkflowStep): string[] {
  return step.nextStepIds?.length ? step.nextStepIds : [];
}
