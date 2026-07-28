import { Command } from 'cmdk';
import { Bot, Image, Users } from 'lucide-react';
import { memo } from 'react';

import { useAgentListStore, useAgentStore } from '../../stores';
import { AgentAvatar } from '../../utils/agentAvatar';
import { useCommandMenuContext } from './CommandMenuContext';
import { CommandItem } from './components';
import { commandStrings } from './commandStrings';
import { commandMenuStyles as styles } from './styles';
import { useCommandMenu } from './useCommandMenu';

/** Cmd+K — ask inbox agent and related shortcuts */
export const AskAIMenu = memo(function AskAIMenu() {
  const {
    closeCommandMenu,
    handleAgentBuilder,
    handleAIPainting,
    handleAskInboxAgent,
    handleSelectAgentWithMessage,
  } = useCommandMenu();
  const { search } = useCommandMenuContext();
  const agents = useAgentStore((s) => s.agents);
  const inboxAgentId = useAgentListStore((s) => s.inboxAgentId);

  const agentRows = agents
    .filter((agent) => agent.sessionType !== 'group' && agent.id !== inboxAgentId)
    .slice(0, 20);

  const trimmed = search.trim();
  const heading = trimmed
    ? commandStrings.askAIHeading(`"${trimmed}"`)
    : commandStrings.askAIHeadingEmpty;

  const inboxAgent = agents.find((agent) => agent.id === inboxAgentId);

  const inboxLabel = inboxAgent?.name ?? commandStrings.inboxAgent;

  return (
    <Command.Group heading={heading}>
      <Command.Item value="inbox-agent" onSelect={handleAskInboxAgent}>
        <AgentAvatar
          agent={{ id: inboxAgentId, name: inboxLabel }}
          background={inboxAgent?.gradient}
          size={18}
        />
        <div className={styles.itemContent}>
          <div className={styles.itemLabel}>{inboxLabel}</div>
        </div>
      </Command.Item>

      <Command.Item value="agent-builder" onSelect={handleAgentBuilder}>
        <Bot className={styles.icon} />
        <div className={styles.itemContent}>
          <div className={styles.itemLabel}>{commandStrings.console.agentBuilder}</div>
        </div>
      </Command.Item>

      <Command.Item value="group-builder" onSelect={() => closeCommandMenu()}>
        <Users className={styles.icon} />
        <div className={styles.itemContent}>
          <div className={styles.itemLabel}>{commandStrings.console.groupBuilder}</div>
        </div>
      </Command.Item>

      <Command.Item value="ai-painting" onSelect={handleAIPainting}>
        <Image className={styles.icon} />
        <div className={styles.itemContent}>
          <div className={styles.itemLabel}>{commandStrings.aiPainting}</div>
        </div>
      </Command.Item>

      {agentRows.map((agent) => (
        <CommandItem
          key={agent.id}
          title={agent.name}
          trailingLabel={commandStrings.search.agent}
          value={`agent-${agent.id}`}
          variant="detailed"
          icon={<AgentAvatar agent={agent} background={agent.gradient} size={18} />}
          onSelect={() => handleSelectAgentWithMessage(agent.id)}
        />
      ))}
    </Command.Group>
  );
});
