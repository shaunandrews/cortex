import { useMemo } from 'react';
import { Button, Text, IconButton } from '@wordpress/ui';
import { trendingDown, trendingUp, closeSmall } from '@wordpress/icons';
import { useAuth } from '../auth/AuthContext';
import { useStarredSites } from '../hooks/useStarredSites';
import { useP2Sites } from '../hooks/useP2Sites';
import { useP2Posts } from '../hooks/useP2Posts';
import { useMentions } from '../hooks/useMentions';
import { useRouteState } from '../hooks/useRouteState';
import { useSubscriptionCleanup } from '../hooks/useSubscriptionCleanup';
import { useSubscriptionDiscovery } from '../hooks/useSubscriptionDiscovery';
import { isXPost } from '../lib/xpost';
import { relativeTime } from '../lib/relativeTime';
import type { WPComSite, WPComNotification } from '../api/types';
import type { SiteSuggestion } from '../api/wpcom';
import { EmptyState, PostRowCard, SiteIcon } from '../components';

function decodeEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function getMentionSubject(note: WPComNotification): string {
  return note.subject?.map((s) => s.text).join('') || 'Mentioned you';
}

function HomeMentions({
  onSelectPost,
}: {
  onSelectPost: (siteId: number, postId: number) => void;
}) {
  const { data: mentions } = useMentions();
  const { data: sites } = useP2Sites();
  const recent = mentions.slice(0, 10);

  const siteMap = useMemo(() => {
    const map = new Map<number, WPComSite>();
    sites?.forEach((s) => map.set(s.ID, s));
    return map;
  }, [sites]);

  if (!recent.length) return null;

  return (
    <div className="home-mentions-section">
      <Text variant="heading-lg" render={<h2 />} className="home-section-title">
        Mentions
      </Text>
      <div className="home-mentions-list">
        {recent.map((note) => {
          const siteId = note.meta?.ids?.site;
          const postId = note.meta?.ids?.post;
          const site = siteId ? siteMap.get(siteId) : undefined;
          return (
            <PostRowCard
              key={note.id}
              title={getMentionSubject(note)}
              authorAvatar={note.icon}
              siteIcon={site?.icon?.img}
              siteName={site ? decodeEntities(site.name) : note.title || undefined}
              date={relativeTime(note.timestamp)}
              onClick={siteId && postId ? () => onSelectPost(siteId, postId) : undefined}
              disabled={!siteId || !postId}
            />
          );
        })}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  sites,
  actionLabel,
  onAction,
  onDismiss,
}: {
  suggestion: SiteSuggestion;
  sites: WPComSite[] | undefined;
  actionLabel: string;
  onAction: (siteId: number) => void;
  onDismiss: (siteId: number) => void;
}) {
  const site = sites?.find((s) => s.ID === suggestion.siteId);
  const name = site ? decodeEntities(site.name) : suggestion.siteName;

  return (
    <div className="suggestion-card">
      <div className="suggestion-card-header">
        <SiteIcon name={name} src={site?.icon?.img} />
        <div className="suggestion-card-info">
          <Text variant="body-lg" className="suggestion-card-name">
            {name}
          </Text>
          <Text variant="body-sm" className="suggestion-card-reason">
            {suggestion.reason}
          </Text>
        </div>
        <div className="suggestion-card-actions">
          <Button
            variant="outline"
            tone="neutral"
            size="compact"
            onClick={() => onAction(suggestion.siteId)}
          >
            {actionLabel}
          </Button>
          <IconButton
            variant="minimal"
            tone="neutral"
            size="compact"
            icon={closeSmall}
            label="Dismiss"
            onClick={() => onDismiss(suggestion.siteId)}
          />
        </div>
      </div>
    </div>
  );
}

function SubscriptionCleanup({ sites }: { sites: WPComSite[] | undefined }) {
  const { suggestions, isLoading, error, analyze, unfollow, dismiss, reset } =
    useSubscriptionCleanup();

  return (
    <div className="home-subscription-action">
      {suggestions === null && !isLoading && (
        <Button variant="outline" tone="neutral" size="default" onClick={analyze}>
          <Button.Icon icon={trendingDown} />
          Find sites to unfollow
        </Button>
      )}
      {isLoading && (
        <div className="suggestion-loading">
          <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
            Analyzing your subscriptions...
          </Text>
        </div>
      )}
      {error && (
        <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-error-weak)' }}>
          {error}
        </Text>
      )}
      {suggestions !== null && (
        <div className="suggestion-results">
          <div className="suggestion-results-header">
            <Text variant="heading-lg" render={<h2 />} className="home-section-title">
              Sites to unfollow
            </Text>
            <Button variant="minimal" tone="neutral" size="compact" onClick={reset}>
              Done
            </Button>
          </div>
          {suggestions.length === 0 ? (
            <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
              All your subscriptions look healthy.
            </Text>
          ) : (
            <div className="suggestion-list">
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.siteId}
                  suggestion={s}
                  sites={sites}
                  actionLabel="Unfollow"
                  onAction={unfollow}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubscriptionDiscovery({ sites }: { sites: WPComSite[] | undefined }) {
  const { suggestions, isLoading, error, analyze, follow, dismiss, reset } =
    useSubscriptionDiscovery();

  return (
    <div className="home-subscription-action">
      {suggestions === null && !isLoading && (
        <Button variant="outline" tone="neutral" size="default" onClick={analyze}>
          <Button.Icon icon={trendingUp} />
          Discover sites to follow
        </Button>
      )}
      {isLoading && (
        <div className="suggestion-loading">
          <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
            Finding sites you might like...
          </Text>
        </div>
      )}
      {error && (
        <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-error-weak)' }}>
          {error}
        </Text>
      )}
      {suggestions !== null && (
        <div className="suggestion-results">
          <div className="suggestion-results-header">
            <Text variant="heading-lg" render={<h2 />} className="home-section-title">
              Sites to follow
            </Text>
            <Button variant="minimal" tone="neutral" size="compact" onClick={reset}>
              Done
            </Button>
          </div>
          {suggestions.length === 0 ? (
            <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
              You're following all the active P2s you have access to.
            </Text>
          ) : (
            <div className="suggestion-list">
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.siteId}
                  suggestion={s}
                  sites={sites}
                  actionLabel="Follow"
                  onAction={follow}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
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
        <div className="home-subscription-actions">
          <SubscriptionCleanup sites={sites} />
          <SubscriptionDiscovery sites={sites} />
        </div>
        <HomeMentions onSelectPost={selectPost} />
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
