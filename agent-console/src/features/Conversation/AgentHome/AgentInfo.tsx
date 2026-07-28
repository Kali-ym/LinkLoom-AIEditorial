import { Flexbox, Markdown, Skeleton } from '@lobehub/ui';
import { memo } from 'react';

import { AGENT_HOME_AVATAR_SIZE } from '../../../constants/layoutTokens';
import { useAgentStore } from '../../../stores';
import { AgentAvatar } from '../../../utils/agentAvatar';
import { agentHomeStyles } from './agentHomeStyles';

/** §C.3 AgentInfo — 头像、名称、简介与欢迎语（内容来自 agent 配置） */
export const AgentInfo = memo(function AgentInfo() {
  const agent = useAgentStore((s) => s.getActiveAgent());
  const loading = useAgentStore((s) => s.agents.length === 0);

  if (loading) {
    return (
      <Flexbox className={agentHomeStyles.hero} gap={14}>
        <Skeleton.Avatar active shape="square" size={AGENT_HOME_AVATAR_SIZE} />
        <Skeleton.Button active style={{ height: 30, width: 220 }} />
        <Skeleton.Button active style={{ height: 18, width: 280 }} />
        <Flexbox width="min(100%, 480px)">
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        </Flexbox>
      </Flexbox>
    );
  }

  const description = agent.description?.trim();
  const welcome = agent.welcome?.trim();

  return (
    <header className={agentHomeStyles.hero}>
      <div className={agentHomeStyles.heroRow}>
        <div className={agentHomeStyles.avatarWrap}>
          <AgentAvatar
            agent={agent}
            background={agent.gradient}
            size={AGENT_HOME_AVATAR_SIZE}
          />
        </div>
        <div className={agentHomeStyles.heroCopy}>
          <h1 className={agentHomeStyles.title}>{agent.name}</h1>
          {description ? <p className={agentHomeStyles.subtitle}>{description}</p> : null}
        </div>
      </div>
      {welcome ? (
        <div className={agentHomeStyles.welcome}>
          <Markdown variant="chat">{welcome}</Markdown>
        </div>
      ) : null}
    </header>
  );
});
