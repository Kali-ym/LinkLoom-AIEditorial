import {
  HumanMessage,
  AIMessage as LangChainAIMessage,
  SystemMessage,
  ToolMessage,
  BaseMessage
} from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import type { OpenAIApiEndpointMode, ReasoningEffort } from '../types/config.js';
import type { AIResponse, AIMessage } from '../types/index.js';
import type { ResponseCacheRequest } from './agents/engine/responseContextCache.js';
import {
  resolvePromptCacheCapability,
  type PromptCacheCapability
} from './agents/engine/promptCacheCapabilities.js';
import {
  sortToolDefinitions,
  stableStringify
} from './agents/engine/canonicalMessageSerializer.js';
import {
  extractProviderContextIds,
  extractProviderResponseId,
  normalizeRuntimeMessageContent,
} from './agents/engine/responseContextCache.js';
import { LogService } from './LogService.js';
import type { GeminiBuiltinSearchMode } from './agents/search/types.js';

export type AIProviderCallOptions = {
  signal?: AbortSignal;
  responseCache?: ResponseCacheRequest;
};

export interface AIProvider {
  name: string;
  dispatcher?: any;
  promptCacheCapability?: PromptCacheCapability;
  generateContent(
    prompt: string | AIMessage[],
    tools: any[],
    systemInstruction?: string,
    options?: AIProviderCallOptions
  ): Promise<AIResponse>;
  streamContent?(
    prompt: string | AIMessage[],
    tools?: any[],
    systemInstruction?: string,
    options?: AIProviderCallOptions
  ): AsyncIterable<AIResponse>;
  listModels?(): Promise<string[]>;
}

function toLangChainUserContent(content: AIMessage['content']): string | Array<Record<string, unknown>> {
  if (typeof content === 'string' || content == null) return content || '';
  return content as unknown as Array<Record<string, unknown>>;
}

function toLangChainMessageContent(content: AIMessage['content']): string | Array<Record<string, unknown>> {
  if (typeof content === 'string' || content == null) return content || '';
  if (!Array.isArray(content)) return String(content);
  return content as unknown as Array<Record<string, unknown>>;
}

/**
 * Maps our internal AIMessage to LangChain BaseMessage
 */
function toLangChainMessages(
  prompt: string | AIMessage[],
  systemInstruction?: string
): BaseMessage[] {
  const messages: BaseMessage[] = [];
  if (systemInstruction) {
    messages.push(new SystemMessage(systemInstruction));
  }
  if (typeof prompt === 'string') {
    messages.push(new HumanMessage(prompt));
  } else {
    for (const m of prompt) {
      switch (m.role) {
        case 'system':
          messages.push(new SystemMessage(toLangChainMessageContent(m.content) as string));
          break;
        case 'user':
          messages.push(new HumanMessage(toLangChainUserContent(m.content) as any));
          break;
        case 'assistant':
          messages.push(
            new LangChainAIMessage({
              content: toLangChainMessageContent(m.content) as any,
              tool_calls: m.tool_calls?.map((tc) => ({
                id: tc.id,
                name: tc.name,
                args: tc.arguments
              }))
            })
          );
          break;
        case 'tool':
          messages.push(
            new ToolMessage({
              content: toLangChainMessageContent(m.content) as string,
              tool_call_id: m.tool_call_id || '',
              name: m.name
            })
          );
          break;
      }
    }
  }
  return messages;
}

/**
 * Maps LangChain BaseMessage to our internal AIResponse
 */
export function fromLangChainMessage(message: BaseMessage | any): AIResponse {
  let content = '';
  let reasoning = '';
  if (typeof message.content === 'string') {
    content = message.content;
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (!part || typeof part !== 'object') continue;
      const text = typeof part.text === 'string' ? part.text : '';
      const isThought =
        part.thought === true ||
        part.type === 'thinking' ||
        part.type === 'reasoning' ||
        part.type === 'reasoning_content';
      if (isThought) {
        reasoning += text;
        continue;
      }
      if (part.type === 'text') {
        content += text;
        continue;
      }
      if (part.type === 'image_url') {
        const url = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
        content += `\n\n![image](${url})\n\n`;
        continue;
      }
      if (part.type === 'inlineData' && part.inlineData?.mimeType && part.inlineData?.data) {
        const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        content += `\n\n![image](${dataUrl})\n\n`;
      }
    }
  }

  const additionalReasoning = message.additional_kwargs?.reasoning_content;
  if (typeof additionalReasoning === 'string' && additionalReasoning) {
    reasoning += additionalReasoning;
  }

  const tool_calls = (message as LangChainAIMessage).tool_calls?.map((tc) => ({
    id: tc.id || '',
    name: tc.name,
    arguments: tc.args
  }));

  const result: AIResponse = { content };
  if (reasoning) {
    result.reasoning = reasoning;
  }
  if (tool_calls && tool_calls.length > 0) {
    result.tool_calls = tool_calls;
  }

  // Usage tracking
  if (message.usage_metadata) {
    result.usage = {
      prompt_tokens: message.usage_metadata.input_tokens || 0,
      completion_tokens: message.usage_metadata.output_tokens || 0,
      total_tokens: message.usage_metadata.total_tokens || 0
    };
  } else {
    const metadata = message.response_metadata;
    if (metadata && (metadata.tokenUsage || metadata.usage)) {
      const usage = metadata.tokenUsage || metadata.usage;
      result.usage = {
        prompt_tokens: usage.promptTokens || usage.prompt_tokens || usage.input_tokens || 0,
        completion_tokens:
          usage.completionTokens || usage.completion_tokens || usage.output_tokens || 0,
        total_tokens: usage.totalTokens || usage.total_tokens || 0
      };
    }
  }

  // Preserve raw parts if available (common in Google GenAI)
  const rawParts = message.response_metadata?.rawResponse?.candidates?.[0]?.content?.parts;
  if (Array.isArray(rawParts)) {
    result.raw_parts = rawParts;
    for (const part of rawParts) {
      if (!part || typeof part !== 'object') continue;
      const text = typeof part.text === 'string' ? part.text : '';
      if (text && part.thought === true) {
        reasoning += text;
      }
    }
  }

  if (reasoning) {
    result.reasoning = reasoning;
  }

  return result;
}

const getCustomFetch = (name: string, dispatcher?: any) => {
  return async (input: any, init?: any): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.url || input.toString();
    LogService.info(`[${name}] API Request: ${url}, Using Proxy: ${!!dispatcher}`);
    try {
      const res = await fetch(input, { ...init, dispatcher });
      const text = await res.text();
      if (!res.ok) {
        LogService.error(`[${name}] API Error: ${res.status} ${text}`);
      }
      // Response bodies are single-use; always return a fresh Response.
      return new Response(text, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers
      });
    } catch (err: any) {
      LogService.error(`[${name}] Fetch Failed: ${err.message}`);
      throw err;
    }
  };
};

function extractResponsesApiContent(data: Record<string, unknown>): string {
  const fromOutput = extractFromResponsesOutput(data.output);
  if (fromOutput) return fromOutput;

  if (typeof data.output_text === 'string') {
    return data.output_text;
  }

  const choices = data.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const message = (choices[0] as Record<string, unknown>).message;
    if (message && typeof message === 'object') {
      const content = (message as Record<string, unknown>).content;
      if (typeof content === 'string') return content;
    }
  }

  return '';
}

function extractFromResponsesOutput(output: unknown): string {
  if (!Array.isArray(output)) return '';
  const parts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;

    if (record.type === 'message' && Array.isArray(record.content)) {
      for (const block of record.content) {
        if (typeof block === 'string') {
          parts.push(block);
          continue;
        }
        if (!block || typeof block !== 'object') continue;
        const contentBlock = block as Record<string, unknown>;
        if (contentBlock.type === 'output_text' && typeof contentBlock.text === 'string') {
          parts.push(contentBlock.text);
        } else if (contentBlock.type === 'text' && typeof contentBlock.text === 'string') {
          parts.push(contentBlock.text);
        }
      }
    }

    if (record.type === 'text' && typeof record.text === 'string') {
      parts.push(record.text);
    }

    if (typeof record.content === 'string') {
      parts.push(record.content);
    }
  }

  return parts.join('');
}

function transformResponsesApiBody(text: string): string {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || data.object !== 'response') {
      return text;
    }

    const usage = data.usage as Record<string, number> | undefined;
    const transformed = {
      object: 'chat.completion',
      id: data.id,
      created: data.created_at,
      model: data.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: extractResponsesApiContent(data)
          },
          finish_reason: 'stop'
        }
      ],
      usage: usage
        ? {
            prompt_tokens: usage.input_tokens || 0,
            completion_tokens: usage.output_tokens || 0,
            total_tokens: usage.total_tokens || 0
          }
        : undefined
    };

    return JSON.stringify(transformed);
  } catch {
    return text;
  }
}

const getOpenAIFetch = (name: string, dispatcher?: any) => {
  const baseFetch = getCustomFetch(name, dispatcher);
  return async (input: any, init?: any): Promise<Response> => {
    const res = await baseFetch(input, init);
    const text = await res.text();
    const transformed = transformResponsesApiBody(text);
    const headers = new Headers(res.headers);
    if (transformed !== text) {
      headers.set('content-type', 'application/json');
    }
    return new Response(transformed, {
      status: res.status,
      statusText: res.statusText,
      headers
    });
  };
};

function normalizeProviderJsonSchema(value: unknown): Record<string, unknown> {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const normalized: Record<string, unknown> = { ...source };
  const type = normalized.type;
  const isObjectSchema = type === 'object' || type === undefined || 'properties' in normalized;

  if (isObjectSchema) {
    normalized.type = typeof type === 'string' ? type : 'object';
    const properties =
      normalized.properties &&
      typeof normalized.properties === 'object' &&
      !Array.isArray(normalized.properties)
        ? (normalized.properties as Record<string, unknown>)
        : {};
    normalized.properties = Object.fromEntries(
      Object.entries(properties).map(([name, propertySchema]) => [
        name,
        normalizeProviderJsonSchema(propertySchema),
      ]),
    );
    normalized.required = Array.isArray(normalized.required)
      ? normalized.required.filter((name): name is string => typeof name === 'string')
      : [];
  }

  if (normalized.items && typeof normalized.items === 'object') {
    normalized.items = normalizeProviderJsonSchema(normalized.items);
  }
  for (const keyword of ['anyOf', 'allOf', 'oneOf']) {
    const alternatives = normalized[keyword];
    if (Array.isArray(alternatives)) {
      normalized[keyword] = alternatives.map((schema) => normalizeProviderJsonSchema(schema));
    }
  }

  return normalized;
}

function normalizeTools(tools?: any[]): any[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  return sortToolDefinitions(tools).map((tool) => {
    if (tool && typeof tool === 'object' && 'name' in tool && 'parameters' in tool) {
      return {
        name: tool.name,
        description: tool.description || '',
        schema: tool.parameters
      };
    }

    return tool;
  });
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseOpenAIUsage(usage?: Record<string, unknown>) {
  if (!usage) return undefined;
  const promptDetails = usage.prompt_tokens_details;
  const inputDetails = usage.input_tokens_details;
  const cachedFromDetails =
    promptDetails && typeof promptDetails === 'object'
      ? Number((promptDetails as Record<string, unknown>).cached_tokens || 0)
      : inputDetails && typeof inputDetails === 'object'
        ? Number((inputDetails as Record<string, unknown>).cached_tokens || 0)
        : 0;

  // Anthropic Messages API reports cache via cache_read_input_tokens /
  // cache_creation_input_tokens (no prompt_tokens_details wrapper).
  const cacheReadInputTokens = Number(usage.cache_read_input_tokens || 0);
  const cacheCreationInputTokens = Number(usage.cache_creation_input_tokens || 0);
  const anthropicCached = cacheReadInputTokens || cachedFromDetails;

  const promptTokens = Number(usage.prompt_tokens || usage.input_tokens || 0);
  const completionTokens = Number(usage.completion_tokens || usage.output_tokens || 0);
  const totalTokens = Number(usage.total_tokens || promptTokens + completionTokens);

  const result: NonNullable<AIResponse['usage']> = {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens
  };

  if (anthropicCached > 0) {
    result.cached_tokens = anthropicCached;
    result.prompt_tokens_details = { cached_tokens: anthropicCached };
  }

  if (cacheReadInputTokens > 0) {
    result.cache_read_input_tokens = cacheReadInputTokens;
  }
  if (cacheCreationInputTokens > 0) {
    result.cache_creation_input_tokens = cacheCreationInputTokens;
  }

  return result;
}

export function attachPromptCacheUsage(
  response: AIResponse,
  responseCache?: ResponseCacheRequest,
): AIResponse {
  if (!responseCache) return response;
  const usage = response.usage ?? {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0
  };
  const cachedTokens = Number(
    usage.cached_tokens ?? usage.cache_read_input_tokens ?? 0,
  );
  const writeTokens = Number(usage.cache_creation_input_tokens ?? 0);
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const requested = Boolean(responseCache.enableStore && responseCache.cacheKey);
  const status = resolvePromptCacheStatus(
    responseCache,
    cachedTokens,
    writeTokens,
  );
  usage.prompt_cache = {
    ...(usage.prompt_cache ?? {}),
    cacheStatus: status,
    cachedInputTokens: cachedTokens,
    cacheWriteInputTokens: writeTokens,
    uncachedInputTokens: Math.max(0, promptTokens - cachedTokens - writeTokens),
    cacheNamespace: responseCache.cacheNamespace,
    cacheContractVersion: responseCache.cacheContractVersion,
    cacheDisableReason: responseCache.cacheDisableReason,
    requested,
    eligible: responseCache.cacheEligibility,
    hit: cachedTokens > 0 ? true : undefined,
    cache_key: responseCache.cacheKey,
    cache_namespace: responseCache.cacheNamespace,
    contract_version: responseCache.cacheContractVersion,
    policy: responseCache.cachePolicy,
    mode: responseCache.cacheMode,
    provider: responseCache.providerId,
    read_tokens: cachedTokens > 0 ? cachedTokens : undefined,
    write_tokens: writeTokens > 0 ? writeTokens : undefined
  };
  response.usage = usage;
  return response;
}

function resolvePromptCacheStatus(
  responseCache: ResponseCacheRequest,
  cachedTokens: number,
  writeTokens: number,
): NonNullable<NonNullable<AIResponse['usage']>['prompt_cache']>['cacheStatus'] {
  if (
    responseCache.cacheDisableReason?.includes('unsupported') ||
    responseCache.cacheDisableReason?.includes('does not expose') ||
    responseCache.cacheDisableReason?.includes('Unknown provider')
  ) {
    return 'unsupported';
  }
  if (
    responseCache.cacheDisableReason?.includes('cache_disabled') ||
    responseCache.cacheDisableReason?.includes('shadow_mode')
  ) {
    return 'disabled';
  }
  if (responseCache.cacheDisableReason) return 'unsafe';
  if (cachedTokens > 0) return 'hit';
  if (writeTokens > 0) return 'write';
  return 'miss';
}

function stableToolArguments(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '{}';
  try {
    return stableStringify(value);
  } catch {
    return '{}';
  }
}

function normalizeUserContentPart(part: unknown): Record<string, unknown> | null {
  if (typeof part === 'string') {
    const text = part.trim();
    return text ? { type: 'text', text } : null;
  }
  if (!part || typeof part !== 'object') return null;
  const record = part as Record<string, unknown>;
  if (record.type === 'text' && typeof record.text === 'string') {
    return { type: 'text', text: record.text };
  }
  if (record.type === 'image_url') {
    const imageUrl = record.image_url;
    if (typeof imageUrl === 'string' && imageUrl.trim()) {
      return { type: 'image_url', image_url: { url: imageUrl } };
    }
    if (imageUrl && typeof imageUrl === 'object') {
      const url = (imageUrl as Record<string, unknown>).url;
      if (typeof url === 'string' && url.trim()) {
        const detail = (imageUrl as Record<string, unknown>).detail;
        return {
          type: 'image_url',
          image_url: {
            url,
            ...(detail === 'auto' || detail === 'low' || detail === 'high' ? { detail } : {}),
          },
        };
      }
    }
  }
  return null;
}

export function normalizeApiMessageContent(
  content: unknown,
  role: string,
): string | Array<Record<string, unknown>> {
  if (role === 'assistant') return normalizeRuntimeMessageContent(content);
  if (typeof content === 'string') return content;
  if (content == null) return '';
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => normalizeUserContentPart(part))
      .filter((part): part is Record<string, unknown> => part != null);
    if (parts.some((part) => part.type === 'image_url') && role === 'user') {
      return parts;
    }
    return parts
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('\n\n');
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function parseDataImageUrl(url: string | undefined): { mime: string; data: string } | null {
  if (!url) return null;
  const match = /^data:([^;]+);base64,(.+)$/i.exec(url.trim());
  if (!match) return null;
  return { mime: match[1], data: match[2] };
}

function toAnthropicMessageContent(
  content: AIMessage['content'],
): string | Array<Record<string, unknown>> {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content == null ? '' : String(content);

  const blocks: Array<Record<string, unknown>> = [];
  for (const part of content) {
    if (part.type === 'text' && part.text) {
      blocks.push({ type: 'text', text: part.text });
      continue;
    }
    if (part.type !== 'image_url') continue;
    const url =
      typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
    const parsed = parseDataImageUrl(url);
    if (!parsed) continue;
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: parsed.mime,
        data: parsed.data,
      },
    });
  }

  return blocks.length > 0 ? blocks : '';
}

