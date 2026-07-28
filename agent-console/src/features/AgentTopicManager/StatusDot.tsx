import { memo } from 'react';
import { cssVar, useTheme } from 'antd-style';

import { RingLoadingIcon } from '../../components/RingLoadingIcon';
import type { TopicViewItem } from '../../domain/types/topicView';

/** §C.53*/
export const StatusDot = memo(function StatusDot({ topic }: { topic: TopicViewItem }) {
  const { isDarkMode } = useTheme();
  const status = topic.status;

  if (status === 'running') {
    return (
      <RingLoadingIcon
        size={12}
        ringColor={isDarkMode ? cssVar.colorWarningBorder : cssVar.colorWarning}
        style={{ color: cssVar.colorWarning }}
      />
    );
  }

  const color =
    status === 'completed'
      ? cssVar.colorTextQuaternary
      : status === 'failed'
        ? cssVar.colorError
        : status === 'unread'
          ? cssVar.colorPrimary
          : cssVar.colorSuccess;

  return (
    <span
      style={{
        background: color,
        borderRadius: '50%',
        display: 'inline-block',
        height: 8,
        width: 8,
      }}
    />
  );
});
