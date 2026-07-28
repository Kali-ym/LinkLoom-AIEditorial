import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { AgentBindingService } from '../../../../services/agents/AgentBindingService.js';
import { AgentRunService } from '../../../../services/api/AgentRunService.js';
import { McpRouteService } from '../../../../services/api/McpRouteService.js';
import { SkillCatalogService } from '../../../../services/api/SkillCatalogService.js';
import { ToolRouteService } from '../../../../services/api/ToolRouteService.js';
import { WorkflowRunService } from '../../../../services/api/WorkflowRunService.js';
import { WorkflowTemplateRouteService } from '../../../../services/api/WorkflowTemplateRouteService.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };
const HIGH: ToolExecutionPolicy = { readonly: false, riskLevel: 'high' };

class ListAgentsTool extends BaseTool {
  readonly id = 'list_agents';
  readonly name = 'list_agents';
  readonly displayName = '列智能体';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出所有可见智能体(id/name/description/category/toolCount)。用户要查看或选择智能体时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new AgentRunService(store, services);
      const agents = await service.listVisibleAgents();
      const items = agents.map((a: { id: string; name: string; description?: string; category?: string; toolIds?: string[] }) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        toolCount: Array.isArray(a.toolIds) ? a.toolIds.length : 0,
      }));
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_AGENTS_FAILED',
        message,
        hint: '可在 /agents 页面查看智能体列表',
      };
    }
  }
}

class GetAgentTool extends BaseTool {
  readonly id = 'get_agent';
  readonly name = 'get_agent';
  readonly displayName = '查智能体详情';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '查询单个智能体完整定义。必填 agentId。用户要查看某智能体配置时调用。';
  readonly parameters = {
    type: 'object',
    properties: { agentId: { type: 'string', description: '智能体 id' } },
    required: ['agentId'],
  };

  async handler(args: { agentId: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new AgentRunService(store, services);
      const agent = await service.getAgent(args.agentId);
      return { ok: true, agent };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const notFound = message.includes('not found');
      return {
        ok: false,
        errorCode: notFound ? 'NOT_FOUND' : 'GET_AGENT_FAILED',
        message,
        hint: '调 list_agents 查看可用智能体',
      };
    }
  }
}

class ListSkillsTool extends BaseTool {
  readonly id = 'list_skills';
  readonly name = 'list_skills';
  readonly displayName = '列技能';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出已注册技能目录。用户要查看可用技能或给智能体选技能时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new SkillCatalogService(store, services);
      const skills = await service.listSkills();
      return { ok: true, count: skills.length, skills };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_SKILLS_FAILED',
        message,
        hint: '可在 /agents 页面查看技能',
      };
    }
  }
}

class ScanSkillsTool extends BaseTool {
  readonly id = 'scan_skills';
  readonly name = 'scan_skills';
  readonly displayName = '扫描技能';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '从文件系统扫描并刷新技能目录(只读刷新,不触发 HITL)。用户要同步最新技能时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new SkillCatalogService(store, services);
      const result = await service.scanSkills();
      return { ok: true, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'SCAN_SKILLS_FAILED',
        message,
        hint: '可在 /agents 页面手动扫描技能',
      };
    }
  }
}

class ListToolsTool extends BaseTool {
  readonly id = 'list_tools';
  readonly name = 'list_tools';
  readonly displayName = '列工具';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出平台可用工具(id/name/description)。用户要查看工具目录或给智能体选工具时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new ToolRouteService(services);
      const tools = service.listAvailableTools();
      const items = tools.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
      }));
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_TOOLS_FAILED',
        message,
        hint: '可在 /agents 页面查看工具',
      };
    }
  }
}

class ListMcpConfigsTool extends BaseTool {
  readonly id = 'list_mcp_configs';
  readonly name = 'list_mcp_configs';
  readonly displayName = '列 MCP 配置';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出所有 MCP 服务器配置。用户要查看或选择 MCP 时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new McpRouteService(store, services);
      const configs = await service.listConfigs();
      return { ok: true, count: configs.length, configs };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_MCP_CONFIGS_FAILED',
        message,
        hint: '可在 /settings 页面查看 MCP 配置',
      };
    }
  }
}