/** Normalize a system-role message content into a plain string (system
 *  messages never carry image parts, so the array branch of
 *  normalizeApiMessageContent is irrelevant here). */
function normalizeSystemMessageText(content: unknown): string {
  const text = normalizeApiMessageContent(content, 'system');
  return typeof text === 'string' ? text : '';
}

export function splitSystemFromPrompt(
  prompt: string | AIMessage[],
  systemInstruction?: string
): {
  systemInstruction?: string;
  conversation: string | AIMessage[];
  /**
   * Dynamic system messages (knowledge / memory / date / todo hints, …) that
   * were NOT folded into `systemInstruction`. They vary per turn, so callers
   * must append them to the END of the request input (not the cached prefix)
   * to keep prompt-cache prefix stability.
   *
   * Invariant: request layout is `stable system → conversation → dynamic tail`.
   * Dynamic contributions must never be folded back into the stable prefix.
   */
  dynamicSystemSuffix?: string;
} {
  if (systemInstruction?.trim()) {
    if (typeof prompt === 'string') {
      return { systemInstruction: systemInstruction.trim(), conversation: prompt };
    }
    // Caller supplied a stable systemInstruction; any system messages still
    // present in the prompt are dynamic leftovers — collect them as suffix.
    const dynamicSystemMessages: string[] = [];
    const conversation: AIMessage[] = [];
    for (const message of prompt) {
      if (message.role === 'system') {
        const text = normalizeSystemMessageText(message.content);
        if (text) dynamicSystemMessages.push(text);
      } else {
        conversation.push(message);
      }
    }
    return {
      systemInstruction: systemInstruction.trim(),
      conversation,
      dynamicSystemSuffix: dynamicSystemMessages.join('\n\n') || undefined,
    };
  }

  if (typeof prompt === 'string') {
    return { conversation: prompt };
  }

  // No explicit systemInstruction: the FIRST system message is treated as the
  // stable system instruction (assembled by PromptPipeline.systemMessage),
  // every subsequent system message is dynamic (preUser / tail) and returned as
  // a suffix so it can be appended to the input tail without polluting the
  // cached instructions prefix.
  let firstSystem: string | undefined;
  const dynamicSystemMessages: string[] = [];
  const conversation: AIMessage[] = [];
  let sawFirstSystem = false;
  for (const message of prompt) {
    if (message.role === 'system') {
      const text = normalizeSystemMessageText(message.content);
      if (!text) continue;
      if (!sawFirstSystem) {
        firstSystem = text;
        sawFirstSystem = true;
      } else {
        dynamicSystemMessages.push(text);
      }
    } else {
      conversation.push(message);
    }
  }

  return {
    systemInstruction: firstSystem,
    conversation,
    dynamicSystemSuffix: dynamicSystemMessages.join('\n\n') || undefined,
  };
}

const DYNAMIC_DATE_SUFFIX_PATTERN = /\n\n当前处理日期为: [^\n]+$/;

function splitStableInstructions(instructions: string): {
  stableInstructions: string;
  dynamicSuffix?: string;
} {
  const trimmed = instructions.trim();
  const match = DYNAMIC_DATE_SUFFIX_PATTERN.exec(trimmed);
  if (!match) {
    return { stableInstructions: trimmed || 'You are a helpful assistant.' };
  }
  const stable = trimmed.slice(0, match.index).trim();
  return {
    stableInstructions: stable || 'You are a helpful assistant.',
    dynamicSuffix: match[0].trim()
  };
}

function appendDynamicSuffixToInput(
  input: Array<Record<string, unknown>>,
  dynamicSuffix?: string
): Array<Record<string, unknown>> {
  if (!dynamicSuffix?.trim() || input.length === 0) return input;
  const last = input[input.length - 1]!;
  if (last.role !== 'user') {
    return [...input, { role: 'user', content: dynamicSuffix }];
  }
  const content = last.content;
  if (Array.isArray(content)) {
    const textType = content.some(
      (part) => part && typeof part === 'object' && (part as Record<string, unknown>).type === 'input_text',
    )
      ? 'input_text'
      : 'text';
    return [
      ...input.slice(0, -1),
      {
        ...last,
        content: [...content, { type: textType, text: dynamicSuffix.trim() }],
      },
    ];
  }
  const text = typeof content === 'string' ? content : '';
  return [
    ...input.slice(0, -1),
    { ...last, content: `${text}\n\n${dynamicSuffix}`.trim() },
  ];
}

function toOpenAIApiMessages(
  prompt: string | AIMessage[],
  systemInstruction?: string,
): Array<Record<string, unknown>> {
  return toChatCompletionsApiMessages(prompt, systemInstruction);
}

function toChatCompletionsUserContent(
  content: AIMessage['content'],
): string | Array<Record<string, unknown>> {
  const normalized = normalizeApiMessageContent(content, 'user');
  if (typeof normalized === 'string' || Array.isArray(normalized)) {
    return normalized;
  }
  return normalized == null ? '' : String(normalized);
}

/** Chat Completions `/v1/chat/completions` messages array for multi-turn tool runs. */
export function toChatCompletionsApiMessages(
  prompt: string | AIMessage[],
  systemInstruction?: string,
  options?: { keepHistoryReasoning?: boolean },
): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  const keepReasoning = options?.keepHistoryReasoning === true;
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  if (typeof prompt === 'string') {
    messages.push({ role: 'user', content: prompt });
    return messages;
  }

  for (const message of prompt) {
    if (message.role === 'system') continue;

    if (message.role === 'assistant') {
      const text = normalizeApiMessageContent(message.content, 'assistant');
      const textContent = typeof text === 'string' ? text : '';
      const hasToolCalls = (message.tool_calls?.length ?? 0) > 0;
      const msg: Record<string, unknown> = {
        role: 'assistant',
        content: hasToolCalls && !textContent ? null : textContent,
      };

      if (keepReasoning && message.reasoning?.trim()) {
        msg.reasoning_content = message.reasoning.trim();
      }

      if (hasToolCalls) {
        msg.tool_calls = message.tool_calls!.map((toolCall) => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.name,
            arguments: stableToolArguments(toolCall.arguments),
          },
        }));
      }

      messages.push(msg);
      continue;
    }

    if (message.role === 'tool') {
      const toolContent = normalizeApiMessageContent(message.content, 'tool');
      messages.push({
        role: 'tool',
        tool_call_id: message.tool_call_id || message.name || 'tool',
        ...(message.name ? { name: message.name } : {}),
        content: typeof toolContent === 'string' ? toolContent : JSON.stringify(toolContent),
      });
      continue;
    }

    if (message.role === 'user') {
      messages.push({
        role: 'user',
        content: toChatCompletionsUserContent(message.content),
      });
    }
  }

  return messages;
}

export function extractResponsesApiResult(data: Record<string, unknown>): AIResponse {
  const contentParts: string[] = [];
  const reasoningParts: string[] = [];
  const tool_calls: NonNullable<AIResponse['tool_calls']> = [];
  const output = Array.isArray(data.output) ? data.output : [];

  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const type = String(record.type || '');

    if (type === 'reasoning') {
      const reasoningText = extractReasoningTextFromOutputItem(record);
      if (reasoningText) reasoningParts.push(reasoningText);
      continue;
    }

    if (type === 'function_call' || type === 'tool_call') {
      tool_calls.push({
        id: String(record.call_id || record.id || ''),
        name: String(record.name || ''),
        arguments: tryParseJson(record.arguments ?? record.input ?? {})
      });
      continue;
    }

    if (type === 'message' && Array.isArray(record.content)) {
      for (const block of record.content) {
        if (typeof block === 'string') {
          contentParts.push(block);
          continue;
        }
        if (!block || typeof block !== 'object') continue;
        const contentBlock = block as Record<string, unknown>;
        if (contentBlock.type === 'output_text' && typeof contentBlock.text === 'string') {
          contentParts.push(contentBlock.text);
        } else if (contentBlock.type === 'text' && typeof contentBlock.text === 'string') {
          contentParts.push(contentBlock.text);
        }
      }
      continue;
    }

    if (type === 'text' && typeof record.text === 'string') {
      contentParts.push(record.text);
    } else if (typeof record.content === 'string') {
      contentParts.push(record.content);
    }
  }

  const fallbackContent = extractResponsesApiContent(data);
  const result: AIResponse = { content: contentParts.join('') || fallbackContent };
  const contextIds = extractProviderContextIds(data);
  if (contextIds.responseId) result.response_id = contextIds.responseId;
  if (contextIds.completionId) result.response_id = contextIds.completionId;
  if (contextIds.messageId) result.response_id = contextIds.messageId;
  result.usage = parseOpenAIUsage(data.usage as Record<string, number> | undefined);
  if (reasoningParts.length > 0) {
    result.reasoning = reasoningParts.join('\n\n');
  }
  if (tool_calls.length > 0) {
    result.tool_calls = tool_calls;
  }
  return result;
}

export function shouldTryAlternateOpenAIEndpoint(error: Error): boolean {
  const msg = error.message.toLowerCase();
  const cause =
    error.cause instanceof Error ? error.cause.message.toLowerCase() : String(error.cause ?? '').toLowerCase();
  const combined = `${msg} ${cause}`;
  if (/\b(404|405|501|502)\b/.test(combined)) return true;
  return (
    combined.includes('fetch failed') ||
    combined.includes('econnreset') ||
    combined.includes('etimedout') ||
    combined.includes('enotfound') ||
    combined.includes('econnrefused') ||
    combined.includes('socket hang up') ||
    combined.includes('network') ||
    combined.includes('not found') ||
    combined.includes('not supported') ||
    combined.includes('unsupported') ||
    combined.includes('unknown path') ||
    combined.includes('invalid url') ||
    combined.includes('instructions are required') ||
    combined.includes('upstream request failed') ||
    combined.includes('bad gateway') ||
    combined.includes('chat/completions') ||
    combined.includes('chat/completion') ||
    combined.includes('/responses') ||
    combined.includes('/messages')
  );
}

export type OpenAIStreamPlan = 'chat_completions' | 'responses' | 'messages';

/** Only api.openai.com should prefer /responses first; third-party gateways often 502 on it. */
export function isOfficialOpenAiApiBase(apiUrl: string): boolean {
  try {
    const host = new URL(apiUrl).hostname.toLowerCase();
    return host === 'api.openai.com' || host.endsWith('.api.openai.com');
  } catch {
    return false;
  }
}

