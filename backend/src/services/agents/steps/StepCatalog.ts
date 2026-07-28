import type { WorkflowInputSpec, WorkflowStepType } from '../../../types/agent.js';
import type { StepExecutor } from './StepRegistry.js';

/** 步骤目录项颜色（与前端 catalog.color 对齐）。 */
export type StepColor = 'emerald' | 'sky' | 'amber' | 'violet' | 'rose' | 'slate';
export type StepCategory = 'pipeline' | 'classic';

export interface StepPreset {
  id: string;
  label: string;
  description?: string;
  config: Record<string, unknown>;
}

export interface WorkflowStepTypeDefinition {
  type: WorkflowStepType;
  label: string;
  icon: string;
  color: StepColor;
  category: StepCategory;
  description: string;
  configSchema?: WorkflowInputSpec;
  defaultConfig?: Record<string, unknown>;
  presets?: StepPreset[];
  /** Pipeline 步骤携带 executor；agent/workflow/tool 等"经典"步骤由 WorkflowEngine 内联处理。 */
  executor?: StepExecutor;
}

/**
 * 步骤目录：持有所有步骤类型的元数据 + executor。
 * - WorkflowEngine 通过 getExecutor() 取得 pipeline 步骤的执行器。
 * - WorkflowStepCatalogService 通过 list() 把整张目录暴露给前端。
 */
export class StepCatalog {
  private static instance: StepCatalog | null = null;
  private defs = new Map<WorkflowStepType, WorkflowStepTypeDefinition>();

  static getInstance(): StepCatalog {
    if (!StepCatalog.instance) {
      StepCatalog.instance = new StepCatalog();
    }
    return StepCatalog.instance;
  }

  register(definition: WorkflowStepTypeDefinition) {
    this.defs.set(definition.type, definition);
  }

  get(type: WorkflowStepType | undefined): WorkflowStepTypeDefinition | undefined {
    if (!type) return undefined;
    return this.defs.get(type);
  }

  getExecutor(type: WorkflowStepType | undefined): StepExecutor | undefined {
    if (!type) return undefined;
    return this.defs.get(type)?.executor;
  }

  hasExecutor(type: WorkflowStepType | undefined): boolean {
    return !!this.getExecutor(type);
  }

  list(): WorkflowStepTypeDefinition[] {
    return Array.from(this.defs.values());
  }
}
