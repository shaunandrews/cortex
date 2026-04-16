import { useQuery } from '@tanstack/react-query';
import { getPost } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';

export function useP2Post(siteId: number, postId: number) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['p2-post', siteId, postId],
    queryFn: () => getPost(token!, siteId, postId),
    enabled: !!token && !!siteId && !!postId,
  });
}
