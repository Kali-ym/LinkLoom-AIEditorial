import { createHash } from 'crypto';
import type { AIMessage } from '../../../types/index.js';

export const CANONICAL_MESSAGE_SERIALIZATION_VERSION = 'canonical-message-v1' as const;

export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export interface CanonicalToolCall {
  id?: string;
  name?: string;
  arguments: CanonicalJsonValue | string;
}

export interface CanonicalAIMessage {
  serializationVersion: typeof CANONICAL_MESSAGE_SERIALIZATION_VERSION;
  role: AIMessage['role'];
  content: CanonicalJsonValue;
  name?: string;
  tool_call_id?: string;
  tool_calls?: CanonicalToolCall[];
  reasoning?: string;
  raw_parts?: CanonicalJsonValue[];
}

export interface CanonicalMessageOptions {
  keepReasoning?: boolean;
  keepRawParts?: boolean;
}

export function canonicalizeAIMessage(
  message: AIMessage,
  options: CanonicalMessageOptions = {}
): CanonicalAIMessage {
  const canonical: CanonicalAIMessage = {
    serializationVersion: CANONICAL_MESSAGE_SERIALIZATION_VERSION,
    role: message.role,
    content: sortJsonValue(message.content)
  };

  if (typeof message.name === 'string' && message.name.length > 0) {
    canonical.name = message.name;
  }
  if (typeof message.tool_call_id === 'string' && message.tool_call_id.length > 0) {
    canonical.tool_call_id = message.tool_call_id;
  }

  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    canonical.tool_calls = message.tool_calls.map(canonicalizeToolCall);
  }

  if (
    options.keepReasoning &&
    typeof message.reasoning === 'string' &&
    message.reasoning.length > 0
  ) {
    canonical.reasoning = message.reasoning;
  }
  if (options.keepRawParts && Array.isArray(message.raw_parts) && message.raw_parts.length > 0) {
    canonical.raw_parts = message.raw_parts.map((part) => sortJsonValue(part));
  }

  return canonical;
}

export function canonicalizeAIMessages(
  messages: AIMessage[],
  options: CanonicalMessageOptions = {}
): CanonicalAIMessage[] {
  return messages.map((message) => canonicalizeAIMessage(message, options));
}

export function canonicalizeToolDefinitions(tools: unknown[]): CanonicalJsonValue[] {
  return sortToolDefinitions(tools)
    .map((tool) => sortJsonValue(tool))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

export function sortToolDefinitions<T>(tools: T[]): T[] {
  return [...tools].sort((left, right) =>
    stableStringify(left).localeCompare(stableStringify(right))
  );
}

export function canonicalMessageString(
  messages: AIMessage[],
  options: CanonicalMessageOptions = {}
): string {
  return stableStringify(canonicalizeAIMessages(messages, options));
}

export function canonicalMessageHash(
  messages: AIMessage[],
  options: CanonicalMessageOptions = {}
): string {
  return hashString(canonicalMessageString(messages, options));
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value)) ?? 'null';
}

export function hashString(value: string, length = 32): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, length);
}

export function sortJsonValue(value: unknown): CanonicalJsonValue {
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJsonValue(child)])
    );
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
}

function canonicalizeToolCall(value: unknown): CanonicalToolCall {
  if (!isRecord(value)) {
    return { arguments: sortJsonValue(value) };
  }

  const args = value.arguments ?? value.args ?? {};
  const result: CanonicalToolCall = {
    arguments: typeof args === 'string' ? args : sortJsonValue(args)
  };
  if (typeof value.id === 'string' && value.id.length > 0) result.id = value.id;
  if (typeof value.name === 'string' && value.name.length > 0) result.name = value.name;
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
