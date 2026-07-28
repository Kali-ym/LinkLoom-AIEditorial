import type {
  AiBuildPlan,
  AiBuildRequest,
  AiBuildResourcePolicy,
  AiBuildReusePolicy,
  CapabilityGraph,
  PlanContract,
  PlanContractFieldRef,
  PlanDraft
} from '../../types/aiBuilder.js';

function resourcePolicyFromRequest(request: AiBuildRequest): AiBuildResourcePolicy {
  const reusePolicy: AiBuildReusePolicy =
    request.reusePolicy || (request.target === 'workflow' ? 'preferExisting' : 'existingOnly');
  return (
    request.resourcePolicy || {
      reusePolicy,
      allowResourceCreation: request.allowResourceCreation === true,
      reason:
        request.resourceCreationReason ||
        (request.allowResourceCreation ? '用户允许创建缺失资源' : '默认优先复用现有资源'),
      source: 'server'
    }
  );
}

function typeOfSchema(schema: unknown) {
  if (schema && typeof schema === 'object' && 'type' in schema) {
    return String((schema as { type?: unknown }).type || 'object');
  }
  return schema ? 'object' : undefined;
}

export class PlanContractService {
  fromDraft(request: AiBuildRequest, draft: PlanDraft, graph?: CapabilityGraph): PlanContract {
    const fieldRefs = this.fieldRefsFromWorkflow(draft.workflowOutline?.steps || []);
    return {
      id: `contract_${draft.id}_v${draft.version || 1}`,
      target: draft.target,
      mode: draft.mode,
      goal: request.goal || draft.summary,
      inputSchema: draft.workflowOutline?.inputSchema || request.inputSchema,
      outputSchema: draft.workflowOutline?.outputSchema || request.outputSchema,
      constraints: [
        ...(request.constraints || []),
        ...draft.assumptions.map((item) => `假设：${item}`)
      ],
      acceptanceCriteria: this.acceptanceCriteria(request, draft.summary, draft.nextSteps),
      fieldRefs: graph?.nodes.some((node) => node.type === 'input') ? fieldRefs : fieldRefs,
      resourcePolicy: resourcePolicyFromRequest(request),
      status: draft.status === 'ready_for_build' ? 'ready' : 'draft',
      updatedAt: new Date().toISOString()
    };
  }

  fromPlan(request: AiBuildRequest, plan: AiBuildPlan, graph?: CapabilityGraph): PlanContract {
    const fieldRefs = this.fieldRefsFromWorkflow(plan.workflowPlan?.steps || []);
    return {
      id: plan.contract?.id || `contract_${plan.id}_v${plan.version || 1}`,
      target: plan.target,
      mode: plan.mode,
      goal: request.goal || plan.summary,
      inputSchema: plan.workflowPlan?.inputSchema || request.inputSchema,
      outputSchema: plan.workflowPlan?.outputSchema || request.outputSchema,
      constraints: [
        ...(request.constraints || []),
        ...plan.warnings.map((item) => `提醒：${item}`)
      ],
      acceptanceCriteria: this.acceptanceCriteria(request, plan.summary, []),
      fieldRefs: graph?.nodes.length ? fieldRefs : fieldRefs,
      resourcePolicy: plan.resourcePolicy || resourcePolicyFromRequest(request),
      status: plan.validation.status === 'ok' ? 'locked' : 'draft',
      updatedAt: new Date().toISOString()
    };
  }

  private fieldRefsFromWorkflow(
    steps: Array<{ id: string; consumes?: string[]; produces?: string[]; kind?: string }>
  ): PlanContractFieldRef[] {
    const refs: PlanContractFieldRef[] = [
      {
        id: 'input.goal',
        label: '用户目标',
        path: 'input.goal',
        source: 'input',
        required: true,
        valueType: 'string'
      }
    ];
    steps.forEach((step) => {
      (step.consumes || []).forEach((path) =>
        refs.push({
          id: `${step.id}.read.${path}`,
          label: `${step.id} 读取 ${path}`,
          path,
          source: 'state',
          required: true,
          valueType: 'unknown'
        })
      );
      (step.produces || []).forEach((path) =>
        refs.push({
          id: `${step.id}.write.${path}`,
          label: `${step.id} 写入 ${path}`,
          path,
          source: 'node',
          required: false,
          valueType: 'unknown'
        })
      );
    });
    return refs;
  }

  private acceptanceCriteria(request: AiBuildRequest, summary: string, nextSteps: string[]) {
    const criteria = [
      `${request.mode === 'update' ? '修改' : '创建'}${request.target}后满足目标：${request.goal || summary}`,
      'dry-run 不存在阻塞错误',
      '资源创建/复用策略与用户确认一致'
    ];
    if (request.outputRequirement) criteria.push(`输出要求：${request.outputRequirement}`);
    if (request.outputSchema)
      criteria.push(`输出 schema 类型：${typeOfSchema(request.outputSchema) || 'object'}`);
    return [...criteria, ...nextSteps.slice(0, 3).map((step) => `下一步可验证：${step}`)];
  }
}
