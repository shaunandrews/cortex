import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useRouteState } from '../hooks/useRouteState';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { IconButton, Text } from '@wordpress/ui';
import { check, starFilled, starEmpty, rotateRight, external } from '@wordpress/icons';
import { useP2Sites } from '../hooks/useP2Sites';
import { useP2Posts } from '../hooks/useP2Posts';
import { useSidebarGroups } from '../hooks/useSidebarGroups';
import { useFollowing } from '../hooks/useFollowing';
import { useMarkAllAsSeen } from '../hooks/useMarkAsSeen';
import { useCreatePost } from '../hooks/useCreatePost';
import { CreateP2Dialog } from './CreateP2Dialog';
import { relativeTime } from '../lib/relativeTime';
import { useSyncStatus } from '../sync/SyncProvider';
import { getXPostOrigin, cleanXPostTitle, parseXPostSource } from '../lib/xpost';
import HomeView from './HomeView';
import PostDetailPanel from './PostDetailPanel';
import SavedCollection from '../saved/SavedCollection';
import AppHeader from './AppHeader';
import Sidebar from './sidebar/Sidebar';

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
  const { data: sites } = useP2Sites();
  const { data: following } = useFollowing();
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
    isHome,
    selectSite,
    selectPost,
    closeDetail,
    goHome,
    goSaved,
    isSavedView,
  } = useRouteState();
  const [createOpen, setCreateOpen] = useState(false);

  const { defaultLayout: outerLayout, onLayoutChanged: onOuterLayoutChanged } = useDefaultLayout({
    id: 'cortex-outer',
  });
  const { defaultLayout: feedLayout, onLayoutChanged: onFeedLayoutChanged } = useDefaultLayout({
    id: 'cortex-feed',
  });

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

  // The detail panel, shared across all views
  const detailPanel =
    hasDetail && detailSiteId && detailPostId ? (
      <>
        <Separator className="resize-handle" />
        <Panel id="detail" defaultSize={45} minSize={25} className="panel">
          <PostDetailPanel siteId={detailSiteId} postId={detailPostId} onClose={closeDetail} />
        </Panel>
      </>
    ) : null;

  // Feed content for site view
  const feedContent = (
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
                      const sub = following?.find((s) => Number(s.blog_ID) === selectedSite.ID);
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
                        <a href={selectedSite.URL} target="_blank" rel="noopener noreferrer" />
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
                                () => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
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
                              () => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
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
                                  <img key={imgIdx} src={src} alt="" className="post-gallery-img" />
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
  );

  return (
    <div className="authed-layout">
      <AppHeader />

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
          {selectedSiteId ? (
            /* Site feed: always show feed + detail split */
            <Group
              orientation="horizontal"
              defaultLayout={feedLayout}
              onLayoutChanged={onFeedLayoutChanged}
            >
              <Panel id="feed" defaultSize={55} minSize={25} className="panel">
                {feedContent}
              </Panel>

              <Separator className="resize-handle" />

              <Panel id="detail" defaultSize={45} minSize={25} className="panel">
                {hasDetail && detailSiteId && detailPostId ? (
                  <PostDetailPanel
                    siteId={detailSiteId}
                    postId={detailPostId}
                    onClose={closeDetail}
                  />
                ) : (
                  <div className="post-detail">
                    <div className="feed-empty">
                      <Text
                        variant="body-md"
                        style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                      >
                        Select a post to read it
                      </Text>
                    </div>
                  </div>
                )}
              </Panel>
            </Group>
          ) : hasDetail && detailSiteId && detailPostId ? (
            /* Home or Saved with a post open: content + detail split */
            <Group
              orientation="horizontal"
              defaultLayout={feedLayout}
              onLayoutChanged={onFeedLayoutChanged}
            >
              <Panel id="content" defaultSize={55} minSize={25} className="panel">
                {isHome ? (
                  <HomeView />
                ) : (
                  <SavedCollection onNavigate={(siteId, postId) => selectPost(siteId, postId)} />
                )}
              </Panel>
              {detailPanel}
            </Group>
          ) : /* Home or Saved, no detail: full width */
          isHome ? (
            <HomeView />
          ) : (
            <SavedCollection onNavigate={(siteId, postId) => selectPost(siteId, postId)} />
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
