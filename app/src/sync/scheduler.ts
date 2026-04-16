/**
 * Scheduler for the sync engine.
 * Manages what to fetch and when: priority queue for prefetching,
 * two polling loops for freshness (change detection + rolling content refresh).
 *
 * No DOM or React dependencies.
 */

import type { WPComSite, WPComSubscription, WPComNotification } from '../api/types';
import type { LightweightPost, SyncPhase, SyncProgress, SiteStatus } from './protocol';
import type { SyncStore } from './store';
import { Fetcher } from './fetcher';
import {
  getMySites,
  getFollowingPage1,
  getFollowing,
  getSitePostsLightweight,
  getNotifications,
} from '../api/wpcom';

// ---------------------------------------------------------------------------
// Priority scores (lower = fetched sooner)
// ---------------------------------------------------------------------------

const PRIORITY_STARRED_UNREAD = 0;
const PRIORITY_UNREAD = 1;
const PRIORITY_STARRED = 2;
const PRIORITY_DEFAULT = 3;

// ---------------------------------------------------------------------------
// Polling intervals (ms)
// ---------------------------------------------------------------------------

const CHANGE_DETECTION_VISIBLE = 25_000; // 25s when tab visible
const CHANGE_DETECTION_HIDDEN = 60_000; // 60s when tab hidden
const CONTENT_REFRESH_INTERVAL = 3_000; // 3s between rolling fetches (maintenance mode)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SchedulerEvent =
  | { type: 'sites'; sites: WPComSite[] }
  | { type: 'following'; subscriptions: WPComSubscription[] }
  | { type: 'posts'; siteId: number; posts: LightweightPost[] }
  | { type: 'notifications'; notifications: WPComNotification[] }
  | {
      type: 'status';
      phase: SyncPhase;
      progress: SyncProgress;
      siteStatuses: Record<number, SiteStatus>;
    };

export type SchedulerCallback = (event: SchedulerEvent) => void;

interface SitePrefetchEntry {
  siteId: number;
  priority: number;
  unseenCount: number;
}

export class Scheduler {
  private store: SyncStore;
  private fetcher: Fetcher;
  private token: string | null = null;
  private starredSiteIds = new Set<number>();
  private listeners: SchedulerCallback[] = [];

  // State
  private _phase: SyncPhase = 'idle';
  private sitesToFetch: SitePrefetchEntry[] = [];
  private sitesFetched = 0;
  private sitesTotal = 0;
  private siteStatuses: Record<number, SiteStatus> = {};
  private p2SiteIds = new Set<number>();

  // Polling timers
  private changeDetectionTimer: ReturnType<typeof setInterval> | null = null;
  private contentRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private tabVisible = true;
  private stopped = false;

  // Rolling refresh state
  private refreshQueue: number[] = [];
  private refreshIndex = 0;

  constructor(store: SyncStore, fetcher: Fetcher) {
    this.store = store;
    this.fetcher = fetcher;
  }

  get phase(): SyncPhase {
    return this._phase;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(token: string, starredSiteIds: number[]): Promise<void> {
    this.token = token;
    this.starredSiteIds = new Set(starredSiteIds);
    this.stopped = false;
    this._phase = 'bootstrapping';
    this.emitStatus();

    try {
      await this.bootstrap();
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') {
        this.emit({
          type: 'status',
          phase: 'idle',
          progress: { fetched: 0, total: 0 },
          siteStatuses: {},
        });
      }
      throw err;
    }
  }

  stop(): void {
    this.stopped = true;
    this._phase = 'idle';
    this.fetcher.clearQueue();
    if (this.changeDetectionTimer) {
      clearInterval(this.changeDetectionTimer);
      this.changeDetectionTimer = null;
    }
    if (this.contentRefreshTimer) {
      clearTimeout(this.contentRefreshTimer);
      this.contentRefreshTimer = null;
    }
  }

  setStarredSites(ids: number[]): void {
    this.starredSiteIds = new Set(ids);
  }

