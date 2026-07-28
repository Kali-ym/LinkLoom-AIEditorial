import { AccordionItem, Block } from '@lobehub/ui';
import { memo, useMemo, useState } from 'react';

import type { Message } from '../../../../domain/types';
import { TaskContent } from '../shared';
import { isTaskErrorStatus } from '../shared/utils';
import { TaskTitle, type TaskMetrics } from './TaskTitle';

/** §C.47*/
export const ServerTaskItem = memo(function ServerTaskItem({ item }: { item: Message }) {
  const { id, metadata, taskDetail, taskThreadMessages } = item;
  const [expanded, setExpanded] = useState(false);
  const title = taskDetail?.title ?? metadata?.taskTitle ?? item.taskTitle;
  const status = taskDetail?.status;
  const isCompleted = status === 'Completed';
  const isError = isTaskErrorStatus(status);

  const metrics: TaskMetrics | undefined = useMemo(() => {
    if (isCompleted || isError) {
      return {
        duration: taskDetail?.duration,
        steps: taskDetail?.totalSteps,
        toolCalls: taskDetail?.totalToolCalls,
      };
    }
    return undefined;
  }, [isCompleted, isError, taskDetail?.duration, taskDetail?.totalSteps, taskDetail?.totalToolCalls]);

  return (
    <AccordionItem
      expand={expanded}
      itemKey={id}
      paddingBlock={4}
      paddingInline={4}
      title={<TaskTitle metrics={metrics} status={status} title={title} />}
      onExpandChange={setExpanded}
    >
      <Block gap={16} padding={12} style={{ marginBlock: 8 }} variant="outlined">
        {expanded ? (
          <TaskContent
            id={id}
            instruction={metadata?.instruction ?? taskDetail?.instruction}
            isError={isError}
            messages={taskThreadMessages}
            status={status}
            taskDetail={taskDetail}
          />
        ) : null}
      </Block>
    </AccordionItem>
  );
});
