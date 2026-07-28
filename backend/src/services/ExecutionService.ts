import { ToolRegistry } from '../registries/ToolRegistry.js';
import type { SystemSettings } from '../types/config.js';
import type { AgentService } from './agents/AgentService.js';
import type { WorkflowEngine } from './agents/WorkflowEngine.js';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function pickExecutionContent(result: unknown): string | undefined {
  if (typeof result === 'string') return result;
  const record = asRecord(result);
  if (!record) return undefined;
  for (const key of ['content', 'html', 'summary']) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

export interface ExecutionServiceDeps {
  settings: SystemSettings;
  agentService: AgentService | null;
  workflowEngine: WorkflowEngine | null;
}

export class ExecutionService {
  constructor(private readonly deps: ExecutionServiceDeps) {}

  async executeAI(agentId: string, input: string, date?: string) {
    if (agentId.startsWith('workflow:')) {
      if (!this.deps.workflowEngine) throw new Error('工作流引擎未初始化');
      const workflowId = agentId.replace('workflow:', '');
      const result = await this.deps.workflowEngine.runWorkflow(workflowId, input, date);
      return {
        content: typeof result === 'string' ? result : JSON.stringify(result),
        data: typeof result === 'object' ? result : { result }
      };
    }

    if (agentId.startsWith('tool:')) {
      const toolId = agentId.replace('tool:', '');
      const result = await ToolRegistry.getInstance().callTool(toolId, {
        prompt: input,
        input,
        markdown: input
      });
      return {
        content: pickExecutionContent(result) ?? JSON.stringify(result),
        data: result
      };
    }

    if (!this.deps.agentService) throw new Error('智能体服务未初始化');
    const actualAgentId = agentId.startsWith('agent:') ? agentId.replace('agent:', '') : agentId;
    return await this.deps.agentService.runAgent(actualAgentId, input, date);
  }

  listAvailableTools() {
    const closedPlugins = this.deps.settings.CLOSED_PLUGINS || [];
    return ToolRegistry.getInstance()
      .getAllTools()
      .filter((tool) => !closedPlugins.includes(tool.id));
  }

  async runTool(id: string, args: any) {
    const closedPlugins = this.deps.settings.CLOSED_PLUGINS || [];
    if (closedPlugins.includes(id)) {
      return { success: false, error: `Tool ${id} is disabled`, statusCode: 403 };
    }

    const result = await ToolRegistry.getInstance().callTool(id, args);

    if (result && typeof result === 'object') {
      if ('success' in result) return result;
      if ('error' in result) return { success: false, error: result.error };

      return {
        success: true,
        content: pickExecutionContent(result),
        data: result
      };
    }

    return {
      success: true,
      content: typeof result === 'string' ? result : JSON.stringify(result),
      data: result
    };
  }
}
