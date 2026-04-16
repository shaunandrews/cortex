import { useQuery } from '@tanstack/react-query';
import { getMySites } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';

export function useP2Sites() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['p2-sites'],
    queryFn: async () => {
      const res = await getMySites(token!);
      return res.sites.filter((s) => s.options?.is_wpforteams_site);
    },
    enabled: !!token,
  });
}
