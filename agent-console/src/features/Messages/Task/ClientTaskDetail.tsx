import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import type { Message } from '../../../domain/types';
import { BubblesLoading } from '../../../components/BubblesLoading';
import { InitializingState } from '../Tasks/shared/InitializingState';
import { TaskMessages } from '../Tasks/shared/TaskMessages';
import { isProcessingStatus } from '../Tasks/shared/utils';

/** §C.47*/
export const ClientTaskDetail = memo(function ClientTaskDetail({ message }: { message: Message }) {
  const { id, metadata, taskDetail, taskThreadMessages } = message;
  const status = taskDetail?.status;
  const instruction = metadata?.instruction ?? taskDetail?.instruction;
  const messages = taskThreadMessages;

  if (!messages) {
    return (
      <Flexbox horizontal align="center" gap={4}>
        <BubblesLoading />
      </Flexbox>
    );
  }

  const blocks = messages.flatMap((m) => m.children ?? []);
  if (blocks.length === 0 && !messages.some((m) => m.content)) {
    return <InitializingState showProgress={false} />;
  }

  return (
    <TaskMessages
      instruction={instruction}
      isProcessing={isProcessingStatus(status)}
      messageId={id}
      messages={messages}
      startTime={taskDetail?.startTime}
    />
  );
});
