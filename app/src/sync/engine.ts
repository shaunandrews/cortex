/**
 * SyncEngine — the portable compositor.
 *
 * Composes Store, Fetcher, and Scheduler into a single class that can run
 * in a Service Worker (production) or the main thread (development).
 * No DOM or React dependencies.
 *
 * Communication happens via the message protocol defined in protocol.ts:
 * - handleMessage() receives BridgeMessages
 * - onMessage() emits WorkerMessages
 */

import { type SyncStore, getSharedStore } from './store';
import { Fetcher } from './fetcher';
import { Scheduler, type SchedulerEvent } from './scheduler';
import { getPost } from '../api/wpcom';
import type { BridgeMessage, WorkerMessage, LightweightPost } from './protocol';
import type { WPComSite, WPComSubscription, WPComNotification } from '../api/types';

export class SyncEngine {
  private store: SyncStore;
  private fetcher: Fetcher;
  private scheduler: Scheduler;
  private listeners: ((msg: WorkerMessage) => void)[] = [];
  private token: string | null = null;
  private starredSiteIds: number[] = [];
  private started = false;

  constructor() {
    this.store = getSharedStore();
    this.fetcher = new Fetcher(6);
    this.scheduler = new Scheduler(this.store, this.fetcher);

    // Wire scheduler events to WorkerMessage emissions
    this.scheduler.onUpdate((event: SchedulerEvent) => {
      switch (event.type) {
        case 'sites':
          this.emit({ type: 'SITES_UPDATED', sites: event.sites });
          break;
        case 'following':
          this.emit({
            type: 'FOLLOWING_UPDATED',
            subscriptions: event.subscriptions,
          });
          break;
        case 'posts':
          this.emit({
            type: 'POSTS_UPDATED',
            siteId: event.siteId,
            posts: event.posts,
          });
          break;
        case 'notifications':
          this.emit({
            type: 'NOTIFICATIONS_UPDATED',
            notifications: event.notifications,
          });
          break;
        case 'status':
          this.emit({
            type: 'SYNC_STATUS',
            phase: event.phase,
            progress: event.progress,
            siteStatuses: event.siteStatuses,
          });
          break;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Start the sync engine. Call after receiving auth token. */
  async start(token: string, starredSiteIds: number[]): Promise<void> {
    this.token = token;
    this.starredSiteIds = starredSiteIds;
    this.started = true;

    try {
      await this.scheduler.start(token, starredSiteIds);
      this.emit({ type: 'READY' });
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') {
        this.emit({ type: 'AUTH_ERROR' });
      }
      throw err;
    }
  }

  /** Stop all fetching and polling. */
  stop(): void {
    this.started = false;
    this.scheduler.stop();
  }

  /** Update the starred sites list (forwarded from localStorage via bridge). */
  setStarredSites(ids: number[]): void {
    this.starredSiteIds = ids;
    this.scheduler.setStarredSites(ids);
  }

  /** Notify the engine of tab visibility changes. */
  setTabVisible(visible: boolean): void {
    this.scheduler.setTabVisible(visible);
  }

  /**
   * Request full post content. Checks IDB first, fetches if missing.
   * Emits POST_CONTENT_READY when available.
   */
  async requestPostContent(siteId: number, postId: number): Promise<string | undefined> {
    // Check store first
    const cached = await this.store.getPostContent(siteId, postId);
    if (cached) {
      this.emit({
        type: 'POST_CONTENT_READY',
        siteId,
        postId,
        content: cached,
      });
      return cached;
    }

    // Fetch from API
    if (!this.token) return undefined;
    try {
      const post = await getPost(this.token, siteId, postId);
      if (post.content) {
        await this.store.putPostContent(siteId, postId, post.content);
        this.emit({
          type: 'POST_CONTENT_READY',
          siteId,
          postId,
          content: post.content,
        });
        return post.content;
      }
    } catch {
      // Non-critical — UI can fall back to its own fetch
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Message handling (used by Service Worker shell)
  // ---------------------------------------------------------------------------

  /** Handle an incoming message from the bridge. */
  handleMessage(msg: BridgeMessage): void {
    switch (msg.type) {
      case 'AUTH_TOKEN':
        if (!this.started) {
          this.start(msg.token, this.starredSiteIds);
        }
        break;
      case 'STARRED_SITES':
        this.setStarredSites(msg.siteIds);
        if (this.token && !this.started) {
          this.start(this.token, msg.siteIds);
        }
        break;
      case 'TAB_VISIBLE':
        this.setTabVisible(msg.visible);
        break;
      case 'REQUEST_POST_CONTENT':
        this.requestPostContent(msg.siteId, msg.postId);
        break;
      case 'KEEPALIVE':
        // No-op, just keeps the SW alive
        break;
    }
  }

  /** Register a callback for outgoing messages. */
  onMessage(callback: (msg: WorkerMessage) => void): void {
    this.listeners.push(callback);
  }

  /** Remove a message listener. */
  removeMessageListener(callback: (msg: WorkerMessage) => void): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  // ---------------------------------------------------------------------------
  // Store access (used by bridge for hydration)
  // ---------------------------------------------------------------------------

  /** Get all sites from the store. */
  async getSites(): Promise<WPComSite[]> {
    return this.store.getSites();
  }

  /** Get all posts for a site from the store. */
  async getPostsBySite(siteId: number): Promise<LightweightPost[]> {
    return this.store.getPostsBySite(siteId);
  }

  /** Get all following data from the store. */
  async getFollowing(): Promise<WPComSubscription[]> {
    return this.store.getFollowing();
  }

  /** Get all notifications from the store. */
  async getNotifications(): Promise<WPComNotification[]> {
    return this.store.getNotifications();
  }

  /** Get all posts grouped by site. */
  async getAllPosts(): Promise<LightweightPost[]> {
    return this.store.getAllPosts();
  }

  /** Get post content from the store. */
  async getPostContent(siteId: number, postId: number): Promise<string | undefined> {
    return this.store.getPostContent(siteId, postId);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private emit(msg: WorkerMessage): void {
    for (const listener of this.listeners) {
      listener(msg);
    }
  }
}
