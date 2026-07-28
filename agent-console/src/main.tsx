import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown | null }
> {
  state: { error: unknown | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[agentConsole] render error', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    return (
      <div className="min-h-screen bg-background-dark p-6 text-white">
        <p className="text-[15px] font-medium">页面发生错误，请刷新后重试。</p>
        <pre className="mt-4 max-w-3xl overflow-auto rounded-xl bg-black/40 p-4 text-[12px] leading-relaxed text-red-300 whitespace-pre-wrap">
          {message}
          {import.meta.env.DEV && stack ? `\n\n${stack}` : ''}
        </pre>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-4 rounded-full bg-white/10 px-4 py-2 text-[13px] hover:bg-white/20"
        >
          重试
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);

/** Defer Sentry so the main bundle does not parse @sentry/react on first paint. */
function loadSentryWhenIdle() {
  const start = () => {
    void import('./sentry').then((m) => m.initSentry());
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 4_000 });
  } else {
    window.setTimeout(start, 2_000);
  }
}

loadSentryWhenIdle();