  setTabVisible(visible: boolean): void {
    const wasHidden = !this.tabVisible;
    this.tabVisible = visible;

    if (visible && wasHidden) {
      // Tab just became visible — restart change detection at faster rate
      this.restartChangeDetection();
      this.startContentRefresh();
      // Fire an immediate check
      this.checkForChanges();
    } else if (!visible) {
      // Tab hidden — slow down change detection, pause content refresh
      this.restartChangeDetection();
      if (this.contentRefreshTimer) {
        clearTimeout(this.contentRefreshTimer);
        this.contentRefreshTimer = null;
      }
    }
  }

  onUpdate(callback: SchedulerCallback): void {
    this.listeners.push(callback);
  }

  removeListener(callback: SchedulerCallback): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  private async bootstrap(): Promise<void> {
    if (!this.token || this.stopped) return;

    // Phase 1: Parallel fetch sites + following page 1 + notifications
    const [sitesRes, followingRes, notificationsRes] = await Promise.all([
      getMySites(this.token),
      getFollowingPage1(this.token),
      getNotifications(this.token).catch(() => ({ notes: [] })),
    ]);

    if (this.stopped) return;

    // Filter to P2 sites
    const p2Sites = sitesRes.sites.filter((s) => s.options?.is_wpforteams_site);
    this.p2SiteIds = new Set(p2Sites.map((s) => s.ID));

    // Store sites
    await this.store.putSites(p2Sites);
    this.emit({ type: 'sites', sites: p2Sites });

    // Store following data
    const subs = followingRes.subscriptions ?? [];
    await this.store.putFollowing(subs);
    this.emit({ type: 'following', subscriptions: subs });

    // Store notifications
    const notifications = notificationsRes.notes ?? [];
    await this.store.putNotifications(notifications);
    this.emit({ type: 'notifications', notifications });

    // Build unseen count map from subscriptions
    const unseenBySite = new Map<number, number>();
    for (const sub of subs) {
      const blogId = Number(sub.blog_ID);
      if (this.p2SiteIds.has(blogId)) {
        unseenBySite.set(blogId, sub.unseen_count ?? 0);
      }
    }

    // Phase 2: Build priority queue — only fetch sites with new unseen posts
    const storedStates = await this.store.getAllSyncStates();
    const storedCountMap = new Map(storedStates.map((s) => [s.siteId, s.lastUnseenCount]));

    this.sitesToFetch = [];
    for (const site of p2Sites) {
      const freshCount = unseenBySite.get(site.ID) ?? 0;
      const storedCount = storedCountMap.get(site.ID);
      const neverFetched = storedCount === undefined;
      const countChanged = freshCount !== storedCount;

      if (neverFetched || countChanged) {
        this.sitesToFetch.push({
          siteId: site.ID,
          priority: this.computePriority(site.ID, freshCount),
          unseenCount: freshCount,
        });
      } else {
        // Site is warm in IDB and count hasn't changed — skip
        this.siteStatuses[site.ID] = 'fresh';
      }
    }
    this.sitesToFetch.sort((a, b) => a.priority - b.priority);
    this.sitesTotal = this.sitesToFetch.length;
    this.sitesFetched = 0;

    this._phase = 'prefetching';
    this.fetcher.setConcurrency(6);
    this.emitStatus();

    // Phase 3: Fetch remaining following pages in background
    this.fetchRemainingFollowing();

    // Start prefetching posts
    await this.prefetchAllSites();

    if (this.stopped) return;

    // Transition to maintenance
    this._phase = 'maintaining';
    this.fetcher.setConcurrency(3);
    this.emitStatus();

    // Start polling loops
    this.restartChangeDetection();
    this.startContentRefresh();
  }

  // ---------------------------------------------------------------------------
  // Prefetch
  // ---------------------------------------------------------------------------

