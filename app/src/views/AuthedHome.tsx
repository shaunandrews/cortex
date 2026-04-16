import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { useRouteState } from '../hooks/useRouteState';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { usePanelTransition } from '../hooks/usePanelTransition';
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
} from '@wordpress/icons';
import { useAuth } from '../auth/AuthContext';
import { useP2Sites } from '../hooks/useP2Sites';
import { useP2Posts } from '../hooks/useP2Posts';
import { useP2Post } from '../hooks/useP2Post';
import { usePostComments } from '../hooks/usePostComments';
import { useToggleLike } from '../hooks/useToggleLike';
import { useStarredSites } from '../hooks/useStarredSites';
import { useFollowing } from '../hooks/useFollowing';
import { useMarkAsSeen, useMarkAllAsSeen } from '../hooks/useMarkAsSeen';
import { useCreatePost } from '../hooks/useCreatePost';
import { useReaderStream } from '../hooks/useReaderStream';
import { useLikedPosts } from '../hooks/useLikedPosts';
import { usePostSummary } from '../hooks/usePostSummary';
import { relativeTime } from '../lib/relativeTime';
import { useSyncStatus } from '../sync/SyncProvider';
import Markdown from 'react-markdown';
import { getXPostOrigin, cleanXPostTitle, parseXPostSource } from '../lib/xpost';

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
  const { starredIds, toggleStar } = useStarredSites();
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
    specialView,
    hasDetail,
    selectSite,
    selectPost,
    selectSpecialView,
    closeDetail,
  } = useRouteState();
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [sortMode, setSortMode] = useState<'alpha' | 'recent' | 'unread'>(() => {
    return (localStorage.getItem('cortex_site_sort') as 'alpha' | 'recent' | 'unread') || 'alpha';
  });
  const [commentsOpen, setCommentsOpen] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const {
    panelRef: detailPanelRef,
    elementRef: detailElementRef,
    collapse: collapseDetail,
    expand: expandDetail,
  } = usePanelTransition(35);
  const markedSeenRef = useRef(new Set<string>());

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'cortex-layout',
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

  // Sync detail panel expand/collapse with URL state
  useEffect(() => {
    if (hasDetail) {
      expandDetail();
    } else {
      collapseDetail();
    }
  }, [hasDetail, expandDetail, collapseDetail]);

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

  const sortSites = useCallback(
    (list: typeof sites) => {
      if (!list) return [];
      return [...list].sort((a, b) => {
        if (sortMode === 'recent') {
          const aTime = followingMap.get(a.ID)?.last_updated ?? 0;
          const bTime = followingMap.get(b.ID)?.last_updated ?? 0;
          if (bTime !== aTime) return bTime - aTime;
        } else if (sortMode === 'unread') {
          const aCount = followingMap.get(a.ID)?.unseen_count ?? 0;
          const bCount = followingMap.get(b.ID)?.unseen_count ?? 0;
          if (bCount !== aCount) return bCount - aCount;
        }
        return a.name.localeCompare(b.name);
      });
    },
    [sortMode, followingMap],
  );

  const filteredSites = useMemo(() => {
    if (!sites) return [];
    const sorted = sortSites(sites);
    if (!searchQuery) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter((s) => s.name.toLowerCase().includes(q));
  }, [sites, searchQuery, sortSites]);

  const allSorted = useMemo(() => {
    if (!sites) return [];
    return [...sites].sort((a, b) => a.name.localeCompare(b.name));
  }, [sites]);

  const starredVisible = useMemo(
    () => allSorted.filter((s) => starredIds.has(s.ID)),
    [allSorted, starredIds],
  );

  const unstarredVisible = useMemo(() => {
    const unstarred = filteredSites.filter((s) => !starredIds.has(s.ID));
    return unstarred;
  }, [filteredSites, starredIds]);

  const allVisible = useMemo(
    () => [...starredVisible, ...unstarredVisible],
    [starredVisible, unstarredVisible],
  );

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
  const readerStream = useReaderStream(specialView === 'unread');
  const likedPosts = useLikedPosts(specialView === 'liked');

  // Reset focused index when search changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchQuery]);

  // Scroll focused item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const focused = list.querySelector(`[data-index="${focusedIndex}"]`) as HTMLElement | null;
    focused?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

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

  // Store active feed pagination in a ref so the scroll handler always has current values
  const activeFeedRef = useRef<{
    hasNext: boolean;
    isFetching: boolean;
    fetchNext: () => void;
  }>({ hasNext: false, isFetching: false, fetchNext: () => {} });

  // Update ref based on active view
  if (specialView === 'unread') {
    activeFeedRef.current = {
      hasNext: readerStream.hasNextPage ?? false,
      isFetching: readerStream.isFetchingNextPage,
      fetchNext: readerStream.fetchNextPage,
    };
  } else if (specialView === 'liked') {
    activeFeedRef.current = {
      hasNext: likedPosts.hasNextPage ?? false,
      isFetching: likedPosts.isFetchingNextPage,
      fetchNext: likedPosts.fetchNextPage,
    };
  } else {
    activeFeedRef.current = {
      hasNext: hasNextPage ?? false,
      isFetching: isFetchingNextPage,
      fetchNext: fetchNextPage,
    };
  }

  // Load older posts when scrolled near the top
  const handleFeedScroll = useCallback(() => {
    const el = feedScrollRef.current;
    const feed = activeFeedRef.current;
    if (!el || !feed.hasNext || feed.isFetching) return;
    if (el.scrollTop < 200) {
      prevScrollHeightRef.current = el.scrollHeight;
      feed.fetchNext();
    }
  }, []);

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

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, allVisible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const site = allVisible[focusedIndex < 0 ? 0 : focusedIndex];
      if (site) selectSite(site.ID);
    } else if (e.key === 'Escape') {
      setSearchQuery('');
    }
  }

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
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel
          id="sidebar"
          defaultSize={20}
          minSize={15}
          collapsible
          collapsedSize={0}
          className="panel"
        >
          <aside className="sidebar">
            <div className="sidebar-views">
              <button
                className={`sidebar-view-tab${specialView === 'unread' ? ' is-active' : ''}`}
                onClick={() => selectSpecialView('unread')}
              >
                All Unread
              </button>
              <button
                className={`sidebar-view-tab${specialView === 'liked' ? ' is-active' : ''}`}
                onClick={() => selectSpecialView('liked')}
              >
                Liked
              </button>
            </div>
            {starredVisible.length > 0 && (
              <div className="starred-grid">
                {starredVisible.map((site, i) => {
                  const unseen = unseenMap.get(site.ID) ?? 0;
                  return (
                    <button
                      key={site.ID}
                      data-index={i}
                      className={`starred-card${site.ID === selectedSiteId ? ' is-selected' : ''}${i === focusedIndex ? ' is-focused' : ''}`}
                      onClick={() => selectSite(site.ID)}
                      tabIndex={-1}
                    >
                      <span
                        className="star-toggle is-starred"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(site.ID);
                          setFocusedIndex(-1);
                        }}
                      >
                        ★
                      </span>
                      <div className="starred-card-icon">
                        {site.icon?.img ? (
                          <img src={site.icon.img} alt="" />
                        ) : (
                          <span>{site.name.charAt(0)}</span>
                        )}
                        {unseen > 0 && <span className="unseen-badge">{unseen}</span>}
                      </div>
                      <Text variant="body-sm" className="starred-card-name">
                        {site.name}
                      </Text>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="sidebar-search">
              <input
                type="text"
                className="sidebar-search-input"
                placeholder="Filter sites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              {searchQuery && (
                <button
                  className="sidebar-search-clear"
                  onClick={() => setSearchQuery('')}
                  tabIndex={-1}
                >
                  &times;
                </button>
              )}
            </div>
            <div className="sidebar-sort">
              <select
                className="sidebar-sort-select"
                value={sortMode}
                onChange={(e) => {
                  const mode = e.target.value as 'alpha' | 'recent' | 'unread';
                  setSortMode(mode);
                  localStorage.setItem('cortex_site_sort', mode);
                }}
              >
                <option value="alpha">A–Z</option>
                <option value="recent">Recent</option>
                <option value="unread">Unread</option>
              </select>
            </div>
            <div className="sidebar-list" ref={listRef}>
              {unstarredVisible.length === 0 && searchQuery ? (
                <div className="sidebar-empty">
                  <Text
                    variant="body-sm"
                    style={{
                      color: 'var(--wpds-color-fg-content-neutral-weak)',
                    }}
                  >
                    No matches
                  </Text>
                </div>
              ) : (
                unstarredVisible.map((site, i) => {
                  const idx = starredVisible.length + i;
                  const unseen = unseenMap.get(site.ID) ?? 0;
                  return (
                    <button
                      key={site.ID}
                      data-index={idx}
                      className={`sidebar-item${site.ID === selectedSiteId ? ' is-selected' : ''}${idx === focusedIndex ? ' is-focused' : ''}`}
                      onClick={() => selectSite(site.ID)}
                      tabIndex={-1}
                    >
                      <div className="sidebar-item-icon">
                        {site.icon?.img ? (
                          <img src={site.icon.img} alt="" />
                        ) : (
                          <span>{site.name.charAt(0)}</span>
                        )}
                      </div>
                      <Text variant="body-md" className="sidebar-item-name">
                        {site.name}
                      </Text>
                      {unseen > 0 && <span className="unseen-badge">{unseen}</span>}
                      <span
                        className="star-toggle"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(site.ID);
                          setFocusedIndex(-1);
                        }}
                      >
                        ☆
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <SyncStatusBar />
          </aside>
        </Panel>

        <Separator className="resize-handle" />

        <Panel id="feed" defaultSize={45} minSize={25} className="panel">
          <main className="feed">
            {(() => {
              // Determine active feed based on view mode
              const isSpecial = specialView !== null;
              const activeData = isSpecial
                ? specialView === 'unread'
                  ? readerStream
                  : likedPosts
                : null;
              const p2BlogIds = following
                ? new Set(
                    following.filter((s) => s.is_wpforteams_site).map((s) => Number(s.blog_ID)),
                  )
                : new Set<number>();
              const feedPosts = isSpecial
                ? activeData!.posts.filter((p) => p2BlogIds.has(p.site_ID))
                : (postsData?.posts ?? []);
              const feedLoading = isSpecial ? activeData!.isLoading : postsLoading;
              const feedError = isSpecial ? activeData!.error : postsError;
              const feedIsFetchingNext = isSpecial
                ? activeData!.isFetchingNextPage
                : isFetchingNextPage;
              const feedRefetch = isSpecial ? activeData!.refetch : refetchPosts;
              const showFeed = isSpecial || selectedSiteId;
              const feedTitle =
                specialView === 'unread'
                  ? 'All Unread'
                  : specialView === 'liked'
                    ? 'Liked Posts'
                    : (selectedSite?.name ?? '');

              return (
                <>
                  {showFeed && (
                    <header className="panel-header">
                      <div className="panel-header-start">
                        <Text variant="heading-lg" render={<h2 />} className="page-title">
                          {feedTitle}
                        </Text>
                      </div>
                      <div className="panel-header-end">
                        {!isSpecial &&
                          selectedSite &&
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
                        {!isSpecial && selectedSite && (
                          <IconButton
                            variant="minimal"
                            tone="neutral"
                            size="compact"
                            icon={external}
                            label="Open site"
                            render={
                              <a
                                href={selectedSite.URL}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                          />
                        )}
                        {!isSpecial && selectedSite && (
                          <IconButton
                            variant="minimal"
                            tone="neutral"
                            size="compact"
                            icon={starredIds.has(selectedSite.ID) ? starFilled : starEmpty}
                            label={starredIds.has(selectedSite.ID) ? 'Unfavorite' : 'Favorite'}
                            onClick={() => toggleStar(selectedSite.ID)}
                          />
                        )}
                        <IconButton
                          variant="minimal"
                          tone="neutral"
                          size="compact"
                          icon={rotateRight}
                          label="Refresh"
                          onClick={() => feedRefetch()}
                        />
                      </div>
                    </header>
                  )}
                  {!showFeed ? (
                    <div className="feed-empty">
                      <Text
                        variant="body-md"
                        style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                      >
                        Select a P2 to see its posts
                      </Text>
                    </div>
                  ) : feedLoading ? (
                    <div className="feed-status">
                      <Text
                        variant="body-md"
                        style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                      >
                        Loading...
                      </Text>
                    </div>
                  ) : feedError ? (
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
                        {feedIsFetchingNext && (
                          <div className="feed-load-more">
                            <Text
                              variant="body-sm"
                              style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
                            >
                              Loading older posts...
                            </Text>
                          </div>
                        )}
                        {(isSpecial ? feedPosts : [...feedPosts].reverse()).map((feedPost) => {
                          const xOrigin = getXPostOrigin(feedPost);

                          if (xOrigin) {
                            const sourceName = parseXPostSource(stripHtml(feedPost.excerpt));
                            const originSite = sites?.find((s) => s.ID === xOrigin.blogId);
                            return (
                              <article
                                key={feedPost.ID}
                                className={`post post-xpost${feedPost.ID === detailPostId ? ' is-selected' : ''}`}
                                onClick={() =>
                                  xOrigin.postId === detailPostId && xOrigin.blogId === detailSiteId
                                    ? closeDetail()
                                    : selectPost(xOrigin.blogId, xOrigin.postId)
                                }
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
                              onClick={() =>
                                feedPost.ID === detailPostId && postSiteId === detailSiteId
                                  ? closeDetail()
                                  : selectPost(postSiteId, feedPost.ID)
                              }
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
                                    {isSpecial && feedPost.site_name && (
                                      <Text variant="body-sm" className="post-thread-site">
                                        {feedPost.site_name}
                                      </Text>
                                    )}
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
                  {selectedSiteId && !isSpecial && (
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
          panelRef={detailPanelRef}
          elementRef={detailElementRef}
          defaultSize={35}
          minSize={25}
          collapsible
          collapsedSize={0}
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
                    {(() => {
                      const detailSite =
                        detailSiteId !== selectedSiteId
                          ? sites?.find((s) => s.ID === detailSiteId)
                          : selectedSite;
                      return detailSite ? (
                        <Text variant="body-sm" className="post-detail-site">
                          {detailSite.name}
                        </Text>
                      ) : null;
                    })()}
                  </div>
                  <div className="panel-header-end">
                    <IconButton
                      variant="outline"
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
                </article>

                {commentsData && commentsData.comments.length > 0 && (
                  <footer className={`comments-drawer${commentsOpen ? ' is-open' : ''}`}>
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
                  </footer>
                )}
              </>
            ) : null}
          </div>
        </Panel>
      </Group>
    </div>
  );
}