/** Stream endpoint order; explicit apiEndpoint pins a single route (matches non-stream attempts). */
export function resolveStreamEndpointPlans(input: {
  apiUrl: string;
  apiEndpoint?: string;
  model?: string;
  providerLabel?: string;
  reasoningEffort?: string;
}): OpenAIStreamPlan[] {
  const anthropicCompatible = /\/anthropic(?:\/|$)/i.test(input.apiUrl);
  const reasoningOn = Boolean(input.reasoningEffort && input.reasoningEffort !== 'none');

  switch (input.apiEndpoint) {
    case 'passthrough':
      return ['chat_completions'];
    case 'chat_completions':
      return ['chat_completions'];
    case 'responses':
      // Respect an explicit responses pin: do NOT silently fall back to
      // chat_completions / messages. Falling back switches the prompt-cache
      // namespace (different request shape), which both misses the cache and
      // pollutes the other endpoint's cache — the user observed this as
      // "回退到了 chat completion". Match the non-streaming behaviour in
      // resolveEndpointAttempts which already pins to ['responses'].
      return ['responses'];
    case 'messages':
      return ['messages'];
    default:
      if (anthropicCompatible && reasoningOn) {
        return ['messages', 'chat_completions', 'responses'];
      }
      if (
        input.providerLabel === 'OpenAI' &&
        (isReasoningCapableOpenAIModel(input.model || '') || reasoningOn) &&
        isOfficialOpenAiApiBase(input.apiUrl)
      ) {
        return ['responses', 'chat_completions', 'messages'];
      }
      return ['chat_completions', 'responses', 'messages'];
  }
}

/**
 * Resolve the endpoint identity used by the prompt-cache contract so it matches
 * the route the provider will actually hit. Prefers a previously pinned session
 * endpoint, then an explicit config, then the first auto-plan candidate.
 */
export function resolveEffectiveApiEndpoint(input: {
  configuredEndpoint?: string;
  pinnedEndpoint?: string;
  providerType?: string;
  apiUrl?: string;
  model?: string;
  providerLabel?: string;
  reasoningEffort?: string;
}): string {
  const pinned = input.pinnedEndpoint?.trim();
  if (pinned && pinned !== 'auto' && pinned !== 'default') return pinned;

  const configured = input.configuredEndpoint?.trim();
  if (configured && configured !== 'auto') return configured;

  const plans = resolveStreamEndpointPlans({
    apiUrl: input.apiUrl || '',
    apiEndpoint: 'auto',
    model: input.model,
    providerLabel: input.providerLabel,
    reasoningEffort: input.reasoningEffort
  });
  return plans[0] ?? resolveDefaultApiEndpoint(input.providerType);
}

export function mapAttemptLabelToApiEndpoint(
  label: string
): OpenAIApiEndpointMode | undefined {
  switch (label) {
    case 'chat/completions':
    case 'chat_completions':
      return 'chat_completions';
    case 'responses':
      return 'responses';
    case 'messages':
      return 'messages';
    case 'passthrough':
      return 'passthrough';
    default:
      return undefined;
  }
}

export function applyReasoningRequestFields(
  body: Record<string, unknown>,
  reasoningEffort?: string,
): void {
  if (!reasoningEffort || reasoningEffort === 'none') return;
  body.reasoning_effort = reasoningEffort;
  // DeepSeek V4 and several OpenAI-compatible gateways require an explicit toggle
  // alongside reasoning_effort before they emit reasoning_content / thinking blocks.
  if (!body.thinking) {
    body.thinking = { type: 'enabled' };
  }
}

function buildChatCompletionsBody(
  model: string,
  prompt: string | AIMessage[],
  tools: any[],
  systemInstruction?: string,
  reasoningEffort?: string,
  responseCache?: ResponseCacheRequest
): Record<string, unknown> {
  const split = splitSystemFromPrompt(prompt, systemInstruction);
  const rawSystem = split.systemInstruction?.trim();
  const { stableInstructions, dynamicSuffix } = rawSystem
    ? splitStableInstructions(rawSystem)
    : { stableInstructions: undefined as string | undefined, dynamicSuffix: undefined as string | undefined };
  const trailingDynamic = [split.dynamicSystemSuffix, dynamicSuffix]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join('\n\n') || undefined;

  const messages = toChatCompletionsApiMessages(split.conversation, stableInstructions || undefined, {
    keepHistoryReasoning: responseCache?.keepHistoryReasoning
  });
  const body: Record<string, unknown> = {
    model,
    messages: appendDynamicSuffixToInput(messages, trailingDynamic)
  };

  if (responseCache?.cacheKey) {
    body.prompt_cache_key = responseCache.cacheKey;
  }

  const apiTools = toOpenAIApiTools(tools);
  if (apiTools?.length) {
    body.tools = apiTools;
  }
  applyReasoningRequestFields(body, reasoningEffort);
  return body;
}

export function toResponsesApiMessageContent(
  content: unknown,
): string | Array<Record<string, unknown>> {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content == null ? '' : String(content);

  const parts: Array<Record<string, unknown>> = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    const record = part as Record<string, unknown>;
    if (record.type === 'text' && typeof record.text === 'string') {
      parts.push({ type: 'input_text', text: record.text });
      continue;
    }
    if (record.type === 'image_url') {
      const imageUrl = record.image_url;
      const url =
        typeof imageUrl === 'string'
          ? imageUrl
          : imageUrl && typeof imageUrl === 'object'
            ? (imageUrl as Record<string, unknown>).url
            : undefined;
      if (typeof url === 'string' && url.trim()) {
        const detail =
          imageUrl && typeof imageUrl === 'object'
            ? (imageUrl as Record<string, unknown>).detail
            : undefined;
        parts.push({
          type: 'input_image',
          image_url: url,
          detail: detail === 'low' || detail === 'high' ? detail : 'auto',
        });
      }
    }
  }

  return parts.length > 0 ? parts : '';
}

function toResponsesApiInputMessages(
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return messages.map((message) => ({
    ...message,
    content: toResponsesApiMessageContent(message.content),
  }));
}

/** Responses API input Items — not Chat Completions `role: tool` messages. */
export function toResponsesApiInputItems(
  prompt: string | AIMessage[],
  options?: { keepHistoryReasoning?: boolean },
): Array<Record<string, unknown>> {
  if (typeof prompt === 'string') {
    return [{ role: 'user', content: toResponsesApiMessageContent(prompt) }];
  }

  const keepReasoning = options?.keepHistoryReasoning === true;

  const items: Array<Record<string, unknown>> = [];

  for (let index = 0; index < prompt.length; index += 1) {
    const message = prompt[index]!;

    if (message.role === 'system') continue;

    if (message.role === 'assistant') {
      if (Array.isArray(message.raw_parts) && message.raw_parts.length > 0) {
        for (const part of message.raw_parts) {
          if (part && typeof part === 'object') {
            items.push(part as Record<string, unknown>);
          }
        }
        continue;
      }

      if (keepReasoning && message.reasoning?.trim()) {
        items.push({
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: message.reasoning.trim() }],
        });
      }

      const text = normalizeApiMessageContent(message.content, 'assistant');
      const toolCalls = message.tool_calls ?? [];

      if (text) {
        items.push({
          role: 'assistant',
          content: toResponsesApiMessageContent(text),
        });
      }

      for (const toolCall of toolCalls) {
        if (!toolCall || typeof toolCall !== 'object') continue;
        const record = toolCall as Record<string, unknown>;
        const callId = typeof record.id === 'string' ? record.id : '';
        const name = typeof record.name === 'string' ? record.name : '';
        if (!callId || !name) continue;
        items.push({
          type: 'function_call',
          call_id: callId,
          name,
          arguments: stableToolArguments(record.arguments),
        });
      }
      continue;
    }

    if (message.role === 'tool') {
      let cursor = index;
      while (cursor < prompt.length && prompt[cursor]?.role === 'tool') {
        const toolMessage = prompt[cursor]!;
        const output = normalizeApiMessageContent(toolMessage.content, 'tool');
        items.push({
          type: 'function_call_output',
          call_id: toolMessage.tool_call_id || toolMessage.name || 'tool',
          output: typeof output === 'string' ? output : JSON.stringify(output),
        });
        cursor += 1;
      }
      index = cursor - 1;
      continue;
    }

    if (message.role === 'user') {
      items.push({
        role: 'user',
        content: toResponsesApiMessageContent(message.content),
      });
    }
  }

  return items;
}

function buildResponsesApiBody(
  model: string,
  prompt: string | AIMessage[],
  tools: any[],
  systemInstruction?: string,
  reasoningEffort?: string,
  responseCache?: ResponseCacheRequest
): Record<string, unknown> {
  const split = splitSystemFromPrompt(prompt, systemInstruction);
  const { stableInstructions, dynamicSuffix } = splitStableInstructions(
    split.systemInstruction?.trim() || 'You are a helpful assistant.'
  );
  // Merge the per-turn dynamic system messages (knowledge / memory / todo …)
  // with the date suffix extracted from instructions, then append both to the
  // END of the input so the cached prefix (instructions + history) stays
  // byte-stable across turns.
  const trailingDynamic = [split.dynamicSystemSuffix, dynamicSuffix]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join('\n\n') || undefined;

  const rawInput = toResponsesApiInputItems(split.conversation, {
    keepHistoryReasoning: responseCache?.keepHistoryReasoning
  });

  const finalInput = appendDynamicSuffixToInput(rawInput, trailingDynamic);

  const body: Record<string, unknown> = {
    model,
    instructions: stableInstructions,
    input: finalInput,
    // We never chain via previous_response_id (HTTP SSE sends full history),
    // so storing responses server-side is pure overhead and can interact badly
    // with some gateways' prompt_cache_key handling. Match LobeHub: store=false
    // still allows prefix caching via prompt_cache_key.
    store: false,
  };

  if (responseCache?.cacheKey) {
    body.prompt_cache_key = responseCache.cacheKey;
  }

  const apiTools = toResponsesApiTools(tools);
  if (apiTools?.length) {
    body.tools = apiTools;
  }
  if (reasoningEffort && reasoningEffort !== 'none') {
    body.reasoning = { effort: reasoningEffort, summary: 'detailed' };
  }
  return body;
}

type ResponsesFunctionCallAccumulator = {
  key: string;
  id: string;
  name: string;
  argumentsText: string;
  completed: boolean;
};

type ResponsesStreamParseState = {
  reasoningDeltaCharsByItem: Map<string, number>;
  reasoningStreamedText: string;
  responseId?: string;
  functionCallsByKey: Map<string, ResponsesFunctionCallAccumulator>;
  emittedFunctionCallKeys: Set<string>;
};

function functionCallStreamKey(record: Record<string, unknown>, fallbackItemId = ''): string {
  const callId = typeof record.call_id === 'string' ? record.call_id.trim() : '';
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const itemId = fallbackItemId.trim();
  return callId || id || itemId;
}

function parseResponsesFunctionCallItem(record: Record<string, unknown>): {
  id: string;
  name: string;
  arguments: unknown;
} | null {
  if (record.type !== 'function_call' && record.type !== 'tool_call') return null;
  const id = String(record.call_id || record.id || '').trim();
  const name = String(record.name || '').trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    arguments: tryParseJson(record.arguments ?? record.input ?? {}),
  };
}

function extractResponsesFunctionCallsFromOutput(
  response: Record<string, unknown>,
): NonNullable<AIResponse['tool_calls']> {
  const output = Array.isArray(response.output) ? response.output : [];
  const tool_calls: NonNullable<AIResponse['tool_calls']> = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const parsed = parseResponsesFunctionCallItem(item as Record<string, unknown>);
    if (parsed) tool_calls.push(parsed);
  }
  return tool_calls;
}

function upsertResponsesFunctionCall(
  state: ResponsesStreamParseState | undefined,
  key: string,
  patch: Partial<ResponsesFunctionCallAccumulator>,
): ResponsesFunctionCallAccumulator | undefined {
  if (!state || !key) return undefined;
  const existing = state.functionCallsByKey.get(key);
  const next: ResponsesFunctionCallAccumulator = {
    key,
    id: patch.id || existing?.id || key,
    name: patch.name || existing?.name || '',
    argumentsText: patch.argumentsText ?? existing?.argumentsText ?? '',
    completed: patch.completed ?? existing?.completed ?? false,
  };
  state.functionCallsByKey.set(key, next);
  return next;
}

function appendResponsesFunctionCallArguments(
  state: ResponsesStreamParseState | undefined,
  key: string,
  delta: string,
): ResponsesFunctionCallAccumulator | undefined {
  if (!state || !key || !delta) return undefined;
  const existing = state.functionCallsByKey.get(key);
  const argumentsText = `${existing?.argumentsText ?? ''}${delta}`;
  return upsertResponsesFunctionCall(state, key, {
    id: existing?.id || key,
    name: existing?.name || '',
    argumentsText,
  });
}

function emitResponsesFunctionCall(
  state: ResponsesStreamParseState | undefined,
  key: string,
): NonNullable<AIResponse['tool_calls']> | undefined {
  if (!state) return undefined;
  const acc = state.functionCallsByKey.get(key);
  if (!acc || !acc.name || state.emittedFunctionCallKeys.has(key)) return undefined;
  if (!acc.completed && !acc.argumentsText.trim()) return undefined;
  state.emittedFunctionCallKeys.add(key);
  return [
    {
      id: acc.id,
      name: acc.name,
      arguments: tryParseJson(acc.argumentsText || '{}'),
    },
  ];
}

function collectPendingResponsesFunctionCalls(
  state: ResponsesStreamParseState | undefined,
  response: Record<string, unknown>,
): NonNullable<AIResponse['tool_calls']> | undefined {
  if (!state) return undefined;
  const pending: NonNullable<AIResponse['tool_calls']> = [];
  for (const toolCall of extractResponsesFunctionCallsFromOutput(response)) {
    if (state.emittedFunctionCallKeys.has(toolCall.id)) continue;
    state.emittedFunctionCallKeys.add(toolCall.id);
    pending.push(toolCall);
  }
  return pending.length > 0 ? pending : undefined;
}

function toPartialResponsesToolCall(
  acc: ResponsesFunctionCallAccumulator,
): NonNullable<AIResponse['tool_calls']>[number] {
  return {
    id: acc.id,
    name: acc.name,
    arguments: acc.argumentsText ? acc.argumentsText : {},
  };
}