class TestMcpTool extends BaseTool {
  readonly id = 'test_mcp';
  readonly name = 'test_mcp';
  readonly displayName = '测试 MCP 连接';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '测试指定 MCP 服务器连接。必填 mcpId。用户要检查 MCP 是否可用时调用。';
  readonly parameters = {
    type: 'object',
    properties: { mcpId: { type: 'string', description: 'MCP 配置 id' } },
    required: ['mcpId'],
  };

  async handler(args: { mcpId: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new McpRouteService(store, services);
      const result = await service.testConnection(args.mcpId);
      return { ok: true, mcpId: args.mcpId, result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const notFound = message.includes('not found');
      return {
        ok: false,
        errorCode: notFound ? 'NOT_FOUND' : 'TEST_MCP_FAILED',
        message,
        hint: '调 list_mcp_configs 查看可用 MCP',
      };
    }
  }
}

class ListWorkflowTemplatesTool extends BaseTool {
  readonly id = 'list_workflow_templates';
  readonly name = 'list_workflow_templates';
  readonly displayName = '列工作流模板';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出可用工作流模板(id/name/description/category/agentCount/workflowCount)。用户要查看或实例化模板时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, settings } = requireToolContext(toolCtx, this.id);
    try {
      const service = new WorkflowTemplateRouteService(store, settings);
      const templates = await service.listTemplates();
      return { ok: true, count: templates.length, templates };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_WORKFLOW_TEMPLATES_FAILED',
        message,
        hint: '可在 /agents 页面查看工作流模板',
      };
    }
  }
}

class ListAgentBindingsTool extends BaseTool {
  readonly id = 'list_agent_bindings';
  readonly name = 'list_agent_bindings';
  readonly displayName = '列智能体绑定';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出指定智能体的资源绑定(KB分类/记忆等)。必填 agentId。用户要查看智能体绑定的知识范围时调用。';
  readonly parameters = {
    type: 'object',
    properties: { agentId: { type: 'string', description: '智能体 id' } },
    required: ['agentId'],
  };

  async handler(args: { agentId: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new AgentBindingService(store, services);
      const result = await service.listBindings(args.agentId);
      return { ok: true, agentId: args.agentId, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const pgUnavailable = message.includes('PgConnection not available');
      return {
        ok: false,
        errorCode: pgUnavailable ? 'PG_UNAVAILABLE' : 'LIST_AGENT_BINDINGS_FAILED',
        message,
        hint: pgUnavailable
          ? '数据库连接不可用,智能体绑定功能需要 PostgreSQL'
          : '调 list_agents 确认 agentId 或去 /agents 页面查看',
      };
    }
  }
}

class SaveAgentTool extends BaseTool {
  readonly id = 'save_agent';
  readonly name = 'save_agent';
  readonly displayName = '保存智能体';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '创建或更新智能体定义。必填 agent 对象(id/name/description/toolIds 等)。' +
    '新建前先调 list_agents/list_tools/list_skills 确认 id 与依赖;更新前先调 get_agent 查看当前配置。';
  readonly parameters = {
    type: 'object',
    properties: {
      agent: {
        type: 'object',
        description: '智能体定义对象(id/name/description/systemPrompt/toolIds/skillIds 等)',
        additionalProperties: true,
      },
    },
    required: ['agent'],
  };

  async handler(args: { agent: Record<string, unknown> }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new AgentRunService(store, services);
      const result = await service.saveAgent(args.agent);
      return { ok: true, agentId: args.agent.id, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'SAVE_AGENT_FAILED',
        message,
        hint: '可在 /agents 页面编辑智能体',
      };
    }
  }
}

