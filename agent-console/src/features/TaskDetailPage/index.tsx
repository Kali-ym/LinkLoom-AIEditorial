import { Button, Flexbox, Icon, Skeleton, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { ChevronRight } from 'lucide-react';
import { memo, useEffect, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { agentConsoleChatPath } from '../../constants/agentConsoleRoutes';
import { useRouteAgentId } from '../../hooks/useRouteAgentId';
import { NavHeader } from '../NavHeader';
import { systemStatusSelectors } from '../../selectors/systemStatus';
import { useLayoutStore, useTaskStore } from '../../stores';
import { useTaskDetailPageStore } from '../../stores/taskDetailPageStore';
import { ToggleRightPanelButton } from '../../components/ToggleRightPanelButton';
import { TaskAgentPanel } from './TaskAgentPanel';
import { ArtifactPreviewModal } from './ArtifactPreviewModal';
import { TaskDetailRunPause } from './TaskDetailRunPause';
import { TaskActivities } from './TaskActivities';
import { TaskArtifacts } from './TaskArtifacts';
import { TaskSubtasks } from './TaskSubtasks';
import { TaskDetailTitleInput } from './TaskDetailTitleInput';
import { TopicChatDrawer } from './TopicChatDrawer';
import { taskDetailPageStrings } from './taskDetailPageStrings';

/** §C.54 / §C.55*/
export const TaskDetailPage = memo(function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const agentId = useRouteAgentId();
  const showTaskAgentPanel = useLayoutStore(systemStatusSelectors.showTaskAgentPanel);
  const toggleTaskAgentPanel = useLayoutStore((s) => s.toggleTaskAgentPanel);
  const detail = useTaskDetailPageStore((s) => s.detail);
  const isLoading = useTaskDetailPageStore((s) => s.isLoading);
  const isNotFound = useTaskDetailPageStore((s) => s.isNotFound);
  const load = useTaskDetailPageStore((s) => s.load);
  const reset = useTaskDetailPageStore((s) => s.reset);
  const setRouteTaskId = useTaskStore((s) => s.setRouteTaskId);
  const selectTask = useTaskStore((s) => s.selectTask);

  useEffect(() => {
    if (!taskId) return;
    setRouteTaskId(taskId);
    const task = useTaskStore.getState().findTaskByRouteId(taskId);
    if (task) selectTask(task.id);
    void load(taskId);
    return () => reset();
  }, [load, reset, selectTask, setRouteTaskId, taskId]);

  if (!taskId) return null;

  if (isNotFound && !isLoading) {
    return (
      <Flexbox flex={1} gap={16} padding={48} align="center" justify="center">
        <Text style={{ fontSize: 18, fontWeight: 600 }}>{taskDetailPageStrings.notFoundTitle}</Text>
        <Text type="secondary">{taskDetailPageStrings.notFoundDesc}</Text>
        <Button type="primary" onClick={() => agentId && navigate(agentConsoleChatPath(agentId))}>
          {taskDetailPageStrings.backToTasks}
        </Button>
      </Flexbox>
    );
  }

  return (
    <Flexbox horizontal flex={1} height="100%" style={{ minWidth: 0, minHeight: 0 }}>
      <Flexbox flex={1} height="100%" style={{ minWidth: 0, minHeight: 0 }}>
        <NavHeader
          left={
            <Flexbox horizontal align="center" gap={4}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: cssVar.colorTextSecondary,
                  cursor: 'pointer',
                  padding: 0,
                }}
                onClick={() => agentId && navigate(agentConsoleChatPath(agentId))}
              >
                任务
              </button>
              <Icon color={cssVar.colorTextQuaternary} icon={ChevronRight} size={14} />
              <Text type="secondary">{detail?.identifier ?? taskId}</Text>
            </Flexbox>
          }
          right={
            <ToggleRightPanelButton
              expand={showTaskAgentPanel}
              hideWhenExpanded
              onToggle={() => toggleTaskAgentPanel()}
            />
          }
        />
        <Flexbox flex={1} padding={24} style={{ overflowY: 'auto' }}>
          {isLoading || !detail ? (
            <Skeleton active paragraph={{ rows: 10 }} title />
          ) : (
            <Flexbox gap={24} style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
              <TaskDetailTitleInput />
              <Flexbox horizontal align="center" justify="space-between" wrap="wrap" gap={12}>
                <TaskDetailRunPause />
                <TopicChatDrawer />
              </Flexbox>
              <Section title={taskDetailPageStrings.properties}>
                <Flexbox horizontal gap={24} wrap="wrap">
                  <Meta label={taskDetailPageStrings.model} value={detail.model ?? '—'} />
                  <Meta label={taskDetailPageStrings.assignee} value={detail.assignee ?? '—'} />
                  {detail.parentLabel ? (
                    <Meta label={taskDetailPageStrings.parent} value={detail.parentLabel} />
                  ) : null}
                </Flexbox>
              </Section>
              <Section title={taskDetailPageStrings.instruction}>
                <Text>{detail.instruction}</Text>
              </Section>
              <Section title={taskDetailPageStrings.subtasks}>
                <TaskSubtasks />
              </Section>
              <Section title={taskDetailPageStrings.artifacts}>
                <TaskArtifacts />
              </Section>
              <Section title={taskDetailPageStrings.activities}>
                <TaskActivities />
              </Section>
            </Flexbox>
          )}
        </Flexbox>
      </Flexbox>
      <TaskAgentPanel />
      <ArtifactPreviewModal />
    </Flexbox>
  );
});

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Flexbox gap={4}>
      <Text fontSize={12} type="secondary">
        {label}
      </Text>
      <Text>{value}</Text>
    </Flexbox>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Flexbox gap={8}>
      <Text style={{ fontWeight: 600 }}>{title}</Text>
      {children}
    </Flexbox>
  );
}
