import type {
  AiBuildCatalog,
  AiBuildChange,
  AiBuildPlan,
  AiBuildTarget,
  CapabilityGraph,
  CapabilityGraphEdge,
  CapabilityGraphNode,
  PlanDraft,
  WorkflowPlan
} from '../../types/aiBuilder.js';

function nodeId(prefix: string, raw: string) {
  return `${prefix}:${raw || 'unknown'}`.replace(/\s+/g, '_');
}

function targetFromRef(ref?: string): AiBuildTarget | 'tool' | 'mcp' {
  if (!ref) return 'agent';
  const [type] = ref.split(':');
  if (
    type === 'agent' ||
    type === 'skill' ||
    type === 'workflow' ||
    type === 'tool' ||
    type === 'mcp'
  )
    return type;
  return 'agent';
}

const PIPELINE_KINDS = new Set([
  'adapter',
  'store-query',
  'store-write',
  'kv-write',
  'batch-iterate'
]);
const CLASSIC_KINDS = new Set(['agent', 'workflow', 'tool']);

function nodeTypeForKind(kind: string | undefined, ref?: string): AiBuildTarget | 'tool' | 'mcp' {
  if (kind && PIPELINE_KINDS.has(kind)) return 'tool';
  if (kind && CLASSIC_KINDS.has(kind)) return targetFromRef(ref || `${kind}:`);
  return targetFromRef(ref);
}

function riskLevel(
  action: CapabilityGraphNode['action'],
  blocked?: boolean
): CapabilityGraphNode['riskLevel'] {
  if (blocked) return 'high';
  if (action === 'create') return 'medium';
  if (action === 'update') return 'medium';
  return 'low';
}

function changeNode(change: AiBuildChange): CapabilityGraphNode {
  if (change.action === 'createAgent' || change.action === 'updateAgent') {
    const action = change.action === 'createAgent' ? 'create' : 'update';
    return {
      id: nodeId('agent', change.agent.id),
      type: 'agent',
      label: change.agent.name || change.agent.id,
      action,
      status: 'changed',
      summary: change.agent.description,
      ref: `agent:${change.agent.id}`,
      riskLevel: riskLevel(action)
    };
  }
  if (change.action === 'createWorkflow' || change.action === 'updateWorkflow') {
    const action = change.action === 'createWorkflow' ? 'create' : 'update';
    return {
      id: nodeId('workflow', change.workflow.id),
      type: 'workflow',
      label: change.workflow.name || change.workflow.id,
      action,
      status: 'changed',
      summary: change.workflow.description,
      ref: `workflow:${change.workflow.id}`,
      riskLevel: riskLevel(action)
    };
  }
  const action = change.action === 'createSkillFile' ? 'create' : 'update';
  return {
    id: nodeId('skill', change.skillId),
    type: 'skill',
    label: `${change.skillId}/${change.filePath}`,
    action,
    status: 'changed',
    summary: '技能文件变更',
    ref: `skill:${change.skillId}`,
    riskLevel: riskLevel(action)
  };
}

export class CapabilityGraphBuilder {
  fromDraft(draft: PlanDraft, catalog: AiBuildCatalog): CapabilityGraph {
    const nodes = new Map<string, CapabilityGraphNode>();
    const edges: CapabilityGraphEdge[] = [];
    nodes.set('input:goal', {
      id: 'input:goal',
      type: 'input',
      label: '用户目标',
      action: 'reference',
      status: 'ready',
      summary: draft.summary,
      riskLevel: 'low'
    });
    for (const resource of draft.proposedResources || []) {
      const id = resource.ref || nodeId(resource.type, resource.name);
      nodes.set(id, {
        id,
        type: resource.type,
        label: resource.name,
        action: resource.action,
        status: 'planned',
        summary: resource.reason,
        ref: resource.ref,
        riskLevel: riskLevel(resource.action)
      });
      edges.push({
        id: `edge:goal:${id}`,
        from: 'input:goal',
        to: id,
        label: resource.action === 'reuse' ? '复用能力' : '规划变更'
      });
    }
    this.addWorkflowOutline(nodes, edges, draft.workflowOutline, catalog);
    return this.finish(
      `cap_${draft.id}`,
      draft.target,
      [...nodes.values()],
      edges,
      draft.risks.length
    );
  }

