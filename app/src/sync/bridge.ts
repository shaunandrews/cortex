/**
 * SyncBridge — React-side adapter between the SyncEngine and React Query.
 *
 * Two modes:
 * - "direct": Engine runs in the main thread (dev). Methods called directly.
 * - "worker": Engine runs in a Service Worker (prod). Communication via postMessage.
 *
 * The bridge is responsible for:
 * 1. Hydrating React Query from IndexedDB on startup
 * 2. Forwarding engine data updates into React Query cache via setQueryData
 * 3. Exposing sync status for UI indicators
 */

import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import { SyncEngine } from './engine';
import type {
  BridgeMessage,
  WorkerMessage,
  SyncPhase,
  SyncProgress,
  SiteStatus,
  LightweightPost,
} from './protocol';
import type {
  WPComSite,
  WPComSubscription,
  WPComNotification,
  WPComPostsResponse,
} from '../api/types';

export interface SyncStatus {
  phase: SyncPhase;
  progress: SyncProgress;
  siteStatuses: Record<number, SiteStatus>;
  lastPollAt: number | null;
}

export class SyncBridge {
  private queryClient: QueryClient;
  private mode: 'direct' | 'worker';
  private engine: SyncEngine | null = null;
  private statusListeners: ((status: SyncStatus) => void)[] = [];
  private seenPostIds = new Set<string>();
  private status: SyncStatus = {
    phase: 'idle',
    progress: { fetched: 0, total: 0 },
    siteStatuses: {},
    lastPollAt: null,
  };

