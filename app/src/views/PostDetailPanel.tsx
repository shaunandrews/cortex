import { useState, useEffect, useRef } from 'react';
import { Icon, IconButton, Text } from '@wordpress/ui';
import {
  closeSmall,
  chevronUp,
  comment as commentIcon,
  archive,
  external,
  starFilled,
  starEmpty,
} from '@wordpress/icons';
import { useP2Post } from '../hooks/useP2Post';
import { useP2Sites } from '../hooks/useP2Sites';
import { usePostComments } from '../hooks/usePostComments';
import { useToggleLike } from '../hooks/useToggleLike';
import { usePostSummary } from '../hooks/usePostSummary';
import { useMarkPostSeen } from '../hooks/useMarkAsSeen';
import { useSavedLookup, useSavePost, useSaveComment, useUnsaveItem } from '../saved/useSavedItems';
import { relativeTime } from '../lib/relativeTime';
import Markdown from 'react-markdown';
import { ActionButton, PanelHeader } from '../components';

function decodeEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

interface PostDetailPanelProps {
  siteId: number;
  postId: number;
  onClose: () => void;
}

export default function PostDetailPanel({ siteId, postId, onClose }: PostDetailPanelProps) {
  const { data: sites } = useP2Sites();
  const { data: post, isLoading: postLoading, error: postError } = useP2Post(siteId, postId);
  const { data: commentsData } = usePostComments(siteId, postId);
  const toggleLike = useToggleLike(siteId, postId);
  const {
    summary,
    isLoading: summaryLoading,
    error: summaryError,
    regenerate: regenerateSummary,
  } = usePostSummary(siteId, postId, post?.content);

  const [commentsOpen, setCommentsOpen] = useState(false);

  const savedLookup = useSavedLookup();
  const savePost = useSavePost();
  const saveComment = useSaveComment();
  const unsaveItem = useUnsaveItem();

  const markPostSeen = useMarkPostSeen();
  const markedSeenRef = useRef(new Set<string>());

  // Close comments drawer when switching posts
  useEffect(() => {
    setCommentsOpen(false);
  }, [postId]);

  // Mark post as seen when opened
  useEffect(() => {
    const key = `${siteId}-${postId}`;
    if (markedSeenRef.current.has(key)) return;
    markedSeenRef.current.add(key);
    markPostSeen(siteId, postId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, postId]);

  if (postLoading) {
    return (
      <div className="post-detail">
        <div className="feed-status">
          <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
            Loading...
          </Text>
        </div>
      </div>
    );
  }

  if (postError) {
    return (
      <div className="post-detail">
        <div className="feed-status">
          <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-error-weak)' }}>
            Couldn't load post
          </Text>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const postKey = `post:${post.site_ID}:${post.ID}`;
  const savedId = savedLookup.get(postKey);
  const isSaved = savedId != null;

  return (
    <div className="post-detail">
      <PanelHeader
        start={
          <Text variant="body-sm" className="post-detail-header-title">
            {decodeEntities(post.title)}
          </Text>
        }
        end={
          <>
            <IconButton
              variant="minimal"
              tone="neutral"
              size="compact"
              icon={external}
              label="Open in new tab"
              onClick={() => window.open(post.URL, '_blank')}
            />
            <IconButton
              variant="minimal"
              tone="neutral"
              size="compact"
              icon={closeSmall}
              label="Close"
              onClick={onClose}
            />
          </>
        }
      />
      <article className="post-detail-article">
        <Text variant="heading-2xl" render={<h1 />} className="post-detail-title page-title">
          {post.title}
        </Text>
        <div className="post-detail-meta">
          <img src={post.author.avatar_URL} alt={post.author.name} className="post-detail-avatar" />
          <Text variant="body-md">{post.author.name}</Text>
          <Text variant="body-sm" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
            {relativeTime(post.date)}
          </Text>
        </div>
        {(() => {
          const tagList = post.tags ? Object.values(post.tags) : [];
          const catList = post.categories ? Object.values(post.categories) : [];
          const allTerms = [
            ...catList.map((c) => ({ ...c, type: 'category' as const })),
            ...tagList.map((t) => ({ ...t, type: 'tag' as const })),
          ];
          return allTerms.length > 0 ? (
            <div className="post-detail-terms">
              {allTerms.map((term) => (
                <span key={`${term.type}-${term.slug}`} className="post-detail-term">
                  {decodeEntities(term.name)}
                </span>
              ))}
            </div>
          ) : null;
        })()}
        {(summary || summaryLoading || summaryError) && (
          <div className="post-summary">
            <div className="post-summary-header">
              <Text variant="body-sm" className="post-summary-label">
                AI Summary
              </Text>
              <button
                className="post-summary-refresh"
                onClick={regenerateSummary}
                disabled={summaryLoading}
                title="Regenerate summary"
              >
                ↻
              </button>
            </div>
            {summary ? (
              <div className="post-summary-text">
                <Markdown>{summary}</Markdown>
              </div>
            ) : summaryError ? (
              <Text
                variant="body-sm"
                style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
              >
                {summaryError}{' '}
                <button className="post-summary-retry" onClick={regenerateSummary}>
                  Retry
                </button>
              </Text>
            ) : (
              <Text
                variant="body-sm"
                style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
              >
                Generating summary...
              </Text>
            )}
          </div>
        )}

        <div
          className="post-detail-content"
          dangerouslySetInnerHTML={{ __html: post.content ?? '' }}
        />
      </article>

      <footer className={`post-detail-footer${commentsOpen ? ' is-open' : ''}`}>
        <div className="post-detail-footer-bar">
          <ActionButton
            icon={<Icon icon={post.i_like ? starFilled : starEmpty} size={20} />}
            variant="danger"
            isActive={!!post.i_like}
            onClick={() => toggleLike.mutate(!!post.i_like)}
            disabled={toggleLike.isPending}
            aria-label={post.i_like ? 'Unlike' : 'Like'}
          >
            {(post.like_count ?? 0) > 0 ? post.like_count : null}
          </ActionButton>
          <ActionButton
            icon={<Icon icon={archive} size={20} />}
            isActive={isSaved}
            onClick={() => {
              if (isSaved) {
                unsaveItem.mutate(savedId);
              } else {
                const site = sites?.find((s) => s.ID === post.site_ID);
                savePost.mutate({
                  post,
                  siteName: site?.name ?? post.site_name ?? '',
                  siteURL: site?.URL ?? post.site_URL ?? '',
                });
              }
            }}
            disabled={savePost.isPending || unsaveItem.isPending}
          >
            {isSaved ? 'Saved' : 'Save'}
          </ActionButton>
          {commentsData && commentsData.comments.length > 0 && (
            <button
              className="comments-drawer-toggle"
              onClick={() => setCommentsOpen(!commentsOpen)}
            >
              <div className="comments-drawer-info">
                <Icon icon={commentIcon} size={18} />
                <Text variant="body-sm" className="comments-drawer-count">
                  {commentsData.found === 1 ? '1 comment' : `${commentsData.found} comments`}
                </Text>
              </div>
              <div className="comments-facepile">
                {(() => {
                  const seen = new Set<string>();
                  return commentsData.comments
                    .filter((c) => {
                      if (seen.has(c.author.avatar_URL)) return false;
                      seen.add(c.author.avatar_URL);
                      return true;
                    })
                    .slice(0, 5)
                    .map((c) => (
                      <img
                        key={c.author.avatar_URL}
                        src={c.author.avatar_URL}
                        alt={c.author.name}
                        className="comments-facepile-avatar"
                      />
                    ));
                })()}
              </div>
              <Icon icon={chevronUp} size={20} />
            </button>
          )}
        </div>
        {commentsData && commentsData.comments.length > 0 && (
          <div className={`collapsible${commentsOpen ? ' is-open' : ''}`}>
            <div className="collapsible-body">
              <div className="comments-drawer-content">
                <div className="comments-list">
                  {commentsData.comments.map((c) => {
                    const commentKey = `comment:${post.site_ID}:${post.ID}:${c.ID}`;
                    const cSavedId = savedLookup.get(commentKey);
                    const cIsSaved = cSavedId != null;
                    return (
                      <div key={c.ID} className={`comment${c.parent ? ' comment-nested' : ''}`}>
                        <div className="comment-header">
                          <img
                            src={c.author.avatar_URL}
                            alt={c.author.name}
                            className="comment-avatar"
                          />
                          <Text variant="body-sm" className="comment-author">
                            {c.author.name}
                          </Text>
                          <Text
                            variant="body-sm"
                            style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                          >
                            {relativeTime(c.date)}
                          </Text>
                          <button
                            className={`comment-save-button${cIsSaved ? ' is-saved' : ''}`}
                            onClick={() => {
                              if (cIsSaved) {
                                unsaveItem.mutate(cSavedId);
                              } else {
                                const site = sites?.find((s) => s.ID === post.site_ID);
                                saveComment.mutate({
                                  comment: c,
                                  post,
                                  siteName: site?.name ?? post.site_name ?? '',
                                  siteURL: site?.URL ?? post.site_URL ?? '',
                                });
                              }
                            }}
                          >
                            <Icon icon={archive} size={12} />
                            <span>{cIsSaved ? 'Saved' : 'Save'}</span>
                          </button>
                        </div>
                        <div
                          className="comment-body"
                          dangerouslySetInnerHTML={{ __html: c.content }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
