import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import { QueryKnowledgeTool } from '../src/plugins/builtin/tools/QueryKnowledgeTool.js';
import { QueryMemoryTool } from '../src/plugins/builtin/tools/QueryMemoryTool.js';
import { ReActRuntime } from '../src/services/agents/runtime/ReActRuntime.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';
import type { AgentDefinition, ToolDefinition } from '../src/types/agent.js';
import type { AIMessage, AIResponse } from '../src/types/index.js';

function createToolContext() {
  const calls: Array<{ tool: string; query: string; options: Record<string, unknown> }> = [];
  const services = {
    knowledgeBaseService: {
      async queryKnowledgeDetailed(query: string, options: Record<string, unknown>) {
        calls.push({ tool: 'query_knowledge', query, options });
        return { answer: `knowledge:${query}` };
      }
    },
    memoryService: {
      async queryMemory(query: string, options: Record<string, unknown>) {
        calls.push({ tool: 'query_memory', query, options });
        return `memory:${query}`;
      }
    }
  };

  return {
    calls,
    ctx: { services } as unknown as ToolExecutionContext
  };
}

function createAgent(runtime?: AgentDefinition['runtime'], overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: `query_tool_agent_${Math.random().toString(36).slice(2)}`,
    name: 'Query Tool Agent',
    description: 'test agent',
    systemPrompt: 'You are a test agent.',
    providerId: 'test',
    model: 'test-model',
    temperature: 0,
    toolIds: [],
    skillIds: [],
    mcpServerIds: [],
    knowledgeCategoryIds: ['knowledge-category'],
    memoryCategoryIds: ['memory-category'],
    runtime,
    ...overrides
  };
}

function createProvider(responses: AIResponse[]) {
  let index = 0;
  return {
    name: 'test-provider',
    async generateContent(_prompt: string | AIMessage[], _tools: ToolDefinition[]) {
      const response = responses[index] || responses[responses.length - 1];
      index += 1;
      return response;
    }
  };
}

