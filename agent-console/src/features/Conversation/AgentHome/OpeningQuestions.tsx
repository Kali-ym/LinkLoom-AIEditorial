import { memo } from 'react';
import { ArrowUpRight } from 'lucide-react';

import { sendUserMessage } from '../../../services/streaming/sendMessage';
import { useAgentStore, useRouteStore, useTopicStore } from '../../../stores';
import { agentHomeStyles } from './agentHomeStyles';

const MAX_OPENING_QUESTIONS = 5;

/** §C.3 OpeningQuestions — 展示 agent.openingQuestions，无配置时不渲染 */
export const OpeningQuestions = memo(function OpeningQuestions() {
  const agent = useAgentStore((s) => s.getActiveAgent());
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const questions = (agent.openingQuestions ?? [])
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, MAX_OPENING_QUESTIONS);

  if (questions.length === 0) return null;

  const handleQuestion = (q: string) => {
    useRouteStore.getState().showConversation(q);
    void sendUserMessage(activeTopicId, q);
  };

  return (
    <section aria-label="快捷开始" className={agentHomeStyles.promptsPanel}>
      <div className={agentHomeStyles.promptsPanelHeader}>
        <h2 className={agentHomeStyles.promptsTitle}>快捷开始</h2>
        <p className={agentHomeStyles.promptsHint}>点选问题立即开始对话</p>
      </div>
      <ul className={agentHomeStyles.promptList}>
        {questions.map((q, index) => (
          <li key={q}>
            <button
              className={agentHomeStyles.promptButton}
              style={{ animationDelay: `${index * 50}ms` }}
              type="button"
              onClick={() => handleQuestion(q)}
            >
              <span className={agentHomeStyles.promptIndex}>{index + 1}</span>
              <span className={agentHomeStyles.promptText}>{q}</span>
              <ArrowUpRight aria-hidden className={agentHomeStyles.promptIcon} size={15} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
});
