import { lazy, Suspense } from 'react';

const ContentRenderer = lazy(() => import('./ContentRenderer'));

type ContentRendererProps = React.ComponentProps<typeof ContentRenderer>;

const LazyContentRenderer: React.FC<ContentRendererProps> = (props) => (
  <Suspense fallback={<div className="min-h-16 animate-pulse rounded-2xl bg-surface-soft dark:bg-white/5" />}>
    <ContentRenderer {...props} />
  </Suspense>
);

export default LazyContentRenderer;
