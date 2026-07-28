import { useCallback, useEffect, useRef, useState } from 'react';
import { agentService } from '../services/agentService';
import type { AgentEventItem, AgentRun, AgentRunStatus } from '../services/agentService';
import {
  ACTIVE_AGENT_RUN_STATUSES,
  isAgentRunTerminalEvent,
  shouldRefreshAgentRunDetail,
  upsertAgentEvent
} from '../utils/agentEvents';

export type AgentRunLiveMode = 'idle' | 'sse' | 'poll';

function isActiveStatus(status?: AgentRunStatus): boolean {
  return status != null && (ACTIVE_AGENT_RUN_STATUSES as readonly string[]).includes(status);
}

export function useAgentRunLive(runId: string) {
  const [detail, setDetail] = useState<AgentRun | null>(null);
  const [events, setEvents] = useState<AgentEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState<AgentRunLiveMode>('idle');
  const [error, setError] = useState('');
  const detailRef = useRef<AgentRun | null>(null);

  const refresh = useCallback(async () => {
    const [nextDetail, nextEvents] = await Promise.all([
      agentService.getAgentRun(runId),
      agentService.getAgentRunEvents(runId)
    ]);
    detailRef.current = nextDetail;
    setDetail(nextDetail);
    setEvents(nextEvents);
    return nextDetail;
  }, [runId]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let unsubscribeSse: (() => void) | undefined;

    const stopPoll = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = undefined;
    };

    const stopSse = () => {
      unsubscribeSse?.();
      unsubscribeSse = undefined;
    };

    const startPoll = () => {
      if (pollTimer || cancelled) return;
      setLiveMode('poll');
      pollTimer = setInterval(() => {
        refresh().catch(() => undefined);
      }, 4000);
    };

    const stopLive = () => {
      stopPoll();
      stopSse();
      setLiveMode('idle');
    };

    const handleTerminal = () => {
      stopLive();
      refresh().catch(() => undefined);
    };

    const startSse = () => {
      if (cancelled || unsubscribeSse) return;
      setLiveMode('sse');
      unsubscribeSse = agentService.subscribeAgentRunEvents(runId, {
        onEvent: (event) => {
          if (cancelled) return;
          setEvents((prev) => upsertAgentEvent(prev, event));
          if (shouldRefreshAgentRunDetail(event)) {
            refresh().catch(() => undefined);
          }
          if (isAgentRunTerminalEvent(event)) {
            handleTerminal();
          }
        },
        onDone: () => {
          if (cancelled) return;
          handleTerminal();
        },
        onError: () => {
          if (cancelled) return;
          stopSse();
          if (isActiveStatus(detailRef.current?.status)) {
            startPoll();
          } else {
            setLiveMode('idle');
          }
        }
      });
    };

    setLoading(true);
    setError('');
    setEvents([]);
    setDetail(null);
    detailRef.current = null;
    stopLive();

    refresh()
      .then((nextDetail) => {
        if (cancelled) return;
        setLoading(false);
        if (isActiveStatus(nextDetail.status)) {
          startSse();
        } else {
          setLiveMode('idle');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : '加载 Run 失败');
        startPoll();
      });

    return () => {
      cancelled = true;
      stopLive();
    };
  }, [runId, refresh]);

  return { detail, events, loading, liveMode, error, refresh };
}
