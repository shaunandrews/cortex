import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getReaderStream } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';
import type { WPComPost } from '../api/types';

export function useReaderStream(enabled: boolean) {
  const { token } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ['reader-stream'],
    queryFn: ({ pageParam }) => getReaderStream(token!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_page_handle ?? undefined,
    enabled: !!token && enabled,
  });

  const posts = useMemo<WPComPost[]>(() => {
    if (!query.data) return [];
    return query.data.pages.flatMap((p) => p.posts ?? []);
  }, [query.data]);

  return {
    posts,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
