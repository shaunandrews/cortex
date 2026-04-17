import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSharedStore } from '../sync/store';

/**
 * Provides a Set of seen post keys ("siteId-postId") backed by IndexedDB.
 *
 * On mount, loads persisted seen IDs from IDB into the React Query cache.
 * useMarkPostSeen updates both the cache and IDB on each mark.
 * Components re-render when the cache entry changes.
 */
export function useSeenPosts(): Set<string> {
  const queryClient = useQueryClient();
  const [seenPosts, setSeenPosts] = useState<Set<string>>(
    () => queryClient.getQueryData<Set<string>>(['seen-posts']) ?? new Set(),
  );

  // Load from IDB on mount, merging with any in-memory additions
  useEffect(() => {
    let cancelled = false;
    getSharedStore()
      .getSeenPostIds()
      .then((set) => {
        if (cancelled) return;
        const current = queryClient.getQueryData<Set<string>>(['seen-posts']);
        const merged = new Set([...set, ...(current ?? [])]);
        queryClient.setQueryData(['seen-posts'], merged);
        setSeenPosts(merged);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  // Subscribe to cache changes so marking a post re-renders consumers
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryKey[0] === 'seen-posts') {
        const data = queryClient.getQueryData<Set<string>>(['seen-posts']);
        if (data) setSeenPosts(data);
      }
    });
    return unsubscribe;
  }, [queryClient]);

  return seenPosts;
}
