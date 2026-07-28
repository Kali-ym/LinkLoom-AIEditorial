import type { AgentDefinition, WorkflowDefinition, WorkflowStepType } from '../../types/agent.js';
import type {
  AiBuildCatalog,
  AiBuildPlan,
  AiBuildValidation,
  WorkflowPlan
} from '../../types/aiBuilder.js';
import { normalizeStringArray, safeRelativePath } from './AiBuilderUtils.js';

const ALL_STEP_KINDS: ReadonlySet<WorkflowStepType> = new Set<WorkflowStepType>([
  'agent',
  'workflow',
  'tool',
  'adapter',
  'store-query',
  'store-write',
  'kv-write',
  'kv-read',
  'transform',
  'batch-iterate',
  'router',
  'human-approval'
]);
const CLASSIC_KINDS: ReadonlySet<WorkflowStepType> = new Set<WorkflowStepType>([
  'agent',
  'workflow',
  'tool'
]);
const PIPELINE_KINDS: ReadonlySet<WorkflowStepType> = new Set<WorkflowStepType>([
  'adapter',
  'store-query',
  'store-write',
  'kv-write',
  'kv-read',
  'transform',
  'batch-iterate',
  'router',
  'human-approval'
]);

function isWorkflowStepType(value: unknown): value is WorkflowStepType {
  return typeof value === 'string' && ALL_STEP_KINDS.has(value as WorkflowStepType);
}

export class AiBuildValidator {
  validatePlan(plan: AiBuildPlan, catalog: AiBuildCatalog): AiBuildValidation {
    const errors: string[] = [];
    const questions = Array.isArray(plan.questions)
      ? plan.questions.filter((question) => {
          if (!question) return false;
          if (typeof question === 'string') return Boolean(question.trim());
          return Boolean((question as any).prompt);
        })
      : [];

    if (!plan.id) errors.push('计划缺少 id');
    if (!plan.target) errors.push('计划缺少 target');
    if (!plan.mode) errors.push('计划缺少 mode');
    if (!Array.isArray(plan.resourceChanges)) errors.push('resourceChanges 必须是数组');
    this.validateTargetChangeScope(plan, errors);

    const createdAgents = new Set<string>();
    const createdWorkflows = new Set<string>();
    const existingAgentIds = new Set(catalog.agents.map((agent) => agent.id));
    const existingWorkflowIds = new Set(catalog.workflows.map((workflow) => workflow.id));
    const existingSkillIds = new Set(catalog.skills.map((skill) => skill.id));
    const existingToolIds = new Set(catalog.tools.map((tool) => tool.id));
    const builtinSkillIds = new Set(
      catalog.skills.filter((skill) => skill.isBuiltin).map((skill) => skill.id)
    );
    const plannedSkillIds = new Set<string>();
    const createdSkillIds = new Set<string>();
    for (const change of plan.resourceChanges || []) {
      if (
        (change.action === 'createSkillFile' || change.action === 'updateSkillFile') &&
        change.skillId
      ) {
        plannedSkillIds.add(change.skillId);
      }
    }

    for (const change of plan.resourceChanges || []) {
      if (change.action === 'createAgent' || change.action === 'updateAgent') {
        this.validateAgentChange(
          change.action,
          change.agent,
          existingAgentIds,
          existingToolIds,
          existingSkillIds,
          plannedSkillIds,
          createdAgents,
          errors
        );
      } else if (change.action === 'createWorkflow' || change.action === 'updateWorkflow') {
        this.validateWorkflowChange(
          change.action,
          change.workflow,
          existingWorkflowIds,
          createdWorkflows,
          existingAgentIds,
          existingToolIds,
          existingWorkflowIds,
          createdAgents,
          errors
        );
      } else if (change.action === 'createSkillFile' || change.action === 'updateSkillFile') {
        if (!change.skillId) errors.push('技能变更缺少 skillId');
        if (
          change.action === 'createSkillFile' &&
          change.skillId &&
          existingSkillIds.has(change.skillId)
        ) {
          errors.push(`技能 id 已存在：${change.skillId}`);
        }
        if (
          change.action === 'createSkillFile' &&
          change.skillId &&
          createdSkillIds.has(change.skillId)
        ) {
          errors.push(`计划中重复创建技能 id：${change.skillId}`);
        }
        if (change.action === 'createSkillFile' && change.skillId)
          createdSkillIds.add(change.skillId);
        if (change.action === 'updateSkillFile' && !existingSkillIds.has(change.skillId)) {
          errors.push(`无法更新不存在的技能：${change.skillId}`);
        }
        if (change.action === 'updateSkillFile' && builtinSkillIds.has(change.skillId)) {
          errors.push(`无法直接修改内置技能：${change.skillId}`);
        }
        if (!safeRelativePath(change.filePath)) {
          errors.push(`技能文件路径不合法：${change.filePath}`);
        }
        if (typeof change.content !== 'string') {
          errors.push(
            `技能文件 ${change.skillId || '<未知>'}/${change.filePath || '<未知>'} 缺少文本内容`
          );
        }
      } else {
        errors.push(`不支持的变更类型：${(change as any).action}`);
      }
    }

    if (plan.workflowPlan) {
      this.validateWorkflowPlan(plan.workflowPlan, errors);
    }

    return {
      status: errors.length > 0 ? 'invalid' : questions.length > 0 ? 'needs_input' : 'ok',
      errors
    };
  }

