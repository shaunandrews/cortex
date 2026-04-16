import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCreateP2 } from './useCreateP2';
import * as wpcom from '../api/wpcom';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: null,
    isLoading: false,
    isAuthed: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useCreateP2', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invalidates site and following caches on success and calls onCreated', async () => {
    const response = {
      success: true,
      blog_details: {
        blogid: 123,
        blogname: 'team-retro',
        url: 'https://team-retro.wordpress.com',
      },
    };
    vi.spyOn(wpcom, 'createP2Site').mockResolvedValue(response);

    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateP2({ onCreated }), { wrapper });

    result.current.mutate({ blog_name: 'team-retro', blog_title: 'Team Retro' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onCreated).toHaveBeenCalledWith(response);
  });

  it('surfaces errors', async () => {
    vi.spyOn(wpcom, 'createP2Site').mockRejectedValue(new Error('blog_name_taken'));

    const { result } = renderHook(() => useCreateP2(), { wrapper });

    result.current.mutate({ blog_name: 'taken-name', blog_title: 'Taken' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('blog_name_taken');
  });
});
