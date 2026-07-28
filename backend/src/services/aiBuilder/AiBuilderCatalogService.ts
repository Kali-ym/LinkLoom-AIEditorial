import type {
  AiBuildCatalog,
  AiBuildStepTypeDescriptor,
  AiBuilderContract
} from '../../types/aiBuilder.js';
import { registerBuiltinSteps, StepCatalog } from '../agents/steps/index.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import {
  EmptyAiBuilderDomainCatalogProvider,
  type AiBuilderDomainCatalogProvider
} from './AiBuilderDomainCatalogProvider.js';
import { truncateText } from './AiBuilderUtils.js';

function getContract(resource: any): AiBuilderContract | undefined {
  const contract = resource?.metadata?.aiBuilder?.contract;
  return contract && typeof contract === 'object' ? contract : undefined;
}

function summarizeMcpServer(config: any) {
  return {
    id: String(config?.id || ''),
    name: String(config?.name || config?.id || ''),
    description: String(config?.description || ''),
    transportType: ['stdio', 'sse', 'streamable-http'].includes(config?.transportType)
      ? config.transportType
      : 'stdio',
    enabled: config?.enabled !== false
  };
}

const CLASSIC_TYPES = new Set(['agent', 'workflow', 'tool']);

function inferStepType(step: any): string {
  if (step.type) return step.type;
  if (step.toolId) return 'tool';
  if (step.workflowId) return 'workflow';
  if (step.agentId) return 'agent';
  return 'agent';
}

function getStepResourceRef(step: any): string | undefined {
  const type = inferStepType(step);
  if (type === 'tool') return step.toolId ? `tool:${step.toolId}` : undefined;
  if (type === 'workflow') return step.workflowId ? `workflow:${step.workflowId}` : undefined;
  if (type === 'agent') return step.agentId ? `agent:${step.agentId}` : undefined;
  return undefined;
}

/** Pipeline 步骤的 config 通常很复杂，给 LLM 看时只截关键字段。 */
function summarizeStepConfig(config: unknown): Record<string, unknown> | undefined {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return undefined;
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      summary[key] = value;
    } else if (Array.isArray(value)) {
      summary[key] = `[${value.length} items]`;
    } else if (typeof value === 'object') {
      summary[key] = '{...}';
    }
  }
  return Object.keys(summary).length > 0 ? summary : undefined;
}

function builderHintsForStepType(type: string): AiBuildStepTypeDescriptor['builderHints'] {
  const hints: Record<string, AiBuildStepTypeDescriptor['builderHints']> = {
    adapter: {
      input: '可选；通常直接读取运行日期、调度上下文和 step config。',
      output: '{ adapter, date, count, message }，外部数据接入结果由具体 adapter 决定。',
      useWhen: '需要先从外部连接器、采集器或集成源同步数据时使用，常作为数据管线第一步。',
      configGuidance: '常用 configOverrides.adapter；运行日期优先用 ${date} 或调度日期。',
      commonRefs: ['${date}', '$.input.date']
    },
    'store-query': {
      input: '通常不依赖上游输出；筛选条件优先放 configOverrides.filter。',
      output: '{ items, total }，后续常用 $.query.items 或 $.<stepId>.items。',
      useWhen: '需要从持久化数据集中按过滤、排序、分页读取候选记录时使用。',
      configGuidance:
        '筛选、排序、limit 放 configOverrides；不要为了固定筛选条件创建 inputSchema。',
      commonRefs: ['$.query.items', '$.input.filter', '$.input.date']
    },
    transform: {
      input: '读取上游 JSON 或当前 resolvedInput。',
      output: '声明式 operations 的转换结果。',
      useWhen: '需要整理字段、解析 JSON、包裹结果或调整下游输入结构，且不需要调用模型时使用。',
      configGuidance: '把 operations 放 configOverrides.operations；保持每步只做一组清晰转换。',
      commonRefs: ['$.current', '$.input', '$.<stepId>']
    },
    'batch-iterate': {
      input: '通常读取上游数组，例如 store-query 输出。',
      output: '{ items, total, succeeded, failed } 类型的批处理结果集合。',
      useWhen: '需要逐条调用智能体、子工作流、工具或可执行 pipeline 子步骤时使用。',
      configGuidance:
        'itemsPath 指向数组；child.type 可为 agent/workflow/store-write/kv-write/tool；并发默认从 1 开始。',
      commonRefs: ['$.query.items', '$.item', '$.item.id', '$.item.parsed']
    },
    'store-write': {
      input: '通常来自 batch-iterate 的单条 item、上游解析结果或 transform 输出。',
      output: '{ id, patchedKeys }，同时更新目标数据记录的 metadata。',
      useWhen: '需要把结构化处理结果写回持久化数据记录时使用。',
      configGuidance:
        'id 通常来自当前 item；patch 指向要写回的对象；重要字段可用 allowedKeys 白名单。',
      commonRefs: ['$.item.id', '$.item.item.id', '$.item.parsed', '$.current']
    },
    'kv-write': {
      input: '通常来自生成、transform 或任意上游结构。',
      output: '{ key, indexKey?, indexValue? }，同时写入 LocalStore KV。',
      useWhen: '需要落地发布产物、索引、快照或跨工作流可复用状态时使用。',
      configGuidance:
        'key 使用稳定模板；value 指向要落库的产物；索引类产物使用 indexKey/indexValue。',
      commonRefs: ['$.current', '$.input', '${date}']
    }
  };
  return hints[type];
}

