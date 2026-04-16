import { useQuery } from '@tanstack/react-query';
import { getFollowing } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';

export function useFollowing() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['following'],
    queryFn: () => getFollowing(token!),
    enabled: !!token,
  });
}
