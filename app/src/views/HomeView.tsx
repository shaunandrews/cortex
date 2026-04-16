import { Text } from '@wordpress/ui';
import { useAuth } from '../auth/AuthContext';
import { useStarredSites } from '../hooks/useStarredSites';
import { useP2Sites } from '../hooks/useP2Sites';
import { useP2Posts } from '../hooks/useP2Posts';
import { useRouteState } from '../hooks/useRouteState';
import { isXPost } from '../lib/xpost';
import { relativeTime } from '../lib/relativeTime';
import type { WPComSite } from '../api/types';

function decodeEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function HomeSitePosts({
  site,
  onSelectPost,
}: {
  site: WPComSite;
  onSelectPost: (siteId: number, postId: number) => void;
}) {
  const { data } = useP2Posts(site.ID);
  const posts = (data?.posts ?? []).filter((p) => !isXPost(p)).slice(0, 5);

  if (!posts.length) return null;

  return (
    <div className="home-site-section">
      <div className="home-site-header">
        <div className="home-site-icon">
          {site.icon?.img ? (
            <img src={site.icon.img} alt="" />
          ) : (
            <span>{decodeEntities(site.name).charAt(0).toUpperCase()}</span>
          )}
        </div>
        <Text variant="heading-lg" render={<h2 />} className="home-site-name">
          {decodeEntities(site.name)}
        </Text>
      </div>
      <div className="home-site-posts">
        {posts.map((post) => (
          <button
            key={post.ID}
            className="home-post-item"
            onClick={() => onSelectPost(site.ID, post.ID)}
          >
            {post.author?.avatar_URL && (
              <img src={post.author.avatar_URL} alt="" className="home-post-avatar" />
            )}
            <div className="home-post-body">
              <Text variant="body-md" className="home-post-title">
                {decodeEntities(post.title)}
              </Text>
              <Text variant="body-sm" className="home-post-meta">
                {post.author?.name}
                <span className="home-post-time">{relativeTime(post.date)}</span>
              </Text>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HomeView() {
  const { user } = useAuth();
  const { starredIds } = useStarredSites();
  const { data: sites } = useP2Sites();
  const { selectPost } = useRouteState();

  const starredSites = sites?.filter((s) => starredIds.has(s.ID)) ?? [];

  return (
    <div className="home-view">
      <div className="home-view-content">
        <Text variant="heading-2xl" render={<h1 />} className="page-title">
          {user ? `Hey, ${user.display_name.split(' ')[0]}` : 'Home'}
        </Text>
        {starredSites.length > 0 ? (
          <div className="home-favorites">
            {starredSites.map((site) => (
              <HomeSitePosts key={site.ID} site={site} onSelectPost={selectPost} />
            ))}
          </div>
        ) : (
          <Text variant="body-lg" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
            Star some sites to see recent posts here.
          </Text>
        )}
      </div>
    </div>
  );
}
