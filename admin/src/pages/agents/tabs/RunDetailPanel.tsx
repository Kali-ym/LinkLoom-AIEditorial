import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAgentRunLive } from '../../../hooks/useAgentRunLive';
import { agentService } from '../../../services/agentService';
import { projectAgentTimeline } from '../../../utils/agentEvents';
import type {
  AgentHitlAction,
  AgentHitlRequest,
  AgentRun,
  AgentRunArtifact,
  AgentRunCheckpoint,
  AgentRunMessage,
  AgentRunOutput
} from '../../../services/agentService';

type DetailSection =
  | 'timeline'
  | 'trace'
  | 'output'
  | 'checkpoints'
  | 'artifacts'
  | 'workspace'
  | 'messages';

interface RunDetailPanelProps {
  run: AgentRun;
  onClose: () => void;
  onApprove?: (permissionId: string, reason?: string) => void;
  onReject?: (permissionId: string, reason?: string) => void;
  onCancel?: () => void;
  onArchive?: () => void;
  onRetry?: () => void;
  onReplay?: () => void;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

function formatDuration(ms?: number): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

function formatJson(value: unknown): string {
  if (value == null) return '暂无数据';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function outputContent(output?: AgentRunOutput | null, fallback?: string): string {
  if (output?.content) return output.content;
  if (output?.data !== undefined) return formatJson(output.data);
  return fallback || '暂无输出';
}

const SECTION_LABELS: Array<{ id: DetailSection; label: string; icon: string }> = [
  { id: 'timeline', label: '事件时间线', icon: 'timeline' },
  { id: 'trace', label: 'Trace', icon: 'account_tree' },
  { id: 'output', label: '输出', icon: 'article' },
  { id: 'checkpoints', label: 'Checkpoint', icon: 'save' },
  { id: 'artifacts', label: 'Artifact', icon: 'attach_file' },
  { id: 'workspace', label: 'Workspace', icon: 'folder' },
  { id: 'messages', label: '消息', icon: 'forum' },
];

export const RunDetailPanel: React.FC<RunDetailPanelProps> = ({
  run,
  onClose,
  onApprove,
  onReject,
  onCancel,
  onArchive,
  onRetry,
  onReplay
}) => {
  const { detail: liveDetail, events, loading: liveLoading, liveMode, error: liveError } =
    useAgentRunLive(run.runId);
  const detail = liveDetail ?? run;
  const [activeSection, setActiveSection] = useState<DetailSection>('timeline');
  const [trace, setTrace] = useState<unknown>(run.output?.trace ?? null);
  const [approvalReason, setApprovalReason] = useState('');
  const [hitlState, setHitlState] = useState<AgentHitlRequest | null>(null);
  const [hitlInput, setHitlInput] = useState('');
  const [hitlBusy, setHitlBusy] = useState(false);
  const [lazyArtifacts, setLazyArtifacts] = useState<AgentRunArtifact[] | null>(null);
  const [lazyMessages, setLazyMessages] = useState<AgentRunMessage[] | null>(null);
  const [artifactDetails, setArtifactDetails] = useState<Record<string, unknown>>({});
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const checkpoints = detail.checkpoints ?? [];
  const artifacts = lazyArtifacts ?? detail.artifacts ?? detail.output?.artifacts ?? [];
  const messages = lazyMessages ?? detail.messages ?? [];
  const permissionId = (detail.pendingPermission as any)?.permissionId;
  const fullOutput = outputContent(detail.output, detail.outputPreview);
  const timeline = useMemo(() => projectAgentTimeline(events), [events]);

  const sectionCounts = useMemo(
    () => ({
      timeline: detail.eventCount ?? timeline.length,
      trace: trace ? 1 : 0,
      output: detail.output || detail.outputPreview ? 1 : 0,
      checkpoints: checkpoints.length,
      artifacts: artifacts.length,
      workspace: detail.workspace ? 1 : 0,
      messages: messages.length,
    }),
    [artifacts.length, checkpoints.length, detail, timeline.length, messages.length, trace]
  );

  useEffect(() => {
    if (detail.output?.trace != null) {
      setTrace((current: unknown) => current ?? detail.output?.trace ?? null);
    }
  }, [detail.output?.trace]);

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]);

