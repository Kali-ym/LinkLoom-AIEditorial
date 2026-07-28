import type { ReactNode } from 'react';
import React, { useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ConsoleConnectionError,
  normalizeBaseUrl,
  probeConsoleConnection,
  readLastBaseUrl,
} from '../domain/connection/consoleConnection';

type StickyNoteProps = {
  className: string;
  children: ReactNode;
};

function ConsoleBrandMark({ className = '' }: { className?: string }) {
  const src = `${import.meta.env.BASE_URL}icon.svg`;
  return (
    <span
      className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[22%] ${className}`}
      aria-hidden
    >
      <img src={src} alt="" className="h-full w-full" width={48} height={48} />
    </span>
  );
}

function StickyNote({ className, children }: StickyNoteProps) {
  return (
    <div className={`absolute flex h-44 w-44 items-center justify-center rounded-3xl p-5 shadow-card ${className}`}>
      <span className="text-sm font-medium leading-snug">{children}</span>
    </div>
  );
}

function resolveConnectError(err: unknown): string {
  if (err instanceof ConsoleConnectionError) return err.message;
  return '连接失败，请检查后重试';
}

const Login: React.FC = () => {
  const defaultBase =
    readLastBaseUrl() ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
    '';
  const [baseUrl, setBaseUrl] = useState(defaultBase);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { connect, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/console" replace />;
  }

  const canSubmit = useMemo(
    () => Boolean(baseUrl.trim() && apiKey.trim() && !loading),
    [baseUrl, apiKey, loading],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalized = normalizeBaseUrl(baseUrl);
    if (!normalized) {
      setError('请填写实例地址');
      setLoading(false);
      return;
    }

    try {
      await probeConsoleConnection(normalized, apiKey.trim());
      connect({
        baseUrl: normalized,
        apiKey: apiKey.trim(),
        connectedAt: new Date().toISOString(),
      });
      navigate('/console');
    } catch (err: unknown) {
      setError(resolveConnectError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-stretch bg-canvas transition-colors dark:bg-background-dark">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-5 top-5 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline-soft bg-canvas text-text-slate transition-colors hover:border-hairline-strong hover:text-text-ink dark:border-white/10 dark:bg-surface-dark dark:text-text-secondary dark:hover:border-white/20 dark:hover:text-white"
        aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      >
        <span className="material-symbols-outlined text-[20px]">
          {theme === 'dark' ? 'light_mode' : 'dark_mode'}
        </span>
      </button>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-12 flex items-center gap-3">
            <ConsoleBrandMark className="shadow-subtle" />
            <div>
              <p className="text-lg font-semibold tracking-tight text-text-ink dark:text-white">
                LinkLoom Console
              </p>
              <p className="text-[13px] text-text-slate dark:text-text-secondary">智能体控制台</p>
            </div>
          </div>

          <div className="mb-10">
            <h1 className="mb-3 text-[40px] font-medium leading-[1.1] tracking-tight text-text-ink dark:text-white sm:text-[48px]">
              连接实例
            </h1>
            <p className="text-[15px] text-text-slate dark:text-text-secondary">
              填写 LinkLoom 实例地址与 AI 互联 API Key，进入对话工作区。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="console-base-url"
                className="mb-2 block text-[13px] font-medium text-text-charcoal dark:text-slate-300"
              >
                实例地址
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-text-stone">
                  dns
                </span>
                <input
                  id="console-base-url"
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-hairline-strong bg-canvas pl-11 pr-4 text-[15px] text-text-ink outline-none transition-all placeholder:text-text-stone focus:border-ink focus:ring-2 focus:ring-ink/10 dark:border-white/10 dark:bg-surface-dark dark:text-white dark:focus:border-white dark:focus:ring-white/10"
                  placeholder="http://120.48.111.74:3000"
                  required
                  autoFocus
                  autoComplete="url"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="console-api-key"
                className="mb-2 block text-[13px] font-medium text-text-charcoal dark:text-slate-300"
              >
                API Key
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-text-stone">
                  key
                </span>
                <input
                  id="console-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-hairline-strong bg-canvas pl-11 pr-4 text-[15px] text-text-ink outline-none transition-all placeholder:text-text-stone focus:border-ink focus:ring-2 focus:ring-ink/10 dark:border-white/10 dark:bg-surface-dark dark:text-white dark:focus:border-white dark:focus:ring-white/10"
                  placeholder="sk_pf_…"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            {error ? (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-light bg-rose-light px-4 py-3 text-[13px] text-coral-dark dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                <span className="material-symbols-outlined text-base text-brand-red">error</span>
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-pill-primary h-12 w-full text-[15px] active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-ink/20 dark:border-t-ink" />
              ) : (
                <>
                  <span>连接并进入</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <p className="mt-12 text-[12px] text-text-stone dark:text-slate-600">
            在管理后台「系统设置 → AI 互联」创建或复制 API Key
          </p>
        </div>
      </div>

      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-surface dark:bg-surface-darker lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-50"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 18% 12%, rgba(12, 175, 207, 0.12), transparent 60%), radial-gradient(ellipse 55% 45% at 88% 88%, rgba(252, 220, 42, 0.1), transparent 55%)',
          }}
        />

        <div className="relative aspect-square w-full max-w-[480px] p-12">
          <StickyNote className="left-4 top-0 rotate-[-6deg] bg-brand-yellow text-ink">
            智能体
            <br />
            直接对话
          </StickyNote>
          <StickyNote className="right-0 top-12 rotate-[5deg] bg-coral-light text-coral-dark">
            话题
            <br />
            上下文延续
          </StickyNote>
          <StickyNote className="bottom-12 left-0 rotate-[8deg] bg-teal-light text-moss-dark">
            工具链
            <br />
            实时追踪
          </StickyNote>
          <StickyNote className="bottom-0 right-8 rotate-[-4deg] bg-surface-lavender text-ink-deep">
            工作区
            <br />
            文件与技能
          </StickyNote>
        </div>
      </div>
    </div>
  );
};

export default Login;
