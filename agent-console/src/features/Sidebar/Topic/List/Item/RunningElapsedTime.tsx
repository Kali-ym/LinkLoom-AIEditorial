import { memo } from 'react';

import { useTopicStore } from '../../../../../stores';
import { topicItemStyles } from './topicItemStyles';

interface RunningElapsedTimeProps {
  topicId: string;
}

export const RunningElapsedTime = memo(function RunningElapsedTime({
  topicId,
}: RunningElapsedTimeProps) {
  const elapsed = useTopicStore((s) => s.elapsedByTopicId[topicId]);
  if (!elapsed) return null;
  return <span className={topicItemStyles.runningElapsedTime}>{elapsed}</span>;
});
