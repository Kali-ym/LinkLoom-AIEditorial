import { memo } from 'react';

import { AgentInfo } from './AgentInfo';
import { agentHomeStyles } from './agentHomeStyles';
import { OpeningQuestions } from './OpeningQuestions';
import { ToolAuthAlert } from './ToolAuthAlert';

/** §C.3 AgentHome — 新话题空态欢迎区 */
export const AgentHome = memo(function AgentHome({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <section
      aria-label="新话题"
      className={agentHomeStyles.root}
      id="agentHome"
    >
      <div aria-hidden className={agentHomeStyles.ambient} />
      <div className={agentHomeStyles.content}>
        <AgentInfo />
        <OpeningQuestions />
        <ToolAuthAlert />
        <p className={agentHomeStyles.footerHint}>
          在下方输入框描述任务，或使用 <kbd className={agentHomeStyles.kbd}>@</kbd> 指派给其他智能体
        </p>
      </div>
    </section>
  );
});