  useEffect(() => {
    if (detail.status !== 'paused') {
      setHitlState(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const state = await agentService.getRunHitl(detail.runId);
        if (!cancelled) setHitlState(state.pendingHitl);
      } catch {
        if (!cancelled) setHitlState(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detail.runId, detail.status]);

  const loadArtifacts = async () => {
    if (lazyArtifacts) return;
    const data = await agentService.getRunArtifacts(detail.runId);
    setLazyArtifacts(data);
  };

  const loadMessages = async () => {
    if (lazyMessages) return;
    const data = await agentService.getRunMessages(detail.runId);
    setLazyMessages(data);
  };

  const loadArtifactDetail = async (artifactId: string) => {
    if (artifactDetails[artifactId]) return;
    const data = await agentService.getRunArtifact(detail.runId, artifactId);
    setArtifactDetails((prev) => ({ ...prev, [artifactId]: data }));
  };

  const resolveHitl = async (action: AgentHitlAction) => {
    if (!hitlState?.requestId) return;
    setHitlBusy(true);
    try {
      await agentService.resolveRunHitl(detail.runId, hitlState.requestId, {
        action,
        kind: hitlState.kind,
        input: hitlInput.trim() ? hitlInput.trim() : undefined,
        reason: approvalReason.trim() || undefined
      });
      setHitlState(null);
      setHitlInput('');
    } finally {
      setHitlBusy(false);
    }
  };

  const loadTrace = async () => {
    if (!trace) {
      const data = await agentService.getAgentRunTrace(detail.runId);
      setTrace(data);
    }
    setActiveSection('trace');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/20 dark:bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-3xl overflow-y-auto bg-white shadow-2xl dark:bg-surface-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-hairline bg-white dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-text-ink dark:text-white">Run 详情</h3>
              <p className="mt-0.5 truncate font-mono text-xs text-text-slate dark:text-text-secondary">
                {detail.runId}
              </p>
              {liveError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{liveError}</p>}
              {liveMode !== 'idle' && (
                <p className="mt-1 text-xs text-text-slate dark:text-text-secondary">
                  {liveMode === 'sse' ? '● 实时 SSE' : '● 轮询兜底'}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {['running', 'paused', 'queued'].includes(detail.status) && onCancel && (
                <button
                  onClick={onCancel}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  取消运行
                </button>
              )}
              {['failed', 'cancelled'].includes(detail.status) && onRetry && (
                <button
                  onClick={onRetry}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                >
                  重试
                </button>
              )}
              {['succeeded', 'failed', 'cancelled'].includes(detail.status) && onArchive && (
                <button
                  onClick={onArchive}
                  className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-text-ink hover:bg-surface-soft dark:border-border-dark dark:text-white dark:hover:bg-white/10"
                >
                  归档
                </button>
              )}
              {onReplay && (
                <button
                  onClick={onReplay}
                  className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-text-ink hover:bg-surface-soft dark:border-border-dark dark:text-white dark:hover:bg-white/10"
                >
                  Replay
                </button>
              )}
              <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-soft dark:hover:bg-white/10">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-5 pb-4 text-sm md:grid-cols-4">
            <MetaItem label="状态" value={detail.status} />
            <MetaItem label="来源" value={detail.source} />
            <MetaItem label="智能体" value={detail.agentId || '-'} mono />
            <MetaItem label="工作流" value={detail.workflowId || '-'} mono />
            <MetaItem label="耗时" value={formatDuration(detail.durationMs)} />
            <MetaItem label="轮次" value={detail.roundCount} />
            <MetaItem label="工具调用" value={detail.toolCallCount} />
            <MetaItem label="事件" value={detail.eventCount ?? events.length} />
            <MetaItem label="Checkpoint" value={checkpoints.length} />
            <MetaItem label="Artifact" value={artifacts.length} />
            <MetaItem label="创建" value={formatTimestamp(detail.createdAt)} />
            <MetaItem label="更新" value={formatTimestamp(detail.updatedAt)} />
            {detail.stopReason && <MetaItem label="停止原因" value={detail.stopReason} />}
            {detail.error && (
              <div className="col-span-2 break-all text-red-600 dark:text-red-400 md:col-span-4">
                错误：{detail.error}
              </div>
            )}
          </div>
        </div>

        {detail.status === 'paused' && hitlState && !permissionId && (
          <div className="border-b border-hairline bg-violet-50 px-5 py-3 dark:border-border-dark dark:bg-violet-900/10">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-violet-600">person_alert</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-violet-900 dark:text-violet-100">
                  HITL 待处理（{hitlState.kind}）
                </p>
                {hitlState.prompt && (
                  <p className="mt-1 text-xs text-violet-800 dark:text-violet-200">{hitlState.prompt}</p>
                )}
              </div>
            </div>
            {(hitlState.kind === 'needs_input' || hitlState.kind === 'external_execution') && (
              <textarea
                value={hitlInput}
                onChange={(e) => setHitlInput(e.target.value)}
                placeholder="输入 HITL 响应内容"
                rows={2}
                className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400 dark:border-violet-700/40 dark:bg-surface-dark dark:text-white"
              />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {(hitlState.allowedActions || ['allow', 'deny', 'cancel']).map((action) => (
                <button
                  key={action}
                  disabled={hitlBusy}
                  onClick={() => void resolveHitl(action)}
                  className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-600 dark:text-violet-100"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {detail.status === 'paused' && permissionId && (
          <div className="border-b border-hairline bg-amber-50 px-5 py-3 dark:border-border-dark dark:bg-amber-900/10">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-600">lock</span>
              <span className="flex-1 text-sm text-amber-800 dark:text-amber-200">等待权限审批</span>
              <button
                onClick={() => onApprove?.(permissionId, approvalReason.trim() || undefined)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                批准
              </button>
              <button
                onClick={() => onReject?.(permissionId, approvalReason.trim() || undefined)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                拒绝
              </button>
            </div>
            <input
              type="text"
              value={approvalReason}
              onChange={(e) => setApprovalReason(e.target.value)}
              placeholder="审批备注（可选）"
              className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-400 dark:border-amber-700/40 dark:bg-surface-dark dark:text-white"
            />
          </div>
        )}

        {liveLoading && (
          <div className="border-b border-hairline px-5 py-2 text-xs text-text-slate dark:border-border-dark dark:text-text-secondary">
            正在加载 Run 详情...
          </div>
        )}

        <div className="flex flex-wrap gap-1 px-5 pt-4 text-sm">
          {SECTION_LABELS.map((section) => {
            const selected = activeSection === section.id;
            const count = sectionCounts[section.id];
            return (
              <button
                key={section.id}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 ${
                  selected
                    ? 'bg-ink text-white dark:bg-white dark:text-ink'
                    : 'text-text-slate hover:bg-surface-soft dark:text-text-secondary dark:hover:bg-white/10'
                }`}
                onClick={() => {
                  if (section.id === 'trace') void loadTrace();
                  else if (section.id === 'artifacts') void loadArtifacts();
                  else if (section.id === 'messages') void loadMessages();
                  setActiveSection(section.id);
                }}
              >
                <span className="material-symbols-outlined text-base">{section.icon}</span>
                {section.label}
                {count > 0 && <span className="text-[10px] opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-4">
          {activeSection === 'timeline' && (
            liveLoading ? (
              <EmptyState>加载事件...</EmptyState>
            ) : timeline.length === 0 ? (
              <EmptyState>无事件记录</EmptyState>
            ) : (
              <div className="space-y-1">
                {timeline.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-soft/40 dark:hover:bg-white/[0.03]"
                  >
                    <span className="material-symbols-outlined text-base leading-5 text-text-slate dark:text-text-secondary">
                      {ev.icon}
                    </span>
                    <span className="w-20 shrink-0 font-mono text-text-slate dark:text-text-secondary">
                      {formatTimestamp(ev.timestamp)}
                    </span>
                    <span className="font-medium text-text-ink dark:text-white">{ev.type}</span>
                    {ev.summary && (
                      <span
                        className="ml-auto max-w-[260px] truncate text-text-slate dark:text-text-secondary"
                        title={ev.payloadTitle}
                      >
                        {ev.summary}
                      </span>
                    )}
                  </div>
                ))}
                <div ref={timelineEndRef} />
              </div>
            )
          )}

          {activeSection === 'trace' && <JsonBlock value={trace ?? detail.output?.trace} empty="暂无 Trace" />}

          {activeSection === 'output' && (
            <div className="space-y-3">
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-soft p-4 text-xs dark:bg-canvas/50">
                {fullOutput}
              </pre>
              {detail.output?.usage !== undefined && (
                <DetailCard title="Usage">
                  <JsonBlock value={detail.output.usage} compact />
                </DetailCard>
              )}
              {detail.output?.metadata && (
                <DetailCard title="Metadata">
                  <JsonBlock value={detail.output.metadata} compact />
                </DetailCard>
              )}
            </div>
          )}

          {activeSection === 'checkpoints' && <CheckpointList checkpoints={checkpoints} />}
          {activeSection === 'artifacts' && (
            <ArtifactList
              artifacts={artifacts}
              artifactDetails={artifactDetails}
              onLoadDetail={(artifactId) => void loadArtifactDetail(artifactId)}
            />
          )}
          {activeSection === 'workspace' && <JsonBlock value={detail.workspace} empty="暂无 Workspace" />}
          {activeSection === 'messages' && <MessageList messages={messages} />}
        </div>
      </div>
    </div>
  );
};

function MetaItem({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="text-text-slate dark:text-text-secondary">{label}：</span>
      <span className={`break-all text-text-ink dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-text-slate dark:text-text-secondary">{children}</div>;
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-white p-3 dark:border-border-dark dark:bg-surface-dark/40">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-slate dark:text-text-secondary">
        {title}
      </h4>
      {children}
    </section>
  );
}

function JsonBlock({ value, empty = '暂无数据', compact = false }: { value: unknown; empty?: string; compact?: boolean }) {
  if (value == null || (Array.isArray(value) && value.length === 0)) return <EmptyState>{empty}</EmptyState>;
  return (
    <pre className={`${compact ? 'max-h-64' : 'max-h-[60vh]'} overflow-auto rounded-lg bg-surface-soft p-4 text-xs dark:bg-canvas/50`}>
      {formatJson(value)}
    </pre>
  );
}

function CheckpointList({ checkpoints }: { checkpoints: AgentRunCheckpoint[] }) {
  if (checkpoints.length === 0) return <EmptyState>暂无 Checkpoint</EmptyState>;
  return (
    <div className="space-y-3">
      {checkpoints.map((checkpoint) => (
        <DetailCard key={checkpoint.checkpointId} title={checkpoint.checkpointId}>
          <div className="mb-2 grid grid-cols-2 gap-2 text-xs text-text-slate dark:text-text-secondary md:grid-cols-4">
            <span>状态：{checkpoint.status}</span>
            <span>原因：{checkpoint.reason || '-'}</span>
            <span>时间：{formatTimestamp(checkpoint.createdAt)}</span>
            <span>Workspace：{checkpoint.workspace ? '有' : '无'}</span>
          </div>
          <JsonBlock
            value={{
              pendingPermission: checkpoint.pendingPermission,
              workspace: checkpoint.workspace,
              state: checkpoint.state,
              metadata: checkpoint.metadata,
            }}
            compact
          />
        </DetailCard>
      ))}
    </div>
  );
}

function ArtifactList({
  artifacts,
  artifactDetails,
  onLoadDetail
}: {
  artifacts: AgentRunArtifact[];
  artifactDetails: Record<string, unknown>;
  onLoadDetail: (artifactId: string) => void;
}) {
  if (artifacts.length === 0) return <EmptyState>暂无 Artifact</EmptyState>;
  return (
    <div className="space-y-3">
      {artifacts.map((artifact) => (
        <DetailCard key={artifact.artifactId} title={`${artifact.kind} · ${artifact.artifactId}`}>
          <div className="mb-2 grid grid-cols-1 gap-2 text-xs text-text-slate dark:text-text-secondary md:grid-cols-3">
            <span className="break-all">URI：{artifact.uri || '-'}</span>
            <span>大小：{artifact.sizeBytes ?? '-'}</span>
            <span>时间：{formatTimestamp(artifact.createdAt)}</span>
          </div>
          {artifact.preview && (
            <pre className="mb-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-soft p-3 text-xs dark:bg-canvas/50">
              {artifact.preview}
            </pre>
          )}
          {artifact.metadata && <JsonBlock value={artifact.metadata} compact />}
          {!artifactDetails[artifact.artifactId] ? (
            <button
              type="button"
              onClick={() => onLoadDetail(artifact.artifactId)}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              加载完整内容
            </button>
          ) : (
            <JsonBlock value={artifactDetails[artifact.artifactId]} compact />
          )}
        </DetailCard>
      ))}
    </div>
  );
}

function MessageList({ messages }: { messages: AgentRunMessage[] }) {
  if (messages.length === 0) return <EmptyState>暂无消息</EmptyState>;
  return (
    <div className="space-y-3">
      {messages.map((message, index) => (
        <DetailCard key={message.id || `${message.role}_${index}`} title={`${index + 1}. ${message.role}`}>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-soft p-3 text-xs dark:bg-canvas/50">
            {formatJson(message.content)}
          </pre>
          {message.metadata && <JsonBlock value={message.metadata} compact />}
        </DetailCard>
      ))}
    </div>
  );
}

