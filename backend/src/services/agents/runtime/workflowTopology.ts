import { ToolRegistry } from '../../../registries/ToolRegistry.js';
import type { WorkflowDefinition, WorkflowStep } from '../../../types/agent.js';
import type { WorkflowInputResolver } from '../WorkflowInputResolver.js';

/**
 * 工作流图拓扑 / 步骤显示等纯函数。
 *
 * `WorkflowEngine` 内部的拓扑/可达性辅助散落在 runWorkflow 与若干 private 方法中，
 * 这里集中放与"图本身"或"步骤元信息"相关的小工具：终点节点、显示名、空响应判断等。
 *
 * 目的：B3 阶段剥离纯算法，让 WorkflowEngine 收缩为协调器。
 */
export function getTerminalStepIds(
  workflow: WorkflowDefinition,
  inputResolver: WorkflowInputResolver
): string[] {
  const succs = inputResolver.buildSuccessorMap(workflow);
  return workflow.steps.map((s) => s.id).filter((id) => (succs.get(id) || []).length === 0);
}

/**
 * 计算单个 step 在进度上报中的显示名。
 *  - 优先 displayName；
 *  - 否则按 agent / sub-workflow / tool 类型回退到对应 registry 名称；
 *  - 兜底为 step.id。
 */
export function getStepDisplayName(step: WorkflowStep, agentNameMap?: Map<string, string>): string {
  if (step.displayName?.trim()) return step.displayName.trim();
  if (step.agentId) return agentNameMap?.get(step.agentId) || step.agentId;
  if (step.workflowId) return `子工作流`;
  if (step.toolId) {
    const tool = ToolRegistry.getInstance().getTool(step.toolId);
    return tool?.displayName || tool?.name || step.toolId;
  }
  return step.id;
}

/**
 * 判断 step 输出是否应被视为"空响应"（直接终止当前 workflow 的传播）。
 * 注意：包含 AgentService 在无内容时硬编码的 placeholder 字面量。
 */
export function isResponseEmpty(output: unknown): boolean {
  if (output === null || output === undefined) return true;
  if (typeof output === 'string') {
    const trimmed = output.trim();
    return !trimmed || trimmed === 'No response generated (AI returned empty content)';
  }
  return false;
}
