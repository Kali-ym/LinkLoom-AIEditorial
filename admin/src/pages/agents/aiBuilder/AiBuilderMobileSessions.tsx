import React from 'react';
import { AiBuilderSessionList } from './AiBuilderSessionList';
import { MsIcon } from './aiBuilderMsIcon';
import type { AiBuilderSession, SessionRuntime } from './sessionStorage';

export interface AiBuilderMobileSessionsProps {
  open: boolean;
  sessions: AiBuilderSession[];
  activeSessionId?: string;
  runtimeBySessionId: Record<string, SessionRuntime>;
  displaySessionTitle: (session: AiBuilderSession) => string;
  sessionPreview: (session: AiBuilderSession) => string;
  formatSessionTime: (timestamp: number) => string;
  onClose: () => void;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

export const AiBuilderMobileSessions: React.FC<AiBuilderMobileSessionsProps> = ({
  open,
  sessions,
  activeSessionId,
  runtimeBySessionId,
  displaySessionTitle,
  sessionPreview,
  formatSessionTime,
  onClose,
  onCreateSession,
  onSelectSession,
  onDeleteSession
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] md:hidden">
      <button
        type="button"
        aria-label="关闭会话列表"
        className="absolute inset-0 bg-slate-950/50"
        onClick={onClose}
      />
      <aside className="absolute left-0 top-0 flex h-full w-[min(18rem,85vw)] flex-col border-r border-hairline-soft bg-surface-soft/95 shadow-modal dark:border-white/10 dark:bg-[#0d1117]">
        <div className="flex items-center justify-between border-b border-hairline-soft px-4 py-3 dark:border-white/10">
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">会话</h3>
            <p className="text-xs text-text-slate dark:text-text-stone">本地会话 · 仅保存在本机</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onCreateSession();
                onClose();
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white hover:opacity-90 dark:bg-canvas dark:text-text-ink"
              aria-label="新建会话"
            >
              <MsIcon name="add" size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-stone hover:bg-surface dark:hover:bg-canvas/5"
              aria-label="关闭"
            >
              <MsIcon name="close" size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <AiBuilderSessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            runtimeBySessionId={runtimeBySessionId}
            displaySessionTitle={displaySessionTitle}
            sessionPreview={sessionPreview}
            formatSessionTime={formatSessionTime}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            afterSelect={onClose}
          />
        </div>
      </aside>
    </div>
  );
};
