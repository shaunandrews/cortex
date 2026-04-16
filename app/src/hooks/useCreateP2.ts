import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createP2Site } from '../api/wpcom';
import { useAuth } from '../auth/AuthContext';
import type { CreateP2Response } from '../api/types';

interface UseCreateP2Options {
  onCreated?: (site: CreateP2Response) => void;
}

export function useCreateP2({ onCreated }: UseCreateP2Options = {}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { blog_name: string; blog_title: string }) => createP2Site(token!, params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['p2-sites'] });
      queryClient.invalidateQueries({ queryKey: ['reader-following'] });
      onCreated?.(data);
    },
  });
}