function reasoningStreamKey(itemId: string, summaryIndex: unknown): string {
  const index = typeof summaryIndex === 'number' ? summaryIndex : 0;
  return itemId ? `${itemId}:${index}` : `:${index}`;
}

export function createResponsesStreamParseState(): ResponsesStreamParseState {
  return {
    reasoningDeltaCharsByItem: new Map(),
    reasoningStreamedText: '',
    functionCallsByKey: new Map(),
    emittedFunctionCallKeys: new Set(),
  };
}

function appendStreamedReasoning(state: ResponsesStreamParseState | undefined, text: string): void {
  if (!state || !text) return;
  state.reasoningStreamedText += text;
}

function resolveReasoningBackfill(
  reasoningFromOutput: string,
  state?: ResponsesStreamParseState,
): string | undefined {
  const trimmed = reasoningFromOutput.trim();
  if (!trimmed) return undefined;

  const streamed = state?.reasoningStreamedText ?? '';
  if (!streamed) return trimmed;
  if (trimmed.startsWith(streamed)) {
    const remainder = trimmed.slice(streamed.length).trim();
    return remainder || undefined;
  }
  if (streamed.length < trimmed.length) return trimmed;
  return undefined;
}


function extractReasoningFromResponseOutput(response: Record<string, unknown>): string {
  const output = Array.isArray(response.output) ? response.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (record.type !== 'reasoning') continue;
    const text = extractReasoningTextFromOutputItem(record);
    if (text) parts.push(text);
  }
  return parts.join('\n\n');
}

function extractReasoningTextFromOutputItem(item: Record<string, unknown>): string {
  const parts: string[] = [];

  const summary = item.summary;
  if (Array.isArray(summary)) {
    for (const part of summary) {
      if (part && typeof part === 'object') {
        const text = (part as Record<string, unknown>).text;
        if (typeof text === 'string' && text.trim()) parts.push(text);
      }
    }
  }

  const content = item.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const record = part as Record<string, unknown>;
      if (typeof record.text === 'string' && record.text.trim()) {
        parts.push(record.text);
      }
    }
  }

  if (typeof item.text === 'string' && item.text.trim()) {
    parts.push(item.text);
  }

  return parts.join('\n\n');
}

function reasoningEffortToThinkingBudget(effort?: string): number {
  switch (effort) {
    case 'low':
      return 4096;
    case 'high':
      return 32000;
    case 'xhigh':
      return 48000;
    case 'max':
      return 64000;
    case 'medium':
    default:
      return 12000;
  }
}

function toAnthropicApiMessages(prompt: string | AIMessage[]): Array<Record<string, unknown>> {
  return toMessagesApiMessages(prompt);
}

/** Anthropic Messages API — preserves tool_use / tool_result blocks for multi-turn tool runs. */
export function toMessagesApiMessages(
  prompt: string | AIMessage[],
  options?: { keepHistoryReasoning?: boolean },
): Array<Record<string, unknown>> {
  if (typeof prompt === 'string') {
    return [{ role: 'user', content: prompt }];
  }

  const result: Array<Record<string, unknown>> = [];
  const keepReasoning = options?.keepHistoryReasoning === true;

  for (let index = 0; index < prompt.length; index += 1) {
    const message = prompt[index]!;

    if (message.role === 'system') continue;

    if (message.role === 'assistant') {
      const blocks: Array<Record<string, unknown>> = [];

      if (keepReasoning && message.reasoning?.trim()) {
        blocks.push({ type: 'thinking', thinking: message.reasoning.trim() });
      }

      const text = normalizeApiMessageContent(message.content, 'assistant');
      if (text) {
        blocks.push({ type: 'text', text });
      }

      for (const toolCall of message.tool_calls ?? []) {
        if (!toolCall || typeof toolCall !== 'object') continue;
        const record = toolCall as Record<string, unknown>;
        const id = typeof record.id === 'string' ? record.id : '';
        const name = typeof record.name === 'string' ? record.name : '';
        if (!id || !name) continue;
        const args = record.arguments;
        blocks.push({
          type: 'tool_use',
          id,
          name,
          input:
            args && typeof args === 'object' && !Array.isArray(args)
              ? args
              : tryParseJson(typeof args === 'string' ? args : '{}'),
        });
      }

      if (blocks.length === 0) {
        result.push({ role: 'assistant', content: '' });
      } else if (blocks.length === 1 && blocks[0]?.type === 'text') {
        result.push({ role: 'assistant', content: (blocks[0] as { text: string }).text });
      } else {
        result.push({ role: 'assistant', content: blocks });
      }
      continue;
    }

    if (message.role === 'tool') {
      const toolResults: Array<Record<string, unknown>> = [];
      let cursor = index;
      while (cursor < prompt.length && prompt[cursor]?.role === 'tool') {
        const toolMessage = prompt[cursor]!;
        const toolContent = normalizeApiMessageContent(toolMessage.content, 'tool');
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolMessage.tool_call_id || toolMessage.name || 'tool',
          content: toolContent || '{}',
        });
        cursor += 1;
      }
      index = cursor - 1;
      result.push({ role: 'user', content: toolResults });
      continue;
    }

    if (message.role === 'user') {
      result.push({
        role: 'user',
        content: toAnthropicMessageContent(message.content),
      });
    }
  }

  return result;
}

/** Messages API tools — `{ name, input_schema }` (lobehub `buildAnthropicTools`). */
export function toMessagesApiTools(tools?: any[]): Array<Record<string, unknown>> | undefined {
  const normalized = normalizeTools(tools);
  if (!normalized?.length) return undefined;
  return normalized.map((tool) => ({
    name: tool.name,
    description: tool.description || '',
    input_schema: normalizeProviderJsonSchema(
      tool.schema || tool.parameters || { type: 'object', properties: {} },
    ),
  }));
}

function markAnthropicCacheControl(target: Record<string, unknown>): void {
  const content = target.content;
  if (typeof content === 'string') {
    target.content = [
      {
        type: 'text',
        text: content,
        cache_control: { type: 'ephemeral' }
      }
    ];
    return;
  }
  if (!Array.isArray(content) || content.length === 0) return;
  // Skip trailing thinking / redacted_thinking blocks: their content changes
  // every turn, so a cache_control breakpoint there would never hit. Walk
  // backwards to the last cacheable block (text / tool_use / tool_result).
  for (let i = content.length - 1; i >= 0; i -= 1) {
    const block = content[i];
    if (!block || typeof block !== 'object') continue;
    const record = block as Record<string, unknown>;
    const type = String(record.type || '');
    if (type === 'thinking' || type === 'redacted_thinking') continue;
    record.cache_control = { type: 'ephemeral' };
    return;
  }
}

export function applyAnthropicPromptCache(
  messages: Array<Record<string, unknown>>,
  systemInstruction: string | undefined,
  responseCache?: ResponseCacheRequest
): { messages: Array<Record<string, unknown>>; system: unknown } {
  // Caching disabled → return untouched system/messages.
  if (!responseCache?.cacheKey) {
    return {
      messages,
      system: systemInstruction?.trim() || undefined
    };
  }

  // Always cache the system prompt when caching is enabled — it is the most
  // stable high-value prefix and must be marked on the first turn so the
  // second turn can hit it. Anthropic allows up to 4 cache breakpoints total;
  // using one for system + one for the last stable message stays well within
  // budget. Skip message breakpoints on the first turn (messages.length <= 1)
  // because the single user message is the dynamic latest input.
  const system = systemInstruction?.trim()
    ? [{ type: 'text', text: systemInstruction.trim(), cache_control: { type: 'ephemeral' } }]
    : undefined;

  if (messages.length <= 1) {
    return {
      messages,
      system
    };
  }

  const stable = messages.slice(0, -1);
  const latest = messages[messages.length - 1];
  if (stable.length > 0) {
    markAnthropicCacheControl(stable[stable.length - 1]!);
  }

  return {
    messages: [...stable, latest!],
    system
  };
}

/** Mark the last tool definition with an ephemeral cache_control breakpoint so
 *  the entire tools array (the front of the Anthropic cache prefix) is cached.
 *  No-op when caching is disabled or there are no tools. */
export function markAnthropicToolsCacheControl(
  tools: Array<Record<string, unknown>> | undefined,
  responseCache?: ResponseCacheRequest,
): Array<Record<string, unknown>> | undefined {
  if (!responseCache?.cacheKey) return tools;
  if (!tools?.length) return undefined;
  const lastTool = tools[tools.length - 1] as Record<string, unknown>;
  if (lastTool && typeof lastTool === 'object') {
    lastTool.cache_control = { type: 'ephemeral' };
  }
  return tools;
}

function buildMessagesApiBody(
  model: string,
  prompt: string | AIMessage[],
  tools: any[],
  systemInstruction?: string,
  reasoningEffort?: string,
  responseCache?: ResponseCacheRequest
): Record<string, unknown> {
  // Anthropic extended thinking requires prior thinking blocks to be echoed
  // back on multi-turn tool chains, so we must keep history reasoning when
  // thinking is enabled — even though it weakens prompt-cache prefix stability.
  const thinkingEnabled = !!reasoningEffort && reasoningEffort !== 'none';
  const keepHistoryReasoning = thinkingEnabled || responseCache?.keepHistoryReasoning === true;

  // Split the stable first system message (cached system prefix) from the
  // per-turn dynamic system messages (knowledge / memory / todo …). The
  // dynamic ones are appended to the message tail as a user turn so the
  // Anthropic cache_control prefix (tools → system → history) stays stable.
  const split = splitSystemFromPrompt(prompt, systemInstruction);
  const { stableInstructions, dynamicSuffix } = splitStableInstructions(
    split.systemInstruction?.trim() || 'You are a helpful assistant.'
  );
  const trailingDynamic = [split.dynamicSystemSuffix, dynamicSuffix]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join('\n\n') || undefined;

  const cached = applyAnthropicPromptCache(
    toMessagesApiMessages(split.conversation, { keepHistoryReasoning }),
    stableInstructions,
    responseCache
  );
  const messages = trailingDynamic
    ? appendDynamicSuffixToInput(cached.messages, trailingDynamic)
    : cached.messages;

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages
  };

  if (cached.system) {
    body.system = cached.system;
  }

  const apiTools = toMessagesApiTools(tools);
  if (apiTools?.length) {
    // Tools sit at the very front of the Anthropic cache prefix (tools → system
    // → messages). Marking the last tool definition caches the entire tools
    // array, high-value for agent runs that repeat a stable toolset across turns.
    body.tools = markAnthropicToolsCacheControl(apiTools, responseCache);
  }

  if (reasoningEffort && reasoningEffort !== 'none') {
    body.thinking = {
      type: 'enabled',
      budget_tokens: reasoningEffortToThinkingBudget(reasoningEffort)
    };
    // OpenAI-compatible /v1/messages gateways also accept the Responses-style field.
    body.reasoning = { effort: reasoningEffort, summary: 'detailed' };
  }

  return body;
}

function extractReasoningTextFromMessagesBlock(record: Record<string, unknown>): string {
  const type = String(record.type || '');
  if (type === 'thinking' && typeof record.thinking === 'string' && record.thinking.trim()) {
    return record.thinking;
  }
  if (type === 'thinking' && typeof record.text === 'string' && record.text.trim()) {
    return record.text;
  }
  if (
    (type === 'reasoning' || type === 'reasoning_text') &&
    typeof record.text === 'string' &&
    record.text.trim()
  ) {
    return record.text;
  }
  if (type === 'reasoning' && typeof record.reasoning === 'string' && record.reasoning.trim()) {
    return record.reasoning;
  }
  return '';
}

function extractReasoningTextFromMessagesContent(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const text = extractReasoningTextFromMessagesBlock(block as Record<string, unknown>);
    if (text) parts.push(text);
  }
  return parts.join('\n\n');
}

function extractReasoningDeltaFromMessagesPayload(record: Record<string, unknown>): string {
  const type = String(record.type || '');
  if (typeof record.thinking === 'string' && record.thinking) return record.thinking;
  if (typeof record.reasoning === 'string' && record.reasoning) return record.reasoning;
  if (
    typeof record.text === 'string' &&
    record.text &&
    (type === 'thinking_delta' ||
      type === 'thinking' ||
      type === 'reasoning_delta' ||
      type === 'reasoning_text_delta' ||
      type === 'reasoning')
  ) {
    return record.text;
  }
  return '';
}

export function extractMessagesApiResult(data: Record<string, unknown>): AIResponse {
  const contentParts: string[] = [];
  let reasoning = '';
  const tool_calls: NonNullable<AIResponse['tool_calls']> = [];

  const blocks = Array.isArray(data.content) ? data.content : [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const record = block as Record<string, unknown>;
    const type = String(record.type || '');
    if (type === 'text' && typeof record.text === 'string') {
      contentParts.push(record.text);
      continue;
    }
    const blockReasoning = extractReasoningTextFromMessagesBlock(record);
    if (blockReasoning) {
      reasoning += blockReasoning;
      continue;
    }
  }
  tool_calls.push(...extractMessagesToolCallsFromContent(blocks));

  const topLevelReasoning = data.reasoning;
  if (typeof topLevelReasoning === 'string' && topLevelReasoning.trim()) {
    reasoning += topLevelReasoning;
  }

  const result: AIResponse = { content: contentParts.join('') };
  if (reasoning) result.reasoning = reasoning;
  if (tool_calls.length > 0) result.tool_calls = tool_calls;

  const contextIds = extractProviderContextIds(data);
  if (contextIds.messageId) result.response_id = contextIds.messageId;

  const usage = parseOpenAIUsage(data.usage as Record<string, unknown> | undefined);
  if (usage) {
    result.usage = usage;
  }

  return result;
}

function isReasoningCapableOpenAIModel(model: string): boolean {
  const normalized = model.toLowerCase();
  return /^gpt-5/.test(normalized) || /^o\d/.test(normalized) || normalized.includes('reasoning');
}

