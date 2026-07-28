import { AppError } from '../../domain/errors.js';
import type { MCPServerConfig } from '../../types/agent.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';

export class McpRouteService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  listConfigs() {
    return this.store.listMCPConfigs();
  }

  async saveConfig(config: any) {
    await this.store.saveMCPConfig(config);
    await this.context.reload();
    return { status: 'success' };
  }

  async deleteConfig(id: string) {
    await this.store.deleteMCPConfig(id);

    const agents = await this.store.listAgents();
    for (const agent of agents) {
      if (agent.mcpServerIds?.includes(id)) {
        agent.mcpServerIds = agent.mcpServerIds.filter((mid: string) => mid !== id);
        await this.store.saveAgent(agent);
      }
    }

    await this.context.reload();
    return { status: 'success' };
  }

  async getHealth(id?: string) {
    if (!id) {
      const configs = (await this.store.listMCPConfigs()) as MCPServerConfig[];
      return this.context.mcpService.getHealthSnapshot(configs);
    }
    const config = await this.getConfigOrThrow(id);
    return this.context.mcpService.getHealth(config);
  }

  async testConnection(id: string) {
    const config = await this.getConfigOrThrow(id);
    return this.context.mcpService.testConnection(config);
  }

  async reconnect(id: string) {
    const config = await this.getConfigOrThrow(id);
    return this.context.mcpService.reconnect(config);
  }

  private async getConfigOrThrow(id: string): Promise<MCPServerConfig> {
    const config = (await this.store.getMCPConfig(id)) as MCPServerConfig | null;
    if (!config) throw new AppError(404, `MCP config not found: ${id}`, 'mcp_config_not_found');
    return config;
  }
}
