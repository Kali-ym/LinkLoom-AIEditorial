import { ActionIcon, Flexbox } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { ChevronDown } from 'lucide-react';
import { memo } from 'react';

import { useLayoutStore, useRouteStore, useTopicStore } from '../../../../stores';
import { useIsGroupSession } from '../../../../hooks/useSession';
import { headerStyles } from '../styles';
import { FolderTag } from './FolderTag';
import { MemberCountTag } from './MemberCountTag';

/** §C.15 Tags*/
export const Tags = memo(function Tags() {
  const isGroupSession = useIsGroupSession();
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);
  const toggleMobileTopicModal = useLayoutStore((s) => s.toggleMobileTopicModal);
  const chatTitle = useRouteStore((s) => s.chatTitle);
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const topics = useTopicStore((s) => s.topics);
  const topic = useTopicStore((s) => s.topics.find((t) => t.id === activeTopicId));

  const topicTitle = topic?.title ?? chatTitle;
  const topicCount = topics.filter((t) => t.status !== 'temp').length;

  if (isMobileViewport && !isGroupSession) {
    return (
      <Flexbox
        allowShrink
        horizontal
        align="center"
        gap={4}
        style={{ cursor: 'pointer', marginLeft: 8, minWidth: 0 }}
        onClick={() => toggleMobileTopicModal()}
      >
        <span className={headerStyles.tagTitle}>
          {topicTitle}
          {topicCount > 0 ? ` (${topicCount})` : ''}
        </span>
        <ActionIcon
          active
          icon={ChevronDown}
          size={{ blockSize: 14, borderRadius: '50%', size: 12 }}
          style={{
            background: cssVar.colorFillSecondary,
            color: cssVar.colorTextDescription,
            flexShrink: 0,
          }}
        />
      </Flexbox>
    );
  }

  if (isGroupSession) {
    return (
      <Flexbox allowShrink horizontal align="center" gap={12} style={{ marginLeft: 8, minWidth: 0 }}>
        <MemberCountTag />
      </Flexbox>
    );
  }

  return (
    <Flexbox
      allowShrink
      horizontal
      align="center"
      gap={6}
      style={{ marginLeft: 8, minWidth: 0 }}
    >
      <span className={headerStyles.tagTitle}>{topicTitle}</span>
      <FolderTag />
    </Flexbox>
  );
});
