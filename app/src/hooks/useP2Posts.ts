import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getSitePosts } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';
import type { WPComPost } from '../api/types';

export function useP2Posts(siteId: number | null) {
  const { token } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ['p2-posts', siteId],
    queryFn: ({ pageParam }) => getSitePosts(token!, siteId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.posts?.length) return undefined;
      const fetched = allPages.reduce((n, p) => n + (p.posts?.length ?? 0), 0);
      if (fetched >= (lastPage.found ?? 0)) return undefined;
      return allPages.length + 1;
    },
    enabled: !!token && !!siteId,
  });

  const posts = useMemo<WPComPost[]>(() => {
    if (!query.data) return [];
    return query.data.pages.flatMap((p) => p.posts ?? []);
  }, [query.data]);

  return {
    data: posts.length > 0 ? { posts, found: query.data?.pages[0]?.found ?? 0 } : undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
