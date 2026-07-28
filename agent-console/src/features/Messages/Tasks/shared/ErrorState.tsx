import { Alert, Flexbox, Highlighter } from '@lobehub/ui';
import { MessageSquare, Timer, Wrench } from 'lucide-react';
import { memo, useMemo } from 'react';

import type { TaskDetail } from '../../../../domain/types/taskMessage';
import { MetricItem, MetricSeparator, MetricsRow } from './MetricItem';
import { formatCost, formatDuration } from './utils';

function getErrorContent(error: Record<string, unknown> | undefined): string | null {
  if (!error) return null;
  const nested = error.error as { body?: unknown } | undefined;
  if (nested?.body) return JSON.stringify(nested.body, null, 2);
  if (error.body && typeof error.body === 'object') return JSON.stringify(error.body, null, 2);
  if (typeof error.message === 'string' && error.message !== '[object Object]') {
    return error.message;
  }
  const keys = Object.keys(error);
  if (keys.length > 0) return JSON.stringify(error, null, 2);
  return null;
}

/** §C.47*/
export const ErrorState = memo(function ErrorState({ taskDetail }: { taskDetail: TaskDetail }) {
  const { status, duration, totalToolCalls, totalMessages, totalCost, error } = taskDetail;
  const isCancelled = status === 'Cancel';
  const formattedDuration = useMemo(() => formatDuration(duration), [duration]);
  const formattedCost = useMemo(() => formatCost(totalCost), [totalCost]);
  const errorContent = useMemo(() => getErrorContent(error), [error]);
  const hasMetrics = Boolean(
    formattedDuration || totalToolCalls || totalMessages || formattedCost,
  );

  return (
    <Flexbox gap={12}>
      <Alert
        extra={
          errorContent ? (
            <Highlighter actionIconSize="small" language="json" padding={8} variant="borderless">
              {errorContent}
            </Highlighter>
          ) : undefined
        }
        title={isCancelled ? '任务已取消' : '任务失败'}
        type="secondary"
      />
      {hasMetrics ? (
        <MetricsRow>
          {formattedDuration ? <MetricItem icon={Timer} value={formattedDuration} /> : null}
          {totalToolCalls !== undefined && totalToolCalls > 0 ? (
            <>
              <MetricSeparator />
              <MetricItem icon={Wrench} label="次技能调用" value={totalToolCalls} />
            </>
          ) : null}
          {totalMessages !== undefined && totalMessages > 0 ? (
            <>
              <MetricSeparator />
              <MetricItem icon={MessageSquare} label="消息" value={totalMessages} />
            </>
          ) : null}
          {formattedCost ? (
            <>
              <MetricSeparator />
              <MetricItem value={formattedCost} />
            </>
          ) : null}
        </MetricsRow>
      ) : null}
    </Flexbox>
  );
});
