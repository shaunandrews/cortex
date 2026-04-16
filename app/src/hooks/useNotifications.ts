import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';
import type { WPComNotification } from '../api/types';

export function useNotifications() {
  const { token } = useAuth();

  return useQuery<WPComNotification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await getNotifications(token!);
      return res.notes ?? [];
    },
    enabled: !!token,
  });
}
