import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { initSentry, SentryErrorBoundary } from './sentry';

initSentry();

function AppErrorFallback({
  error,
  resetError
}: {
  error: unknown;
  resetError: () => void;
}) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  return (
    <div className="min-h-screen bg-background-dark p-6 text-white">
      <p className="text-[15px] font-medium">页面发生错误，请刷新后重试。</p>
      {import.meta.env.DEV && (
        <>
          <pre className="mt-4 max-w-3xl overflow-auto rounded-xl bg-black/40 p-4 text-[12px] leading-relaxed text-red-300 whitespace-pre-wrap">
            {message}
            {stack ? `\n\n${stack}` : ''}
          </pre>
          <button
            type="button"
            onClick={resetError}
            className="mt-4 rounded-full bg-white/10 px-4 py-2 text-[13px] hover:bg-white/20"
          >
            重试
          </button>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <SentryErrorBoundary fallback={AppErrorFallback}>
    <App />
  </SentryErrorBoundary>
);