export function parseResponsesStreamPayload(
  payload: Record<string, unknown>,
  state?: ResponsesStreamParseState
): Partial<Pick<AIResponse, 'content' | 'reasoning' | 'response_id' | 'usage' | 'tool_calls'>> | null {
  const type = String(payload.type || '');

  if (type === 'response.completed' || type === 'response.done' || type === 'response.created') {
    const response =
      payload.response && typeof payload.response === 'object'
        ? (payload.response as Record<string, unknown>)
        : payload;
    const responseId = extractProviderResponseId(payload) ?? extractProviderResponseId(response);
    if (responseId && state) state.responseId = responseId;

    const usage = parseOpenAIUsage(response.usage as Record<string, unknown> | undefined);
    const reasoningFromOutput =
      type === 'response.completed' || type === 'response.done'
        ? extractReasoningFromResponseOutput(response)
        : '';
    const reasoningBackfill = resolveReasoningBackfill(reasoningFromOutput, state);
    if (reasoningBackfill && state) {
      appendStreamedReasoning(state, reasoningBackfill);
    }
    const tool_calls =
      type === 'response.completed' || type === 'response.done'
        ? collectPendingResponsesFunctionCalls(state, response)
        : undefined;

    if (usage || responseId || reasoningBackfill || tool_calls?.length) {
      return {
        ...(responseId ? { response_id: responseId } : {}),
        ...(usage ? { usage } : {}),
        ...(reasoningBackfill ? { reasoning: reasoningBackfill } : {}),
        ...(tool_calls?.length ? { tool_calls } : {}),
      };
    }
  }

  const itemId = typeof payload.item_id === 'string' ? payload.item_id : '';
  const summaryIndex = payload.summary_index;
  const streamKey = reasoningStreamKey(itemId, summaryIndex);
  const delta = typeof payload.delta === 'string' ? payload.delta : '';

  if (delta && type.includes('function_call_arguments.delta')) {
    const key = itemId || streamKey;
    const acc = appendResponsesFunctionCallArguments(state, key, delta);
    if (acc?.name) {
      return { tool_calls: [toPartialResponsesToolCall(acc)] };
    }
  }

  if (type.includes('function_call_arguments.done')) {
    const key = itemId || streamKey;
    const name = typeof payload.name === 'string' ? payload.name : '';
    const argumentsText =
      typeof payload.arguments === 'string'
        ? payload.arguments
        : state?.functionCallsByKey.get(key)?.argumentsText ?? '';
    upsertResponsesFunctionCall(state, key, {
      id: key,
      name,
      argumentsText,
      completed: true,
    });
    const tool_calls = emitResponsesFunctionCall(state, key);
    if (tool_calls?.length) return { tool_calls };
  }

  if (delta && (type.includes('output_text.delta') || type === 'response.text.delta')) {
    return { content: delta };
  }

  if (
    delta &&
    (type.includes('reasoning_summary_text.delta') ||
      type.includes('reasoning_summary.delta') ||
      type.includes('reasoning_text.delta') ||
      type.includes('reasoning.delta') ||
      type === 'response.reasoning.delta')
  ) {
    if (state && streamKey) {
      state.reasoningDeltaCharsByItem.set(
        streamKey,
        (state.reasoningDeltaCharsByItem.get(streamKey) ?? 0) + delta.length
      );
    }
    appendStreamedReasoning(state, delta);
    return { reasoning: delta };
  }

  if (
    typeof payload.text === 'string' &&
    payload.text &&
    type.includes('reasoning_summary_text.done')
  ) {
    const prior = streamKey ? (state?.reasoningDeltaCharsByItem.get(streamKey) ?? 0) : 0;
    if (prior > 0) return null;
    appendStreamedReasoning(state, payload.text);
    return { reasoning: payload.text };
  }

  if (type.includes('reasoning_summary_part.done')) {
    const part = payload.part;
    if (part && typeof part === 'object') {
      const text = (part as Record<string, unknown>).text;
      if (typeof text === 'string' && text.trim()) {
        const prior = streamKey ? (state?.reasoningDeltaCharsByItem.get(streamKey) ?? 0) : 0;
        if (prior > 0) return null;
        appendStreamedReasoning(state, text);
        return { reasoning: text };
      }
    }
  }

  if (type.includes('output_item.done') || type === 'response.output_item.done') {
    const item = payload.item;
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    if (record.type === 'function_call' || record.type === 'tool_call') {
      const key = functionCallStreamKey(record, itemId);
      const argumentsText =
        typeof record.arguments === 'string'
          ? record.arguments
          : state?.functionCallsByKey.get(key)?.argumentsText ?? '';
      upsertResponsesFunctionCall(state, key, {
        id: String(record.call_id || record.id || key),
        name: String(record.name || ''),
        argumentsText,
        completed: true,
      });
      const tool_calls = emitResponsesFunctionCall(state, key);
      if (tool_calls?.length) return { tool_calls };
      return null;
    }
    if (record.type !== 'reasoning') return null;
    const reasoningText = extractReasoningTextFromOutputItem(record);
    if (!reasoningText) return null;
    const itemKey =
      typeof record.id === 'string' ? reasoningStreamKey(record.id, summaryIndex) : streamKey;
    const prior = itemKey ? (state?.reasoningDeltaCharsByItem.get(itemKey) ?? 0) : 0;
    if (prior > 0) return null;
    appendStreamedReasoning(state, reasoningText);
    return { reasoning: reasoningText };
  }

  if (type === 'response.output_item.added' || type.includes('output_item.added')) {
    const item = payload.item;
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      if (record.type === 'function_call' || record.type === 'tool_call') {
        const key = functionCallStreamKey(record, itemId);
        const argumentsText = typeof record.arguments === 'string' ? record.arguments : '';
        const acc = upsertResponsesFunctionCall(state, key, {
          id: String(record.call_id || record.id || key),
          name: String(record.name || ''),
          argumentsText,
          completed: Boolean(argumentsText.trim()),
        });
        if (acc?.name && argumentsText.trim()) {
          const tool_calls = emitResponsesFunctionCall(state, key);
          if (tool_calls?.length) return { tool_calls };
        }
        if (acc?.name) {
          return { tool_calls: [toPartialResponsesToolCall(acc)] };
        }
        return null;
      }
      if (record.type === 'reasoning') {
        const reasoningText = extractReasoningTextFromOutputItem(record);
        if (reasoningText) {
          appendStreamedReasoning(state, reasoningText);
          return { reasoning: reasoningText };
        }
      }
    }
  }

  return null;
}

type ChatCompletionsStreamParseState = {
  completionId?: string;
  toolCallsByIndex: Map<number, { id?: string; name?: string; argumentsText?: string }>;
  emittedToolCallIds: Set<string>;
};

export function createChatCompletionsStreamParseState(): ChatCompletionsStreamParseState {
  return { toolCallsByIndex: new Map(), emittedToolCallIds: new Set() };
}

function parseChatCompletionToolCallRecords(
  rawToolCalls: unknown,
  state?: ChatCompletionsStreamParseState,
  options?: { allowPartial?: boolean },
): NonNullable<AIResponse['tool_calls']> | undefined {
  if (!Array.isArray(rawToolCalls)) return undefined;
  const tool_calls = rawToolCalls.flatMap((tc, fallbackIndex) => {
    if (!tc || typeof tc !== 'object') return [];
    const toolRecord = tc as Record<string, unknown>;
    const index = typeof toolRecord.index === 'number' ? toolRecord.index : fallbackIndex;
    const existing = state?.toolCallsByIndex.get(index) ?? {};
    const fn =
      toolRecord.function && typeof toolRecord.function === 'object'
        ? (toolRecord.function as Record<string, unknown>)
        : undefined;
    const id =
      (typeof toolRecord.id === 'string' ? toolRecord.id : undefined) ||
      existing.id ||
      `chat_tool_${index}`;
    const name =
      (typeof fn?.name === 'string' ? fn.name : undefined) ||
      (typeof toolRecord.name === 'string' ? toolRecord.name : undefined) ||
      existing.name;
    const argumentsText =
      typeof fn?.arguments === 'string'
        ? options?.allowPartial
          ? `${existing.argumentsText ?? ''}${fn.arguments}`
          : fn.arguments
        : existing.argumentsText;
    if (state) {
      state.toolCallsByIndex.set(index, { id, name, argumentsText });
    }
    if (!name) return [];
    if (state?.emittedToolCallIds.has(id) && !options?.allowPartial) return [];
    if (!options?.allowPartial) state?.emittedToolCallIds.add(id);
    return [
      {
        id,
        name,
        arguments: argumentsText ? tryParseJson(argumentsText) : {},
      },
    ];
  });
  return tool_calls.length > 0 ? tool_calls : undefined;
}

function compactChatCompletionToolCalls(
  state?: ChatCompletionsStreamParseState,
): NonNullable<AIResponse['tool_calls']> | undefined {
  if (!state || state.toolCallsByIndex.size === 0) return undefined;
  const tool_calls = [...state.toolCallsByIndex.entries()].flatMap(([index, acc]) => {
    if (!acc.name) return [];
    const id = acc.id || `chat_tool_${index}`;
    if (state.emittedToolCallIds.has(id)) return [];
    state.emittedToolCallIds.add(id);
    return [
      {
        id,
        name: acc.name,
        arguments: tryParseJson(acc.argumentsText || '{}'),
      },
    ];
  });
  return tool_calls.length > 0 ? tool_calls : undefined;
}

export function parseChatCompletionsStreamPayload(
  payload: Record<string, unknown>,
  state?: ChatCompletionsStreamParseState
): Partial<Pick<AIResponse, 'content' | 'reasoning' | 'response_id' | 'usage' | 'tool_calls'>> | null {
  const usage = parseOpenAIUsage(payload.usage as Record<string, unknown> | undefined);
  const contextIds = extractProviderContextIds(payload);
  if (contextIds.completionId && state) {
    state.completionId = contextIds.completionId;
  }

  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  if (!choice || typeof choice !== 'object') {
    if (contextIds.responseId || contextIds.completionId || contextIds.messageId) {
      const response_id =
        contextIds.responseId ?? contextIds.completionId ?? contextIds.messageId;
      if (response_id) {
        return { response_id, content: '', reasoning: undefined };
      }
    }
    if (usage) return { usage, content: '' };
    return null;
  }
  const choiceRecord = choice as Record<string, unknown>;
  const finishReason =
    typeof choiceRecord.finish_reason === 'string' ? choiceRecord.finish_reason : undefined;
  const message =
    choiceRecord.message && typeof choiceRecord.message === 'object'
      ? (choiceRecord.message as Record<string, unknown>)
      : undefined;
  const messageToolCalls = message
    ? parseChatCompletionToolCallRecords(message.tool_calls, state)
    : undefined;
  const delta = choiceRecord.delta;
  if (!delta || typeof delta !== 'object') {
    if (messageToolCalls?.length) return { tool_calls: messageToolCalls };
    if (finishReason === 'tool_calls') {
      const tool_calls = compactChatCompletionToolCalls(state);
      if (tool_calls?.length) return { tool_calls };
    }
    if (message) {
      const msgContent = typeof message.content === 'string' ? message.content : '';
      const msgReasoning =
        typeof message.reasoning_content === 'string'
          ? message.reasoning_content
          : typeof message.reasoning === 'string'
            ? message.reasoning
            : '';
      if (msgContent || msgReasoning) {
        const result: Partial<
          Pick<AIResponse, 'content' | 'reasoning' | 'response_id' | 'usage' | 'tool_calls'>
        > = {};
        if (msgContent) result.content = msgContent;
        if (msgReasoning) result.reasoning = msgReasoning;
        if (usage) result.usage = usage;
        return result;
      }
    }
    if (usage) return { usage, content: '' };
    return null;
  }
  const record = delta as Record<string, unknown>;
  const content = typeof record.content === 'string' ? record.content : '';
  const reasoning =
    typeof record.reasoning_content === 'string'
      ? record.reasoning_content
      : typeof record.reasoning_text === 'string'
        ? record.reasoning_text
        : typeof record.reasoning === 'string'
          ? record.reasoning
          : '';
  const tool_calls =
    parseChatCompletionToolCallRecords(record.tool_calls, state, { allowPartial: true }) ??
    messageToolCalls ??
    (finishReason === 'tool_calls' ? compactChatCompletionToolCalls(state) : undefined);
  if (!content && !reasoning && !tool_calls?.length) {
    if (usage) return { usage, content: '' };
    return null;
  }
  const result: Partial<
    Pick<AIResponse, 'content' | 'reasoning' | 'response_id' | 'usage' | 'tool_calls'>
  > = {};
  if (content) result.content = content;
  if (reasoning) result.reasoning = reasoning;
  if (usage) result.usage = usage;
  if (tool_calls?.length) result.tool_calls = tool_calls;
  return result;
}

function extractMessagesToolCallsFromContent(
  content: unknown,
): NonNullable<AIResponse['tool_calls']> {
  if (!Array.isArray(content)) return [];
  const tool_calls: NonNullable<AIResponse['tool_calls']> = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const record = block as Record<string, unknown>;
    if (record.type !== 'tool_use') continue;
    const id = String(record.id || '').trim();
    const name = String(record.name || '').trim();
    if (!id || !name) continue;
    tool_calls.push({
      id,
      name,
      arguments: tryParseJson(record.input ?? {}),
    });
  }
  return tool_calls;
}

type MessagesToolUseAccumulator = {
  blockIndex: number;
  id: string;
  name: string;
  inputJsonText: string;
  completed: boolean;
};

type MessagesStreamParseState = {
  messageId?: string;
  reasoningDeltaCharsByBlock: Map<number, number>;
  reasoningStreamedText: string;
  toolUsesByBlock: Map<number, MessagesToolUseAccumulator>;
  emittedToolUseIds: Set<string>;
};

function upsertMessagesToolUse(
  state: MessagesStreamParseState | undefined,
  blockIndex: number,
  patch: Partial<MessagesToolUseAccumulator>,
): MessagesToolUseAccumulator | undefined {
  if (!state) return undefined;
  const existing = state.toolUsesByBlock.get(blockIndex);
  const next: MessagesToolUseAccumulator = {
    blockIndex,
    id: patch.id || existing?.id || `msg_tool_${blockIndex}`,
    name: patch.name || existing?.name || '',
    inputJsonText: patch.inputJsonText ?? existing?.inputJsonText ?? '',
    completed: patch.completed ?? existing?.completed ?? false,
  };
  state.toolUsesByBlock.set(blockIndex, next);
  return next;
}