  private validateTargetChangeScope(plan: AiBuildPlan, errors: string[]) {
    const changes = Array.isArray(plan.resourceChanges) ? plan.resourceChanges : [];
    const actions = changes.map((change) => change.action);

    if (plan.target === 'agent') {
      if (plan.workflowPlan) {
        errors.push('创建/修改智能体时不能输出 workflowPlan，请改用工作流构建器');
      }
      for (const action of actions) {
        if (action !== 'createAgent' && action !== 'updateAgent') {
          errors.push(`智能体构建器不能产生 ${action}；如需创建技能或工作流，请 @创建 工作流`);
        }
      }
      const expected = plan.mode === 'update' ? 'updateAgent' : 'createAgent';
      if (actions.some((action) => action !== expected)) {
        errors.push(
          `智能体构建器在${plan.mode === 'update' ? '修改' : '创建'}模式下只能产生 ${expected}`
        );
      }
    }

    if (plan.target === 'skill') {
      if (plan.workflowPlan) {
        errors.push('创建/修改技能时不能输出 workflowPlan，请改用工作流构建器');
      }
      for (const action of actions) {
        if (action !== 'createSkillFile' && action !== 'updateSkillFile') {
          errors.push(`技能构建器不能产生 ${action}；如需创建智能体或工作流，请 @创建 工作流`);
        }
      }
      const expected = plan.mode === 'update' ? 'updateSkillFile' : 'createSkillFile';
      if (actions.some((action) => action !== expected)) {
        errors.push(
          `技能构建器在${plan.mode === 'update' ? '修改' : '创建'}模式下只能产生 ${expected}`
        );
      }
    }

    if (plan.target === 'workflow' && plan.mode === 'create') {
      const hasWorkflowChange = actions.some(
        (action) => action === 'createWorkflow' || action === 'updateWorkflow'
      );
      if (!hasWorkflowChange && !plan.workflowPlan) {
        errors.push('创建工作流计划应至少包含工作流变更或 workflowPlan');
      }
      const allowResourceCreation =
        plan.resourcePolicy?.source === 'server' &&
        plan.resourcePolicy.allowResourceCreation === true;
      if (!allowResourceCreation) {
        for (const action of actions) {
          if (action === 'createAgent' || action === 'createSkillFile') {
            errors.push('创建工作流默认不能新建智能体或技能；如需新建能力，请先在对话中明确允许');
          }
        }
      }
    }

    if (plan.target === 'workflow' && plan.mode === 'update') {
      for (const action of actions) {
        if (action === 'createAgent' || action === 'createSkillFile') {
          const explicitlyRequested =
            plan.resourcePolicy?.source === 'server' &&
            plan.resourcePolicy.allowResourceCreation === true;
          if (!explicitlyRequested) {
            errors.push(
              '修改工作流时默认不能新建智能体或技能；若确需补充能力，请先获得服务端资源创建授权'
            );
          }
        }
      }
    }
  }