export class AiBuilderCatalogService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext,
    private readonly domainCatalogProvider: AiBuilderDomainCatalogProvider = new EmptyAiBuilderDomainCatalogProvider()
  ) {
    registerBuiltinSteps();
  }

  async buildCatalog(): Promise<AiBuildCatalog> {
    const [agents, skills, workflows, mcpServers] = await Promise.all([
      this.store.listAgents(),
      this.store.listSkills(),
      this.store.listWorkflows(),
      this.listMcpServerSummaries()
    ]);

    const tools = this.context.executionService.listAvailableTools();
    const settings = this.context.settings || {};
    const providerId = String(
      (settings as any).ACTIVE_AI_PROVIDER_ID || (settings as any).AI_PROVIDERS?.[0]?.id || ''
    );
    const provider =
      ((settings as any).AI_PROVIDERS || []).find((item: any) => item.id === providerId) ||
      (settings as any).AI_PROVIDERS?.[0];
    const domainCatalog = this.domainCatalogProvider.buildDomainCatalog();
    const legacyBusinessEnums = this.domainCatalogProvider.buildLegacyBusinessEnums?.();

    return {
      agents: agents
        .filter((agent: any) => !agent.isHidden)
        .map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          description: agent.description || '',
          toolIds: agent.toolIds || [],
          skillIds: agent.skillIds || [],
          mcpServerIds: agent.mcpServerIds || [],
          category: agent.category,
          runtime: agent.runtime,
          contract: getContract(agent)
        })),
      tools: tools.map((tool: any) => ({
        id: tool.id,
        name: tool.name,
        displayName: tool.displayName,
        description: tool.description || '',
        parameters: tool.parameters || {},
        scope: tool.scope
      })),
      mcpServers,
      skills: skills.map((skill: any) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description || '',
        files: skill.files || [],
        instructionsSummary: truncateText(skill.instructions || '', 1200),
        isBuiltin: skill.isBuiltin === true
      })),
      workflows: workflows.map((workflow: any) => ({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description || '',
        inputSpec: workflow.inputSpec,
        outputSpec: workflow.outputSpec,
        contract: getContract(workflow),
        stepCount: Array.isArray(workflow.steps) ? workflow.steps.length : 0,
        steps: Array.isArray(workflow.steps)
          ? workflow.steps.map((step: any) => {
              const type = inferStepType(step);
              const summary: Record<string, unknown> | undefined = CLASSIC_TYPES.has(type)
                ? undefined
                : summarizeStepConfig(step.config);
              return {
                id: step.id,
                type,
                resourceRef: getStepResourceRef(step),
                produces: step.metadata?.aiBuilder?.produces,
                configSummary: summary
              };
            })
          : []
      })),
      stepTypes: this.buildStepTypeCatalog(),
      domainCatalog,
      businessEnums: legacyBusinessEnums,
      defaults: {
        providerId,
        model: String(provider?.models?.[0] || '')
      }
    };
  }

  private async listMcpServerSummaries() {
    try {
      const listMCPConfigs = (this.store as any).listMCPConfigs;
      if (typeof listMCPConfigs !== 'function') return [];
      const configs = await listMCPConfigs.call(this.store);
      return Array.isArray(configs)
        ? configs
            .filter(Boolean)
            .map(summarizeMcpServer)
            .filter((server) => server.id)
        : [];
    } catch {
      return [];
    }
  }

  private buildStepTypeCatalog(): AiBuildStepTypeDescriptor[] {
    const catalog = StepCatalog.getInstance();
    return catalog.list().map((def) => {
      const fields = def.configSchema?.fields?.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        description: field.description,
        options: field.options
      }));
      return {
        type: def.type,
        label: def.label,
        category: def.category,
        description: def.description,
        builderHints: builderHintsForStepType(def.type),
        configFields: fields,
        defaultConfig: def.defaultConfig,
        presets: def.presets
      };
    });
  }

  compactCatalog(catalog: AiBuildCatalog): AiBuildCatalog {
    return {
      agents: catalog.agents.slice(0, 80).map((agent) => ({
        ...agent,
        description: truncateText(agent.description || '', 260)
      })),
      tools: catalog.tools.slice(0, 120).map((tool) => ({
        ...tool,
        description: truncateText(tool.description || '', 240),
        parameters: this.compactSchema(tool.parameters)
      })),
      mcpServers: (catalog.mcpServers || []).slice(0, 80).map((server) => ({
        ...server,
        description: truncateText(server.description || '', 220)
      })),
      skills: catalog.skills.slice(0, 80).map((skill) => ({
        ...skill,
        description: truncateText(skill.description || '', 220),
        instructionsSummary: truncateText(skill.instructionsSummary || '', 360),
        files: (skill.files || []).slice(0, 12)
      })),
      workflows: catalog.workflows.slice(0, 80).map((workflow) => ({
        ...workflow,
        description: truncateText(workflow.description || '', 240),
        inputSpec: this.compactSchema(workflow.inputSpec) as any,
        outputSpec: this.compactSchema(workflow.outputSpec),
        steps: (workflow.steps || []).slice(0, 12)
      })),
      stepTypes: catalog.stepTypes,
      domainCatalog: catalog.domainCatalog,
      businessEnums: catalog.businessEnums,
      defaults: catalog.defaults
    };
  }

  private compactSchema(schema: unknown): unknown {
    if (!schema || typeof schema !== 'object') return schema;
    const text = JSON.stringify(schema);
    if (text.length <= 1800) return schema;
    return { summary: truncateText(text, 1800) };
  }
}
