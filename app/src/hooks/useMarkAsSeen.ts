import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markPostsAsSeen, markAllAsSeen } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';
import type { WPComSubscription } from '../api/types';

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
