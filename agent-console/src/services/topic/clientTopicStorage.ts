import type { Message } from '../../domain/types';

const STORAGE_KEY = 'agentConsole:clientTopics';
const LEGACY_STORAGE_KEY = 'agentConsole:forkTopics';

export interface ClientTopicRecord {
  id: string;
  title: string;
  sourceTopicId?: string;
  agentId?: string;
  messages: Message[];
  /** fork 时继承的不可变上下文；后端仅持久化新轮次，刷新时需与 API 合并。 */
  seedMessages?: Message[];
  createdAt: string;
}

function readAll(): Record<string, ClientTopicRecord> {
  try {
    const raw =
      sessionStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ClientTopicRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(records: Record<string, ClientTopicRecord>): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  sessionStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function saveClientTopic(record: ClientTopicRecord): void {
  const all = readAll();
  all[record.id] = record;
  writeAll(all);
}

export function getClientTopic(id: string): ClientTopicRecord | undefined {
  return readAll()[id];
}

export function getForkSeedMessages(topicId: string): Message[] {
  const record = getClientTopic(topicId);
  if (!record) return [];
  return record.seedMessages ?? record.messages ?? [];
}

export function getAllClientTopics(): ClientTopicRecord[] {
  return Object.values(readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function removeClientTopic(id: string): void {
  const all = readAll();
  if (!all[id]) return;
  delete all[id];
  writeAll(all);
}

/** 尚未落库后端、仅存在于客户端 seed 的话题。 */
export function isClientOnlyTopicId(topicId: string): boolean {
  if (!topicId) return false;
  if (getClientTopic(topicId)) return true;
  return topicId.startsWith('temp-') || topicId.startsWith('fork-');
}

export function isEphemeralTopicId(topicId: string): boolean {
  return isClientOnlyTopicId(topicId);
}
