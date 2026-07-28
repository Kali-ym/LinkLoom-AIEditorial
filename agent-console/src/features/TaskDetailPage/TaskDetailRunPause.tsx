import { Button, Flexbox } from '@lobehub/ui';
import { Pause, Play } from 'lucide-react';
import { memo, useCallback } from 'react';

import type { TaskStatus } from '../../domain/types/task';
import { showToast } from '../../services/ui/toast';
import { useTaskDetailPageStore } from '../../stores/taskDetailPageStore';
import { taskDetailPageStrings } from './taskDetailPageStrings';

/** §C.54*/
export const TaskDetailRunPause = memo(function TaskDetailRunPause() {
  const detail = useTaskDetailPageStore((s) => s.detail);
  const setRunStatus = useTaskDetailPageStore((s) => s.setRunStatus);

  const toggle = useCallback(() => {
    if (!detail) return;
    const next: TaskStatus = detail.status === 'running' ? 'paused' : 'running';
    setRunStatus(next);
    showToast(
      next === 'running'
        ? taskDetailPageStrings.runStarted
        : taskDetailPageStrings.runPaused,
    );
  }, [detail, setRunStatus]);

  if (!detail) return null;

  const isRunning = detail.status === 'running';

  return (
    <Flexbox horizontal gap={8}>
      <Button icon={isRunning ? Pause : Play} type="primary" onClick={toggle}>
        {isRunning ? taskDetailPageStrings.pause : taskDetailPageStrings.run}
      </Button>
    </Flexbox>
  );
});