  private async prefetchAllSites(): Promise<void> {
    if (!this.token || this.stopped) return;

    const promises = this.sitesToFetch.map((entry) => {
      this.siteStatuses[entry.siteId] = 'fetching';
      return this.fetcher
        .enqueue<LightweightPost[]>({
          id: `prefetch-${entry.siteId}`,
          priority: entry.priority,
          execute: () => this.fetchSitePosts(entry.siteId),
        })
        .then((posts) => {
          this.siteStatuses[entry.siteId] = 'fresh';
          this.sitesFetched++;
          this.emitStatus();
          return posts;
        })
        .catch(() => {
          this.siteStatuses[entry.siteId] = 'error';
          this.sitesFetched++;
          this.emitStatus();
        });
    });

    await Promise.all(promises);
  }

  private async fetchSitePosts(siteId: number): Promise<LightweightPost[]> {
    if (!this.token) throw new Error('No token');

    const res = await getSitePostsLightweight(this.token, siteId);
    const posts: LightweightPost[] = (res.posts ?? []).map((p) => ({
      ...p,
      fetchedAt: Date.now(),
    }));

    // Look up the current unseen count so we can compare on next startup
    const following = await this.store.getFollowing();
    const sub = following.find((s) => Number(s.blog_ID) === siteId);
    const currentUnseen = sub?.unseen_count ?? 0;

    await this.store.putPosts(posts);
    await this.store.putSyncState({
      siteId,
      lastFetchedAt: Date.now(),
      lastUnseenCount: currentUnseen,
      priority: this.computePriority(siteId, currentUnseen),
    });

    this.emit({ type: 'posts', siteId, posts });
    return posts;
  }

  // ---------------------------------------------------------------------------
  // Remaining following pages (background)
  // ---------------------------------------------------------------------------

  private async fetchRemainingFollowing(): Promise<void> {
    if (!this.token || this.stopped) return;

    try {
      // getFollowing fetches all pages internally
      const allSubs = await getFollowing(this.token);
      if (this.stopped) return;

      await this.store.putFollowing(allSubs);
      this.emit({ type: 'following', subscriptions: allSubs });

      // Check for sites we missed in page 1
      for (const sub of allSubs) {
        const blogId = Number(sub.blog_ID);
        if (this.p2SiteIds.has(blogId) && !this.sitesToFetch.some((s) => s.siteId === blogId)) {
          // New site from later pages — add to fetch queue
          const entry = {
            siteId: blogId,
            priority: this.computePriority(blogId, sub.unseen_count ?? 0),
            unseenCount: sub.unseen_count ?? 0,
          };
          this.sitesToFetch.push(entry);
          this.sitesTotal++;
          this.siteStatuses[blogId] = 'fetching';

          this.fetcher
            .enqueue({
              id: `prefetch-late-${blogId}`,
              priority: entry.priority,
              execute: () => this.fetchSitePosts(blogId),
            })
            .then(() => {
              this.siteStatuses[blogId] = 'fresh';
              this.sitesFetched++;
              this.emitStatus();
            })
            .catch(() => {
              this.siteStatuses[blogId] = 'error';
              this.sitesFetched++;
              this.emitStatus();
            });
        }
      }
    } catch {
      // Non-critical — page 1 data is already stored
    }
  }

  // ---------------------------------------------------------------------------
  // Polling Loop 1: Change detection
  // ---------------------------------------------------------------------------

  private restartChangeDetection(): void {
    if (this.changeDetectionTimer) {
      clearInterval(this.changeDetectionTimer);
    }
    const interval = this.tabVisible ? CHANGE_DETECTION_VISIBLE : CHANGE_DETECTION_HIDDEN;
    this.changeDetectionTimer = setInterval(() => this.checkForChanges(), interval);
  }

