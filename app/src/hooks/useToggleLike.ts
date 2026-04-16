import { useMutation, useQueryClient } from '@tanstack/react-query';
import { likePost, unlikePost } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';
import type { WPComPost } from '../api/types';

export function useToggleLike(siteId: number, postId: number) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['p2-post', siteId, postId];

  return useMutation({
    mutationFn: (liked: boolean) =>
      liked ? unlikePost(token!, siteId, postId) : likePost(token!, siteId, postId),
    onMutate: async (liked: boolean) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WPComPost>(queryKey);

      queryClient.setQueryData<WPComPost>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          i_like: !liked,
          like_count: (old.like_count ?? 0) + (liked ? -1 : 1),
        };
      });

      return { previous };
    },
    onError: (_err, _liked, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });
}
