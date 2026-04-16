import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Text, Link, Notice } from '@wordpress/ui';
import { useAuth } from './AuthContext';

export default function Callback() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      const accessToken = params.get('access_token');
      const state = params.get('state');

      const storedState = sessionStorage.getItem('cortex_oauth_state');
      sessionStorage.removeItem('cortex_oauth_state');

      if (!accessToken) {
        setError('No access token received');
        return;
      }

      if (!state || state !== storedState) {
        setError('State mismatch — possible CSRF attack');
        return;
      }

      try {
        await login(accessToken);
        const returnTo = sessionStorage.getItem('cortex_return_to') || '/';
        sessionStorage.removeItem('cortex_return_to');
        navigate(returnTo, { replace: true });
      } catch {
        setError('Authentication failed');
      }
    }

    handleCallback();
  }, [login, navigate]);

  if (error) {
    return (
      <Stack direction="column" align="center" justify="center" gap="lg" style={{ height: '100%' }}>
        <Notice.Root intent="error" style={{ maxWidth: 'var(--wpds-dimension-surface-width-md)' }}>
          <Notice.Title>Authentication Error</Notice.Title>
          <Notice.Description>{error}</Notice.Description>
        </Notice.Root>
        <Link href="/" tone="neutral">
          Back to home
        </Link>
      </Stack>
    );
  }

  return (
    <Stack direction="column" align="center" justify="center" gap="md" style={{ height: '100%' }}>
      <Text variant="body-lg" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
        Authenticating...
      </Text>
    </Stack>
  );
}
