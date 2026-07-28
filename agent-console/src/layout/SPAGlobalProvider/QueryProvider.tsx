import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { memo, type PropsWithChildren } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

/** TanStack Query provider for Agent Console data hooks (Phase 2+). */
export const QueryProvider = memo(function QueryProvider({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
});

export { queryClient };
