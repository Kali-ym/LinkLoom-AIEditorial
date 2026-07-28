import { adapterStepDefinition } from './AdapterStep.js';
import { batchIterateStepDefinition } from './BatchIterateStep.js';
import { humanApprovalStepDefinition } from './HumanApprovalStep.js';
import { kvReadStepDefinition } from './KvReadStep.js';
import { kvWriteStepDefinition } from './KvWriteStep.js';
import {
  agentStepDefinition,
  workflowStepDefinition,
  toolStepDefinition
} from './classicStepDefinitions.js';
import { routerStepDefinition } from './RouterStep.js';
import { StepCatalog } from './StepCatalog.js';
import { StepRegistry } from './StepRegistry.js';
import { storeQueryStepDefinition } from './StoreQueryStep.js';
import { storeWriteStepDefinition } from './StoreWriteStep.js';
import { transformStepDefinition } from './TransformStep.js';

export { StepRegistry } from './StepRegistry.js';
export { StepCatalog } from './StepCatalog.js';
export type { StepExecutionContext, StepExecutor } from './StepRegistry.js';
export type {
  WorkflowStepTypeDefinition,
  StepColor,
  StepCategory,
  StepPreset
} from './StepCatalog.js';

let registered = false;

/**
 * 进程级注册业务步骤；幂等。
 * - StepCatalog 持有完整 definition（包括"经典"步骤的元数据，供前端目录展示）
 * - StepRegistry 仍然只接收有 executor 的 pipeline 步骤，保持 WorkflowEngine 行为不变
 */
export function registerBuiltinSteps() {
  if (registered) return;
  const catalog = StepCatalog.getInstance();
  const registry = StepRegistry.getInstance();

  const allDefs = [
    adapterStepDefinition,
    storeQueryStepDefinition,
    storeWriteStepDefinition,
    transformStepDefinition,
    kvWriteStepDefinition,
    kvReadStepDefinition,
    routerStepDefinition,
    humanApprovalStepDefinition,
    batchIterateStepDefinition,
    agentStepDefinition,
    workflowStepDefinition,
    toolStepDefinition
  ];

  for (const def of allDefs) {
    catalog.register(def);
    if (def.executor) {
      registry.register(def.type, def.executor);
    }
  }

  registered = true;
}
