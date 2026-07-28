import fs from 'fs';
import path from 'path';
import { BaseRepository } from './BaseRepository.js';
import type { PgConnection } from './DatabaseConnection.js';
import {
  AgentMapper,
  McpConfigMapper,
  SkillMapper,
  WorkflowMapper
} from './mappers/AgentMapper.js';

export class AgentRepository extends BaseRepository {
  constructor(
    conn: PgConnection,
    private readonly dataDir: string
  ) {
    super(conn);
  }

  getSkillsDir(): string {
    const skillsDir = path.join(this.dataDir, 'skills');
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
    }
    return skillsDir;
  }

  async saveAgent(agent: any): Promise<void> {
    await this.db.run(
      `INSERT INTO agents (id, data) VALUES (?, ?)
       ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
      agent.id,
      AgentMapper.toRow(agent)
    );
  }

  async getAgent(id: string): Promise<any> {
    const row = await this.db.get('SELECT data FROM agents WHERE id = ?', id);
    return AgentMapper.toEntity(row);
  }

  async listAgents(): Promise<any[]> {
    const rows = await this.db.all('SELECT data FROM agents ORDER BY id DESC');
    return AgentMapper.toEntityList(rows);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.db.run('DELETE FROM agents WHERE id = ?', id);
  }

  async saveSkill(skill: any): Promise<void> {
    await this.db.run(
      `INSERT INTO skills (id, data) VALUES (?, ?)
       ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
      skill.id,
      SkillMapper.toRow(skill)
    );
  }

  async getSkill(id: string): Promise<any> {
    const row = await this.db.get('SELECT data FROM skills WHERE id = ?', id);
    return SkillMapper.toEntity(row);
  }

  async listSkills(): Promise<any[]> {
    const rows = await this.db.all('SELECT data FROM skills ORDER BY id DESC');
    return SkillMapper.toEntityList(rows);
  }

  async deleteSkill(id: string): Promise<void> {
    await this.db.run('DELETE FROM skills WHERE id = ?', id);
  }

  async saveWorkflow(workflow: any): Promise<void> {
    await this.db.run(
      `INSERT INTO workflows (id, data) VALUES (?, ?)
       ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
      workflow.id,
      WorkflowMapper.toRow(workflow)
    );
  }

  async getWorkflow(id: string): Promise<any> {
    const row = await this.db.get('SELECT data FROM workflows WHERE id = ?', id);
    return WorkflowMapper.toEntity(row);
  }

  async listWorkflows(): Promise<any[]> {
    const rows = await this.db.all('SELECT data FROM workflows ORDER BY id DESC');
    return WorkflowMapper.toEntityList(rows);
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.db.run('DELETE FROM workflows WHERE id = ?', id);
  }

  async saveMCPConfig(config: any): Promise<void> {
    await this.db.run(
      `INSERT INTO mcp_configs (id, data) VALUES (?, ?)
       ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
      config.id,
      McpConfigMapper.toRow(config)
    );
  }

  async getMCPConfig(id: string): Promise<any> {
    const row = await this.db.get('SELECT data FROM mcp_configs WHERE id = ?', id);
    return McpConfigMapper.toEntity(row);
  }

  async listMCPConfigs(): Promise<any[]> {
    const rows = await this.db.all('SELECT data FROM mcp_configs ORDER BY id DESC');
    return McpConfigMapper.toEntityList(rows);
  }

  async deleteMCPConfig(id: string): Promise<void> {
    await this.db.run('DELETE FROM mcp_configs WHERE id = ?', id);
  }
}
