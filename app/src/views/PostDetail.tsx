import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Button, Icon, Text, Popover, VisuallyHidden } from '@wordpress/ui';
import { wordpress } from '@wordpress/icons';
import { useAuth } from '../auth/AuthContext';
import { useP2Post } from '../hooks/useP2Post';
import { useP2Sites } from '../hooks/useP2Sites';
import { usePostComments } from '../hooks/usePostComments';
import { useToggleLike } from '../hooks/useToggleLike';
import { relativeTime } from '../lib/relativeTime';

export default function PostDetail() {
  const { siteId, postId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthed, isLoading: authLoading, logout } = useAuth();

  const numSiteId = Number(siteId);
  const numPostId = Number(postId);

  const { data: sites } = useP2Sites();
  const site = sites?.find((s) => s.ID === numSiteId);

  const { data: post, isLoading, error } = useP2Post(numSiteId, numPostId);
  const { data: commentsData } = usePostComments(numSiteId, numPostId);
  const toggleLike = useToggleLike(numSiteId, numPostId);

  if (authLoading) {
    return (
      <div className="authed-layout">
        <div className="feed-status">
          <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
            Loading...
          </Text>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="authed-layout">
      <header className="header">
        <div className="header-brand">
          <Button
            variant="minimal"
            tone="neutral"
            size="compact"
            onClick={() => navigate(-1)}
            className="back-button"
          >
            &larr;
          </Button>
          <Icon icon={wordpress} size={20} />
          <Text variant="heading-lg" className="header-wordmark">
            Cortex
          </Text>
        </div>
        {user && (
          <Popover.Root>
            <Popover.Trigger render={<button className="avatar-trigger" />}>
              <img src={user.avatar_URL} alt={user.display_name} className="avatar" />
            </Popover.Trigger>
            <Popover.Popup align="end" sideOffset={4} className="avatar-menu">
              <VisuallyHidden>
                <Popover.Title>Account menu</Popover.Title>
              </VisuallyHidden>
              <Text variant="body-sm" className="avatar-menu-name">
                {user.display_name}
              </Text>
              <Button
                variant="minimal"
                tone="neutral"
                size="compact"
                onClick={logout}
                className="avatar-menu-action"
              >
                Sign out
              </Button>
            </Popover.Popup>
          </Popover.Root>
        )}
      </header>

      <main className="post-detail">
        {isLoading ? (
          <div className="feed-status">
            <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
              Loading...
            </Text>
          </div>
        ) : error ? (
          <div className="feed-status">
            <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-error-weak)' }}>
              Couldn't load post
            </Text>
          </div>
        ) : post ? (
          <article className="post-detail-article">
            {site && (
              <Text variant="body-sm" className="post-detail-site">
                {site.name}
              </Text>
            )}
            <Text variant="heading-2xl" render={<h1 />} className="post-detail-title page-title">
              {post.title}
            </Text>
            <div className="post-detail-meta">
              <img
                src={post.author.avatar_URL}
                alt={post.author.name}
                className="post-detail-avatar"
              />
              <Text variant="body-md">{post.author.name}</Text>
              <Text
                variant="body-sm"
                style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
              >
                {relativeTime(post.date)}
              </Text>
            </div>
            <div
              className="post-detail-content"
              dangerouslySetInnerHTML={{ __html: post.content ?? '' }}
            />

            <div className="post-detail-actions">
              <button
                className={`like-button${post.i_like ? ' is-liked' : ''}`}
                onClick={() => toggleLike.mutate(!!post.i_like)}
                disabled={toggleLike.isPending}
              >
                <span className="like-icon">{post.i_like ? '♥' : '♡'}</span>
                {(post.like_count ?? 0) > 0 && (
                  <span className="like-count">{post.like_count}</span>
                )}
              </button>
            </div>

            {commentsData && commentsData.comments.length > 0 && (
              <section className="comments-section">
                <Text variant="heading-lg" render={<h2 />} className="comments-heading page-title">
                  {commentsData.found === 1 ? '1 comment' : `${commentsData.found} comments`}
                </Text>
                <div className="comments-list">
                  {commentsData.comments.map((comment) => (
                    <div
                      key={comment.ID}
                      className={`comment${comment.parent ? ' comment-nested' : ''}`}
                    >
                      <div className="comment-header">
                        <img
                          src={comment.author.avatar_URL}
                          alt={comment.author.name}
                          className="comment-avatar"
                        />
                        <Text variant="body-sm" className="comment-author">
                          {comment.author.name}
                        </Text>
                        <Text
                          variant="body-sm"
                          style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                        >
                          {relativeTime(comment.date)}
                        </Text>
                      </div>
                      <div
                        className="comment-body"
                        dangerouslySetInnerHTML={{ __html: comment.content }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </article>
        ) : null}
      </main>
    </div>
  );
}
