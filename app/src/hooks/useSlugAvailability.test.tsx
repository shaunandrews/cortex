import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSlugAvailability } from './useSlugAvailability';
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

const flush = () => new Promise((r) => setTimeout(r, 500));

describe('useSlugAvailability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns idle for an empty slug', () => {
    const { result } = renderHook(() => useSlugAvailability(''));
    expect(result.current.status).toBe('idle');
  });

  it('returns invalid when the shape is bad', () => {
    const spy = vi.spyOn(wpcom, 'checkSlugAvailable');
    const { result } = renderHook(() => useSlugAvailability('ab'));
    expect(result.current.status).toBe('invalid');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns checking while the probe runs, then available', async () => {
    vi.spyOn(wpcom, 'checkSlugAvailable').mockResolvedValue('available');

    const { result } = renderHook(() => useSlugAvailability('team-retro'));
    expect(result.current.status).toBe('checking');

    await act(async () => {
      await flush();
    });

    expect(result.current.status).toBe('available');
  });

  it('returns taken when the endpoint says the slug exists', async () => {
    vi.spyOn(wpcom, 'checkSlugAvailable').mockResolvedValue('taken');

    const { result } = renderHook(() => useSlugAvailability('team-retro'));

    await act(async () => {
      await flush();
    });

    expect(result.current.status).toBe('taken');
  });

  it('falls back to available on network error', async () => {
    vi.spyOn(wpcom, 'checkSlugAvailable').mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useSlugAvailability('team-retro'));

    await act(async () => {
      await flush();
    });

    expect(result.current.status).toBe('available');
  });
});
