import React, { useMemo } from 'react';
import { useAgentRunLive } from '../../../hooks/useAgentRunLive';
import type { AgentRunReplayResult } from '../../../services/agentService';
import {
  compareAgentEventTimelines,
  projectAgentTimeline,
  type AgentEventComparisonRow,
  type AgentTimelineProjection
} from '../../../utils/agentEvents';

interface ReplayComparePanelProps {
  result: AgentRunReplayResult;
  onClose: () => void;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function outputText(output?: { content?: string; data?: unknown } | null): string {
  if (!output) return '暂无输出';
  if (output.content) return output.content;
  if (output.data !== undefined) return JSON.stringify(output.data, null, 2);
  return '暂无输出';
}

function isTimelineProjection(value: AgentTimelineProjection | undefined): value is AgentTimelineProjection {
  return value != null;
}

function ReplayCompareContent({ result }: { result: AgentRunReplayResult }) {
  const originalEvents = result.original.events;
  const originalOut = outputText(result.original.output);

  const { detail, events: replayEvents, loading, liveMode } = useAgentRunLive(result.replayRunId!);
  const replayOut = outputText(detail?.output);
  const eventRows = useMemo(
    () => compareAgentEventTimelines(originalEvents, replayEvents),
    [originalEvents, replayEvents]
  );
  const originalTimeline = useMemo(() => eventRows.map((row) => row.original).filter(isTimelineProjection), [eventRows]);
  const replayTimeline = useMemo(() => eventRows.map((row) => row.replay).filter(isTimelineProjection), [eventRows]);
  const outputDiffers = originalOut !== replayOut;

  return (
    <div className="grid flex-1 grid-cols-2 divide-x divide-hairline overflow-hidden dark:divide-border-dark">
      <CompareColumn title="原始 Run" status={result.original.status}>
        <EventList events={originalTimeline} diffRows={eventRows} side="original" />
        <OutputBlock content={originalOut} differs={outputDiffers} />
      </CompareColumn>

      <CompareColumn
        title="Replay Run"
        status={detail?.status || result.replayStatus || 'running'}
        loading={loading}
        liveMode={liveMode}
      >
        <EventList events={replayTimeline} diffRows={eventRows} side="replay" />
        <OutputBlock content={replayOut} differs={outputDiffers} />
      </CompareColumn>
    </div>
  );
}

export const ReplayComparePanel: React.FC<ReplayComparePanelProps> = ({ result, onClose }) => {
  const originalEvents = result.original.events;
  const originalOut = outputText(result.original.output);
  const originalTimeline = useMemo(() => projectAgentTimeline(originalEvents), [originalEvents]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 dark:bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-surface-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4 dark:border-border-dark">
          <div>
            <h3 className="text-base font-semibold text-text-ink dark:text-white">Replay 对比</h3>
            <p className="mt-0.5 text-xs text-text-slate dark:text-text-secondary">
              原始 {result.originalRunId.slice(-12)}
              {result.replayRunId ? ` · Replay ${result.replayRunId.slice(-12)}` : ' · 未启动重跑'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-soft dark:hover:bg-white/10">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {result.replayRunId ? (
          <ReplayCompareContent result={result} />
        ) : (
          <div className="grid flex-1 grid-cols-2 divide-x divide-hairline overflow-hidden dark:divide-border-dark">
            <CompareColumn title="原始 Run" status={result.original.status}>
              <EventList events={originalTimeline} diffRows={[]} side="original" />
              <OutputBlock content={originalOut} differs={false} />
            </CompareColumn>
            <CompareColumn title="Replay Run" status="—">
              <p className="py-8 text-center text-sm text-text-slate dark:text-text-secondary">
                无法重跑：缺少 agentId 或输入
              </p>
            </CompareColumn>
          </div>
        )}
      </div>
    </div>
  );
};

function CompareColumn({
  title,
  status,
  loading,
  liveMode,
  children
}: {
  title: string;
  status: string;
  loading?: boolean;
  liveMode?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-hairline bg-white px-4 py-2 dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-ink dark:text-white">{title}</span>
          <span className="text-xs text-text-slate dark:text-text-secondary">
            {status}
            {loading ? ' · 加载中' : ''}
            {liveMode === 'sse' ? ' · SSE' : liveMode === 'poll' ? ' · 轮询' : ''}
          </span>
        </div>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}

function EventList({
  events,
  diffRows,
  side
}: {
  events: AgentTimelineProjection[];
  diffRows: AgentEventComparisonRow[];
  side: 'original' | 'replay';
}) {
  if (events.length === 0) {
    return <p className="text-xs text-text-slate dark:text-text-secondary">无事件</p>;
  }

  const diffKeys = new Set(
    diffRows
      .filter((row) => row.differs)
      .map((row) => (side === 'original' ? row.original?.id : row.replay?.id))
      .filter(Boolean)
  );

  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-slate dark:text-text-secondary">
        事件链 ({events.length})
      </h4>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {events.map((ev) => {
          const isDiff = diffKeys.has(ev.id);
          return (
            <div
              key={ev.id}
              className={`rounded px-2 py-1 text-xs ${
                isDiff
                  ? 'bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700/40'
                  : 'hover:bg-surface-soft/40 dark:hover:bg-white/[0.03]'
              }`}
            >
              <span className="font-mono text-text-slate dark:text-text-secondary">{formatTimestamp(ev.timestamp)}</span>
              <span className="ml-2 font-medium text-text-ink dark:text-white">{ev.type}</span>
              {ev.summary && (
                <span className="ml-2 text-text-slate dark:text-text-secondary" title={ev.payloadTitle}>
                  {ev.summary}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OutputBlock({ content, differs }: { content: string; differs: boolean }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-slate dark:text-text-secondary">
        输出 {differs && <span className="text-amber-600">· 有差异</span>}
      </h4>
      <pre
        className={`max-h-48 overflow-auto whitespace-pre-wrap rounded-lg p-3 text-xs ${
          differs
            ? 'bg-amber-50 dark:bg-amber-900/20'
            : 'bg-surface-soft dark:bg-canvas/50'
        }`}
      >
        {content}
      </pre>
    </section>
  );
}