  private async checkForChanges(): Promise<void> {
    if (!this.token || this.stopped) return;

    // Refresh notifications alongside change detection
    this.refreshNotifications();

    try {
      const res = await getFollowingPage1(this.token);
      const subs = res.subscriptions ?? [];

      // Compare unseen counts against stored state
      const stored = await this.store.getFollowing();
      const storedMap = new Map(stored.map((s) => [Number(s.blog_ID), s.unseen_count ?? 0]));

      const changedSites: number[] = [];
      for (const sub of subs) {
        const blogId = Number(sub.blog_ID);
        if (!this.p2SiteIds.has(blogId)) continue;
        const oldCount = storedMap.get(blogId) ?? 0;
        if ((sub.unseen_count ?? 0) > oldCount) {
          changedSites.push(blogId);
        }
      }

      // Update stored following data
      await this.store.putFollowing(subs);
      this.emit({ type: 'following', subscriptions: subs });

      // Push changed sites to front of fetch queue
      for (const siteId of changedSites) {
        this.siteStatuses[siteId] = 'fetching';
        this.fetcher
          .enqueueFront({
            id: `change-${siteId}-${Date.now()}`,
            priority: PRIORITY_STARRED_UNREAD,
            execute: () => this.fetchSitePosts(siteId),
          })
          .then(() => {
            this.siteStatuses[siteId] = 'fresh';
            this.emitStatus();
          })
          .catch(() => {
            this.siteStatuses[siteId] = 'error';
            this.emitStatus();
          });
      }
    } catch {
      // Will retry on next interval
    }
  }

  private async refreshNotifications(): Promise<void> {
    if (!this.token || this.stopped) return;

    try {
      const res = await getNotifications(this.token);
      const notifications = res.notes ?? [];
      await this.store.putNotifications(notifications);
      this.emit({ type: 'notifications', notifications });
    } catch {
      // Will retry on next interval
    }
  }

  // ---------------------------------------------------------------------------
  // Polling Loop 2: Rolling content refresh
  // ---------------------------------------------------------------------------

  private startContentRefresh(): void {
    if (!this.tabVisible || this.stopped) return;
    this.refreshQueue = [...this.p2SiteIds];
    this.refreshIndex = 0;
    this.scheduleNextRefresh();
  }

  private scheduleNextRefresh(): void {
    if (this.contentRefreshTimer) clearTimeout(this.contentRefreshTimer);
    if (!this.tabVisible || this.stopped) return;

    this.contentRefreshTimer = setTimeout(() => this.refreshNextSite(), CONTENT_REFRESH_INTERVAL);
  }

  private async refreshNextSite(): Promise<void> {
    if (!this.token || this.stopped || !this.tabVisible) return;

    if (this.refreshIndex >= this.refreshQueue.length) {
      this.refreshIndex = 0; // Start over
    }

    const siteId = this.refreshQueue[this.refreshIndex];
    this.refreshIndex++;

    const syncState = await this.store.getSyncState(siteId);
    const modifiedAfter = syncState ? new Date(syncState.lastFetchedAt).toISOString() : undefined;

    try {
      const res = await getSitePostsLightweight(this.token, siteId, 1, modifiedAfter);
      if (res.posts && res.posts.length > 0) {
        const posts: LightweightPost[] = res.posts.map((p) => ({
          ...p,
          fetchedAt: Date.now(),
        }));
        await this.store.putPosts(posts);
        await this.store.putSyncState({
          siteId,
          lastFetchedAt: Date.now(),
          lastUnseenCount: 0,
          priority: this.computePriority(siteId, 0),
        });
        this.emit({ type: 'posts', siteId, posts });
      } else {
        // No new posts, just update lastFetchedAt
        await this.store.putSyncState({
          siteId,
          lastFetchedAt: Date.now(),
          lastUnseenCount: syncState?.lastUnseenCount ?? 0,
          priority: syncState?.priority ?? PRIORITY_DEFAULT,
        });
      }
    } catch {
      // Will retry on next cycle
    }

    this.scheduleNextRefresh();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private computePriority(siteId: number, unseenCount: number): number {
    const isStarred = this.starredSiteIds.has(siteId);
    const hasUnread = unseenCount > 0;

    if (isStarred && hasUnread) return PRIORITY_STARRED_UNREAD;
    if (hasUnread) return PRIORITY_UNREAD;
    if (isStarred) return PRIORITY_STARRED;
    return PRIORITY_DEFAULT;
  }

  private emit(event: SchedulerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private emitStatus(): void {
    this.emit({
      type: 'status',
      phase: this._phase,
      progress: { fetched: this.sitesFetched, total: this.sitesTotal },
      siteStatuses: { ...this.siteStatuses },
    });
  }
}
