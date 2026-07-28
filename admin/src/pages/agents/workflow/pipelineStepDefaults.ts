import type { WorkflowStep } from '../../../services/agentService';
import type { StepTypeDescriptor } from '../../../hooks/useStepCatalog';

/**
 * 构造一个新步骤实例。
 * 默认 config 完全来自后端 catalog.defaultConfig，前端不再硬编码业务字段。
 */
export function createStepFromCatalog(
  def: StepTypeDescriptor | undefined,
  id: string,
  displayName: string
): WorkflowStep {
  const type = (def?.type as WorkflowStep['type']) || 'agent';
  const base: WorkflowStep = {
    id,
    type,
    displayName,
    nextStepIds: [],
    enabled: true
  };

  // pipeline 类型携带默认 config
  if (def?.defaultConfig) {
    base.config = JSON.parse(JSON.stringify(def.defaultConfig));
  }

  // 经典类型的默认占位
  if (type === 'agent') {
    base.agentId = '';
    base.execution = { mode: 'single' };
  } else if (type === 'workflow') {
    base.workflowId = '';
  } else if (type === 'tool') {
    base.toolId = '';
  }

  return base;
}