function appendMessagesToolUseInput(
  state: MessagesStreamParseState | undefined,
  blockIndex: number,
  partialJson: string,
): MessagesToolUseAccumulator | undefined {
  if (!state || !partialJson) return undefined;
  const existing = state.toolUsesByBlock.get(blockIndex);
  const inputJsonText = `${existing?.inputJsonText ?? ''}${partialJson}`;
  return upsertMessagesToolUse(state, blockIndex, {
    id: existing?.id,
    name: existing?.name,
    inputJsonText,
  });
}

function toPartialMessagesToolCall(
  acc: MessagesToolUseAccumulator,
): NonNullable<AIResponse['tool_calls']>[number] {
  return {
    id: acc.id,
    name: acc.name,
    arguments: acc.inputJsonText ? acc.inputJsonText : {},
  };
}

function emitMessagesToolCall(
  state: MessagesStreamParseState | undefined,
  blockIndex: number,
): NonNullable<AIResponse['tool_calls']> | undefined {
  if (!state) return undefined;
  const acc = state.toolUsesByBlock.get(blockIndex);
  if (!acc || !acc.name || state.emittedToolUseIds.has(acc.id)) return undefined;
  state.emittedToolUseIds.add(acc.id);
  return [
    {
      id: acc.id,
      name: acc.name,
      arguments: tryParseJson(acc.inputJsonText || '{}'),
    },
  ];
}

function collectPendingMessagesToolCalls(
  state: MessagesStreamParseState | undefined,
  message: Record<string, unknown>,
): NonNullable<AIResponse['tool_calls']> | undefined {
  if (!state) return undefined;
  const pending: NonNullable<AIResponse['tool_calls']> = [];
  for (const toolCall of extractMessagesToolCallsFromContent(message.content)) {
    if (state.emittedToolUseIds.has(toolCall.id)) continue;
    state.emittedToolUseIds.add(toolCall.id);
    pending.push(toolCall);
  }
  return pending.length > 0 ? pending : undefined;
}

export function createMessagesStreamParseState(): MessagesStreamParseState {
  return {
    reasoningDeltaCharsByBlock: new Map(),
    reasoningStreamedText: '',
    toolUsesByBlock: new Map(),
    emittedToolUseIds: new Set(),
  };
}

function appendMessagesStreamedReasoning(
  state: MessagesStreamParseState | undefined,
  text: string,
): void {
  if (!state || !text) return;
  state.reasoningStreamedText += text;
}

function resolveMessagesReasoningBackfill(
  reasoningFromMessage: string,
  state?: MessagesStreamParseState,
): string | undefined {
  const trimmed = reasoningFromMessage.trim();
  if (!trimmed) return undefined;

  const streamed = state?.reasoningStreamedText ?? '';
  if (!streamed) return trimmed;
  if (trimmed.startsWith(streamed)) {
    const remainder = trimmed.slice(streamed.length).trim();
    return remainder || undefined;
  }
  if (streamed.length < trimmed.length) return trimmed;
  return undefined;
}

export function parseMessagesStreamPayload(
  payload: Record<string, unknown>,
  state?: MessagesStreamParseState
): Partial<Pick<AIResponse, 'content' | 'reasoning' | 'response_id' | 'usage' | 'tool_calls'>> | null {
  const type = String(payload.type || '');

  const contextIds = extractProviderContextIds(payload);
  if (contextIds.messageId && state) {
    state.messageId = contextIds.messageId;
  }
  if (type === 'message_start' && contextIds.messageId) {
    return { response_id: contextIds.messageId, content: '' };
  }

  if (type === 'content_block_start') {
    const block = payload.content_block;
    const blockIndex = typeof payload.index === 'number' ? payload.index : 0;
    if (block && typeof block === 'object') {
      const record = block as Record<string, unknown>;
      if (record.type === 'tool_use') {
        const id = String(record.id || `msg_tool_${blockIndex}`);
        const name = String(record.name || '');
        const input =
          record.input &&
          typeof record.input === 'object' &&
          Object.keys(record.input as Record<string, unknown>).length > 0
            ? JSON.stringify(record.input)
            : '';
        const acc = upsertMessagesToolUse(state, blockIndex, {
          id,
          name,
          inputJsonText: input,
          completed: Boolean(input.trim()),
        });
        if (acc?.name && input.trim()) {
          const tool_calls = emitMessagesToolCall(state, blockIndex);
          if (tool_calls?.length) return { tool_calls };
        }
        if (acc?.name) {
          return { tool_calls: [toPartialMessagesToolCall(acc)] };
        }
      }
    }
  }

  if (type === 'content_block_delta') {
    const delta = payload.delta;
    if (!delta || typeof delta !== 'object') return null;
    const record = delta as Record<string, unknown>;
    const blockIndex = typeof payload.index === 'number' ? payload.index : 0;
    const reasoning = extractReasoningDeltaFromMessagesPayload(record);
    if (reasoning) {
      if (state) {
        state.reasoningDeltaCharsByBlock.set(
          blockIndex,
          (state.reasoningDeltaCharsByBlock.get(blockIndex) ?? 0) + reasoning.length
        );
        appendMessagesStreamedReasoning(state, reasoning);
      }
      return { reasoning };
    }
    if (record.type === 'input_json_delta' && typeof record.partial_json === 'string') {
      const acc = appendMessagesToolUseInput(state, blockIndex, record.partial_json);
      if (acc?.name) {
        return { tool_calls: [toPartialMessagesToolCall(acc)] };
      }
      return null;
    }
    if (record.type === 'text_delta' && typeof record.text === 'string') {
      return { content: record.text };
    }
    return null;
  }

  if (type === 'content_block_stop') {
    const blockIndex = typeof payload.index === 'number' ? payload.index : 0;
    const block = payload.content_block;
    if (block && typeof block === 'object') {
      const record = block as Record<string, unknown>;
      if (record.type === 'tool_use') {
        const id = String(record.id || `msg_tool_${blockIndex}`);
        const name = String(record.name || '');
        const input =
          record.input &&
          typeof record.input === 'object' &&
          Object.keys(record.input as Record<string, unknown>).length > 0
            ? JSON.stringify(record.input)
            : state?.toolUsesByBlock.get(blockIndex)?.inputJsonText ?? '';
        upsertMessagesToolUse(state, blockIndex, {
          id,
          name,
          inputJsonText: input,
          completed: true,
        });
        const tool_calls = emitMessagesToolCall(state, blockIndex);
        if (tool_calls?.length) return { tool_calls };
        return null;
      }
      const reasoningText = extractReasoningTextFromMessagesBlock(record);
      if (reasoningText) {
        const prior = state?.reasoningDeltaCharsByBlock.get(blockIndex) ?? 0;
        if (prior > 0) return null;
        appendMessagesStreamedReasoning(state, reasoningText);
        return { reasoning: reasoningText };
      }
    }
    if (state?.toolUsesByBlock.has(blockIndex)) {
      upsertMessagesToolUse(state, blockIndex, { completed: true });
      const tool_calls = emitMessagesToolCall(state, blockIndex);
      if (tool_calls?.length) return { tool_calls };
    }
  }

  if (type === 'message_stop') {
    const message = payload.message;
    if (message && typeof message === 'object') {
      const messageRecord = message as Record<string, unknown>;
      const reasoningText = extractReasoningTextFromMessagesContent(messageRecord.content);
      const backfill = resolveMessagesReasoningBackfill(reasoningText, state);
      const tool_calls = collectPendingMessagesToolCalls(state, messageRecord);
      if (backfill || tool_calls?.length) {
        if (backfill) appendMessagesStreamedReasoning(state, backfill);
        return {
          ...(backfill ? { reasoning: backfill } : {}),
          ...(tool_calls?.length ? { tool_calls } : {}),
        };
      }
    }
  }

  if (
    typeof payload.delta === 'string' &&
    payload.delta &&
    (type.includes('reasoning') || type.includes('thinking'))
  ) {
    appendMessagesStreamedReasoning(state, payload.delta);
    return { reasoning: payload.delta };
  }

  if (type === 'message_delta') {
    const delta = payload.delta;
    if (delta && typeof delta === 'object') {
      const record = delta as Record<string, unknown>;
      const reasoning = extractReasoningDeltaFromMessagesPayload(record);
      if (reasoning) return { reasoning };
      if (typeof record.text === 'string') return { content: record.text };
    }
    // Anthropic streams cumulative usage (incl. cache_read_input_tokens /
    // cache_creation_input_tokens) on the message_delta event's top-level usage.
    const usage = parseOpenAIUsage(payload.usage as Record<string, unknown> | undefined);
    if (usage) return { usage };
  }

  return null;
}

function flushOpenAISseEventBlock(block: string): Record<string, unknown> | null {
  const normalized = block.replace(/\r\n/g, '\n').trim();
  if (!normalized || normalized.startsWith(':')) return null;

  const dataLines = normalized
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, '').trim())
    .filter((line) => line && line !== '[DONE]');
  if (dataLines.length === 0) return null;

  const jsonText = dataLines.join('\n');
  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function* iterateOpenAISseJsonFromText(text: string): Iterable<Record<string, unknown>> {
  let buffer = text.replace(/\r\n/g, '\n');
  let blockEnd = buffer.indexOf('\n\n');
  while (blockEnd !== -1) {
    const block = buffer.slice(0, blockEnd);
    buffer = buffer.slice(blockEnd + 2);
    const payload = flushOpenAISseEventBlock(block);
    if (payload) yield payload;
    blockEnd = buffer.indexOf('\n\n');
  }
  const trailing = flushOpenAISseEventBlock(buffer);
  if (trailing) yield trailing;
}

async function* iterateOpenAISseJson(
  response: Response,
  signal?: AbortSignal
): AsyncIterable<Record<string, unknown>> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      let blockEnd = buffer.indexOf('\n\n');
      while (blockEnd !== -1) {
        const block = buffer.slice(0, blockEnd);
        buffer = buffer.slice(blockEnd + 2);
        const payload = flushOpenAISseEventBlock(block);
        if (payload) yield payload;
        blockEnd = buffer.indexOf('\n\n');
      }
    }

    const trailing = flushOpenAISseEventBlock(buffer);
    if (trailing) yield trailing;
  } finally {
    reader.releaseLock();
  }
}

function toOpenAIApiTools(tools?: any[]): Array<Record<string, unknown>> | undefined {
  const normalized = normalizeTools(tools);
  if (!normalized?.length) return undefined;
  return normalized.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: normalizeProviderJsonSchema(
        tool.schema || tool.parameters || { type: 'object', properties: {} },
      ),
    }
  }));
}

/** Responses API tools — flat `{ type, name, parameters }` (lobehub `convertChatCompletionToolToResponseTool`). */
export function toResponsesApiTools(tools?: any[]): Array<Record<string, unknown>> | undefined {
  const normalized = normalizeTools(tools);
  if (!normalized?.length) return undefined;
  return normalized.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description || '',
    parameters: normalizeProviderJsonSchema(
      tool.schema || tool.parameters || { type: 'object', properties: {} },
    ),
  }));
}

function normalizeResponseBodyText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;

  const dataLines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]');
  if (dataLines.length > 0) {
    return dataLines[dataLines.length - 1];
  }

  return trimmed;
}

function extractOpenAIErrorMessage(text: string): string {
  const trimmed = text.trim();
  if (/<!DOCTYPE html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    const titleMatch = trimmed.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? '';
    if (/502|bad gateway/i.test(title) || /502|bad gateway/i.test(trimmed)) {
      const hostMatch = title.match(/^([^|]+)\s*\|/);
      const host = hostMatch?.[1]?.trim();
      return host
        ? `${host} 返回 502 Bad Gateway：上游服务不可用，请稍后重试或更换 API 接口地址`
        : '上游 API 网关返回 502 Bad Gateway，请稍后重试或更换接口地址';
    }
    if (title) return title;
    return '上游 API 返回 HTML 错误页面，请检查接口地址或联系 API 服务商';
  }

  const candidates: string[] = [];

  const jsonPrefix = text.match(/^(\{[\s\S]*?\})(?:event:|$)/);
  if (jsonPrefix?.[1]) {
    candidates.push(jsonPrefix[1]);
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data:')) {
      candidates.push(trimmed.slice(5).trim());
    }
  }

  candidates.push(normalizeResponseBodyText(text));

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as {
        error?: { message?: string; type?: string };
        message?: string;
      };
      if (parsed.error?.message) return parsed.error.message;
      if (parsed.message) return parsed.message;
    } catch {
      // try next candidate
    }
  }

  return trimmed;
}

export function parseOpenAIChatResponseText(text: string): AIResponse {
  const normalized = transformResponsesApiBody(normalizeResponseBodyText(text));
  const data = JSON.parse(normalized) as Record<string, unknown>;

  if (data.object === 'response') {
    return extractResponsesApiResult(data);
  }

  const choice = Array.isArray(data.choices)
    ? (data.choices[0] as Record<string, unknown>)
    : undefined;
  const message = choice?.message as Record<string, unknown> | undefined;
  const rawContent = message?.content;
  const content =
    rawContent == null
      ? ''
      : typeof rawContent === 'string'
        ? rawContent
        : JSON.stringify(rawContent);

  const rawToolCalls = message?.tool_calls;
  const tool_calls =
    Array.isArray(rawToolCalls) && rawToolCalls.length > 0
      ? rawToolCalls.map((tc: any) => ({
          id: tc.id || '',
          name: tc.function?.name || tc.name || '',
          arguments: tryParseJson(tc.function?.arguments ?? tc.arguments ?? {})
        }))
      : undefined;

  const result: AIResponse = { content };
  if (tool_calls?.length) {
    result.tool_calls = tool_calls;
  }
  const contextIds = extractProviderContextIds(data);
  if (contextIds.responseId) result.response_id = contextIds.responseId;
  if (contextIds.completionId) result.response_id = contextIds.completionId;
  if (contextIds.messageId) result.response_id = contextIds.messageId;
  const usage = parseOpenAIUsage(data.usage as Record<string, number> | undefined);
  if (usage) {
    result.usage = usage;
  }
  return result;
}