  constructor(queryClient: QueryClient, mode: 'direct' | 'worker') {
    this.queryClient = queryClient;
    this.mode = mode;

    if (mode === 'direct') {
      this.engine = new SyncEngine();
      this.engine.onMessage((msg) => this.handleWorkerMessage(msg));
    } else {
      // Listen for messages from the Service Worker
      navigator.serviceWorker?.addEventListener('message', (event) => {
        this.handleWorkerMessage(event.data as WorkerMessage);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(token: string, starredSiteIds: number[]): Promise<void> {
    if (this.mode === 'direct') {
      await this.engine!.start(token, starredSiteIds);
    } else {
      this.sendToBridge({ type: 'AUTH_TOKEN', token });
      this.sendToBridge({ type: 'STARRED_SITES', siteIds: starredSiteIds });
    }
  }

  stop(): void {
    if (this.mode === 'direct') {
      this.engine?.stop();
    }
    // Worker mode: SW stops on its own when tab closes
  }

  updateStarredSites(ids: number[]): void {
    if (this.mode === 'direct') {
      this.engine?.setStarredSites(ids);
    } else {
      this.sendToBridge({ type: 'STARRED_SITES', siteIds: ids });
    }
  }

  setTabVisible(visible: boolean): void {
    if (this.mode === 'direct') {
      this.engine?.setTabVisible(visible);
    } else {
      this.sendToBridge({ type: 'TAB_VISIBLE', visible });
    }
  }

  sendKeepalive(): void {
    if (this.mode === 'worker') {
      this.sendToBridge({ type: 'KEEPALIVE' });
    }
  }

  requestPostContent(siteId: number, postId: number): void {
    if (this.mode === 'direct') {
      this.engine?.requestPostContent(siteId, postId);
    } else {
      this.sendToBridge({ type: 'REQUEST_POST_CONTENT', siteId, postId });
    }
  }

  // ---------------------------------------------------------------------------
  // Hydration — populate React Query from IndexedDB on startup
  // ---------------------------------------------------------------------------

  async hydrateFromStore(): Promise<void> {
    if (this.mode !== 'direct' || !this.engine) return;

    // Load seen post IDs so hydration can apply them
    this.seenPostIds = await this.engine.getSeenPostIds();

    // Hydrate sites
    const sites = await this.engine.getSites();
    if (sites.length > 0) {
      const p2Sites = sites.filter((s) => s.options?.is_wpforteams_site);
      this.queryClient.setQueryData(['p2-sites'], p2Sites);

      // Hydrate posts per site
      for (const site of p2Sites) {
        const posts = await this.engine.getPostsBySite(site.ID);
        if (posts.length > 0) {
          this.hydratePostsForSite(site.ID, posts);
        }
      }
    }

    // Hydrate following
    const following = await this.engine.getFollowing();
    if (following.length > 0) {
      this.queryClient.setQueryData(['following'], following);
    }

    // Hydrate notifications
    const notifications = await this.engine.getNotifications();
    if (notifications.length > 0) {
      this.queryClient.setQueryData(['notifications'], notifications);
    }
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== callback);
    };
  }

  // ---------------------------------------------------------------------------
  // Message handling — incoming from engine/worker
  // ---------------------------------------------------------------------------

  private handleWorkerMessage(msg: WorkerMessage): void {
    switch (msg.type) {
      case 'SITES_UPDATED':
        this.handleSitesUpdated(msg.sites);
        break;
      case 'POSTS_UPDATED':
        this.handlePostsUpdated(msg.siteId, msg.posts);
        break;
      case 'FOLLOWING_UPDATED':
        this.handleFollowingUpdated(msg.subscriptions);
        break;
      case 'NOTIFICATIONS_UPDATED':
        this.handleNotificationsUpdated(msg.notifications);
        break;
      case 'POST_CONTENT_READY':
        this.handlePostContentReady(msg.siteId, msg.postId, msg.content);
        break;
      case 'SYNC_STATUS':
        this.status = {
          phase: msg.phase,
          progress: msg.progress,
          siteStatuses: msg.siteStatuses,
          lastPollAt: Date.now(),
        };
        this.emitStatus();
        break;
      case 'AUTH_ERROR':
        // Auth failed in the engine — the existing 401 handler in queryClient
        // will take care of clearing the token and redirecting
        break;
      case 'READY':
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // React Query cache updates
  // ---------------------------------------------------------------------------

  private handleSitesUpdated(sites: WPComSite[]): void {
    const p2Sites = sites.filter((s) => s.options?.is_wpforteams_site);
    // useP2Sites queryFn returns WPComSite[] (flat array), not WPComSitesResponse
    this.queryClient.setQueryData(['p2-sites'], p2Sites);
  }

  private handlePostsUpdated(siteId: number, posts: LightweightPost[]): void {
    this.hydratePostsForSite(siteId, posts);
  }

  private handleFollowingUpdated(subscriptions: WPComSubscription[]): void {
    this.queryClient.setQueryData(['following'], subscriptions);
  }

  private handleNotificationsUpdated(notifications: WPComNotification[]): void {
    this.queryClient.setQueryData(['notifications'], notifications);
  }

  private handlePostContentReady(siteId: number, postId: number, content: string): void {
    // Update the individual post cache with full content
    this.queryClient.setQueryData(['p2-post', siteId, postId], (old: unknown) => {
      if (old && typeof old === 'object') {
        return { ...old, content };
      }
      return old;
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Pack posts into a synthetic InfiniteData structure for useP2Posts,
   * and also populate individual post caches for useP2Post.
   */
  private hydratePostsForSite(siteId: number, posts: LightweightPost[]): void {
    // Sort by date descending (newest first)
    const sorted = [...posts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Apply seen state from the local IDB seenPosts store
    const withSeen = sorted.map((p) =>
      !p.is_seen && this.seenPostIds.has(`${siteId}-${p.ID}`) ? { ...p, is_seen: true } : p,
    );

    // Build InfiniteData structure for useP2Posts
    const infiniteData: InfiniteData<WPComPostsResponse> = {
      pages: [{ found: withSeen.length, posts: withSeen }],
      pageParams: [1],
    };

    this.queryClient.setQueryData(
      ['p2-posts', siteId],
      (existing: InfiniteData<WPComPostsResponse> | undefined) => {
        if (existing && existing.pages.length > 0) {
          // Also preserve is_seen from existing React Query cache (optimistic updates)
          const cacheSeenIds = new Set<number>();
          for (const page of existing.pages) {
            for (const p of page.posts) {
              if (p.is_seen) cacheSeenIds.add(p.ID);
            }
          }
          const mergedPosts = withSeen.map((p) =>
            !p.is_seen && cacheSeenIds.has(p.ID) ? { ...p, is_seen: true } : p,
          );

          const merged = { ...existing };
          merged.pages = [
            { found: mergedPosts.length, posts: mergedPosts },
            ...existing.pages.slice(1),
          ];
          return merged;
        }
        return infiniteData;
      },
    );

    // Don't write lightweight posts to individual ['p2-post'] cache —
    // they lack content, which would prevent useP2Post from fetching
    // the full version for the detail panel.
  }

  private sendToBridge(msg: BridgeMessage): void {
    navigator.serviceWorker?.controller?.postMessage(msg);
  }

  private emitStatus(): void {
    for (const listener of this.statusListeners) {
      listener(this.status);
    }
  }
}