  private validateAgentChange(
    action: 'createAgent' | 'updateAgent',
    agent: AgentDefinition,
    existingAgentIds: Set<string>,
    existingToolIds: Set<string>,
    existingSkillIds: Set<string>,
    plannedSkillIds: Set<string>,
    createdAgents: Set<string>,
    errors: string[]
  ) {
    if (!agent || typeof agent !== 'object') {
      errors.push(`${action} 缺少 agent 对象`);
      return;
    }
    if (!agent.id) errors.push(`${action} 缺少 agent.id`);
    if (action === 'createAgent' && !agent.name)
      errors.push(`智能体 ${agent.id || '<未知>'} 缺少 name`);
    if (action === 'createAgent' && agent.id && existingAgentIds.has(agent.id)) {
      errors.push(`智能体 id 已存在：${agent.id}`);
    }
    if (action === 'updateAgent' && agent.id && !existingAgentIds.has(agent.id)) {
      errors.push(`无法更新不存在的智能体：${agent.id}`);
    }
    if (agent.id && createdAgents.has(agent.id)) {
      errors.push(`计划中重复创建智能体 id：${agent.id}`);
    }
    if (agent.id && action === 'createAgent') createdAgents.add(agent.id);
    if (
      (action === 'createAgent' || Object.prototype.hasOwnProperty.call(agent, 'toolIds')) &&
      !Array.isArray(agent.toolIds)
    )
      errors.push(`智能体 ${agent.id} 的 toolIds 必须是数组`);
    if (
      (action === 'createAgent' || Object.prototype.hasOwnProperty.call(agent, 'skillIds')) &&
      !Array.isArray(agent.skillIds)
    )
      errors.push(`智能体 ${agent.id} 的 skillIds 必须是数组`);
    if (
      (action === 'createAgent' || Object.prototype.hasOwnProperty.call(agent, 'mcpServerIds')) &&
      !Array.isArray(agent.mcpServerIds)
    )
      errors.push(`智能体 ${agent.id} 的 mcpServerIds 必须是数组`);
    for (const toolId of agent.toolIds || []) {
      if (!existingToolIds.has(toolId))
        errors.push(`智能体 ${agent.id} 引用了不存在的工具：${toolId}`);
    }
    for (const skillId of agent.skillIds || []) {
      if (!existingSkillIds.has(skillId) && !plannedSkillIds.has(skillId)) {
        errors.push(`智能体 ${agent.id} 引用了不存在的技能：${skillId}`);
      }
    }
  }

