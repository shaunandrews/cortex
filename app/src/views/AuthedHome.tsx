import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from 'react';
import { useRouteState } from '../hooks/useRouteState';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { Button, Icon, IconButton, Text, Popover, VisuallyHidden } from '@wordpress/ui';
import {
  wordpress,
  check,
  starFilled,
  starEmpty,
  rotateRight,
  closeSmall,
  chevronUp,
  comment as commentIcon,
  external,
  archive,
} from '@wordpress/icons';
import { useAuth } from '../auth/AuthContext';
import { useP2Sites } from '../hooks/useP2Sites';
import { useP2Posts } from '../hooks/useP2Posts';
import { useP2Post } from '../hooks/useP2Post';
import { usePostComments } from '../hooks/usePostComments';
import { useToggleLike } from '../hooks/useToggleLike';
import { useSidebarGroups } from '../hooks/useSidebarGroups';
import { useFollowing } from '../hooks/useFollowing';
import { useMarkAsSeen, useMarkAllAsSeen } from '../hooks/useMarkAsSeen';
import { useCreatePost } from '../hooks/useCreatePost';
import { CreateP2Dialog } from './CreateP2Dialog';
import { usePostSummary } from '../hooks/usePostSummary';
import { relativeTime } from '../lib/relativeTime';
import { useSyncStatus } from '../sync/SyncProvider';
import Markdown from 'react-markdown';
import { getXPostOrigin, cleanXPostTitle, parseXPostSource } from '../lib/xpost';
import HomeView from './HomeView';
import SavedCollection from '../saved/SavedCollection';
import Sidebar from './sidebar/Sidebar';
import {
  useSavedLookup,
  useSavePost,
  useSaveComment,
  useUnsaveItem,
} from '../saved/useSavedItems';

function decodeEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.trim() || '';
}

function extractImages(html: string): string[] {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('img'))
    .map((img) => img.src)
    .filter(
      (src) =>
        src && !src.includes('gravatar.com') && !src.includes('emoji') && !src.includes('s.w.org'),
    );
}

