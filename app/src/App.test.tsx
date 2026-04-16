import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import App from './App';

vi.mock('./api/wpcom', () => ({
  getMe: vi.fn().mockRejectedValue(new Error('no token')),
  getMySites: vi.fn().mockResolvedValue({ sites: [] }),
}));

vi.mock('./lib/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}));

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('App', () => {
  it('shows UnauthHome when not logged in', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Connect with WordPress.com/ }),
      ).toBeInTheDocument();
    });
  });

  it('shows loading state initially when token exists', () => {
    localStorage.setItem('cortex_token', 'some-token');

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders callback route at /callback', async () => {
    render(
      <MemoryRouter initialEntries={['/callback']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No access token received')).toBeInTheDocument();
    });
  });
});
