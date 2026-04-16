import { QueryClient, QueryCache } from '@tanstack/react-query';

const TOKEN_KEY = 'cortex_token';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error.message === 'UNAUTHORIZED') {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/';
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 60s — sync engine keeps data fresher than this
      gcTime: 30 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error.message === 'UNAUTHORIZED') return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: true,
    },
  },
});
