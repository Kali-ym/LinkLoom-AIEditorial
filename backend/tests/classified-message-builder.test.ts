import { describe, expect, it } from 'vitest';
import { ClassifiedMessageBuilder } from '../src/services/agents/context/ClassifiedMessageBuilder.js';
import { ContextTokenCategory } from '../src/services/agents/context/ContextTokenTypes.js';
import type { AIMessage } from '../src/types/index.js';

describe('ClassifiedMessageBuilder', () => {
  it('classifies plain system message as SystemPrompt', () => {
    const builder = new ClassifiedMessageBuilder();
    const input = builder.build(
      [{ role: 'system', content: 'You are helpful.' } as AIMessage],
      [],
      new Set()
    );
    expect(input.systemMessages).toHaveLength(1);
    expect(input.systemMessages[0].category).toBe(ContextTokenCategory.SystemPrompt);
  });

  it('separates ## Available Skills section into Skills category', () => {
    const builder = new ClassifiedMessageBuilder();
    const content = 'You are helpful.\n\n## Available Skills\n\n### Skill: foo\nInstructions:\nDo foo.\n';
    const input = builder.build(
      [{ role: 'system', content } as AIMessage],
      [],
      new Set()
    );
    const categories = input.systemMessages.map((s) => s.category);
    expect(categories).toContain(ContextTokenCategory.SystemPrompt);
    expect(categories).toContain(ContextTokenCategory.Skills);
    const skills = input.systemMessages.find((s) => s.category === ContextTokenCategory.Skills);
    expect(skills?.message.content).toContain('## Available Skills');
    const main = input.systemMessages.find((s) => s.category === ContextTokenCategory.SystemPrompt);
    expect(main?.message.content).toContain('You are helpful.');
    expect(main?.message.content).not.toContain('## Available Skills');
  });

  it('classifies summary system message as SummarizedConversation', () => {
    const builder = new ClassifiedMessageBuilder();
    const input = builder.build(
      [{ role: 'system', content: '已压缩的较早上下文：\nuser: hi' } as AIMessage],
      [],
      new Set()
    );
    expect(input.systemMessages[0].category).toBe(ContextTokenCategory.SummarizedConversation);
    expect(input.metadata.summaryPresent).toBe(true);
    expect(input.metadata.compacted).toBe(true);
  });

  it('classifies user/assistant as Conversation', () => {
    const builder = new ClassifiedMessageBuilder();
    const input = builder.build(
      [
        { role: 'user', content: 'hi' } as AIMessage,
        { role: 'assistant', content: 'hello' } as AIMessage
      ],
      [],
      new Set()
    );
    expect(input.conversationMessages).toHaveLength(2);
    expect(input.conversationMessages.every((m) => m.category === ContextTokenCategory.Conversation)).toBe(true);
  });

  it('classifies tool role messages as Conversation with tool_result subCategory', () => {
    const builder = new ClassifiedMessageBuilder();
    const input = builder.build(
      [{ role: 'tool', content: 'result', tool_call_id: 'tc1' } as unknown as AIMessage],
      [],
      new Set()
    );
    expect(input.conversationMessages[0].subCategory).toBe('tool_result');
  });

  it('separates MCP tools from local tools by mcpToolIds set', () => {
    const builder = new ClassifiedMessageBuilder();
    const tools = [
      { id: 'local_foo', function: { name: 'local_foo' } },
      { id: 'mcp_bar', function: { name: 'mcp_bar' } }
    ];
    const input = builder.build([], tools, new Set(['mcp_bar']));
    const localTd = input.toolDefinitions.find((t) => t.category === ContextTokenCategory.ToolDefinitions);
    const mcpTd = input.toolDefinitions.find((t) => t.category === ContextTokenCategory.Mcp);
    expect(localTd?.tools).toHaveLength(1);
    expect(mcpTd?.tools).toHaveLength(1);
  });

  it('separates MCP tools by prefix when no mcpToolIds set', () => {
    const builder = new ClassifiedMessageBuilder({ mcpToolIdPrefix: 'mcp_' });
    const tools = [
      { id: 'local_foo' },
      { id: 'mcp_bar' }
    ];
    const input = builder.build([], tools, new Set());
    const mcpTd = input.toolDefinitions.find((t) => t.category === ContextTokenCategory.Mcp);
    expect(mcpTd?.tools).toHaveLength(1);
  });

  it('produces empty toolDefinitions when no tools', () => {
    const builder = new ClassifiedMessageBuilder();
    const input = builder.build([], [], new Set());
    expect(input.toolDefinitions).toHaveLength(0);
  });
});
