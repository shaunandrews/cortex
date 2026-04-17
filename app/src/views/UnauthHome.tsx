import { Button, Icon } from '@wordpress/ui';
import { wordpress } from '@wordpress/icons';
import NeuralConstellation from '../NeuralConstellation';

export default function UnauthHome() {
  function handleConnect() {
    const state = crypto.randomUUID();
    sessionStorage.setItem('cortex_oauth_state', state);
    sessionStorage.setItem('cortex_return_to', window.location.pathname);

    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_WPCOM_CLIENT_ID,
      redirect_uri: `${window.location.origin}/callback`,
      response_type: 'token',
      scope: 'global',
      state,
    });

    window.location.href = `https://public-api.wordpress.com/oauth2/authorize?${params}`;
  }

  return (
    <>
      <NeuralConstellation />
      <div className="unauth-home">
        <div className="unauth-spacer-top" />
        <div className="unauth-content">
          <h1 className="unauth-title">Cortex</h1>
          <p className="unauth-tagline">The AI-native workspace for Automattic</p>
          <div className="unauth-cta">
            <Button onClick={handleConnect}>
              <Icon icon={wordpress} size={20} />
              Connect with WordPress.com
            </Button>
          </div>
        </div>
        <div className="unauth-spacer-bottom" />
      </div>
    </>
  );
}
