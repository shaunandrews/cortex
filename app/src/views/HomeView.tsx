import { Text } from '@wordpress/ui';
import { useAuth } from '../auth/AuthContext';
import { useStarredSites } from '../hooks/useStarredSites';
import { useP2Sites } from '../hooks/useP2Sites';
import { useP2Posts } from '../hooks/useP2Posts';
import { useRouteState } from '../hooks/useRouteState';
import { isXPost } from '../lib/xpost';
import { relativeTime } from '../lib/relativeTime';
import type { WPComSite } from '../api/types';
import { EmptyState, PostRowCard, SiteIcon } from '../components';

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
        <SiteIcon name={decodeEntities(site.name)} src={site.icon?.img} />
        <Text variant="heading-lg" render={<h2 />} className="home-site-name">
          {decodeEntities(site.name)}
        </Text>
      </div>
      <div className="home-site-posts">
        {posts.map((post) => (
          <PostRowCard
            key={post.ID}
            title={decodeEntities(post.title)}
            author={post.author?.name}
            authorAvatar={post.author?.avatar_URL}
            date={relativeTime(post.date)}
            onClick={() => onSelectPost(site.ID, post.ID)}
          />
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
          <EmptyState
            title="No favorites yet"
            message="Star sites in the sidebar to see recent posts from them here."
          />
        )}
      </div>
    </div>
  );
}