  private validateWorkflowChange(
    action: 'createWorkflow' | 'updateWorkflow',
    workflow: WorkflowDefinition,
    existingWorkflowIds: Set<string>,
    createdWorkflows: Set<string>,
    existingAgentIds: Set<string>,
    existingToolIds: Set<string>,
    allExistingWorkflowIds: Set<string>,
    createdAgents: Set<string>,
    errors: string[]
  ) {
    if (!workflow || typeof workflow !== 'object') {
      errors.push(`${action} 缺少 workflow 对象`);
      return;
    }
    if (!workflow.id) errors.push(`${action} 缺少 workflow.id`);
    if (action === 'createWorkflow' && !workflow.name)
      errors.push(`工作流 ${workflow.id || '<未知>'} 缺少 name`);
    if (action === 'createWorkflow' && workflow.id && existingWorkflowIds.has(workflow.id)) {
      errors.push(`工作流 id 已存在：${workflow.id}`);
    }
    if (action === 'updateWorkflow' && workflow.id && !existingWorkflowIds.has(workflow.id)) {
      errors.push(`无法更新不存在的工作流：${workflow.id}`);
    }
    if (workflow.id && createdWorkflows.has(workflow.id)) {
      errors.push(`计划中重复创建工作流 id：${workflow.id}`);
    }
    if (workflow.id && action === 'createWorkflow') createdWorkflows.add(workflow.id);
    if (action === 'createWorkflow' || Object.prototype.hasOwnProperty.call(workflow, 'steps')) {
      this.validateWorkflowShape(
        workflow,
        existingAgentIds,
        existingToolIds,
        allExistingWorkflowIds,
        createdAgents,
        errors
      );
    }
  }

  validateWorkflowShape(
    workflow: WorkflowDefinition,
    existingAgentIds: Set<string>,
    existingToolIds: Set<string>,
    existingWorkflowIds: Set<string>,
    createdAgents: Set<string>,
    errors: string[]
  ) {
    if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
      errors.push(`工作流 ${workflow.id} 至少需要一个步骤`);
      return;
    }
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (!step.id) errors.push(`工作流 ${workflow.id} 存在缺少 id 的步骤`);
      if (step.id && stepIds.has(step.id))
        errors.push(`工作流 ${workflow.id} 存在重复步骤 id：${step.id}`);
      if (step.id) stepIds.add(step.id);

