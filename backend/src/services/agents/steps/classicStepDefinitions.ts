import type { WorkflowStepTypeDefinition } from './StepCatalog.js';

/**
 * "经典"步骤（agent / workflow / tool）的元数据描述。
 * 这些步骤不在 StepRegistry 注册 executor，由 WorkflowEngine 内联处理；
 * 这里仅描述 label / icon / 用于前端步骤目录展示。
 *
 * config 字段一般为空 —— 这三类步骤的字段是顶层（agentId/workflowId/toolId/inputTemplate），
 * 不在 step.config 里。前端 WorkflowStepDetail 会另外渲染这些选择器。
 */
export const agentStepDefinition: WorkflowStepTypeDefinition = {
  type: 'agent',
  label: '智能体',
  icon: 'smart_toy',
  color: 'sky',
  category: 'classic',
  description: '调用一个 Agent（含工具/技能）处理输入。'
};

export const workflowStepDefinition: WorkflowStepTypeDefinition = {
  type: 'workflow',
  label: '子工作流',
  icon: 'account_tree',
  color: 'emerald',
  category: 'classic',
  description: '调用另一个工作流。'
};

export const toolStepDefinition: WorkflowStepTypeDefinition = {
  type: 'tool',
  label: '流程动作',
  icon: 'build',
  color: 'amber',
  category: 'classic',
  description: '调用注册的 Tool（如 HTTP / 解析 / 系统工具）。'
};
