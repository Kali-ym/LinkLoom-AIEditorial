import { Block, Flexbox, Icon, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { Footprints, ListChecks, Wrench, X } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { NeuralNetworkLoading } from '../../../../components/NeuralNetworkLoading';
import type { TaskDetail } from '../../../../domain/types/taskMessage';
import { formatDuration, formatElapsedTime, isProcessingStatus } from '../shared/utils';

export interface TaskMetrics {
  duration?: number;
  isLoading?: boolean;
  startTime?: number;
  steps?: number;
  toolCalls?: number;
}

const TaskStatusIndicator = memo(function TaskStatusIndicator({
  status,
}: {
  status?: TaskDetail['status'];
}) {
  const isCompleted = status === 'Completed';
  const isError = status === 'Failed' || status === 'Cancel';
  const isProcessing = status ? isProcessingStatus(status) : false;
  const isInitializing = !status;

  let icon = null;
  if (isCompleted) icon = <Icon color={cssVar.colorSuccess} icon={ListChecks} size={12} />;
  else if (isError) icon = <Icon color={cssVar.colorError} icon={X} size={12} />;
  else if (isProcessing || isInitializing) icon = <NeuralNetworkLoading size={16} />;
  else return null;

  return (
    <Block horizontal align="center" flex="none" height={24} justify="center" variant="outlined" width={24}>
      {icon}
    </Block>
  );
});

const MetricsDisplay = memo(function MetricsDisplay({
  metrics,
  status,
}: {
  metrics: TaskMetrics;
  status?: TaskDetail['status'];
}) {
  const { steps, toolCalls, startTime, duration, isLoading } = metrics;
  const [elapsedTime, setElapsedTime] = useState(0);
  const isProcessing = status ? isProcessingStatus(status) : false;

  useEffect(() => {
    if (startTime && isProcessing) setElapsedTime(Math.max(0, Date.now() - startTime));
  }, [isProcessing, startTime]);

  useEffect(() => {
    if (!startTime || !isProcessing) return;
    const timer = setInterval(() => setElapsedTime(Math.max(0, Date.now() - startTime)), 1000);
    return () => clearInterval(timer);
  }, [isProcessing, startTime]);

  if (isLoading) return null;
  const hasSteps = steps !== undefined && steps > 0;
  const hasToolCalls = toolCalls !== undefined && toolCalls > 0;
  const hasTime = isProcessing ? startTime !== undefined : duration !== undefined;
  if (!hasSteps && !hasToolCalls && !hasTime) return null;

  return (
    <Flexbox horizontal align="center" gap={8}>
      {hasSteps ? (
        <Flexbox horizontal align="center" gap={2}>
          <Icon color={cssVar.colorTextTertiary} icon={Footprints} size={12} />
          <Text fontSize={12} type="secondary">
            {steps}
          </Text>
        </Flexbox>
      ) : null}
      {hasToolCalls ? (
        <Flexbox horizontal align="center" gap={2}>
          <Icon color={cssVar.colorTextTertiary} icon={Wrench} size={12} />
          <Text fontSize={12} type="secondary">
            {toolCalls}
          </Text>
        </Flexbox>
      ) : null}
      {hasTime ? (
        <Text fontSize={12} type="secondary">
          {isProcessing
            ? formatElapsedTime(elapsedTime)
            : duration
              ? `（用时 ${formatDuration(duration)}）`
              : null}
        </Text>
      ) : null}
    </Flexbox>
  );
});

/** §C.47*/
export const TaskTitle = memo(function TaskTitle({
  metrics,
  status,
  title,
}: {
  metrics?: TaskMetrics;
  status?: TaskDetail['status'];
  title?: string;
}) {
  return (
    <Flexbox horizontal align="center" gap={6} style={{ minWidth: 0 }}>
      <TaskStatusIndicator status={status} />
      <Text ellipsis fontSize={14}>
        {title}
      </Text>
      {metrics ? <MetricsDisplay metrics={metrics} status={status} /> : null}
    </Flexbox>
  );
});
