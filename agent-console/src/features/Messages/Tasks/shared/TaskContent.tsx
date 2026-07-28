import { Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import { BubblesLoading } from '../../../../components/BubblesLoading';
import type { TaskDetail, TaskThreadMessage } from '../../../../domain/types/taskMessage';
import { ErrorState } from './ErrorState';
import { InitializingState } from './InitializingState';
import { TaskMessages } from './TaskMessages';
import { isProcessingStatus } from './utils';

export const TaskContent = memo(function TaskContent({
  id,
  instruction,
  isError,
  messages,
  status,
  taskDetail,
}: {
  id: string;
  instruction?: string;
  isError: boolean;
  messages?: TaskThreadMessage[];
  status?: TaskDetail['status'];
  taskDetail?: TaskDetail;
}) {
  const isProcessing = isProcessingStatus(status);

  if (!messages?.length) {
    if (isProcessing) return <InitializingState />;
    return (
      <Flexbox horizontal align="center" gap={4}>
        <BubblesLoading />
        <Text type="secondary">正在获取详情...</Text>
      </Flexbox>
    );
  }

  return (
    <>
      <TaskMessages
        duration={taskDetail?.duration}
        instruction={instruction ?? taskDetail?.instruction}
        isProcessing={isProcessing}
        messageId={id}
        messages={messages}
        startTime={taskDetail?.startTime}
      />
      {isError && taskDetail ? <ErrorState taskDetail={taskDetail} /> : null}
    </>
  );
});
