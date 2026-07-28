/**
 * Agent Console 状态作用域约定：
 *
 * - **Agent 级**：话题列表、工具/技能/MCP 绑定（plusState.plugins）、文档树、沙箱/执行目标
 * - **Topic 级**：会话消息、模型选择、工作区 todos/plan/网页、工作目录 override
 *
 * Store 中跨 agent 的 Map（如 messagesByTopicId、plusStateByAgentId）可以保留全量缓存，
 * 但 UI 与 hydrate 必须只暴露当前 agent / 当前 topic 的数据。
 */

export type TopicModelSelection = {
  model: string;
  provider: string;
};
