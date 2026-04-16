import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPost } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';

export function useCreatePost(siteId: number | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => createPost(token!, siteId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['p2-posts', siteId] });
    },
  });
}
