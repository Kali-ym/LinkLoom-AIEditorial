import { memo } from 'react';

import type { Message } from '../../../domain/types';
import { ErrorState, InitializingState, TaskMessages, isProcessingStatus, isTaskErrorStatus } from '../Tasks/shared';

/** §C.47*/
export const StatusContent = memo(function StatusContent({ message }: { message: Message }) {
  const { id, metadata, taskDetail, taskThreadMessages } = message;
  const status = taskDetail?.status;
  const instruction = metadata?.instruction ?? taskDetail?.instruction;
  const isError = isTaskErrorStatus(status);
  const messages = taskThreadMessages;

  if (!status) return <InitializingState />;

  if (messages && messages.length > 0) {
    return (
      <>
        <TaskMessages
          duration={taskDetail?.duration}
          instruction={instruction}
          isProcessing={isProcessingStatus(status)}
          messageId={id}
          messages={messages}
          startTime={taskDetail?.startTime}
        />
        {isError && taskDetail ? <ErrorState taskDetail={taskDetail} /> : null}
      </>
    );
  }

  return <InitializingState />;
});