describe('query_knowledge and query_memory argument handling', () => {
  it('accepts query aliases for knowledge search', async () => {
    const { calls, ctx } = createToolContext();
    const result = await new QueryKnowledgeTool().handler(
      { question: 'ReAct 工具观察', limit: 2, categoryIds: ['custom-category'] },
      ctx
    );

    expect(result).toEqual({ answer: 'knowledge:ReAct 工具观察' });
    expect(calls[0]).toMatchObject({
      tool: 'query_knowledge',
      query: 'ReAct 工具观察',
      options: { limit: 2, categoryIds: ['custom-category'], fallbackFormat: 'context' }
    });
  });

  it('applies context knowledgeScope as a hard limit for explicit query categories', async () => {
    const { calls, ctx } = createToolContext();

    await new QueryKnowledgeTool().handler(
      { query: '权限范围', categoryIds: ['allowed-category'], limit: 3 },
      {
        ...ctx,
        knowledgeScope: {
          allowedCategoryIds: ['allowed-category', 'other-category'],
          allowedDocumentIds: ['doc-a'],
          scopeSource: 'agent'
        }
      } as ToolExecutionContext
    );

    expect(calls[0].options).toMatchObject({
      categoryIds: ['allowed-category'],
      limit: 3,
      fallbackFormat: 'context',
      sourceFilter: {
        sourceType: 'knowledge',
        sourceIds: ['knowledge'],
        parentIds: ['doc-a'],
        metadata: expect.objectContaining({
          categoryIds: ['allowed-category'],
          documentIds: ['doc-a'],
          mergedScope: true
        })
      }
    });
  });

  it('turns explicit categories outside context knowledgeScope into deny-all', async () => {
    const { calls, ctx } = createToolContext();

    await new QueryKnowledgeTool().handler(
      { query: '越权分类', categoryIds: ['blocked-category'] },
      {
        ...ctx,
        knowledgeScope: {
          allowedCategoryIds: ['allowed-category'],
          scopeSource: 'agent'
        }
      } as ToolExecutionContext
    );

    expect(calls[0].options).toMatchObject({
      categoryIds: ['blocked-category'],
      fallbackFormat: 'context',
      sourceFilter: {
        sourceType: 'knowledge',
        sourceIds: ['knowledge'],
        parentIds: ['__deny_all__'],
        metadata: expect.objectContaining({
          categoryIds: [],
          documentIds: [],
          emptyScopePolicy: 'deny_all'
        })
      }
    });
  });

  it('accepts keyword arrays for memory search', async () => {
    const { calls, ctx } = createToolContext();
    const result = await new QueryMemoryTool().handler(
      { keywords: ['用户偏好', '日报'], minImportance: 3, tags: ['agent'] },
      ctx
    );

    expect(result).toEqual({ summary: 'memory:用户偏好 日报' });
    expect(calls[0]).toMatchObject({
      tool: 'query_memory',
      query: '用户偏好 日报',
      options: { minImportance: 3, tags: ['agent'] }
    });
  });

  it('throws clear query errors before reaching repository search', async () => {
    const { calls, ctx } = createToolContext();

    await expect(new QueryKnowledgeTool().handler({}, ctx)).rejects.toThrow(
      'query_knowledge 缺少 query 参数'
    );
    await expect(new QueryMemoryTool().handler({}, ctx)).rejects.toThrow(
      'query_memory 缺少 query 参数'
    );
    expect(calls).toHaveLength(0);
  });

  it('normalizes string tool arguments in ReAct runtime and preserves bound categories', async () => {
    const toolRegistry = ToolRegistry.getInstance();
    toolRegistry.registerTool(new QueryKnowledgeTool());

    const { calls, ctx } = createToolContext();
    toolRegistry.setDefaultContextSupplier(async () => ctx);

    const runtime = new ReActRuntime({
      agentDef: createAgent({ mode: 'react', maxRounds: 1, returnTrace: true }),
      provider: createProvider([
        {
          content: '',
          tool_calls: [
            {
              id: 'call-1',
              name: 'query_knowledge',
              arguments: 'Agent ReAct 配置'
            }
          ]
        }
      ]),
      tools: [new QueryKnowledgeTool()],
      mcpConfigs: [],
      mcpService: { callTool: async () => ({}) } as any,
      toolRegistry,
      messages: [{ role: 'user', content: 'run test' }],
      silent: true
    });

    const result = await runtime.run();

    expect(result.stopReason).toBe('max_rounds');
    expect(result.trace?.rounds[0].observations[0]).toMatchObject({
      toolName: 'query_knowledge',
      success: true
    });
    expect(calls[0]).toMatchObject({
      tool: 'query_knowledge',
      query: 'Agent ReAct 配置',
      options: { categoryIds: ['knowledge-category'], fallbackFormat: 'context' }
    });
  });

  it('passes agent knowledgeScope into ReAct query_knowledge tool calls', async () => {
    const toolRegistry = ToolRegistry.getInstance();
    toolRegistry.registerTool(new QueryKnowledgeTool());

    const { calls, ctx } = createToolContext();
    toolRegistry.setDefaultContextSupplier(async () => ctx);

    const runtime = new ReActRuntime({
      agentDef: createAgent(
        { mode: 'react', maxRounds: 1, returnTrace: true },
        {
          knowledgeCategoryIds: [],
          knowledgeScope: {
            allowedCategoryIds: ['agent-scope-category'],
            allowedDocumentIds: ['agent-doc'],
            scopeSource: 'agent'
          }
        }
      ),
      provider: createProvider([
        {
          content: '',
          tool_calls: [
            {
              id: 'call-scope',
              name: 'query_knowledge',
              arguments: { query: 'Agent scope', categoryIds: ['agent-scope-category'] }
            }
          ]
        }
      ]),
      tools: [new QueryKnowledgeTool()],
      mcpConfigs: [],
      mcpService: { callTool: async () => ({}) } as any,
      toolRegistry,
      messages: [{ role: 'user', content: 'run scoped test' }],
      silent: true
    });

    const result = await runtime.run();

    expect(result.stopReason).toBe('max_rounds');
    expect(calls[0].options).toMatchObject({
      categoryIds: ['agent-scope-category'],
      fallbackFormat: 'context',
      sourceFilter: {
        parentIds: ['agent-doc'],
        metadata: expect.objectContaining({
          categoryIds: ['agent-scope-category'],
          documentIds: ['agent-doc'],
          mergedScope: true
        })
      }
    });
  });
});
