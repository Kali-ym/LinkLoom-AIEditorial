import { MsIcon } from './aiBuilderMsIcon';
import type { AiBuilderSession, SessionRuntime } from './sessionStorage';

export interface AiBuilderSessionListProps {
  sessions: AiBuilderSession[];
  activeSessionId?: string;
  runtimeBySessionId: Record<string, SessionRuntime | undefined>;
  displaySessionTitle: (session: AiBuilderSession) => string;
  sessionPreview: (session: AiBuilderSession) => string;
  formatSessionTime: (timestamp: number) => string;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  afterSelect?: () => void;
}

export function AiBuilderSessionList({
  sessions,
  activeSessionId,
  runtimeBySessionId,
  displaySessionTitle,
  sessionPreview,
  formatSessionTime,
  onSelectSession,
  onDeleteSession,
  afterSelect
}: AiBuilderSessionListProps) {
  return (
    <>
      {sessions.map((session) => {
        const sessionRuntime = runtimeBySessionId[session.id];
        const isBackgroundRunning = Boolean(
          sessionRuntime?.isStreaming || sessionRuntime?.isApplying || sessionRuntime?.dryRunLoading
        );

        return (
          <button
            key={session.id}
            type="button"
            onClick={() => {
              onSelectSession(session.id);
              afterSelect?.();
            }}
            className={`group mb-1 flex w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-left transition ${
              session.id === activeSessionId
                ? 'bg-canvas text-slate-950 shadow-subtle dark:bg-canvas/[0.08] dark:text-white'
                : 'text-text-charcoal hover:bg-canvas/70 dark:text-text-stone dark:hover:bg-canvas/[0.05]'
            }`}
          >
            <MsIcon
              name="forum"
              size={18}
              className={`mt-0.5 shrink-0 ${isBackgroundRunning ? 'text-amber-500' : 'text-text-stone'}`}
            />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">
                  {displaySessionTitle(session)}
                </span>
                {isBackgroundRunning && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    运行中
                  </span>
                )}
                <span className="shrink-0 text-[10px] font-medium text-text-stone">
                  {formatSessionTime(session.updatedAt)}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-text-stone">
                {isBackgroundRunning
                  ? sessionRuntime?.statusText || '任务执行中…'
                  : sessionPreview(session)}
              </span>
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteSession(session.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.stopPropagation();
                  onDeleteSession(session.id);
                }
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-text-stone opacity-0 hover:bg-surface hover:text-coral-dark group-hover:opacity-100 dark:hover:bg-canvas/10"
            >
              <MsIcon name="close" size={16} />
            </span>
          </button>
        );
      })}
    </>
  );
}
