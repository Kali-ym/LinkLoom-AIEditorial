import type { WorkflowStep } from '../services/agentService';

type NamedEntity = { id: string; name: string; displayName?: string };

export interface WorkflowStepLabelOptions {
  /** 步骤类型目录里的中文名，如「库内查询」。 */
  typeLabel?: string;
}

/** 工作流步骤在列表/图谱上的展示名 */
export function getWorkflowStepLabel(
  step: WorkflowStep,
  agents: NamedEntity[],
  tools: NamedEntity[] = [],
  workflows: NamedEntity[] = [],
  options?: WorkflowStepLabelOptions
): string {
  if (step.displayName?.trim()) return step.displayName.trim();
  if (step.toolId) {
    const tool = tools.find((t) => t.id === step.toolId);
    return tool?.displayName || tool?.name || step.toolId;
  }
  if (step.agentId) {
    const agent = agents.find((a) => a.id === step.agentId);
    return agent?.name || step.agentId;
  }
  if (step.workflowId) {
    const wf = workflows.find((w) => w.id === step.workflowId);
    return wf ? `工作流: ${wf.name}` : `工作流: ${step.workflowId}`;
  }
  if (options?.typeLabel?.trim()) return options.typeLabel.trim();
  if (step.id?.trim()) return step.id.trim();
  return '未配置';
}

export function isToolStep(step: WorkflowStep): boolean {
  return step.type === 'tool' || !!step.toolId;
}
