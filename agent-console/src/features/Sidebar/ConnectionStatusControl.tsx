import { DropdownMenu, type DropdownItem } from '@lobehub/ui';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  maskApiKey,
  probeConsoleConnection,
} from '../../domain/connection/consoleConnection';
import {
  isAgentConsoleBootstrapComplete,
  whenAgentConsoleBootstrapComplete,
} from '../../stores';

const HEARTBEAT_MS = 45_000;
const PROBE_IDLE_DELAY_MS = 1_500;

function statusColor(health: string): string {
  if (health === 'connected') return '#22c55e';
  if (health === 'checking' || health === 'unknown') return '#94a3b8';
  return '#ef4444';
}

function statusLabel(health: string): string {
  if (health === 'connected') return '已连接';
  if (health === 'checking' || health === 'unknown') return '检测中';
  return '已断开';
}

function scheduleAfterIdle(callback: () => void, timeoutMs: number): () => void {
  let idleId: number | undefined;
  let timeoutId: number | undefined;
  let cancelled = false;

  const run = () => {
    if (cancelled) return;
    callback();
  };

  if (typeof window.requestIdleCallback === 'function') {
    idleId = window.requestIdleCallback(run, { timeout: timeoutMs });
  } else {
    timeoutId = window.setTimeout(run, timeoutMs);
  }

  return () => {
    cancelled = true;
    if (idleId != null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId);
    }
    if (timeoutId != null) window.clearTimeout(timeoutId);
  };
}

export function ConnectionStatusControl() {
  const navigate = useNavigate();
  const { connection, health, lastHeartbeatAt, disconnect, setHealth } = useAuth();

  useEffect(() => {
    if (!connection) return;

    let cancelled = false;
    let intervalId: number | undefined;
    let cancelIdle: (() => void) | undefined;

    const beat = async () => {
      if (cancelled) return;
      try {
        await probeConsoleConnection(connection.baseUrl, connection.apiKey);
        if (!cancelled) setHealth('connected');
      } catch (err) {
        if (cancelled) return;
        const isAuth =
          err &&
          typeof err === 'object' &&
          'kind' in err &&
          (err as { kind: string }).kind === 'auth';
        if (isAuth) {
          disconnect();
          navigate('/console/login', { replace: true });
          return;
        }
        setHealth('disconnected');
      }
    };

    const startHeartbeat = () => {
      if (cancelled) return;
      setHealth('checking');
      void beat();
      intervalId = window.setInterval(() => void beat(), HEARTBEAT_MS);
    };

    const begin = async () => {
      if (!isAgentConsoleBootstrapComplete()) {
        await whenAgentConsoleBootstrapComplete();
      }
      if (cancelled) return;
      cancelIdle = scheduleAfterIdle(startHeartbeat, PROBE_IDLE_DELAY_MS);
    };

    void begin();

    return () => {
      cancelled = true;
      cancelIdle?.();
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, [connection, disconnect, navigate, setHealth]);

  const menuItems: DropdownItem[] = useMemo(() => {
    if (!connection) return [];
    const heartbeatText = lastHeartbeatAt
      ? new Date(lastHeartbeatAt).toLocaleString()
      : '—';
    return [
      {
        key: 'baseUrl',
        label: `实例：${connection.baseUrl}`,
        onClick: () => {
          void navigator.clipboard.writeText(connection.baseUrl);
        },
      },
      {
        key: 'apiKey',
        label: `Key：${maskApiKey(connection.apiKey)}`,
      },
      {
        key: 'status',
        label: `${statusLabel(health)} · ${heartbeatText}`,
      },
      { type: 'divider' },
      {
        key: 'disconnect',
        danger: true,
        label: '断开连接',
        onClick: () => {
          disconnect();
          navigate('/console/login', { replace: true });
        },
      },
    ];
  }, [connection, disconnect, health, lastHeartbeatAt, navigate]);

  if (!connection) return null;

  return (
    <DropdownMenu items={menuItems} placement="bottomLeft">
      <button
        type="button"
        title="连接状态"
        aria-label="连接状态"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent hover:bg-black/5 dark:hover:bg-white/10"
      >
        <span
          className={health === 'checking' || health === 'unknown' ? 'animate-pulse' : undefined}
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: 999,
            background: statusColor(health),
            boxShadow: health === 'connected' ? `0 0 0 3px ${statusColor(health)}33` : undefined,
          }}
        />
      </button>
    </DropdownMenu>
  );
}
