import { memo } from 'react';

import { taskMessageStyles } from './specialMessageStyles';

/** §C.17 task message */
export const TaskMessage = memo(function TaskMessage({
  status,
  title,
  description,
}: {
  status: string;
  title: string;
  description: string;
}) {
  return (
    <div className={taskMessageStyles.root} data-msg-type="task">
      <div className={taskMessageStyles.head}>
        <span className={taskMessageStyles.status}>{status}</span>
        <span className={taskMessageStyles.title}>{title}</span>
      </div>
      <div className={taskMessageStyles.description}>{description}</div>
    </div>
  );
});
