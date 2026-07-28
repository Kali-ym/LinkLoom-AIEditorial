import { Flexbox } from '@lobehub/ui';
import { memo, useMemo } from 'react';

import { NavHeader } from '../../NavHeader';
import { OpenInAppButton } from '../../OpenInAppButton';
import { useAgentStore, useTopicStore } from '../../../stores';
import { HeaderActions } from './HeaderActions';
import { ShareButton } from './ShareButton';
import { Tags } from './Tags';
import { WorkingPanelToggle } from './WorkingPanelToggle';
import { headerStyles } from './styles';

/** §C.15 ChatHeader — NavHeader 44px + Tags / HeaderActions / OpenInApp / Share / WorkingPanel */
export const ChatHeader = memo(function ChatHeader() {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const topicWorkingDirectory = useTopicStore(
    (s) => s.topics.find((t) => t.id === activeTopicId)?.workingDirectory,
  );
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const agents = useAgentStore((s) => s.agents);
  const isLocalSystemEnabled = useMemo(
    () => Boolean(agents.find((a) => a.id === activeAgentId)?.isLocalSystemEnabled),
    [activeAgentId, agents],
  );
  const effectiveWorkingDirectory = useMemo(() => {
    const agent = agents.find((a) => a.id === activeAgentId);
    return topicWorkingDirectory || agent?.workingDirectory || '';
  }, [activeAgentId, agents, topicWorkingDirectory]);

  return (
    <>
      <div className={headerStyles.container} data-region="chat-header">
        <NavHeader
        left={
          <Flexbox
            allowShrink
            horizontal
            align="center"
            className={headerStyles.leftContent}
            gap={4}
          >
            <Tags />
            <HeaderActions />
          </Flexbox>
        }
        right={
          <Flexbox
            horizontal
            align="center"
            className="chat-header-actions"
            gap={4}
          >
            {isLocalSystemEnabled && (
              <OpenInAppButton workingDirectory={effectiveWorkingDirectory} />
            )}
            <ShareButton />
            <WorkingPanelToggle />
          </Flexbox>
        }
        slotClassNames={{
          left: headerStyles.slotLeft,
          right: headerStyles.slotRight,
        }}
      />
      </div>
    </>
  );
});
