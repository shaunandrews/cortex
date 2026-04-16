export default function UnauthHome() {
  function handleConnect() {
    const state = crypto.randomUUID();
    sessionStorage.setItem('cortex_oauth_state', state);

    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_WPCOM_CLIENT_ID,
      redirect_uri: import.meta.env.VITE_WPCOM_REDIRECT_URI,
      response_type: 'token',
      scope: 'global',
      state,
    });

    window.location.href = `https://public-api.wordpress.com/oauth2/authorize?${params}`;
  }

  return (
    <div className="container">
      <div className="logo">◈</div>
      <h1>Cortex</h1>
      <p className="tagline">The AI-native workspace for Automattic</p>
      <button className="connect-btn" onClick={handleConnect}>
        Connect with WordPress.com
      </button>
    </div>
  );
}
