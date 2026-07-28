import { AccordionItem, Block, Text } from '@lobehub/ui';
import { memo } from 'react';

import type { Message } from '../../../../domain/types';
import { ErrorState, InitializingState, TaskMessages, isProcessingStatus, isTaskErrorStatus } from '../shared';
import { countToolCalls, extractTaskBlocks } from '../shared/taskBlockUtils';
import { TaskTitle } from './TaskTitle';

/** §C.47*/
export const ClientTaskItem = memo(function ClientTaskItem({ item }: { item: Message }) {
  const { id, metadata, taskDetail, taskThreadMessages } = item;
  const title = taskDetail?.title ?? metadata?.taskTitle ?? item.taskTitle;
  const status = taskDetail?.status;
  const instruction = metadata?.instruction ?? taskDetail?.instruction;
  const blocks = extractTaskBlocks(taskThreadMessages);
  const hasBlocks = blocks.length > 0;
  const isInitializing = !status;
  const isProcessing = isProcessingStatus(status);
  const isError = isTaskErrorStatus(status);
  const isCompleted = status === 'Completed';

  const metrics =
    isProcessing && hasBlocks
      ? {
          startTime: taskDetail?.startTime,
          toolCalls: countToolCalls(blocks),
          steps: blocks.length,
        }
      : undefined;

  let body = null;
  if ((isInitializing || isProcessing) && !hasBlocks) {
    body = <InitializingState />;
  } else if ((isProcessing || isCompleted) && hasBlocks && taskThreadMessages) {
    body = (
      <TaskMessages
        duration={taskDetail?.duration}
        instruction={instruction}
        isProcessing={isProcessing}
        messageId={id}
        messages={taskThreadMessages}
        startTime={taskDetail?.startTime}
      />
    );
  } else if (isError && taskDetail) {
    body = <ErrorState taskDetail={taskDetail} />;
  }

  return (
    <AccordionItem
      expand
      itemKey={id}
      paddingBlock={4}
      paddingInline={4}
      title={<TaskTitle metrics={metrics} status={status} title={title} />}
    >
      <Block gap={16} padding={12} style={{ marginBlock: 8 }} variant="outlined">
        {instruction ? (
          <Text fontSize={13} type="secondary">
            {instruction}
          </Text>
        ) : null}
        {body}
      </Block>
    </AccordionItem>
  );
});
