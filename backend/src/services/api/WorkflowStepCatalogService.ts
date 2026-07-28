import { ADAPTER_ALL_VALUE, FEED_SOURCE_TYPE_OPTIONS } from '../../config/businessEnums.js';
import type { WorkflowInputField, WorkflowInputSpec, WorkflowStepType } from '../../types/agent.js';
import { StepCatalog, registerBuiltinSteps } from '../agents/steps/index.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';

/**
 * 把后端 StepCatalog 元数据聚合后暴露给前端（含 agent/workflow/tool 三类的可选 id 列表，
 * 以及 adapter 的实际适配器名）。
 *
 * 前端 useStepCatalog hook 拉取此响应，渲染 StepTypePicker / SchemaForm。
 */
export interface StepTypeDescriptor {
  type: WorkflowStepType;
  label: string;
  icon: string;
  color: string;
  category: 'pipeline' | 'classic';
  description: string;
  configSchema?: WorkflowInputSpec;
  defaultConfig?: Record<string, unknown>;
  presets?: Array<{
    id: string;
    label: string;
    description?: string;
    config: Record<string, unknown>;
  }>;
  /** 经典步骤的引用列表（agent → agents, workflow → workflows, tool → tools）。 */
  references?: Array<{ id: string; name: string; description?: string }>;
}

export interface StepCatalogResponse {
  stepTypes: StepTypeDescriptor[];
  /** 通用业务枚举，供前端步骤配置、模板编辑等场景复用。 */
  enums: {
    feedSourceTypes: typeof FEED_SOURCE_TYPE_OPTIONS;
    adapterAllValue: string;
  };
}

export class WorkflowStepCatalogService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {
    registerBuiltinSteps();
  }

  async list(): Promise<StepCatalogResponse> {
    const catalog = StepCatalog.getInstance();
    const defs = catalog.list();

    const [agents, workflows, tools, adapters] = await Promise.all([
      this.store.listAgents().catch(() => []),
      this.store.listWorkflows().catch(() => []),
      this.listTools(),
      this.listAdapterNames()
    ]);

    const stepTypes: StepTypeDescriptor[] = defs.map((def) => {
      const desc: StepTypeDescriptor = {
        type: def.type,
        label: def.label,
        icon: def.icon,
        color: def.color,
        category: def.category,
        description: def.description,
        configSchema: this.augmentSchema(def.type, def.configSchema, adapters),
        defaultConfig: def.defaultConfig,
        presets: def.presets
      };

      if (def.type === 'agent') {
        desc.references = agents.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description
        }));
      } else if (def.type === 'workflow') {
        desc.references = workflows.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description
        }));
      } else if (def.type === 'tool') {
        desc.references = tools;
      }

      return desc;
    });

    return {
      stepTypes,
      enums: {
        feedSourceTypes: FEED_SOURCE_TYPE_OPTIONS,
        adapterAllValue: ADAPTER_ALL_VALUE
      }
    };
  }

  /**
   * adapter 步骤的"采集目标"枚举需要在 runtime 注入实际适配器名 —— 不让 catalog 静态依赖 TaskService。
   */
  private augmentSchema(
    type: WorkflowStepType,
    schema: WorkflowInputSpec | undefined,
    adapters: string[]
  ): WorkflowInputSpec | undefined {
    if (!schema) return schema;
    if (type !== 'adapter') return schema;

    const fields: WorkflowInputField[] = schema.fields.map((f) => {
      if (f.key !== 'adapter') return f;
      return {
        ...f,
        options: [
          { value: ADAPTER_ALL_VALUE, label: '全部已启用适配器' },
          ...adapters.map((name) => ({ value: name, label: name }))
        ]
      };
    });
    return { ...schema, fields };
  }

  private async listAdapterNames(): Promise<string[]> {
    const taskService = this.context.taskService as any;
    if (!taskService?.getAdapters) return [];
    try {
      const adapters = taskService.getAdapters() as Array<{ name?: string }>;
      return adapters.map((a) => a.name).filter((n): n is string => !!n);
    } catch {
      return [];
    }
  }

  private async listTools(): Promise<Array<{ id: string; name: string; description?: string }>> {
    const execSvc = (this.context as any).executionService;
    if (!execSvc?.listAvailableTools) return [];
    try {
      const tools = await execSvc.listAvailableTools();
      return (
        tools as Array<{ id: string; name?: string; displayName?: string; description?: string }>
      ).map((t) => ({
        id: t.id,
        name: t.displayName || t.name || t.id,
        description: t.description
      }));
    } catch {
      return [];
    }
  }
}
