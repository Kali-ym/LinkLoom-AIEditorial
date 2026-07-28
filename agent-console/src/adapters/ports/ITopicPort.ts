import type { Topic, TopicThread } from '../../domain/types';
import type {
  FetchAgentTopicsViewParams,
  FetchAgentTopicsViewResult,
  TopicImportPayload,
} from '../types';

export interface TopicSidebarData {
  topics: Topic[];
  threadsByTopicId: Record<string, TopicThread[]>;
  elapsedByTopicId: Record<string, string>;
}

export interface ITopicPort {
  getActiveTopicId(): Promise<string>;
  /** 单次请求拉取侧栏话题 + 线程 + 耗时（避免 listTopics/threads/elapsed 各打一遍 agent-runs）。 */
  getTopicSidebar(agentId: string): Promise<TopicSidebarData>;
  listTopics(agentId: string): Promise<Topic[]>;
  getThreadsByTopicId(): Promise<Record<string, TopicThread[]>>;
  getElapsedByTopicId(): Promise<Record<string, string>>;
  getThreads(topicId: string): Promise<TopicThread[]>;
  getElapsed(topicId: string): Promise<string | undefined>;
  renameTopic(topicId: string, title: string): Promise<void>;
  saveSnapshot(topicId: string): Promise<void>;
  batchMove(topicIds: string[], targetAgentId: string): Promise<void>;
  persistImport(
    payload: TopicImportPayload,
    fileName: string,
  ): Promise<{ id: string; title: string }>;
  deleteTopic(topicId: string): Promise<void>;
  parseImportJson(raw: string): TopicImportPayload;
  fetchTopicsViewPage(params: FetchAgentTopicsViewParams): Promise<FetchAgentTopicsViewResult>;
}
