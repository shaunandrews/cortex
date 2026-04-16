import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Callback from './Callback';
import { AuthProvider } from './AuthContext';

vi.mock('../api/wpcom', () => ({
  getMe: vi.fn(),
}));

vi.mock('../lib/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}));

import { getMe } from '../api/wpcom';
const mockedGetMe = vi.mocked(getMe);

function renderCallback(hash: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hash },
    writable: true,
  });

  return render(
    <MemoryRouter initialEntries={['/callback']}>
      <AuthProvider>
        <Callback />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Callback', () => {
  it('shows error when no access token in hash', async () => {
    renderCallback('');

    await waitFor(() => {
      expect(screen.getByText('No access token received')).toBeInTheDocument();
    });
  });

  it('shows error on state mismatch', async () => {
    sessionStorage.setItem('cortex_oauth_state', 'correct-state');
    renderCallback('#access_token=tok123&state=wrong-state');

    await waitFor(() => {
      expect(screen.getByText(/State mismatch/)).toBeInTheDocument();
    });
  });

  it('shows error when login fails', async () => {
    sessionStorage.setItem('cortex_oauth_state', 'good-state');
    mockedGetMe.mockRejectedValue(new Error('network error'));

    renderCallback('#access_token=tok123&state=good-state');

    await waitFor(() => {
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    });
  });

  it('shows authenticating message while in progress', () => {
    sessionStorage.setItem('cortex_oauth_state', 'state1');
    mockedGetMe.mockReturnValue(new Promise(() => {})); // never resolves

    renderCallback('#access_token=tok123&state=state1');

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
  });
});
