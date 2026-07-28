import type { Topic } from '../../domain/types';
import { topicBelongsToAgent } from './topicAgentScope';
import {
  getAllClientTopics,
  getClientTopic,
  isClientOnlyTopicId,
  removeClientTopic,
  type ClientTopicRecord,
} from './clientTopicStorage';

function isEmptyTempDraft(record: ClientTopicRecord): boolean {
  return (
    isClientOnlyTopicId(record.id) &&
    record.messages.length === 0 &&
    !(record.seedMessages?.length ?? 0)
  );
}

function recordBelongsToAgent(record: ClientTopicRecord, agentId: string): boolean {
  if (!agentId) return true;
  if (record.agentId) return record.agentId === agentId;
  return true;
}

/** 每个 agent 只保留一个空 temp 草稿；删除其余 sessionStorage 记录。 */
export function pruneEmptyTempClientTopicsForAgent(
  agentId: string,
  keepTopicId?: string,
): void {
  if (!agentId) return;
  for (const record of getAllClientTopics()) {
    if (!recordBelongsToAgent(record, agentId)) continue;
    if (!isEmptyTempDraft(record)) continue;
    if (keepTopicId && record.id === keepTopicId) continue;
    removeClientTopic(record.id);
  }
}

export function findEmptyTempClientTopicForAgent(agentId: string): ClientTopicRecord | undefined {
  if (!agentId) return undefined;
  return getAllClientTopics().find(
    (record) => recordBelongsToAgent(record, agentId) && isEmptyTempDraft(record),
  );
}

export function clientRecordToTempTopic(record: ClientTopicRecord, agentId: string): Topic {
  return {
    id: record.id,
    title: record.title,
    status: 'temp',
    tag: '临时',
    agentId: record.agentId ?? agentId,
    active: false,
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
  };
}

export function dedupeEmptyTempTopicsForAgent(topics: Topic[], agentId: string): Topic[] {
  if (!agentId) return topics;

  let keptEmptyTempId: string | undefined;
  const result: Topic[] = [];

  for (const topic of topics) {
    const client = getClientTopic(topic.id);
    const isEmptyTemp =
      topic.status === 'temp' &&
      isClientOnlyTopicId(topic.id) &&
      (client ? isEmptyTempDraft(client) : !client);

    if (!isEmptyTemp || !topicBelongsToAgent(topic, agentId)) {
      result.push(topic);
      continue;
    }

    if (!keptEmptyTempId) {
      keptEmptyTempId = topic.id;
      result.push(topic);
      continue;
    }

    removeClientTopic(topic.id);
  }

  if (keptEmptyTempId) {
    pruneEmptyTempClientTopicsForAgent(agentId, keptEmptyTempId);
  }

  return result;
}
