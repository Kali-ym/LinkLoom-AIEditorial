import { preventDefault } from '@lobehub/ui';
import { Command } from 'cmdk';
import { Sparkles } from 'lucide-react';
import { memo, useMemo } from 'react';

import { useAgentListStore, useAgentStore } from '../../stores';
import { AgentAvatar } from '../../utils/agentAvatar';
import { useCommandMenuContext } from './CommandMenuContext';
import { commandStrings } from './commandStrings';
import { commandMenuStyles as styles } from './styles';

/** §C.41 `@` 提及助理*/
export const AskAgentCommands = memo(function AskAgentCommands() {
  const { search, setSearch, setSelectedAgent } = useCommandMenuContext();
  const agents = useAgentStore((s) => s.agents);
  const inboxAgentId = useAgentListStore((s) => s.inboxAgentId);

  const isAtMention = search.trimStart().startsWith('@');
  const mentionQuery = useMemo(() => {
    if (!isAtMention) return '';
    return search.trimStart().slice(1).toLowerCase();
  }, [isAtMention, search]);

  const inboxAgent = agents.find((agent) => agent.id === inboxAgentId);

  const filteredAgents = useMemo(() => {
    const rows = agents.filter(
      (agent) => agent.sessionType !== 'group' && agent.id !== inboxAgentId,
    );
    if (!mentionQuery) return rows.slice(0, 10);
    return rows.filter((agent) => agent.name.toLowerCase().includes(mentionQuery)).slice(0, 10);
  }, [agents, inboxAgentId, mentionQuery]);

  const showInbox =
    !mentionQuery || (inboxAgent?.name.toLowerCase().includes(mentionQuery) ?? false);

  if (!isAtMention) return null;

  return (
    <Command.Group heading={commandStrings.mentionHeading}>
      {showInbox ? (
        <Command.Item
          value={`@${inboxAgent?.name ?? commandStrings.inboxAgent}-${inboxAgentId}`}
          onMouseDown={preventDefault}
          onSelect={() => {
            setSelectedAgent({
              backgroundColor: inboxAgent?.gradient,
              id: inboxAgentId,
              title: inboxAgent?.name ?? commandStrings.inboxAgent,
            });
            setSearch('');
          }}
        >
          <AgentAvatar
            agent={{ id: inboxAgentId, name: inboxAgent?.name ?? commandStrings.inboxAgent }}
            background={inboxAgent?.gradient}
            size={18}
          />
          <div className={styles.itemContent}>
            <div className={styles.itemLabel}>@{inboxAgent?.name ?? commandStrings.inboxAgent}</div>
          </div>
        </Command.Item>
      ) : null}

      {filteredAgents.map((agent) => (
        <Command.Item
          key={agent.id}
          value={`@${agent.name}-${agent.id}`}
          onMouseDown={preventDefault}
          onSelect={() => {
            setSelectedAgent({
              backgroundColor: agent.gradient,
              id: agent.id,
              title: agent.name,
            });
            setSearch('');
          }}
        >
          <Sparkles className={styles.icon} />
          <div className={styles.itemContent}>
            <div className={styles.itemLabel}>@{agent.name}</div>
          </div>
        </Command.Item>
      ))}
    </Command.Group>
  );
});
