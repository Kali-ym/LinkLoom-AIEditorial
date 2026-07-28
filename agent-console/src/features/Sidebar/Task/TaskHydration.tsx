import { memo, useLayoutEffect, useRef } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import { isAgentTaskRoute } from '../../../constants/agentConsoleRoutes';
import { useTaskStore, useTopicStore } from '../../../stores';

/**
 * URL `?task=` / `/task/:taskId` 与 taskStore 双向同步。
 * `task` 值为 task.identifier 或 task.id。
 */
export const TaskHydration = memo(function TaskHydration() {
  const { taskId: routeParam } = useParams<{ taskId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const routeTaskId = useTaskStore((s) => s.routeTaskId);
  const taskFromUrl = routeParam ?? searchParams.get('task') ?? '';
  const onTaskRoute = isAgentTaskRoute(pathname);
  const lastUrlTaskRef = useRef<string | null>(null);
  const lastStoreTaskRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const urlChanged = lastUrlTaskRef.current !== taskFromUrl;
    const storeChanged = lastStoreTaskRef.current !== routeTaskId;
    lastUrlTaskRef.current = taskFromUrl;
    lastStoreTaskRef.current = routeTaskId;

    if (taskFromUrl === routeTaskId) return;

    const task = useTaskStore.getState().findTaskByRouteId(taskFromUrl);

    if (urlChanged && taskFromUrl && task) {
      useTaskStore.getState().setRouteTaskId(taskFromUrl);
      useTaskStore.getState().selectTask(task.id);
      if (task.topicId) {
        useTopicStore.getState().selectTopic(task.topicId);
      }
      return;
    }

    if (onTaskRoute) return;

    if (storeChanged || (taskFromUrl && !task)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (routeTaskId) {
            if (next.get('task') === routeTaskId) return prev;
            next.set('task', routeTaskId);
          } else if (!next.has('task')) {
            return prev;
          } else {
            next.delete('task');
          }
          return next;
        },
        { replace: true },
      );
    }
  }, [onTaskRoute, routeTaskId, setSearchParams, taskFromUrl]);

  return null;
});