export type GeminiThinkingConfig = {
  includeThoughts: boolean;
  thinkingBudget?: number;
};

export class GeminiProvider implements AIProvider {
  name = 'Gemini';
  promptCacheCapability = resolvePromptCacheCapability('GEMINI');
  private apiUrl: string;
  private apiKey: string;
  private model: string;
  private thinkingConfig?: GeminiThinkingConfig;
  private builtinSearch: GeminiBuiltinSearchMode;
  public dispatcher?: any;

  constructor(
    apiUrl: string,
    apiKey: string,
    model: string,
    dispatcher?: any,
    thinkingConfig?: GeminiThinkingConfig,
    builtinSearch: GeminiBuiltinSearchMode = 'off',
  ) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.model = model;
    this.dispatcher = dispatcher;
    this.thinkingConfig = thinkingConfig;
    this.builtinSearch = builtinSearch;
    LogService.info(
      `[Gemini] Initialized with apiUrl: ${apiUrl}, model: ${model}, proxy: ${!!dispatcher}`
    );
  }

  private getLLM(tools?: any[]) {
    const resolvedThinking =
      this.thinkingConfig ??
      (this.model.includes('thinking')
        ? { includeThoughts: true, thinkingBudget: 32000 }
        : undefined);

    const llm = new ChatGoogleGenerativeAI({
      apiKey: this.apiKey,
      model: this.model,
      baseUrl: this.apiUrl || undefined,
      // @ts-ignore - Gemini thinking / thought summaries
      thinkingConfig: resolvedThinking
        ? {
            includeThoughts: resolvedThinking.includeThoughts,
            thinkingBudget: resolvedThinking.thinkingBudget ?? 32000,
          }
        : undefined,
    });

    const customTools = normalizeTools(tools) || [];
    const geminiBuiltinTools =
      this.builtinSearch === 'full' ? [{ google_search: {} }, { url_context: {} }] : [];

    return llm.bindTools([...geminiBuiltinTools, ...customTools] as any);
  }

  private toGeminiInput(
    prompt: string | AIMessage[],
    systemInstruction?: string
  ): string | BaseMessage[] {
    if (typeof prompt === 'string') {
      return toLangChainMessages(prompt, systemInstruction);
    }

    const transcript: string[] = [];
    if (systemInstruction) {
      transcript.push(`System: ${systemInstruction}`);
    }

    for (const message of prompt) {
      if (message.role === 'system') {
        transcript.push(`System: ${message.content || ''}`);
        continue;
      }

      if (message.role === 'assistant') {
        const toolCallsText = (message.tool_calls || [])
          .map(
            (toolCall: any) =>
              `ToolCall ${toolCall.name}: ${JSON.stringify(toolCall.arguments || {})}`
          )
          .join('\n');
        transcript.push(
          `Assistant: ${message.content || ''}${toolCallsText ? `\n${toolCallsText}` : ''}`
        );
        continue;
      }

      if (message.role === 'tool') {
        transcript.push(
          `Tool ${message.name || message.tool_call_id || 'unknown'} Result: ${message.content || ''}`
        );
        continue;
      }

      transcript.push(`User: ${message.content || ''}`);
    }

    return transcript.join('\n\n');
  }

  async generateContent(
    prompt: string | AIMessage[],
    tools: any[],
    systemInstruction?: string,
    options?: AIProviderCallOptions
  ): Promise<AIResponse> {
    const input = this.toGeminiInput(prompt, systemInstruction);
    const res = await this.getLLM(tools).invoke(
      input,
      options?.signal ? { signal: options.signal } : undefined
    );
    return attachPromptCacheUsage(fromLangChainMessage(res), options?.responseCache);
  }

  async *streamContent(
    prompt: string | AIMessage[],
    tools?: any[],
    systemInstruction?: string,
    options?: AIProviderCallOptions
  ): AsyncIterable<AIResponse> {
    const input = this.toGeminiInput(prompt, systemInstruction);
    const stream = await this.getLLM(tools).stream(
      input,
      options?.signal ? { signal: options.signal } : undefined
    );
    for await (const chunk of stream) {
      if (options?.signal?.aborted) break;
      yield attachPromptCacheUsage(fromLangChainMessage(chunk), options?.responseCache);
    }
  }

  async listModels(): Promise<string[]> {
    const url = `${this.apiUrl}/v1beta/models?key=${this.apiKey}`;
    const response = await fetch(url, { dispatcher: this.dispatcher });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }
    const data = (await response.json()) as any;
    return (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => m.name.replace('models/', ''));
  }
}

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  protected apiUrl: string;
  protected apiKey: string;
  protected model: string;
  protected apiEndpoint: OpenAIApiEndpointMode;
  protected reasoningEffort?: ReasoningEffort;
  public dispatcher?: any;

  get promptCacheCapability(): PromptCacheCapability {
    return resolvePromptCacheCapability(this.getProviderLabel(), this.apiEndpoint);
  }

  constructor(
    apiUrl: string,
    apiKey: string,
    model: string,
    dispatcher?: any,
    apiEndpoint: OpenAIApiEndpointMode = 'auto',
    reasoningEffort?: ReasoningEffort
  ) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.model = model;
    this.apiEndpoint = apiEndpoint || 'auto';
    this.reasoningEffort = reasoningEffort;
    this.dispatcher = dispatcher;
    LogService.info(
      `[OpenAI] Initialized with apiUrl: ${apiUrl}, model: ${model}, endpoint: ${this.apiEndpoint}, proxy: ${!!dispatcher}`
    );
  }

  protected resolveBaseUrl(): string {
    let base = this.apiUrl.replace(/\/$/, '');
    base = base.replace(/\/(chat\/completions?|responses|messages)$/i, '');
    return base.endsWith('/v1') ? base : `${base}/v1`;
  }

  protected passthroughEndpoint(): string {
    return this.apiUrl.replace(/\/$/, '');
  }

  protected isPassthroughEndpoint(): boolean {
    return this.apiEndpoint === 'passthrough';
  }

  protected getProviderLabel(): string {
    return 'OpenAI';
  }

  protected getLLM(tools?: any[]) {
    const llm = new ChatOpenAI({
      apiKey: this.apiKey,
      model: this.model,
      // Streaming still uses LangChain; generateContent uses dual-endpoint direct fetch.
      useResponsesApi: false,
      configuration: {
        baseURL: this.resolveBaseUrl(),
        fetch: getOpenAIFetch(this.getProviderLabel(), this.dispatcher)
      }
    });

    if (tools && tools.length > 0) {
      return llm.bindTools(normalizeTools(tools)!);
    }
    return llm;
  }

  protected responsesEndpoint(): string {
    if (this.isPassthroughEndpoint()) return this.passthroughEndpoint();
    return `${this.resolveBaseUrl()}/responses`;
  }

  protected chatCompletionsEndpoint(): string {
    if (this.isPassthroughEndpoint()) return this.passthroughEndpoint();
    return `${this.resolveBaseUrl()}/chat/completions`;
  }

  protected messagesEndpoint(): string {
    if (this.isPassthroughEndpoint()) return this.passthroughEndpoint();
    return `${this.resolveBaseUrl()}/messages`;
  }

  protected messagesApiHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      // Prompt caching requires the beta header on the native Anthropic API;
      // OpenAI-compatible /v1/messages gateways that proxy Claude also accept it.
      'anthropic-beta': 'prompt-caching-2024-07-31'
    };
  }

  protected async postMessagesApiJson(
    body: Record<string, unknown>,
    options?: { signal?: AbortSignal }
  ): Promise<AIResponse> {
    const url = this.messagesEndpoint();
    LogService.info(`[${this.getProviderLabel()}] POST ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: this.messagesApiHeaders(),
      body: JSON.stringify(body),
      dispatcher: this.dispatcher,
      signal: options?.signal
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} ${extractOpenAIErrorMessage(text)}`);
    }

    const data = JSON.parse(normalizeResponseBodyText(text)) as Record<string, unknown>;
    return extractMessagesApiResult(data);
  }

  protected async postOpenAIJson(
    url: string,
    body: Record<string, unknown>,
    options?: { signal?: AbortSignal }
  ): Promise<AIResponse> {
    LogService.info(`[${this.getProviderLabel()}] POST ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body),
      dispatcher: this.dispatcher,
      signal: options?.signal
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} ${extractOpenAIErrorMessage(text)}`);
    }

    return parseOpenAIChatResponseText(text);
  }

  protected resolveEndpointAttempts<T extends { label: string }>(attempts: T[]): T[] {
    switch (this.apiEndpoint) {
      case 'passthrough':
        return attempts.filter((attempt) => attempt.label === 'chat/completions');
      case 'chat_completions':
        return attempts.filter((attempt) => attempt.label === 'chat/completions');
      case 'responses':
        return attempts.filter((attempt) => attempt.label === 'responses');
      case 'messages':
        return attempts.filter((attempt) => attempt.label === 'messages');
      default:
        return attempts;
    }
  }

  /** Pin auto routing to the first successful endpoint for session affinity. */
  protected pinApiEndpoint(endpoint: OpenAIApiEndpointMode | string): void {
    if (this.apiEndpoint !== 'auto') return;
    const mapped =
      typeof endpoint === 'string' ? mapAttemptLabelToApiEndpoint(endpoint) : endpoint;
    if (!mapped || mapped === 'auto') return;
    this.apiEndpoint = mapped;
    LogService.info(
      `[${this.getProviderLabel()}] Pinned apiEndpoint=${mapped} for prompt-cache route affinity`
    );
  }

  getResolvedApiEndpoint(): OpenAIApiEndpointMode {
    return this.apiEndpoint;
  }

  protected async invokeCompatibleOpenAIEndpoints(
    prompt: string | AIMessage[],
    tools: any[],
    systemInstruction?: string,
    options?: AIProviderCallOptions
  ): Promise<AIResponse> {
    const allAttempts = [
      {
        label: 'chat/completions',
        url: this.chatCompletionsEndpoint(),
        body: buildChatCompletionsBody(
          this.model,
          prompt,
          tools,
          systemInstruction,
          this.reasoningEffort,
          options?.responseCache
        ),
        parse: (text: string) => parseOpenAIChatResponseText(text)
      },
      {
        label: 'responses',
        url: this.responsesEndpoint(),
        body: buildResponsesApiBody(
          this.model,
          prompt,
          tools,
          systemInstruction,
          this.reasoningEffort,
          options?.responseCache
        ),
        parse: (text: string) => parseOpenAIChatResponseText(text)
      },
      {
        label: 'messages',
        url: this.messagesEndpoint(),
        body: buildMessagesApiBody(
          this.model,
          prompt,
          tools,
          systemInstruction,
          this.reasoningEffort,
          options?.responseCache
        ),
        parse: (text: string) =>
          extractMessagesApiResult(JSON.parse(normalizeResponseBodyText(text)) as Record<string, unknown>)
      }
    ];
    const attempts = this.resolveEndpointAttempts(allAttempts);

    let lastError: Error | undefined;
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        LogService.info(`[${this.getProviderLabel()}] POST ${attempt.url}`);
        const response = await fetch(attempt.url, {
          method: 'POST',
          headers:
            attempt.label === 'messages'
              ? this.messagesApiHeaders()
              : {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${this.apiKey}`
                },
          body: JSON.stringify(attempt.body),
          dispatcher: this.dispatcher,
          signal: options?.signal
        });

        const text = await response.text();
        if (!response.ok) {
          throw new Error(`${response.status} ${extractOpenAIErrorMessage(text)}`);
        }

        this.pinApiEndpoint(attempt.label);
        return attachPromptCacheUsage(attempt.parse(text), options?.responseCache);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const hasAlternate = i < attempts.length - 1;
        if (!hasAlternate || !shouldTryAlternateOpenAIEndpoint(lastError)) {
          throw lastError;
        }
        LogService.warn(
          `[${this.getProviderLabel()}] ${attempt.label} failed for ${this.model}, trying alternate endpoint: ${lastError.message}`
        );
      }
    }

    throw lastError || new Error('AI request failed');
  }

  protected async chatCompletionsDirect(
    prompt: string | AIMessage[],
    tools: any[],
    systemInstruction?: string,
    options?: { signal?: AbortSignal }
  ): Promise<AIResponse> {
    return await this.invokeCompatibleOpenAIEndpoints(prompt, tools, systemInstruction, options);
  }

  async generateContent(
    prompt: string | AIMessage[],
    tools: any[],
    systemInstruction?: string,
    options?: AIProviderCallOptions
  ): Promise<AIResponse> {
    return await this.invokeCompatibleOpenAIEndpoints(prompt, tools, systemInstruction, options);
  }

  async *streamContent(
    prompt: string | AIMessage[],
    tools?: any[],
    systemInstruction?: string,
    options?: AIProviderCallOptions
  ): AsyncIterable<AIResponse> {
    const plans = this.resolveStreamPlans();
    let lastError: Error | undefined;

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      try {
        if (plan === 'responses') {
          yield* this.streamResponsesApiContent(prompt, tools, systemInstruction, options);
        } else if (plan === 'messages') {
          yield* this.streamMessagesApiContent(prompt, tools, systemInstruction, options);
        } else {
          yield* this.streamChatCompletionsApiContent(prompt, tools, systemInstruction, options);
        }
        this.pinApiEndpoint(plan);
        return;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const hasAlternate = i < plans.length - 1;
        if (!hasAlternate || !shouldTryAlternateOpenAIEndpoint(lastError)) {
          throw lastError;
        }
        LogService.warn(
          `[${this.getProviderLabel()}] ${plan} stream failed for ${this.model}, trying alternate endpoint: ${lastError.message}`
        );
      }
    }

    throw lastError || new Error('AI stream failed');
  }

  protected resolveStreamPlans(): OpenAIStreamPlan[] {
    return resolveStreamEndpointPlans({
      apiUrl: this.apiUrl,
      apiEndpoint: this.apiEndpoint,
      model: this.model,
      providerLabel: this.getProviderLabel(),
      reasoningEffort: this.reasoningEffort
    });
  }

  protected async *streamChatCompletionsApiContent(
    prompt: string | AIMessage[],
    tools: any[] | undefined,
    systemInstruction: string | undefined,
    options?: AIProviderCallOptions
  ): AsyncIterable<AIResponse> {
    const body: Record<string, unknown> = {
      ...buildChatCompletionsBody(
        this.model,
        prompt,
        tools ?? [],
        systemInstruction,
        this.reasoningEffort,
        options?.responseCache
      ),
      stream: true
    };
    applyReasoningRequestFields(body, this.reasoningEffort);

    const url = this.chatCompletionsEndpoint();
    LogService.info(`[${this.getProviderLabel()}] POST ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(body),
      dispatcher: this.dispatcher,
      signal: options?.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${extractOpenAIErrorMessage(text)}`);
    }

    const streamState = createChatCompletionsStreamParseState();
    let yieldedMeaningful = false;

    const emitParsed = (
      parsed: Partial<
        Pick<AIResponse, 'content' | 'reasoning' | 'response_id' | 'usage' | 'tool_calls'>
      > | null
    ): AIResponse | null => {
      if (!parsed) return null;
      const result: AIResponse = { content: parsed.content ?? '' };
      if (parsed.reasoning) result.reasoning = parsed.reasoning;
      if (typeof parsed.response_id === 'string') result.response_id = parsed.response_id;
      if (parsed.usage) result.usage = parsed.usage;
      if (parsed.tool_calls?.length) result.tool_calls = parsed.tool_calls;
      attachPromptCacheUsage(result, options?.responseCache);
      if (
        result.content?.trim() ||
        result.reasoning?.trim() ||
        (result.tool_calls?.length ?? 0) > 0
      ) {
        yieldedMeaningful = true;
      }
      if (
        result.content ||
        result.reasoning ||
        result.response_id ||
        result.usage ||
        result.tool_calls
      ) {
        return result;
      }
      return null;
    };

    // True streaming: read the SSE body incrementally instead of buffering the
    // whole response with `response.text()`. Buffering forced the entire
    // generation to finish before the first chunk could be yielded, which
    // combined with `emitPacedStreamChunks` produced a fake "token-by-token"
    // effect and made long outputs feel frozen until the very end.
    let usedStreamingSse = false;
    if (response.body) {
      for await (const payload of iterateOpenAISseJson(response, options?.signal)) {
        usedStreamingSse = true;
        if (options?.signal?.aborted) break;
        const result = emitParsed(parseChatCompletionsStreamPayload(payload, streamState));
        if (result) yield result;
      }
    }

    // Fallback: some OpenAI-compatible gateways ignore `stream: true` and
    // return a single JSON object. Re-read the body only when the streaming
    // path produced nothing meaningful.
    if (!usedStreamingSse && !yieldedMeaningful) {
      const rawBody = await response.text();
      if (rawBody.includes('data:')) {
        for (const payload of iterateOpenAISseJsonFromText(rawBody)) {
          if (options?.signal?.aborted) break;
          const result = emitParsed(parseChatCompletionsStreamPayload(payload, streamState));
          if (result) yield result;
        }
      } else if (rawBody.trim()) {
        try {
          const fallback = emitParsed(parseOpenAIChatResponseText(rawBody));
          if (fallback) yield fallback;
        } catch {
          // ignore malformed fallback body
        }
      }
    }

    if (streamState.completionId && !yieldedMeaningful) {
      yield { content: '', response_id: streamState.completionId };
    }
  }

  protected async *streamResponsesApiContent(
    prompt: string | AIMessage[],
    tools: any[] | undefined,
    systemInstruction: string | undefined,
    options?: AIProviderCallOptions
  ): AsyncIterable<AIResponse> {
    const body = buildResponsesApiBody(
      this.model,
      prompt,
      tools ?? [],
      systemInstruction,
      this.reasoningEffort,
      options?.responseCache
    );
    if (!body.reasoning && this.reasoningEffort && this.reasoningEffort !== 'none') {
      body.reasoning = {
        effort: this.reasoningEffort,
        summary: 'detailed'
      };
    }
    body.stream = true;

    const response = await fetch(this.responsesEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(body),
      dispatcher: this.dispatcher,
      signal: options?.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${extractOpenAIErrorMessage(text)}`);
    }

    const streamState = createResponsesStreamParseState();
    const chatStreamState = createChatCompletionsStreamParseState();
    for await (const payload of iterateOpenAISseJson(response, options?.signal)) {
      if (options?.signal?.aborted) break;
      const parsed =
        parseResponsesStreamPayload(payload, streamState) ??
        parseChatCompletionsStreamPayload(payload, chatStreamState);
      if (!parsed) continue;
      const result: AIResponse = { content: parsed.content ?? '' };
      if (parsed.reasoning) result.reasoning = parsed.reasoning;
      if ('response_id' in parsed && typeof parsed.response_id === 'string') {
        result.response_id = parsed.response_id;
      }
      if (parsed.usage) result.usage = parsed.usage;
      if (parsed.tool_calls?.length) result.tool_calls = parsed.tool_calls;
      attachPromptCacheUsage(result, options?.responseCache);
      if (
        result.content ||
        result.reasoning ||
        result.response_id ||
        result.usage ||
        result.tool_calls
      ) {
        yield result;
      }
    }

    if (streamState.responseId) {
      yield { content: '', response_id: streamState.responseId };
    }
  }

  protected async *streamMessagesApiContent(
    prompt: string | AIMessage[],
    tools: any[] | undefined,
    systemInstruction: string | undefined,
    options?: AIProviderCallOptions
  ): AsyncIterable<AIResponse> {
    const body = {
      ...buildMessagesApiBody(
        this.model,
        prompt,
        tools ?? [],
        systemInstruction,
        this.reasoningEffort,
        options?.responseCache
      ),
      stream: true
    };

    const response = await fetch(this.messagesEndpoint(), {
      method: 'POST',
      headers: {
        ...this.messagesApiHeaders(),
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(body),
      dispatcher: this.dispatcher,
      signal: options?.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${extractOpenAIErrorMessage(text)}`);
    }

    const messagesStreamState = createMessagesStreamParseState();
    const responsesStreamState = createResponsesStreamParseState();
    const chatStreamState = createChatCompletionsStreamParseState();
    for await (const payload of iterateOpenAISseJson(response, options?.signal)) {
      if (options?.signal?.aborted) break;
      const parsed =
        parseMessagesStreamPayload(payload, messagesStreamState) ??
        parseResponsesStreamPayload(payload, responsesStreamState) ??
        parseChatCompletionsStreamPayload(payload, chatStreamState);
      if (!parsed) continue;
      const result: AIResponse = { content: parsed.content ?? '' };
      if (parsed.reasoning) result.reasoning = parsed.reasoning;
      if (typeof parsed.response_id === 'string') result.response_id = parsed.response_id;
      if (parsed.usage) result.usage = parsed.usage;
      if (parsed.tool_calls?.length) result.tool_calls = parsed.tool_calls;
      attachPromptCacheUsage(result, options?.responseCache);
      if (
        result.content ||
        result.reasoning ||
        result.response_id ||
        parsed.usage ||
        result.tool_calls
      ) {
        yield result;
      }
    }

    if (messagesStreamState.messageId) {
      yield { content: '', response_id: messagesStreamState.messageId };
    }
  }

  async listModels(): Promise<string[]> {
    const url = `${this.resolveBaseUrl()}/models`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      dispatcher: this.dispatcher
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }
    const data = (await response.json()) as any;
    return (data.data || []).map((m: any) => m.id).sort();
  }
}

/** 智谱 GLM（OpenAI 兼容，但 base URL 已是 /v4，不能再追加 /v1） */
export class GLMProvider extends OpenAIProvider {
  name = 'GLM';

  constructor(
    apiUrl: string,
    apiKey: string,
    model: string,
    dispatcher?: any,
    apiEndpoint: OpenAIApiEndpointMode = 'auto',
    reasoningEffort?: ReasoningEffort
  ) {
    super(apiUrl, apiKey, model, dispatcher, apiEndpoint, reasoningEffort);
    LogService.info(
      `[GLM] Initialized with apiUrl: ${apiUrl}, model: ${model}, proxy: ${!!dispatcher}`
    );
  }

  protected override resolveBaseUrl(): string {
    return this.apiUrl.replace(/\/$/, '');
  }

  protected override getProviderLabel(): string {
    return 'GLM';
  }

  override async listModels(): Promise<string[]> {
    const url = `${this.resolveBaseUrl()}/models`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      dispatcher: this.dispatcher
    });
    if (!response.ok) {
      return ['glm-4-flash', 'glm-4-air', 'glm-4-plus', 'glm-4-long', 'glm-4.6', 'glm-4.7'];
    }
    const data = (await response.json()) as any;
    const models = (data.data || data.models || [])
      .map((m: any) => (typeof m === 'string' ? m : m.id))
      .filter(Boolean);
    return models.length > 0 ? models.sort() : ['glm-4-flash', 'glm-4-air', 'glm-4-plus'];
  }
}

export class AnthropicProvider extends OpenAIProvider {
  override name = 'Anthropic';

  constructor(
    apiUrl: string,
    apiKey: string,
    model: string,
    dispatcher?: any,
    apiEndpoint: OpenAIApiEndpointMode = 'messages',
    reasoningEffort?: ReasoningEffort
  ) {
    const resolvedEndpoint =
      apiEndpoint === 'passthrough'
        ? 'passthrough'
        : !apiEndpoint || apiEndpoint === 'auto' || apiEndpoint === 'chat_completions'
          ? 'messages'
          : apiEndpoint;
    super(apiUrl, apiKey, model, dispatcher, resolvedEndpoint, reasoningEffort);
    LogService.info(
      `[Anthropic] Initialized with apiUrl: ${apiUrl}, model: ${model}, endpoint: ${this.apiEndpoint}, proxy: ${!!dispatcher}`
    );
  }

  protected override getProviderLabel(): string {
    return 'Anthropic';
  }

  protected override resolveStreamPlans(): Array<'chat_completions' | 'responses' | 'messages'> {
    switch (this.apiEndpoint) {
      case 'passthrough':
        return ['chat_completions'];
      case 'chat_completions':
        return ['messages', 'chat_completions'];
      case 'responses':
        return ['responses', 'messages'];
      case 'messages':
      default:
        return ['messages', 'chat_completions'];
    }
  }
}

export class OllamaProvider implements AIProvider {
  name = 'Ollama';
  promptCacheCapability = resolvePromptCacheCapability('OLLAMA');
  private apiUrl: string;
  private model: string;
  public dispatcher?: any;

  constructor(apiUrl: string, model: string, dispatcher?: any) {
    this.apiUrl = apiUrl.replace(/\/$/, '') || 'http://localhost:11434';
    this.model = model;
    this.dispatcher = dispatcher;
    LogService.info(
      `[Ollama] Initialized with apiUrl: ${this.apiUrl}, model: ${model}, proxy: ${!!dispatcher}`
    );
  }

  private getLLM(tools?: any[]) {
    const llm = new ChatOllama({
      baseUrl: this.apiUrl,
      model: this.model
    });

    if (tools && tools.length > 0) {
      return llm.bindTools(normalizeTools(tools)!);
    }
    return llm;
  }

  async generateContent(
    prompt: string | AIMessage[],
    tools: any[],
    systemInstruction?: string,
    options?: AIProviderCallOptions
  ): Promise<AIResponse> {
    const messages = toLangChainMessages(prompt, systemInstruction);
    const res = await this.getLLM(tools).invoke(
      messages,
      options?.signal ? { signal: options.signal } : undefined
    );
    return attachPromptCacheUsage(fromLangChainMessage(res), options?.responseCache);
  }

  async *streamContent(
    prompt: string | AIMessage[],
    tools?: any[],
    systemInstruction?: string,
    options?: AIProviderCallOptions
  ): AsyncIterable<AIResponse> {
    const messages = toLangChainMessages(prompt, systemInstruction);
    const stream = await this.getLLM(tools).stream(
      messages,
      options?.signal ? { signal: options.signal } : undefined
    );
    for await (const chunk of stream) {
      if (options?.signal?.aborted) break;
      yield attachPromptCacheUsage(fromLangChainMessage(chunk), options?.responseCache);
    }
  }

  async listModels(): Promise<string[]> {
    const url = `${this.apiUrl}/api/tags`;
    const response = await fetch(url, { dispatcher: this.dispatcher });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error: ${response.status} ${errorText}`);
    }
    const data = (await response.json()) as any;
    return (data.models || []).map((m: any) => m.name);
  }
}

export function resolveDefaultApiEndpoint(
  type?: string
): 'chat_completions' | 'responses' | 'messages' | 'auto' {
  return type === 'CLAUDE' ? 'messages' : 'chat_completions';
}

export function createAIProvider(config: any, dispatcher?: any): AIProvider | null {
  if (!config) return null;
  const model = config.model || config.models?.[0];
  const defaultEndpoint = resolveDefaultApiEndpoint(config.type);

  switch (config.type) {
    case 'OPENAI':
      return new OpenAIProvider(
        config.apiUrl,
        config.apiKey,
        model,
        dispatcher,
        config.apiEndpoint || defaultEndpoint,
        config.reasoningEffort
      );
    case 'GLM':
      return new GLMProvider(
        config.apiUrl,
        config.apiKey,
        model,
        dispatcher,
        config.apiEndpoint || defaultEndpoint,
        config.reasoningEffort
      );
    case 'CLAUDE':
      return new AnthropicProvider(
        config.apiUrl,
        config.apiKey,
        model,
        dispatcher,
        config.apiEndpoint || defaultEndpoint,
        config.reasoningEffort
      );
    case 'OLLAMA':
      return new OllamaProvider(config.apiUrl, model, dispatcher);
    case 'GEMINI':
      return new GeminiProvider(
        config.apiUrl,
        config.apiKey,
        model,
        dispatcher,
        config.thinkingConfig,
        config.builtinSearch === 'full' ? 'full' : 'off',
      );
    default:
      return null;
  }
}
