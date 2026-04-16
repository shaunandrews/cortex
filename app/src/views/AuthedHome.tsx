import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getMySites } from '../api/wpcom';
import type { WPComSite } from '../api/types';

export default function AuthedHome() {
  const { user, token, logout } = useAuth();
  const [sites, setSites] = useState<WPComSite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    getMySites(token)
      .then((res) => {
        // Filter to P2 sites
        const p2Sites = res.sites.filter((s) => s.options?.is_wpforteams_site);
        setSites(p2Sites);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="authed-layout">
      <header className="header">
        <div className="header-left">
          <span className="header-logo">◈</span>
          <span className="header-title">Cortex</span>
        </div>
        <div className="header-right">
          {user && (
            <>
              <img src={user.avatar_URL} alt="" className="avatar" />
              <span className="username">{user.display_name}</span>
            </>
          )}
          <button className="sign-out" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="main">
        <h2>Your P2 Sites</h2>
        {loading ? (
          <p className="tagline">Loading…</p>
        ) : sites.length === 0 ? (
          <p className="tagline">No P2 sites found.</p>
        ) : (
          <div className="sites-grid">
            {sites.map((site) => (
              <a
                key={site.ID}
                href={site.URL}
                target="_blank"
                rel="noopener noreferrer"
                className="site-card"
              >
                <div className="site-icon">
                  {site.icon?.img ? (
                    <img src={site.icon.img} alt="" />
                  ) : (
                    <span>{site.name.charAt(0)}</span>
                  )}
                </div>
                <div className="site-info">
                  <div className="site-name">{site.name}</div>
                  <div className="site-url">{site.URL.replace('https://', '')}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
