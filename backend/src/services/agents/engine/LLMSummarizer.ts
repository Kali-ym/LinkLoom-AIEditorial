import type { AIProvider } from '../../AIProvider.js';
import type { ContextSummarizer, ContextSummarizerInput } from './ContextManager.js';
import { LogService } from '../../LogService.js';

export interface LLMSummarizerOptions {
  provider: AIProvider;
  model?: string;
}

const DEFAULT_MAX_TOKENS = 400;
const DEFAULT_TEMPERATURE = 0.3;
const SYSTEM_INSTRUCTION = `你是一个上下文压缩助手。请用简洁的中文（100-200字）总结以下对话历史的核心要点，包括：用户的目标/问题、已尝试的方法、当前状态。不要使用列表格式，用连贯的段落。如果对话历史很短或没有实质内容，返回空字符串。`;

function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}...`;
}

function formatMessagesForSummarizer(messages: ContextSummarizerInput['messages']): string {
  return messages
    .filter((m) => m.content && String(m.content).trim())
    .map((m) => {
      const role = m.role === 'system' ? '系统' : m.role === 'assistant' ? '助手' : '用户';
      return `[${role}] ${truncateContent(String(m.content), 600)}`;
    })
    .join('\n\n');
}

export function createLLMSummarizer(options: LLMSummarizerOptions): ContextSummarizer {
  const { provider } = options;

  return async (input: ContextSummarizerInput): Promise<string> => {
    const { messages, previousSummary, signal } = input;

    const userContent = [
      previousSummary ? `【之前的摘要】\n${previousSummary}\n\n` : '',
      '【对话历史】\n',
      formatMessagesForSummarizer(messages)
    ].join('');

    try {
      const response = await provider.generateContent(
        userContent,
        [],
        SYSTEM_INSTRUCTION,
        { signal }
      );

      const summary = response.content.trim();

      if (!summary) {
        LogService.warn('[LLMSummarizer] Empty summary returned, falling back to heuristic');
        return '';
      }

      LogService.info(`[LLMSummarizer] Generated summary (${summary.length} chars)`);
      return summary;
    } catch (err) {
      if (signal?.aborted) {
        return '';
      }
      LogService.error(`[LLMSummarizer] LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
      return '';
    }
  };
}