  fromPlan(plan: AiBuildPlan, catalog: AiBuildCatalog): CapabilityGraph {
    const nodes = new Map<string, CapabilityGraphNode>();
    const edges: CapabilityGraphEdge[] = [];
    nodes.set('input:plan', {
      id: 'input:plan',
      type: 'input',
      label: '构建计划',
      action: 'reference',
      status: 'ready',
      summary: plan.summary,
      riskLevel: 'low'
    });
    for (const change of plan.resourceChanges || []) {
      const node = changeNode(change);
      nodes.set(node.id, node);
      edges.push({
        id: `edge:plan:${node.id}`,
        from: 'input:plan',
        to: node.id,
        label: '资源变更'
      });
    }
    this.addWorkflowOutline(nodes, edges, plan.workflowPlan, catalog);
    return this.finish(
      `cap_${plan.id}_v${plan.version || 1}`,
      plan.target,
      [...nodes.values()],
      edges,
      plan.warnings.length + (plan.validation.errors.length || 0)
    );
  }

  private addWorkflowOutline(
    nodes: Map<string, CapabilityGraphNode>,
    edges: CapabilityGraphEdge[],
    workflowPlan: WorkflowPlan | undefined,
    catalog: AiBuildCatalog
  ) {
    if (!workflowPlan?.steps?.length) return;
    let previousId = 'input:goal';
    if (!nodes.has(previousId)) previousId = 'input:plan';
    workflowPlan.steps.forEach((step, index) => {
      const isPipeline = PIPELINE_KINDS.has(step.kind);
      const refType = nodeTypeForKind(step.kind, step.resourceRef);
      const id = step.resourceRef || nodeId(step.kind, step.id);
      const catalogHit = isPipeline ? true : this.catalogHasRef(catalog, step.resourceRef);
      nodes.set(id, {
        id,
        type: refType,
        label: step.goal || step.id,
        action: isPipeline
          ? 'reference'
          : step.needsNewAgent || step.needsNewSkill
            ? 'create'
            : step.resourceRef
              ? 'reuse'
              : 'reference',
        status: catalogHit || step.needsNewAgent || step.needsNewSkill ? 'planned' : 'blocked',
        summary: `${step.kind}${step.produces?.length ? ` · 输出 ${step.produces.join(', ')}` : ''}`,
        ref: isPipeline ? undefined : step.resourceRef,
        riskLevel: riskLevel(
          isPipeline ? 'reuse' : step.needsNewAgent || step.needsNewSkill ? 'create' : 'reuse',
          !catalogHit && Boolean(step.resourceRef)
        )
      });
      edges.push({
        id: `edge:step:${index}:${id}`,
        from: previousId,
        to: id,
        label: step.consumes?.length ? `读取 ${step.consumes.join(', ')}` : '下一步',
        fieldRefs: [...(step.consumes || []), ...(step.produces || [])]
      });
      previousId = id;
    });
    nodes.set('output:result', {
      id: 'output:result',
      type: 'output',
      label: '最终输出',
      action: 'produce',
      status: 'planned',
      summary: workflowPlan.description || workflowPlan.name,
      riskLevel: 'low'
    });
    edges.push({
      id: 'edge:workflow:output',
      from: previousId,
      to: 'output:result',
      label: '产出结果'
    });
  }

  private catalogHasRef(catalog: AiBuildCatalog, ref?: string) {
    if (!ref) return true;
    const [type, id] = ref.split(':');
    if (!id) return true;
    if (type === 'agent') return catalog.agents.some((agent) => agent.id === id);
    if (type === 'skill') return catalog.skills.some((skill) => skill.id === id);
    if (type === 'workflow') return catalog.workflows.some((workflow) => workflow.id === id);
    if (type === 'tool') return catalog.tools.some((tool) => tool.id === id || tool.name === id);
    return true;
  }

  private finish(
    id: string,
    target: AiBuildTarget,
    nodes: CapabilityGraphNode[],
    edges: CapabilityGraphEdge[],
    risks: number
  ): CapabilityGraph {
    return {
      id,
      target,
      nodes,
      edges,
      summary: {
        reuse: nodes.filter((node) => node.action === 'reuse').length,
        create: nodes.filter((node) => node.action === 'create').length,
        update: nodes.filter((node) => node.action === 'update').length,
        risks: risks + nodes.filter((node) => node.status === 'blocked').length
      },
      updatedAt: new Date().toISOString()
    };
  }
}