      const type = step.type || (step.toolId ? 'tool' : step.workflowId ? 'workflow' : 'agent');
      if (!isWorkflowStepType(type)) {
        errors.push(`工作流 ${workflow.id} 步骤 ${step.id} 类型未知：${String(type)}`);
        continue;
      }
      if (type === 'tool' && (!step.toolId || !existingToolIds.has(step.toolId))) {
        errors.push(
          `工作流 ${workflow.id} 步骤 ${step.id} 引用了不存在的工具：${step.toolId || '<空>'}`
        );
      }
      if (
        type === 'agent' &&
        (!step.agentId || (!existingAgentIds.has(step.agentId) && !createdAgents.has(step.agentId)))
      ) {
        errors.push(
          `工作流 ${workflow.id} 步骤 ${step.id} 引用了不存在的智能体：${step.agentId || '<空>'}`
        );
      }
      if (type === 'workflow' && (!step.workflowId || !existingWorkflowIds.has(step.workflowId))) {
        errors.push(
          `工作流 ${workflow.id} 步骤 ${step.id} 引用了不存在的工作流：${step.workflowId || '<空>'}`
        );
      }
      if (PIPELINE_KINDS.has(type)) {
        this.validatePipelineStepConfig(workflow.id, step, errors);
      }
      for (const nextId of step.nextStepIds || []) {
        if (!stepIds.has(nextId) && !workflow.steps.some((candidate) => candidate.id === nextId)) {
          errors.push(`工作流 ${workflow.id} 步骤 ${step.id} 链接到不存在的步骤：${nextId}`);
        }
      }
    }
    if (!workflow.initialStepId || !stepIds.has(workflow.initialStepId)) {
      errors.push(`工作流 ${workflow.id} 的 initialStepId 无效`);
    }
    this.validateReachability(workflow, stepIds, errors);
  }

  /**
   * Pipeline 步骤的最低必要校验：
   * - config 必须是对象（若给了）
   * - adapter / store-write / kv-write / batch-iterate 各自必填关键字段（容许使用表达式）。
   */
  private validatePipelineStepConfig(workflowId: string, step: any, errors: string[]) {
    if (
      step.config !== undefined &&
      (typeof step.config !== 'object' || Array.isArray(step.config) || step.config === null)
    ) {
      errors.push(`工作流 ${workflowId} 步骤 ${step.id} 的 config 必须是对象`);
      return;
    }
    const cfg = (step.config || {}) as Record<string, unknown>;
    const has = (key: string) => cfg[key] !== undefined && cfg[key] !== '' && cfg[key] !== null;
    switch (step.type) {
      case 'adapter':
        if (!has('adapter')) {
          errors.push(`工作流 ${workflowId} 步骤 ${step.id}（adapter）需要 config.adapter`);
        }
        break;
      case 'store-write':
        if (!has('id')) {
          errors.push(
            `工作流 ${workflowId} 步骤 ${step.id}（store-write）需要 config.id（如 $.item.id）`
          );
        }
        break;
      case 'kv-write':
        if (!has('key')) {
          errors.push(`工作流 ${workflowId} 步骤 ${step.id}（kv-write）需要 config.key`);
        }
        break;
      case 'kv-read':
        if (!has('key')) {
          errors.push(`工作流 ${workflowId} 步骤 ${step.id}（kv-read）需要 config.key`);
        }
        break;
      case 'batch-iterate':
        if (!has('itemsPath')) {
          errors.push(`工作流 ${workflowId} 步骤 ${step.id}（batch-iterate）需要 config.itemsPath`);
        }
        if (!cfg.child || typeof cfg.child !== 'object' || Array.isArray(cfg.child)) {
          errors.push(
            `工作流 ${workflowId} 步骤 ${step.id}（batch-iterate）需要 config.child 对象`
          );
        }
        break;
      case 'store-query':
        // store-query 全字段可选，跳过强制校验。
        break;
      default:
        break;
    }
  }

  private validateReachability(
    workflow: WorkflowDefinition,
    stepIds: Set<string>,
    errors: string[]
  ) {
    if (!workflow.initialStepId || !stepIds.has(workflow.initialStepId)) return;
    const stepMap = new Map(workflow.steps.map((step) => [step.id, step]));
    const visited = new Set<string>();
    const queue = [workflow.initialStepId];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const step = stepMap.get(current);
      for (const nextId of step?.nextStepIds || []) {
        if (stepIds.has(nextId) && !visited.has(nextId)) queue.push(nextId);
      }
    }
    for (const stepId of stepIds) {
      if (!visited.has(stepId))
        errors.push(`工作流 ${workflow.id} 存在从 initialStepId 不可达的步骤：${stepId}`);
    }
  }

  private validateWorkflowPlan(plan: WorkflowPlan, errors: string[]) {
    if (!plan.name) errors.push('workflowPlan.name 不能为空');
    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      errors.push('workflowPlan.steps 至少需要一个步骤');
      return;
    }

    const produced = new Set<string>();
    for (const [index, step] of plan.steps.entries()) {
      if (!step.goal) errors.push(`workflowPlan 第 ${index + 1} 步缺少 goal`);
      if (!isWorkflowStepType(step.kind)) {
        errors.push(
          `workflowPlan 第 ${index + 1} 步 kind 无效：${String(step.kind)}（允许 agent|tool|workflow|adapter|store-query|store-write|kv-write|transform|batch-iterate）`
        );
      } else if (
        CLASSIC_KINDS.has(step.kind) &&
        !step.resourceRef &&
        !step.needsNewAgent &&
        !step.needsNewSkill &&
        step.kind === 'agent'
      ) {
        // 经典 agent 没指定 resourceRef 也未要求新建：允许 Compiler fallback 到 createdAgents[0]，不在此处报错。
      }
      for (const consumedField of normalizeStringArray(step.consumes)) {
        if (!produced.has(consumedField) && !consumedField.startsWith('input.') && index > 0) {
          errors.push(`workflowPlan 步骤 ${step.id || index + 1} 消费了未知字段：${consumedField}`);
        }
      }
      for (const producedField of normalizeStringArray(step.produces)) produced.add(producedField);
    }
  }
}
