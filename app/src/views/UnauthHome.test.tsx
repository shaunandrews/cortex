import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UnauthHome from './UnauthHome';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});

describe('UnauthHome', () => {
  it('renders the branding and connect button', () => {
    render(<UnauthHome />);

    expect(screen.getByText('Cortex')).toBeInTheDocument();
    expect(screen.getByText('The AI-native workspace for Automattic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect with WordPress.com/ })).toBeInTheDocument();
  });

  it('stores OAuth state in sessionStorage on connect', async () => {
    vi.stubEnv('VITE_WPCOM_CLIENT_ID', 'test-client-id');
    vi.stubEnv('VITE_WPCOM_REDIRECT_URI', 'http://localhost:5176/callback');

    render(<UnauthHome />);
    await userEvent.click(screen.getByRole('button', { name: /Connect with WordPress.com/ }));

    const storedState = sessionStorage.getItem('cortex_oauth_state');
    expect(storedState).toBeTruthy();
    expect(storedState).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