function SyncStatusBar() {
  const { phase, progress, lastPollAt } = useSyncStatus();

  if (phase === 'idle') return null;

  let label = '';
  if (phase === 'bootstrapping') {
    label = 'Connecting…';
  } else if (phase === 'prefetching') {
    label = `Syncing ${progress.fetched} of ${progress.total} sites`;
  } else if (phase === 'maintaining') {
    label = lastPollAt
      ? `Live · Updated ${relativeTime(new Date(lastPollAt).toISOString())}`
      : 'Live';
  }

  const showProgress = phase === 'prefetching' && progress.total > 0;
  const pct = showProgress ? (progress.fetched / progress.total) * 100 : 0;

  return (
    <div className="sync-status">
      {showProgress && (
        <div className="sync-status-bar">
          <div className="sync-status-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      <Text variant="body-sm" className="sync-status-label">
        {label}
      </Text>
    </div>
  );
}

export default function AuthedHome() {
  const { user, logout } = useAuth();
  const { data: sites } = useP2Sites();
  const { data: following } = useFollowing();
  const markAsSeen = useMarkAsSeen();
  const markAllAsSeen = useMarkAllAsSeen();

  const unseenMap = useMemo(() => {
    const map = new Map<number, number>();
    if (following) {
      for (const sub of following) {
        const blogId = Number(sub.blog_ID);
        if (blogId > 0 && sub.unseen_count > 0) {
          map.set(blogId, sub.unseen_count);
        }
      }
    }
    return map;
  }, [following]);

  const {
    selectedSiteId,
    detailSiteId,
    detailPostId,
    hasDetail,
    selectSite,
    selectPost,
    closeDetail,
    goHome,
    goSaved,
    isSavedView,
  } = useRouteState();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const isHome = !selectedSiteId && !isSavedView;

  const savedLookup = useSavedLookup();
  const savePost = useSavePost();
  const saveComment = useSaveComment();
  const unsaveItem = useUnsaveItem();

  const markedSeenRef = useRef(new Set<string>());

  const { defaultLayout: outerLayout, onLayoutChanged: onOuterLayoutChanged } = useDefaultLayout({
    id: 'cortex-outer',
  });
  const { defaultLayout: feedLayout, onLayoutChanged: onFeedLayoutChanged } = useDefaultLayout({
    id: 'cortex-feed',
  });

  const {
    data: post,
    isLoading: postLoading,
    error: postError,
  } = useP2Post(detailSiteId ?? 0, detailPostId ?? 0);
  const { data: commentsData } = usePostComments(detailSiteId ?? 0, detailPostId ?? 0);
  const toggleLike = useToggleLike(detailSiteId ?? 0, detailPostId ?? 0);
  const {
    summary,
    isLoading: summaryLoading,
    regenerate: regenerateSummary,
  } = usePostSummary(detailSiteId ?? 0, detailPostId ?? 0, post?.content);

  // Close comments drawer when switching posts
  useEffect(() => {
    setCommentsOpen(false);
  }, [detailPostId]);

  const followingMap = useMemo(() => {
    const map = new Map<number, { unseen_count: number; last_updated: number }>();
    if (following) {
      for (const sub of following) {
        const blogId = Number(sub.blog_ID);
        if (blogId > 0) {
          map.set(blogId, {
            unseen_count: sub.unseen_count ?? 0,
            last_updated: sub.last_updated ?? 0,
          });
        }
      }
    }
    return map;
  }, [following]);

  const sidebarStore = useSidebarGroups({ sites, followingMap });
  const { starredIds, toggleFavorite } = sidebarStore;

  const selectedSite = sites?.find((s) => s.ID === selectedSiteId);
  const {
    data: postsData,
    isLoading: postsLoading,
    error: postsError,
    refetch: refetchPosts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useP2Posts(selectedSiteId);

  const feedScrollRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const prevSiteRef = useRef<number | null>(null);
  const prevScrollHeightRef = useRef(0);

  const createPost = useCreatePost(selectedSiteId);

  // Scroll to bottom when switching sites
  useEffect(() => {
    if (!selectedSiteId || !postsData?.posts.length) return;
    if (prevSiteRef.current === selectedSiteId) return;
    prevSiteRef.current = selectedSiteId;
    const el = feedScrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [selectedSiteId, postsData]);

  // Maintain scroll position after older posts are prepended
  useLayoutEffect(() => {
    const el = feedScrollRef.current;
    const prev = prevScrollHeightRef.current;
    if (!el || !prev) return;
    const added = el.scrollHeight - prev;
    if (added > 0) {
      el.scrollTop += added;
    }
    prevScrollHeightRef.current = 0;
  }, [postsData]);

  // Load older posts when scrolled near the top
  const handleFeedScroll = useCallback(() => {
    const el = feedScrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollTop < 200) {
      prevScrollHeightRef.current = el.scrollHeight;
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Mark post as seen when opened in the detail panel
  useEffect(() => {
    if (!detailSiteId || !detailPostId) return;
    const key = `${detailSiteId}-${detailPostId}`;
    if (markedSeenRef.current.has(key)) return;
    markedSeenRef.current.add(key);
    markAsSeen.mutate({
      blogId: detailSiteId,
      postIds: [detailPostId],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailSiteId, detailPostId]);

  const handleMarkAllRead = useCallback(
    (siteId: number) => {
      const sub = following?.find((s) => Number(s.blog_ID) === siteId);
      if (sub) {
        markAllAsSeen.mutate({
          feedId: Number(sub.feed_ID),
          blogId: siteId,
        });
      }
    },
    [following, markAllAsSeen],
  );

  const handleOpenSite = useCallback((site: { URL: string }) => {
    window.open(site.URL, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="authed-layout">
      <header className="header">
        <div className="header-brand">
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

      <Group
        orientation="horizontal"
        className="workspace"
        defaultLayout={outerLayout}
        onLayoutChanged={onOuterLayoutChanged}
      >
        <Panel
          id="sidebar"
          defaultSize={20}
          minSize={15}
          collapsible
          collapsedSize={0}
          className="panel"
        >
          <Sidebar
            store={sidebarStore}
            sites={sites}
            unseenMap={unseenMap}
            selectedSiteId={selectedSiteId}
            isHome={isHome}
            isSaved={isSavedView}
            onSelectSite={(id) => selectSite(id)}
            onGoHome={goHome}
            onGoSaved={goSaved}
            onCreateP2={() => setCreateOpen(true)}
            onOpenSite={handleOpenSite}
            onMarkAllRead={handleMarkAllRead}
            footer={<SyncStatusBar />}
          />
        </Panel>

        <Separator className="resize-handle" />

        <Panel id="main" defaultSize={80} minSize={40} className="panel">
          {isHome ? (
            <HomeView />
          ) : isSavedView ? (
            <SavedCollection
              onNavigate={(siteId, postId) => {
                selectPost(siteId, postId);
              }}
            />
          ) : (
          <Group
            orientation="horizontal"
            defaultLayout={feedLayout}
            onLayoutChanged={onFeedLayoutChanged}
          >
            <Panel id="feed" defaultSize={55} minSize={25} className="panel">
              <main className="feed">
                {(() => {
                  const feedPosts = postsData?.posts ?? [];

                  return (
                    <>
                      {selectedSiteId && (
                        <header className="panel-header">
                          <div className="panel-header-start">
                            <Text variant="heading-lg" render={<h2 />} className="page-title">
                              {selectedSite?.name ?? ''}
                            </Text>
                          </div>
                          <div className="panel-header-end">
                            {selectedSite &&
                              (unseenMap.get(selectedSite.ID) ?? 0) > 0 &&
                              (() => {
                                const sub = following?.find(
                                  (s) => Number(s.blog_ID) === selectedSite.ID,
                                );
                                return sub ? (
                                  <IconButton
                                    variant="minimal"
                                    tone="neutral"
                                    size="compact"
                                    icon={check}
                                    label="Mark all as read"
                                    onClick={() =>
                                      markAllAsSeen.mutate({
                                        feedId: Number(sub.feed_ID),
                                        blogId: selectedSite.ID,
                                      })
                                    }
                                  />
                                ) : null;
                              })()}
                            {selectedSite && (
                              <IconButton
                                variant="minimal"
                                tone="neutral"
                                size="compact"
                                icon={external}
                                label="Open site"
                                nativeButton={false}
                                render={
                                  <a
                                    href={selectedSite.URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  />
                                }
                              />
                            )}
                            {selectedSite && (
                              <IconButton
                                variant="minimal"
                                tone="neutral"
                                size="compact"
                                icon={starredIds.has(selectedSite.ID) ? starFilled : starEmpty}
                                label={starredIds.has(selectedSite.ID) ? 'Unfavorite' : 'Favorite'}
                                onClick={() => toggleFavorite(selectedSite.ID)}
                              />
                            )}
                            <IconButton
                              variant="minimal"
                              tone="neutral"
                              size="compact"
                              icon={rotateRight}
                              label="Refresh"
                              onClick={() => refetchPosts()}
                            />
                          </div>
                        </header>
                      )}
                      {!selectedSiteId ? (
                        <div className="feed-empty">
                          <Text
                            variant="body-md"
                            style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                          >
                            Select a P2 to see its posts
                          </Text>
                        </div>
                      ) : postsLoading ? (
                        <div className="feed-status">
                          <Text
                            variant="body-md"
                            style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                          >
                            Loading...
                          </Text>
                        </div>
                      ) : postsError ? (
                        <div className="feed-status">
                          <Text
                            variant="body-md"
                            style={{ color: 'var(--wpds-color-fg-content-error-weak)' }}
                          >
                            Couldn't load posts
                          </Text>
                        </div>
                      ) : !feedPosts.length ? (
                        <div className="feed-status">
                          <Text
                            variant="body-md"
                            style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                          >
                            No posts yet
                          </Text>
                        </div>
                      ) : (
                        <div className="feed-scroll" ref={feedScrollRef} onScroll={handleFeedScroll}>
                          <div className="feed-posts">
                            {isFetchingNextPage && (
                              <div className="feed-load-more">
                                <Text
                                  variant="body-sm"
                                  style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                                >
                                  Loading older posts...
                                </Text>
                              </div>
                            )}
                            {[...feedPosts].reverse().map((feedPost) => {
                              const xOrigin = getXPostOrigin(feedPost);

                              if (xOrigin) {
                                const sourceName = parseXPostSource(stripHtml(feedPost.excerpt));
                                const originSite = sites?.find((s) => s.ID === xOrigin.blogId);
                                return (
                                  <article
                                    key={feedPost.ID}
                                    className={`post post-xpost${xOrigin.postId === detailPostId && xOrigin.blogId === detailSiteId ? ' is-selected' : ''}`}
                                    onClick={(e) => {
                                      if (
                                        xOrigin.postId === detailPostId &&
                                        xOrigin.blogId === detailSiteId
                                      ) {
                                        closeDetail();
                                      } else {
                                        const el = e.currentTarget;
                                        selectPost(xOrigin.blogId, xOrigin.postId);
                                        setTimeout(
                                          () =>
                                            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
                                          220,
                                        );
                                      }
                                    }}
                                  >
                                    <svg
                                      className="xpost-icon"
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="16"
                                      height="16"
                                      fill="currentColor"
                                      viewBox="0 0 256 256"
                                      aria-hidden="true"
                                    >
                                      <path d="M237.66,178.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L212.69,192H168a8,8,0,0,1-6.51-3.35L83.88,80H32a8,8,0,0,1,0-16H88a8,8,0,0,1,6.51,3.35L172.12,176h40.57l-10.35-10.34a8,8,0,0,1,11.32-11.32ZM143,107a8,8,0,0,0,11.16-1.86l18-25.12h40.57L202.34,90.34a8,8,0,0,0,11.32,11.32l24-24a8,8,0,0,0,0-11.32l-24-24a8,8,0,0,0-11.32,11.32L212.69,64H168a8,8,0,0,0-6.51,3.35L141.15,95.82A8,8,0,0,0,143,107Zm-30,42a8,8,0,0,0-11.16,1.86L83.88,176H32a8,8,0,0,0,0,16H88a8,8,0,0,0,6.51-3.35l20.34-28.47A8,8,0,0,0,113,149Z" />
                                    </svg>
                                    <div className="xpost-body">
                                      <Text variant="body-lg" render={<h3 />} className="xpost-title">
                                        {decodeEntities(cleanXPostTitle(feedPost.title))}
                                      </Text>
                                      <div className="xpost-source">
                                        <div className="xpost-source-icon">
                                          {originSite?.icon?.img ? (
                                            <img src={originSite.icon.img} alt="" />
                                          ) : (
                                            <span>{(sourceName ?? '?').charAt(0).toUpperCase()}</span>
                                          )}
                                        </div>
                                        <Text variant="body-sm" className="xpost-source-name">
                                          +{sourceName ?? originSite?.name ?? 'source'}
                                        </Text>
                                      </div>
                                    </div>
                                  </article>
                                );
                              }

                              const images = extractImages(feedPost.content ?? '');
                              const postSiteId = feedPost.site_ID || selectedSiteId!;
                              return (
                                <article
                                  key={`${postSiteId}-${feedPost.ID}`}
                                  className={`post${feedPost.ID === detailPostId ? ' is-selected' : ''}`}
                                  onClick={(e) => {
                                    if (feedPost.ID === detailPostId && postSiteId === detailSiteId) {
                                      closeDetail();
                                    } else {
                                      const el = e.currentTarget;
                                      selectPost(postSiteId, feedPost.ID);
                                      setTimeout(
                                        () =>
                                          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
                                        220,
                                      );
                                    }
                                  }}
                                >
                                  <div className="post-thread">
                                    {feedPost.author?.avatar_URL && (
                                      <img
                                        src={feedPost.author.avatar_URL}
                                        alt=""
                                        className="post-thread-avatar"
                                      />
                                    )}
                                    <div className="post-thread-body">
                                      <div className="post-thread-header">
                                        <Text variant="body-md" className="post-thread-author">
                                          {feedPost.author?.name ?? 'Unknown'}
                                        </Text>
                                        <Text variant="body-sm" className="post-thread-time">
                                          {relativeTime(feedPost.date)}
                                        </Text>
                                      </div>
                                      <Text variant="heading-lg" render={<h3 />} className="post-title">
                                        {decodeEntities(feedPost.title)}
                                      </Text>
                                      {stripHtml(feedPost.excerpt) && (
                                        <Text variant="body-md" render={<p />} className="post-excerpt">
                                          {stripHtml(feedPost.excerpt)}
                                        </Text>
                                      )}
                                      {images.length > 0 && (
                                        <div className="post-gallery">
                                          {images.slice(0, 4).map((src, imgIdx) => (
                                            <img
                                              key={imgIdx}
                                              src={src}
                                              alt=""
                                              className="post-gallery-img"
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {selectedSiteId && (
                        <div className="feed-compose">
                          <textarea
                            ref={composeRef}
                            className="feed-compose-input"
                            placeholder="Write a new post..."
                            rows={1}
                            disabled={createPost.isPending}
                            onInput={(e) => {
                              const el = e.currentTarget;
                              el.style.height = 'auto';
                              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                const val = composeRef.current?.value.trim();
                                if (!val || createPost.isPending) return;
                                createPost.mutate(val, {
                                  onSuccess: () => {
                                    if (composeRef.current) {
                                      composeRef.current.value = '';
                                      composeRef.current.style.height = 'auto';
                                    }
                                    const el = feedScrollRef.current;
                                    if (el) {
                                      requestAnimationFrame(() => {
                                        el.scrollTop = el.scrollHeight;
                                      });
                                    }
                                  },
                                });
                              }
                            }}
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </main>
            </Panel>

            <Separator className="resize-handle" />

            <Panel
              id="detail"
              defaultSize={45}
              minSize={25}
              className="panel"
            >
              <div className="post-detail">
                {!hasDetail ? (
                  <div className="feed-empty">
                    <Text
                      variant="body-md"
                      style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                    >
                      Select a post to read it
                    </Text>
                  </div>
                ) : postLoading ? (
                  <div className="feed-status">
                    <Text
                      variant="body-md"
                      style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                    >
                      Loading...
                    </Text>
                  </div>
                ) : postError ? (
                  <div className="feed-status">
                    <Text
                      variant="body-md"
                      style={{ color: 'var(--wpds-color-fg-content-error-weak)' }}
                    >
                      Couldn't load post
                    </Text>
                  </div>
                ) : post ? (
                  <>
                    <header className="panel-header">
                      <div className="panel-header-start">
                        <Text variant="body-sm" className="post-detail-header-title">
                          {decodeEntities(post.title)}
                        </Text>
                      </div>
                      <div className="panel-header-end">
                        <IconButton
                          variant="minimal"
                          tone="neutral"
                          size="compact"
                          icon={closeSmall}
                          label="Close"
                          onClick={closeDetail}
                        />
                      </div>
                    </header>
                    <article className="post-detail-article">
                      <Text
                        variant="heading-2xl"
                        render={<h1 />}
                        className="post-detail-title page-title"
                      >
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
                      {(summary || summaryLoading) && (
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
                        {(() => {
                          const postKey = `post:${post.site_ID}:${post.ID}`;
                          const savedId = savedLookup.get(postKey);
                          const isSaved = savedId != null;
                          return (
                            <button
                              className={`save-button${isSaved ? ' is-saved' : ''}`}
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
                              <Icon icon={archive} size={16} />
                              <span>{isSaved ? 'Saved' : 'Save'}</span>
                            </button>
                          );
                        })()}
                        {commentsData && commentsData.comments.length > 0 && (
                          <button
                            className="comments-drawer-toggle"
                            onClick={() => setCommentsOpen(!commentsOpen)}
                          >
                            <div className="comments-drawer-info">
                              <Icon icon={commentIcon} size={18} />
                              <Text variant="body-sm" className="comments-drawer-count">
                                {commentsData.found === 1
                                  ? '1 comment'
                                  : `${commentsData.found} comments`}
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
                                {commentsData.comments.map((c) => (
                                  <div
                                    key={c.ID}
                                    className={`comment${c.parent ? ' comment-nested' : ''}`}
                                  >
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
                                      {(() => {
                                        const commentKey = `comment:${post.site_ID}:${post.ID}:${c.ID}`;
                                        const cSavedId = savedLookup.get(commentKey);
                                        const cIsSaved = cSavedId != null;
                                        return (
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
                                        );
                                      })()}
                                    </div>
                                    <div
                                      className="comment-body"
                                      dangerouslySetInnerHTML={{ __html: c.content }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </footer>
                  </>
                ) : null}
              </div>
            </Panel>
          </Group>
          )}
        </Panel>
      </Group>
      <CreateP2Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(site) => {
          const newId = Number(site.blog_details.blogid);
          if (Number.isFinite(newId)) {
            selectSite(newId);
          }
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
