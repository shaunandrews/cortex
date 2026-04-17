/**
 * Shared message protocol between SyncBridge (React) and SyncEngine (Service Worker).
 * Both sides import these types — keep free of DOM/React dependencies.
 */

import type { WPComSite, WPComSubscription, WPComNotification } from '../api/types';

// ---------------------------------------------------------------------------
// Lightweight post — the feed-ready version stored in IDB (no full content)
// ---------------------------------------------------------------------------

export interface LightweightPost {
  ID: number;
  site_ID: number;
  title: string;
  excerpt: string;
  date: string;
  modified?: string;
  URL: string;
  author: { name: string; avatar_URL: string };
  like_count?: number;
  i_like?: boolean;
  is_seen?: boolean;
  tags?: Record<string, { name: string; slug: string }>;
  metadata?: { id: string; key: string; value: string }[];
  post_thumbnail?: { URL: string; width: number; height: number } | null;
  site_name?: string;
  site_URL?: string;
  /** Timestamp when this post was fetched by the sync engine */
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// Sync state persisted per-site in IDB
// ---------------------------------------------------------------------------

export interface SiteSyncState {
  siteId: number;
  lastFetchedAt: number; // ms timestamp of last successful post fetch
  lastUnseenCount: number;
  priority: number; // lower = higher priority
}

// ---------------------------------------------------------------------------
// Status types
// ---------------------------------------------------------------------------

export type SyncPhase = 'idle' | 'bootstrapping' | 'prefetching' | 'maintaining';

export interface SyncProgress {
  fetched: number;
  total: number;
}

export type SiteStatus = 'fresh' | 'fetching' | 'stale' | 'error';

// ---------------------------------------------------------------------------
// Bridge → Worker messages
// ---------------------------------------------------------------------------

export type BridgeMessage =
  | { type: 'AUTH_TOKEN'; token: string }
  | { type: 'STARRED_SITES'; siteIds: number[] }
  | { type: 'TAB_VISIBLE'; visible: boolean }
  | { type: 'REQUEST_POST_CONTENT'; siteId: number; postId: number }
  | { type: 'KEEPALIVE' };

// ---------------------------------------------------------------------------
// Worker → Bridge messages
// ---------------------------------------------------------------------------

export type WorkerMessage =
  | { type: 'READY' }
  | {
      type: 'SYNC_STATUS';
      phase: SyncPhase;
      progress: SyncProgress;
      siteStatuses: Record<number, SiteStatus>;
    }
  | { type: 'SITES_UPDATED'; sites: WPComSite[] }
  | { type: 'POSTS_UPDATED'; siteId: number; posts: LightweightPost[] }
  | { type: 'FOLLOWING_UPDATED'; subscriptions: WPComSubscription[] }
  | { type: 'NOTIFICATIONS_UPDATED'; notifications: WPComNotification[] }
  | {
      type: 'POST_CONTENT_READY';
      siteId: number;
      postId: number;
      content: string;
    }
  | { type: 'AUTH_ERROR' };
