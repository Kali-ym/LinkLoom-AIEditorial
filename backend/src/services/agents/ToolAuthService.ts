import { AppError } from '../../domain/errors.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import {
  defaultAvatarForAuthType,
  isComposioOAuthToolId,
  isMcpToolKey,
  mcpIdFromToolKey,
  toMcpToolKey,
  type PendingAuthToolDto,
} from './toolAuthCatalog.js';
import { ToolAuthGrantStore } from './ToolAuthGrantStore.js';

interface PendingAuthState {
  agentId: string;
  toolKey: string;
  expiresAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

function generateStateId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 12);
  return `tas_${t}${r}`;
}

export class ToolAuthService {
  private readonly grantStore: ToolAuthGrantStore;

  constructor(
    private readonly localStore: LocalStore,
    private readonly context: ServiceContext,
  ) {
    const conn = localStore.getConnection();
    if (!conn) {
      throw new Error('PgConnection not available for ToolAuthService');
    }
    this.grantStore = new ToolAuthGrantStore(conn);
  }

  async listPendingAuthTools(agentId: string): Promise<{ tools: PendingAuthToolDto[] }> {
    const agent = await this.localStore.getAgent(agentId);
    if (!agent) {
      throw new AppError(404, `agent ${agentId} not found`);
    }

    const grants = await this.grantStore.list(agentId);
    const tools: PendingAuthToolDto[] = [];

    for (const mcpId of agent.mcpServerIds ?? []) {
      const toolKey = toMcpToolKey(mcpId);
      if (grants.has(toolKey)) continue;
      const config = await this.localStore.getMCPConfig(mcpId);
      if (!config || config.enabled === false) continue;
      tools.push({
        id: toolKey,
        label: config.name || mcpId,
        avatar: defaultAvatarForAuthType('market'),
        authType: 'market',
      });
    }

    for (const toolId of agent.toolIds ?? []) {
      if (!isComposioOAuthToolId(toolId) || grants.has(toolId)) continue;
      const catalogTool = this.context.executionService
        .listAvailableTools()
        .find((tool) => tool.id === toolId);
      tools.push({
        id: toolId,
        label: catalogTool?.displayName || catalogTool?.name || toolId,
        avatar: defaultAvatarForAuthType('composio'),
        authType: 'composio',
      });
    }

    return { tools };
  }

  async createAuthorizeUrl(agentId: string, toolId: string): Promise<{ authUrl: string; state: string }> {
    const pending = await this.listPendingAuthTools(agentId);
    if (!pending.tools.some((tool) => tool.id === toolId)) {
      throw new AppError(404, `tool ${toolId} is not pending authorization for agent ${agentId}`);
    }

    await this.assertToolBelongsToAgent(agentId, toolId);

    const state = generateStateId();
    const payload: PendingAuthState = {
      agentId,
      toolKey: toolId,
      expiresAt: Date.now() + STATE_TTL_MS,
    };
    await this.saveState(state, payload);

    const authUrl = `/api/tool-auth/consent?state=${encodeURIComponent(state)}`;
    return { authUrl, state };
  }

  async completeAuthorization(state: string): Promise<{ agentId: string; toolKey: string }> {
    const record = await this.readState(state);
    if (!record) {
      throw new AppError(400, 'authorization state is invalid or expired');
    }
    if (record.expiresAt < Date.now()) {
      await this.deleteState(state);
      throw new AppError(400, 'authorization state expired');
    }

    await this.assertToolBelongsToAgent(record.agentId, record.toolKey);
    await this.grantStore.grant(record.agentId, record.toolKey, {
      source: 'tool-auth-consent',
      completedAt: new Date().toISOString(),
    });
    await this.deleteState(state);

    return { agentId: record.agentId, toolKey: record.toolKey };
  }

  async getConsentPage(state: string): Promise<{ html: string }> {
    const record = await this.readState(state);
    if (!record) {
      throw new AppError(400, 'authorization state is invalid or expired');
    }
    const pending = await this.listPendingAuthTools(record.agentId);
    const label =
      pending.tools.find((tool) => tool.id === record.toolKey)?.label ?? record.toolKey;
    return { html: this.renderConsentHtml(state, label) };
  }

  renderConsentHtml(state: string, label: string): string {
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>工具授权</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; max-width: 420px; margin: 0 auto; }
    button { padding: 10px 16px; border-radius: 8px; border: none; background: #6366f1; color: #fff; cursor: pointer; }
    p { color: #475569; line-height: 1.5; }
  </style>
</head>
<body>
  <h2>授权 ${escapeHtml(label)}</h2>
  <p>内网 V1：点击下方按钮完成授权。生产环境可替换为 Composio / Market OAuth 跳转。</p>
  <button id="grant">授权并关闭</button>
  <p id="status"></p>
  <script>
    document.getElementById('grant').addEventListener('click', async () => {
      const status = document.getElementById('status');
      status.textContent = '处理中…';
      try {
        const res = await fetch('/api/tool-auth/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: ${JSON.stringify(state)} }),
        });
        if (!res.ok) throw new Error(await res.text());
        status.textContent = '授权成功，正在关闭窗口…';
        window.setTimeout(() => window.close(), 600);
      } catch (error) {
        status.textContent = '授权失败：' + (error && error.message ? error.message : String(error));
      }
    });
  </script>
</body>
</html>`;
  }

  private async assertToolBelongsToAgent(agentId: string, toolKey: string): Promise<void> {
    const agent = await this.localStore.getAgent(agentId);
    if (!agent) {
      throw new AppError(404, `agent ${agentId} not found`);
    }

    if (isMcpToolKey(toolKey)) {
      const mcpId = mcpIdFromToolKey(toolKey);
      if (!mcpId || !(agent.mcpServerIds ?? []).includes(mcpId)) {
        throw new AppError(404, `mcp ${toolKey} is not attached to agent ${agentId}`);
      }
      return;
    }

    if (!(agent.toolIds ?? []).includes(toolKey)) {
      throw new AppError(404, `tool ${toolKey} is not attached to agent ${agentId}`);
    }
  }

  private async saveState(state: string, payload: PendingAuthState): Promise<void> {
    const conn = this.localStore.getConnection();
    if (!conn) throw new Error('PgConnection not available');
    await conn.run(
      `INSERT INTO kv(key, value, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
      `tool_auth_state:${state}`,
      JSON.stringify(payload),
      payload.expiresAt,
    );
  }

  private async readState(state: string): Promise<PendingAuthState | null> {
    const conn = this.localStore.getConnection();
    if (!conn) return null;
    const row = await conn.get<{ value: string; expires_at: number | null }>(
      `SELECT value, expires_at FROM kv WHERE key = $1`,
      `tool_auth_state:${state}`,
    );
    if (!row?.value) return null;
    if (row.expires_at != null && row.expires_at < Date.now()) return null;
    try {
      return JSON.parse(row.value) as PendingAuthState;
    } catch {
      return null;
    }
  }

  private async deleteState(state: string): Promise<void> {
    const conn = this.localStore.getConnection();
    if (!conn) return;
    await conn.run(`DELETE FROM kv WHERE key = $1`, `tool_auth_state:${state}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
