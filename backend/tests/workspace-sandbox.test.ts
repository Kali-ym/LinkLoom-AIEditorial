import { mkdtemp } from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ExecuteCommandTool } from '../src/plugins/builtin/tools/ExecuteCommandTool.js';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import { ReActRuntime } from '../src/services/agents/runtime/ReActRuntime.js';
import type { AgentDefinition, ToolDefinition } from '../src/types/agent.js';
import type { AIMessage } from '../src/types/index.js';

function createAgent(): AgentDefinition {
  return {
    id: `workspace_sandbox_agent_${Math.random().toString(36).slice(2)}`,
    name: 'Workspace Sandbox Agent',
    description: 'test agent',
    systemPrompt: 'You are a test agent.',
    providerId: 'test',
    model: 'test-model',
    temperature: 0,
    toolIds: [],
    skillIds: [],
    mcpServerIds: [],
    runtime: { mode: 'react', maxRounds: 2, returnTrace: true }
  };
}

function createProvider(toolName: string, args: Record<string, unknown>) {
  let calls = 0;
  return {
    name: 'test-provider',
    async generateContent() {
      calls += 1;
      if (calls === 1) {
        return {
          content: '',
          tool_calls: [{ id: `call-${toolName}`, name: toolName, arguments: args }]
        };
      }
      return { content: 'done' };
    }
  };
}

async function createWorkspaceRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'linkloom-workspace-sandbox-test-'));
}

describe('workspace sandbox', () => {
  it('denies execute_command when workspace mode is none', async () => {
    const registry = ToolRegistry.getInstance();
    registry.registerTool(new ExecuteCommandTool());

    const envelope = await registry.callToolEnvelope(
      'execute_command',
      { command: 'echo blocked' },
      { workspacePolicy: { mode: 'none' } }
    );

    expect(envelope.error).toMatchObject({ code: 'sandbox_denied', retryable: false });
    expect(envelope.sandbox).toMatchObject({ effect: 'deny', code: 'workspace_mode_none' });
    expect(envelope.attempts).toBe(0);
  });

  it('keeps execute_command cwd inside the active local workspace', async () => {
    const rootDir = await createWorkspaceRoot();
    const tool = new ExecuteCommandTool();

    await expect(
      tool.handler(
        { command: 'echo escaped', cwd: '..' },
        {
          workspace: {
            workspaceId: 'workspace_path_guard',
            mode: 'local',
            rootDir,
            createdAt: new Date().toISOString()
          },
          workspacePolicy: { mode: 'local' }
        } as any
      )
    ).rejects.toThrow('cwd must stay inside active workspace');
  });

  it('does not execute docker or remote workspace commands through the local backend', async () => {
    const registry = ToolRegistry.getInstance();
    registry.registerTool(new ExecuteCommandTool());

    for (const mode of ['docker', 'remote'] as const) {
      const envelope = await registry.callToolEnvelope(
        'execute_command',
        { command: 'echo blocked' },
        { workspacePolicy: { mode } }
      );

      expect(envelope.error).toMatchObject({ code: 'sandbox_denied' });
      expect(envelope.sandbox).toMatchObject({
        effect: 'deny',
        code: 'workspace_backend_unavailable'
      });
      expect(envelope.attempts).toBe(0);
    }
  });

  it('denies MCP network tools when run policy disables network and records the denial as observation', async () => {
    const mcpTool: ToolDefinition = {
      id: 'docs-server:search_docs',
      name: 'docs_server__search_docs',
      description: 'Search docs',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query']
      },
      execution: { capabilities: ['network'], readonly: true },
      uiHints: {
        mcp: {
          serverId: 'docs-server',
          originalName: 'search_docs'
        }
      }
    };
    const messages: AIMessage[] = [{ role: 'user', content: 'run mcp' }];
    const runtime = new ReActRuntime({
      agentDef: createAgent(),
      provider: createProvider('docs_server__search_docs', { query: 'agent' }) as any,
      tools: [mcpTool],
      mcpConfigs: [
        { id: 'docs-server', name: 'Docs Server', description: '', transportType: 'stdio', enabled: true }
      ],
      mcpService: {
        callToolWithTrace: async () => {
          throw new Error('MCP should not be called when sandbox denies network');
        }
      } as any,
      toolRegistry: ToolRegistry.getInstance(),
      messages,
      workspace: { policy: { mode: 'local', network: 'disabled' } },
      silent: true
    });

    const result = await runtime.run();
    const observation = result.trace?.rounds[0].observations[0];

    expect(result.stopReason).toBe('final');
    expect(observation).toMatchObject({ success: false, toolName: 'docs_server__search_docs' });
    expect(observation?.execution).toMatchObject({
      source: 'mcp',
      error: { code: 'sandbox_denied' },
      sandbox: { effect: 'deny', code: 'network_disabled' }
    });
  });
});