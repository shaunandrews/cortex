import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostComments, createComment, likeComment, unlikeComment } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';
import type { WPComCommentsResponse } from '../api/types';

export function usePostComments(siteId: number, postId: number) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['post-comments', siteId, postId],
    queryFn: () => getPostComments(token!, siteId, postId),
    enabled: !!token && !!siteId && !!postId,
  });
}

export function useCreateComment(siteId: number, postId: number) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => createComment(token!, siteId, postId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', siteId, postId] });
    },
  });
}

export function useToggleCommentLike(siteId: number, postId: number) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['post-comments', siteId, postId];

  return useMutation({
    mutationFn: ({ commentId, liked }: { commentId: number; liked: boolean }) =>
      liked ? unlikeComment(token!, siteId, commentId) : likeComment(token!, siteId, commentId),
    onMutate: async ({ commentId, liked }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WPComCommentsResponse>(queryKey);

      queryClient.setQueryData<WPComCommentsResponse>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          comments: old.comments.map((c) =>
            c.ID === commentId
              ? { ...c, i_like: !liked, like_count: (c.like_count ?? 0) + (liked ? -1 : 1) }
              : c,
          ),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });
}