class DeleteAgentTool extends BaseTool {
  readonly id = 'delete_agent';
  readonly name = 'delete_agent';
  readonly displayName = '删除智能体';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description =
    '删除指定智能体。必填 agentId。删除前应先调 get_agent 确认目标,并检查是否被工作流引用。';
  readonly parameters = {
    type: 'object',
    properties: { agentId: { type: 'string', description: '要删除的智能体 id' } },
    required: ['agentId'],
  };

  async handler(args: { agentId: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new AgentRunService(store, services);
      const result = await service.deleteAgent(args.agentId);
      return { ok: true, agentId: args.agentId, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const conflict = message.includes('工作流引用');
      const notFound = message.includes('not found');
      return {
        ok: false,
        errorCode: conflict ? 'CONFLICT' : notFound ? 'NOT_FOUND' : 'DELETE_AGENT_FAILED',
        message,
        hint: conflict
          ? '先从引用该智能体的工作流中移除后再删除'
          : '调 list_agents 确认 agentId',
      };
    }
  }
}

class SaveWorkflowTool extends BaseTool {
  readonly id = 'save_workflow';
  readonly name = 'save_workflow';
  readonly displayName = '保存工作流';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '创建或更新工作流定义。必填 workflow 对象(id/name/steps 等)。' +
    '新建或修改前先调 list_workflows 确认 id 与步骤引用。';
  readonly parameters = {
    type: 'object',
    properties: {
      workflow: {
        type: 'object',
        description: '工作流定义对象(id/name/description/steps 等)',
        additionalProperties: true,
      },
    },
    required: ['workflow'],
  };

  async handler(args: { workflow: Record<string, unknown> }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new WorkflowRunService(store, services);
      const result = await service.saveWorkflow(args.workflow);
      return { ok: true, workflowId: args.workflow.id, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'SAVE_WORKFLOW_FAILED',
        message,
        hint: '可在 /agents 页面编辑工作流',
      };
    }
  }
}

class InstantiateTemplateTool extends BaseTool {
  readonly id = 'instantiate_template';
  readonly name = 'instantiate_template';
  readonly displayName = '实例化工作流模板';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '从工作流模板实例化智能体与工作流。必填 templateId;可选 variables(模板变量对象)、conflictStrategy(copy|reuse,默认 copy)。' +
    '调用前应先调 list_workflow_templates 让用户确认 templateId。';
  readonly parameters = {
    type: 'object',
    properties: {
      templateId: { type: 'string', description: '工作流模板 id' },
      variables: {
        type: 'object',
        description: '模板变量键值(可选)',
        additionalProperties: true,
      },
      conflictStrategy: {
        type: 'string',
        enum: ['copy', 'reuse'],
        description: 'id 冲突策略: copy=复制新 id, reuse=复用已有(默认 copy)',
      },
    },
    required: ['templateId'],
  };

  async handler(
    args: {
      templateId: string;
      variables?: Record<string, unknown>;
      conflictStrategy?: 'copy' | 'reuse';
    },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store, settings } = requireToolContext(toolCtx, this.id);
    try {
      const service = new WorkflowTemplateRouteService(store, settings);
      const result = await service.instantiate(args.templateId, {
        variables: args.variables,
        conflictStrategy: args.conflictStrategy,
      });
      return { ok: true, ...result, templateId: args.templateId };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const notFound = message.includes('not found') || message.includes('ENOENT');
      return {
        ok: false,
        errorCode: notFound ? 'NOT_FOUND' : 'INSTANTIATE_TEMPLATE_FAILED',
        message,
        hint: '调 list_workflow_templates 查看可用模板',
      };
    }
  }
}

export const agentTools: BaseTool[] = [
  new ListAgentsTool(),
  new GetAgentTool(),
  new ListSkillsTool(),
  new ScanSkillsTool(),
  new ListToolsTool(),
  new ListMcpConfigsTool(),
  new TestMcpTool(),
  new ListWorkflowTemplatesTool(),
  new ListAgentBindingsTool(),
  new SaveAgentTool(),
  new DeleteAgentTool(),
  new SaveWorkflowTool(),
  new InstantiateTemplateTool(),
];
