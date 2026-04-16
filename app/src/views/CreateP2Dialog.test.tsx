import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CreateP2Dialog } from './CreateP2Dialog';
import * as wpcom from '../api/wpcom';

const flush = () => new Promise((r) => setTimeout(r, 500));

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

function wrap(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe('CreateP2Dialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    wrap(<CreateP2Dialog open={false} onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('derives the slug from the title', () => {
    vi.spyOn(wpcom, 'checkSlugAvailable').mockResolvedValue('available');
    wrap(<CreateP2Dialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);

    const titleInput = screen.getByLabelText('Name') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Team Retro 2026' } });

    const slugInput = screen.getByLabelText('Address') as HTMLInputElement;
    expect(slugInput.value).toBe('team-retro-2026');
  });

  it('stops deriving the slug after manual edit', () => {
    vi.spyOn(wpcom, 'checkSlugAvailable').mockResolvedValue('available');
    wrap(<CreateP2Dialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);

    const titleInput = screen.getByLabelText('Name') as HTMLInputElement;
    const slugInput = screen.getByLabelText('Address') as HTMLInputElement;

    fireEvent.change(titleInput, { target: { value: 'Team Retro' } });
    expect(slugInput.value).toBe('team-retro');

    fireEvent.change(slugInput, { target: { value: 'custom-slug' } });
    expect(slugInput.value).toBe('custom-slug');

    fireEvent.change(titleInput, { target: { value: 'Different Title' } });
    expect(slugInput.value).toBe('custom-slug');
  });

  it('disables submit until availability check confirms the slug is free', async () => {
    vi.spyOn(wpcom, 'checkSlugAvailable').mockResolvedValue('available');
    wrap(<CreateP2Dialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);

    const submit = screen.getByRole('button', { name: 'Create P2' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Team Retro' } });
    // Still disabled while the check is pending.
    expect(submit).toBeDisabled();

    await act(async () => {
      await flush();
    });

    expect(submit).not.toBeDisabled();
  });

  it('calls onCreated when the API returns success', async () => {
    vi.spyOn(wpcom, 'checkSlugAvailable').mockResolvedValue('available');
    const response = {
      success: true,
      blog_details: {
        blogid: 999,
        blogname: 'team-retro',
        url: 'https://team-retro.wordpress.com',
      },
    };
    const createSpy = vi.spyOn(wpcom, 'createP2Site').mockResolvedValue(response);
    const onCreated = vi.fn();

    wrap(<CreateP2Dialog open onOpenChange={vi.fn()} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Team Retro' } });

    await act(async () => {
      await flush();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create P2' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(response));
    expect(createSpy).toHaveBeenCalledWith('test-token', {
      blog_name: 'team-retro',
      blog_title: 'Team Retro',
    });
  });

  it('shows an inline error when the slug is taken at submit time', async () => {
    vi.spyOn(wpcom, 'checkSlugAvailable').mockResolvedValue('available');
    vi.spyOn(wpcom, 'createP2Site').mockRejectedValue(new Error('Blog name is already taken'));

    wrap(<CreateP2Dialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Team Retro' } });

    await act(async () => {
      await flush();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create P2' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/already taken/i);
    });
  });

  it('surfaces raw API error messages for other failures', async () => {
    vi.spyOn(wpcom, 'checkSlugAvailable').mockResolvedValue('available');
    vi.spyOn(wpcom, 'createP2Site').mockRejectedValue(new Error('lang_id is required'));

    wrap(<CreateP2Dialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Team Retro' } });

    await act(async () => {
      await flush();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create P2' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/lang_id is required/i);
    });
  });
});
