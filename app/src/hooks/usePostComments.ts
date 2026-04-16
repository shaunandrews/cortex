import { useQuery } from '@tanstack/react-query';
import { getPostComments } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';

export function usePostComments(siteId: number, postId: number) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['post-comments', siteId, postId],
    queryFn: () => getPostComments(token!, siteId, postId),
    enabled: !!token && !!siteId && !!postId,
  });
}
