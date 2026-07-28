export interface AgentWorkflowReference {
  id: string;
  name: string;
  stepIds: string[];
}

type WorkflowLike = {
  id: string;
  name?: string;
  steps?: Array<{ id: string; agentId?: string }>;
};

/** 从已加载的工作流列表中查找引用指定 agentId 的工作流（数据来自 workflows 表）。 */
export function findWorkflowsReferencingAgent(
  agentId: string,
  workflows: WorkflowLike[]
): AgentWorkflowReference[] {
  const trimmed = String(agentId || '').trim();
  if (!trimmed) return [];

  const refs: AgentWorkflowReference[] = [];
  for (const wf of workflows) {
    const steps = Array.isArray(wf.steps) ? wf.steps : [];
    const stepIds = steps.filter((step) => step.agentId === trimmed).map((step) => step.id);
    if (stepIds.length > 0) {
      refs.push({
        id: wf.id,
        name: wf.name?.trim() || wf.id,
        stepIds
      });
    }
  }
  return refs;
}
