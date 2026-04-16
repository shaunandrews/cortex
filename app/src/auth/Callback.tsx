import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Callback() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      // Parse the hash fragment: #access_token=...&token_type=bearer&state=...
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      const accessToken = params.get('access_token');
      const state = params.get('state');

      // Validate state
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
        navigate('/', { replace: true });
      } catch {
        setError('Authentication failed');
      }
    }

    handleCallback();
  }, [login, navigate]);

  if (error) {
    return (
      <div className="container">
        <p style={{ color: '#ef4444' }}>{error}</p>
        <a href="/" style={{ color: '#666', marginTop: 16 }}>
          Back to home
        </a>
      </div>
    );
  }

  return (
    <div className="container">
      <p className="tagline">Authenticating…</p>
    </div>
  );
}
