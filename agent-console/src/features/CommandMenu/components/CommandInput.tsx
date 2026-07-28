import { Tag } from '@lobehub/ui';
import { Command } from 'cmdk';
import { ArrowLeft } from 'lucide-react';
import { memo, useMemo } from 'react';

import { useAgentStore } from '../../../stores';
import { AgentAvatar } from '../../../utils/agentAvatar';
import { useCommandMenuContext } from '../CommandMenuContext';
import { commandStrings } from '../commandStrings';
import { commandMenuStyles as styles } from '../styles';
import { useCommandMenu } from '../useCommandMenu';

/** §C.41*/
export const CommandInput = memo(function CommandInput() {
  const { handleBack } = useCommandMenu();
  const {
    activeAgentId,
    menuContext,
    pages,
    page,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    selectedAgent,
    setSelectedAgent,
  } = useCommandMenuContext();

  const activeAgent = useAgentStore((s) =>
    activeAgentId ? s.agents.find((agent) => agent.id === activeAgentId) : undefined,
  );

  const hasPages = pages.length > 0;
  const hasSelectedAgent = !!selectedAgent;
  const hasActiveAgent = !!activeAgentId && menuContext === 'agent';

  const typeLabel = useMemo(() => {
    if (!typeFilter) return '';
    return commandStrings.search[typeFilter as keyof typeof commandStrings.search] ?? typeFilter;
  }, [typeFilter]);

  const placeholder = hasSelectedAgent
    ? commandStrings.askAgentPlaceholder(selectedAgent.title)
    : page === 'ask-ai'
      ? commandStrings.aiModePlaceholder
      : commandStrings.searchPlaceholder;

  const contextName = commandStrings.context[menuContext] ?? menuContext;

  return (
    <>
      {(menuContext !== 'general' || typeFilter) && !hasPages && !hasSelectedAgent ? (
        <div className={styles.contextWrapper}>
          {hasActiveAgent ? (
            <Tag
              className={styles.contextTag}
              icon={
                activeAgent ? (
                  <AgentAvatar agent={activeAgent} background={activeAgent.gradient} size={14} />
                ) : (
                  '?'
                )
              }
            >
              {activeAgent?.name ?? commandStrings.defaultAgent}
            </Tag>
          ) : menuContext !== 'general' ? (
            <Tag className={styles.contextTag}>{contextName}</Tag>
          ) : null}
          {typeFilter ? (
            <Tag className={styles.backTag} closable onClose={() => setTypeFilter(undefined)}>
              {typeLabel}
            </Tag>
          ) : null}
        </div>
      ) : null}

      <div className={styles.inputWrapper}>
        {hasPages && !hasSelectedAgent ? (
          <Tag className={styles.backTag} icon={<ArrowLeft size={12} />} onClick={handleBack} />
        ) : null}
        {hasSelectedAgent ? (
          <Tag closable onClose={() => setSelectedAgent(undefined)}>
            {selectedAgent.title}
          </Tag>
        ) : null}
        <Command.Input
          autoFocus
          maxLength={500}
          placeholder={placeholder}
          value={search}
          onValueChange={setSearch}
        />
        {page !== 'ask-ai' && !hasSelectedAgent && search.trim() ? (
          <>
            <span style={{ fontSize: 14, opacity: 0.6 }}>{commandStrings.askAI}</span>
            <Tag>{commandStrings.keyboard.Tab}</Tag>
          </>
        ) : (
          <Tag>{commandStrings.keyboard.ESC}</Tag>
        )}
      </div>
    </>
  );
});
