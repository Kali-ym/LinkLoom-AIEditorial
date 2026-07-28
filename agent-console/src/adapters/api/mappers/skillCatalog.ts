import type { Agent } from '../../../domain/types';
import type { CatalogTool, SkillCatalog, SkillCommand } from '../../../domain/types/skill';
import { toMcpPluginId } from './agentPluginBindings';

export interface BackendSkillDto {
  id: string;
  name: string;
  description?: string;
  files?: string[];
  isBuiltin?: boolean;
}

export interface BackendToolDto {
  id: string;
  name?: string;
  displayName?: string;
  description?: string;
  scope?: 'agent' | 'workflow' | 'system' | 'both';
}

export interface BackendMcpConfigDto {
  id: string;
  name?: string;
  description?: string;
}

/** Slash built-ins — client executes; labels overridden by `SLASH_COMMAND_LABELS` in UI. */
export const WORKSPACE_BUILTIN_COMMANDS: SkillCommand[] = [
  {
    category: 'command',
    label: '开启新话题',
    type: 'newTopic',
    desc: '清空当前对话并回到空态',
  },
  {
    category: 'command',
    label: '压缩上下文',
    type: 'compact',
    desc: '压缩历史消息以节省 token',
  },
];

export interface MapWorkspaceSkillCatalogInput {
  skills: BackendSkillDto[];
  tools: BackendToolDto[];
  mcpConfigs?: BackendMcpConfigDto[];
  agents: Agent[];
}

export function mapWorkspaceSkillCatalog(input: MapWorkspaceSkillCatalogInput): SkillCatalog {
  const { skills, tools, mcpConfigs = [], agents } = input;

  const agentSkills = skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description?.trim() || skill.name,
    fileCount: skill.files?.length,
    files: skill.files?.length ? [...skill.files] : undefined,
  }));

  const projectSkills = skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description?.trim() || skill.name,
  }));

  const toolById = new Map<string, { id: string; name: string; description: string; scope?: CatalogTool['scope'] }>();

  for (const tool of tools) {
    const toolId = tool.id?.trim();
    if (!toolId) continue;
    const name = tool.displayName?.trim() || tool.name?.trim() || toolId;
    toolById.set(toolId, {
      id: toolId,
      name,
      description: tool.description?.trim() || name,
      scope: tool.scope,
    });
  }

  for (const config of mcpConfigs) {
    if (!config.id) continue;
    const pluginId = toMcpPluginId(config.id);
    if (toolById.has(pluginId)) continue;
    const name = config.name?.trim() || config.id;
    toolById.set(pluginId, {
      id: pluginId,
      name,
      description: config.description?.trim() || `MCP: ${name}`,
    });
  }

  return {
    commands: WORKSPACE_BUILTIN_COMMANDS,
    agentSkills,
    projectSkills,
    userSkills: [],
    tools: [...toolById.values()],
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      gradient: agent.gradient,
    })),
  };
}
