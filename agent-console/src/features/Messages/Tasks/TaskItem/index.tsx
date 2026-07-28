import { memo } from 'react';

import type { Message } from '../../../../domain/types';
import { ClientTaskItem } from './ClientTaskItem';
import { ServerTaskItem } from './ServerTaskItem';

/** §C.47*/
export const TaskItem = memo(function TaskItem({ item }: { item: Message }) {
  if (item.taskDetail?.clientMode) return <ClientTaskItem item={item} />;
  return <ServerTaskItem item={item} />;
});
