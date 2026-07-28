import {
  ContextTokenCategory,
  type ClassifiedMessage,
  type ClassifiedModelInput,
  type ClassifiedToolDefinitions
} from './ContextTokenTypes.js';
import type { AIMessage } from '../../../types/index.js';

const SKILLS_SECTION_PATTERN = /## Available Skills\s*\n[\s\S]*?(?=\n## |\n# |$)/;
const SUMMARY_PREFIX_PATTERN = /^已压缩的较早上下文：/;

export interface ClassifiedMessageBuilderOptions {
  /** MCP 工具的 id 前缀，用于区分 MCP 工具与本地工具 */
  mcpToolIdPrefix?: string;
}

export class ClassifiedMessageBuilder {
  constructor(private readonly options: ClassifiedMessageBuilderOptions = {}) {}

  build(
    messages: AIMessage[],
    tools: unknown[],
    mcpToolIds: Set<string> = new Set()
  ): ClassifiedModelInput {
    const systemMessages: ClassifiedMessage[] = [];
    const conversationMessages: ClassifiedMessage[] = [];
    const toolDefinitions: ClassifiedToolDefinitions[] = [];
    let summaryPresent = false;

    for (const message of messages) {
      if (message.role === 'system') {
        const content = typeof message.content === 'string' ? message.content : '';
        if (SUMMARY_PREFIX_PATTERN.test(content)) {
          summaryPresent = true;
          systemMessages.push({
            message,
            category: ContextTokenCategory.SummarizedConversation,
            subCategory: 'heuristic_summary'
          });
        } else {
          const split = this.splitSystemContent(content);
          if (split.skills) {
            systemMessages.push({
              message: { role: 'system', content: split.skills },
              category: ContextTokenCategory.Skills
            });
          }
          if (split.main) {
            systemMessages.push({
              message: { role: 'system', content: split.main },
              category: ContextTokenCategory.SystemPrompt
            });
          }
        }
      } else if (message.role === 'tool') {
        conversationMessages.push({
          message,
          category: ContextTokenCategory.Conversation,
          subCategory: 'tool_result'
        });
      } else {
        conversationMessages.push({
          message,
          category: ContextTokenCategory.Conversation,
          subCategory: message.role
        });
      }
    }

    if (tools.length > 0) {
      const localTools: unknown[] = [];
      const mcpTools: unknown[] = [];
      for (const tool of tools) {
        const toolId = (tool as { id?: string; function?: { name?: string } }).id
          ?? (tool as { function?: { name?: string } }).function?.name
          ?? '';
        if (mcpToolIds.has(toolId) || (this.options.mcpToolIdPrefix && toolId.startsWith(this.options.mcpToolIdPrefix))) {
          mcpTools.push(tool);
        } else {
          localTools.push(tool);
        }
      }
      if (localTools.length > 0) {
        toolDefinitions.push({ tools: localTools, category: ContextTokenCategory.ToolDefinitions });
      }
      if (mcpTools.length > 0) {
        toolDefinitions.push({ tools: mcpTools, category: ContextTokenCategory.Mcp });
      }
    }

    return {
      systemMessages,
      conversationMessages,
      toolDefinitions,
      metadata: {
        compacted: summaryPresent,
        summaryPresent,
        assembledAt: new Date().toISOString()
      }
    };
  }

  private splitSystemContent(content: string): { main: string; skills?: string } {
    if (!content) return { main: '' };
    const match = content.match(SKILLS_SECTION_PATTERN);
    if (!match) return { main: content };
    const skills = match[0];
    const main = (content.slice(0, match.index) + content.slice((match.index ?? 0) + match[0].length)).trim();
    return { main, skills };
  }
}
