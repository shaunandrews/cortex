import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markPostsAsSeen, markAllAsSeen } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';
import { getSharedStore } from '../sync/store';
import type { WPComSubscription } from '../api/types';

/**
 * Optimistically set is_seen on a post in the feed cache, persist to IDB, and fire the API call.
 * Used by both PostDetailPanel (origin posts) and AuthedHome (x-posts).
 */
export function useMarkPostSeen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const markAsSeen = useMarkAsSeen();
  const mutateRef = useRef(markAsSeen.mutate);
  useEffect(() => {
    mutateRef.current = markAsSeen.mutate;
  });

  return useCallback(
    (siteId: number, postId: number) => {
      const key = `${siteId}-${postId}`;

      // Update the seen-posts set (used by rendering to determine is-seen class)
      queryClient.setQueryData<Set<string>>(['seen-posts'], (old) => {
        const next = new Set(old);
        next.add(key);
        return next;
      });

      // Persist to IDB so it survives refresh
      getSharedStore()
        .markSeen(siteId, postId)
        .catch(() => {});

      // Fire the API call (also optimistically updates unseen_count on subscriptions)
      if (token) {
        mutateRef.current({ blogId: siteId, postIds: [postId] });
      }
    },
    [token, queryClient],
  );
}

export function useMarkAsSeen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ blogId, postIds }: { blogId: number; postIds: number[] }) =>
      markPostsAsSeen(token!, blogId, postIds),
    onMutate: async ({ blogId, postIds }) => {
      await queryClient.cancelQueries({ queryKey: ['following'] });
      const previous = queryClient.getQueryData<WPComSubscription[]>(['following']);

      queryClient.setQueryData<WPComSubscription[]>(['following'], (old) => {
        if (!old) return old;
        return old.map((sub) =>
          Number(sub.blog_ID) === blogId
            ? { ...sub, unseen_count: Math.max(sub.unseen_count - postIds.length, 0) }
            : sub,
        );
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['following'], context.previous);
      }
    },
  });
}

export function useMarkAllAsSeen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedId }: { feedId: number; blogId: number }) => markAllAsSeen(token!, [feedId]),
    onMutate: async ({ blogId }) => {
      await queryClient.cancelQueries({ queryKey: ['following'] });
      const previous = queryClient.getQueryData<WPComSubscription[]>(['following']);

      queryClient.setQueryData<WPComSubscription[]>(['following'], (old) => {
        if (!old) return old;
        return old.map((sub) =>
          Number(sub.blog_ID) === blogId ? { ...sub, unseen_count: 0 } : sub,
        );
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['following'], context.previous);
      }
    },
  });
}
