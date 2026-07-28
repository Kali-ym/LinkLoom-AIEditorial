import { batchMoveTopicsToAgentApi } from '../topicMoveAdapter';
import { parseTopicImportJson } from '../topicImportAdapter';
import { persistImportedTopic, renameTopicApi, saveTopicSnapshot } from '../topicPersistAdapter';
import { fetchAgentTopicsView } from '../topicsViewApiAdapter';
import type { ITopicPort } from '../ports/ITopicPort';
import {
  getMockActiveTopicId,
  getMockElapsedByTopicId,
  getMockThreadsByTopicId,
  getMockTopics,
} from './seeds/topicSeed';

export const mockTopicPort: ITopicPort = {
  async getActiveTopicId() {
    return getMockActiveTopicId();
  },

  async getTopicSidebar(agentId) {
    return {
      topics: getMockTopics(agentId),
      threadsByTopicId: getMockThreadsByTopicId(),
      elapsedByTopicId: getMockElapsedByTopicId(),
    };
  },

  async listTopics(agentId) {
    return getMockTopics(agentId);
  },

  async getThreadsByTopicId() {
    return getMockThreadsByTopicId();
  },

  async getElapsedByTopicId() {
    return getMockElapsedByTopicId();
  },

  async getThreads(topicId) {
    return getMockThreadsByTopicId()[topicId] ?? [];
  },

  async getElapsed(topicId) {
    return getMockElapsedByTopicId()[topicId];
  },

  renameTopic: renameTopicApi,
  saveSnapshot: saveTopicSnapshot,
  batchMove: batchMoveTopicsToAgentApi,
  persistImport: persistImportedTopic,
  deleteTopic: async () => undefined,
  parseImportJson: parseTopicImportJson,
  fetchTopicsViewPage: fetchAgentTopicsView,
};
