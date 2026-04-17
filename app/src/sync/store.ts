/**
 * IndexedDB store for the sync engine.
 * Uses the `idb` library for a thin promise wrapper around native IDB.
 *
 * Object stores:
 *   sites       – P2 site metadata, keyed by site ID
 *   posts       – Lightweight posts (no full content), compound key [siteId, postId]
 *   postContent – Full HTML content, compound key [siteId, postId]
 *   syncState   – Per-site sync metadata, keyed by site ID
 *   following   – Reader subscriptions, keyed by blog_ID
 *   savedItems  – User-saved posts/comments with content snapshots
 *   savedGroups – User-created folders for organizing saved items
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { WPComSite, WPComSubscription, WPComNotification } from '../api/types';
import type { LightweightPost, SiteSyncState } from './protocol';
import type { SavedItem, SavedGroup } from '../saved/types';

const DB_NAME = 'cortex-sync';
const DB_VERSION = 5;

export interface SyncStoreDB {
  sites: {
    key: number;
    value: WPComSite;
  };
  posts: {
    key: [number, number]; // [siteId, postId]
    value: LightweightPost;
    indexes: {
      bySite: number;
      byDate: string;
    };
  };
  postContent: {
    key: [number, number]; // [siteId, postId]
    value: { siteId: number; postId: number; content: string; fetchedAt: number };
  };
  syncState: {
    key: number; // siteId
    value: SiteSyncState;
  };
  following: {
    key: number; // blog_ID
    value: WPComSubscription;
  };
  notifications: {
    key: number; // notification id
    value: WPComNotification;
    indexes: {
      byType: string;
    };
  };
  savedItems: {
    key: number; // auto-increment id
    value: SavedItem;
    indexes: {
      byGroup: number;
      bySite: number;
      byType: string;
      bySavedAt: number;
    };
  };
  savedGroups: {
    key: number; // auto-increment id
    value: SavedGroup;
  };
  summaries: {
    key: [number, number]; // [siteId, postId]
    value: { siteId: number; postId: number; summary: string; generatedAt: number };
  };
  seenPosts: {
    key: [number, number]; // [siteId, postId]
    value: { siteId: number; postId: number; seenAt: number };
  };
}

export class SyncStore {
  private dbPromise: Promise<IDBPDatabase<SyncStoreDB>>;

  constructor() {
    this.dbPromise = openDB<SyncStoreDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Sites store
        if (!db.objectStoreNames.contains('sites')) {
          db.createObjectStore('sites', { keyPath: 'ID' });
        }

        // Posts store with indexes
        if (!db.objectStoreNames.contains('posts')) {
          const postStore = db.createObjectStore('posts', {
            keyPath: ['site_ID', 'ID'],
          });
          postStore.createIndex('bySite', 'site_ID');
          postStore.createIndex('byDate', 'date');
        }

        // Post content store
        if (!db.objectStoreNames.contains('postContent')) {
          db.createObjectStore('postContent', {
            keyPath: ['siteId', 'postId'],
          });
        }

        // Sync state store
        if (!db.objectStoreNames.contains('syncState')) {
          db.createObjectStore('syncState', { keyPath: 'siteId' });
        }

        // Following/subscriptions store
        if (!db.objectStoreNames.contains('following')) {
          db.createObjectStore('following', { keyPath: 'blog_ID' });
        }

        // Notifications store (v3)
        if (!db.objectStoreNames.contains('notifications')) {
          const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
          notifStore.createIndex('byType', 'type');
        }

        // Saved items store (v2)
        if (!db.objectStoreNames.contains('savedItems')) {
          const savedStore = db.createObjectStore('savedItems', {
            keyPath: 'id',
            autoIncrement: true,
          });
          savedStore.createIndex('byGroup', 'groupId');
          savedStore.createIndex('bySite', 'siteId');
          savedStore.createIndex('byType', 'type');
          savedStore.createIndex('bySavedAt', 'savedAt');
        }

        // Saved groups store (v2)
        if (!db.objectStoreNames.contains('savedGroups')) {
          db.createObjectStore('savedGroups', {
            keyPath: 'id',
            autoIncrement: true,
          });
        }

        // AI summaries store (v4)
        if (!db.objectStoreNames.contains('summaries')) {
          db.createObjectStore('summaries', {
            keyPath: ['siteId', 'postId'],
          });
        }

        // Seen posts store (v5) — tracks which posts the user has read
        if (!db.objectStoreNames.contains('seenPosts')) {
          db.createObjectStore('seenPosts', {
            keyPath: ['siteId', 'postId'],
          });
        }
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Sites
  // ---------------------------------------------------------------------------

  async putSites(sites: WPComSite[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('sites', 'readwrite');
    await Promise.all([...sites.map((site) => tx.store.put(site)), tx.done]);
  }

  async getSites(): Promise<WPComSite[]> {
    const db = await this.dbPromise;
    return db.getAll('sites');
  }

  // ---------------------------------------------------------------------------
  // Posts (lightweight, no content)
  // ---------------------------------------------------------------------------

  async putPosts(posts: LightweightPost[]): Promise<void> {
    if (posts.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction('posts', 'readwrite');
    await Promise.all([...posts.map((post) => tx.store.put(post)), tx.done]);
  }

  async getPostsBySite(siteId: number): Promise<LightweightPost[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex('posts', 'bySite', siteId);
  }

  async getAllPosts(): Promise<LightweightPost[]> {
    const db = await this.dbPromise;
    return db.getAll('posts');
  }

  // ---------------------------------------------------------------------------
  // Post content (full HTML)
  // ---------------------------------------------------------------------------

  async putPostContent(siteId: number, postId: number, content: string): Promise<void> {
    const db = await this.dbPromise;
    await db.put('postContent', {
      siteId,
      postId,
      content,
      fetchedAt: Date.now(),
    });
  }

  async getPostContent(siteId: number, postId: number): Promise<string | undefined> {
    const db = await this.dbPromise;
    const record = await db.get('postContent', [siteId, postId]);
    return record?.content;
  }

  // ---------------------------------------------------------------------------
  // Sync state
  // ---------------------------------------------------------------------------

  async putSyncState(state: SiteSyncState): Promise<void> {
    const db = await this.dbPromise;
    await db.put('syncState', state);
  }

  async getSyncState(siteId: number): Promise<SiteSyncState | undefined> {
    const db = await this.dbPromise;
    return db.get('syncState', siteId);
  }

  async getAllSyncStates(): Promise<SiteSyncState[]> {
    const db = await this.dbPromise;
    return db.getAll('syncState');
  }

  // ---------------------------------------------------------------------------
  // Following / subscriptions
  // ---------------------------------------------------------------------------

  async putFollowing(subscriptions: WPComSubscription[]): Promise<void> {
    if (subscriptions.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction('following', 'readwrite');
    await Promise.all([...subscriptions.map((sub) => tx.store.put(sub)), tx.done]);
  }

  async getFollowing(): Promise<WPComSubscription[]> {
    const db = await this.dbPromise;
    return db.getAll('following');
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  async putNotifications(notifications: WPComNotification[]): Promise<void> {
    if (notifications.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction('notifications', 'readwrite');
    await Promise.all([...notifications.map((n) => tx.store.put(n)), tx.done]);
  }

  async getNotifications(): Promise<WPComNotification[]> {
    const db = await this.dbPromise;
    return db.getAll('notifications');
  }

  // ---------------------------------------------------------------------------
  // Saved items
  // ---------------------------------------------------------------------------

  async getSavedItems(): Promise<SavedItem[]> {
    const db = await this.dbPromise;
    return db.getAll('savedItems');
  }

  async getSavedItemsByGroup(groupId: number | null): Promise<SavedItem[]> {
    const db = await this.dbPromise;
    if (groupId === null) {
      // IDB can't index null directly — filter in memory
      const all = await db.getAll('savedItems');
      return all.filter((item) => item.groupId === null);
    }
    return db.getAllFromIndex('savedItems', 'byGroup', groupId);
  }

  async findSavedItem(
    type: 'post' | 'comment',
    siteId: number,
    postId: number,
    commentId: number | null,
  ): Promise<SavedItem | undefined> {
    const db = await this.dbPromise;
    const all = await db.getAllFromIndex('savedItems', 'bySite', siteId);
    return all.find(
      (item) => item.type === type && item.postId === postId && item.commentId === commentId,
    );
  }

  async addSavedItem(item: SavedItem): Promise<number> {
    const db = await this.dbPromise;
    // Strip `id` so IDB auto-increment generates it
    const rest = { ...item };
    delete (rest as Record<string, unknown>).id;
    return db.add('savedItems', rest as SavedItem) as Promise<number>;
  }

  async deleteSavedItem(id: number): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('savedItems', id);
  }

  async updateSavedItemGroup(id: number, groupId: number | null): Promise<void> {
    const db = await this.dbPromise;
    const item = await db.get('savedItems', id);
    if (item) {
      item.groupId = groupId;
      await db.put('savedItems', item);
    }
  }

  async updateSavedItemPosition(id: number, x: number, y: number): Promise<void> {
    const db = await this.dbPromise;
    const item = await db.get('savedItems', id);
    if (item) {
      item.x = x;
      item.y = y;
      await db.put('savedItems', item);
    }
  }

  async moveSavedItemsFromGroup(fromGroupId: number): Promise<void> {
    const db = await this.dbPromise;
    const items = await db.getAllFromIndex('savedItems', 'byGroup', fromGroupId);
    if (items.length === 0) return;
    const tx = db.transaction('savedItems', 'readwrite');
    for (const item of items) {
      item.groupId = null;
      tx.store.put(item);
    }
    await tx.done;
  }

  // ---------------------------------------------------------------------------
  // Saved groups
  // ---------------------------------------------------------------------------

  async getSavedGroups(): Promise<SavedGroup[]> {
    const db = await this.dbPromise;
    return db.getAll('savedGroups');
  }

  async addSavedGroup(group: SavedGroup): Promise<number> {
    const db = await this.dbPromise;
    const rest = { ...group };
    delete (rest as Record<string, unknown>).id;
    return db.add('savedGroups', rest as SavedGroup) as Promise<number>;
  }

  async updateSavedGroup(group: SavedGroup): Promise<void> {
    const db = await this.dbPromise;
    await db.put('savedGroups', group);
  }

  async deleteSavedGroup(id: number): Promise<void> {
    const db = await this.dbPromise;
    await this.moveSavedItemsFromGroup(id);
    await db.delete('savedGroups', id);
  }

  // ---------------------------------------------------------------------------
  // AI Summaries
  // ---------------------------------------------------------------------------

  async putSummary(siteId: number, postId: number, summary: string): Promise<void> {
    const db = await this.dbPromise;
    await db.put('summaries', { siteId, postId, summary, generatedAt: Date.now() });
  }

  async getSummary(siteId: number, postId: number): Promise<string | undefined> {
    const db = await this.dbPromise;
    const row = await db.get('summaries', [siteId, postId]);
    return row?.summary;
  }

  // ---------------------------------------------------------------------------
  // Seen Posts
  // ---------------------------------------------------------------------------

  async markSeen(siteId: number, postId: number): Promise<void> {
    const db = await this.dbPromise;
    await db.put('seenPosts', { siteId, postId, seenAt: Date.now() });
  }

  async getSeenPostIds(): Promise<Set<string>> {
    const db = await this.dbPromise;
    const all = await db.getAll('seenPosts');
    return new Set(all.map((r) => `${r.siteId}-${r.postId}`));
  }

  // ---------------------------------------------------------------------------
  // Maintenance
  // ---------------------------------------------------------------------------

  async clearAll(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(
      [
        'sites',
        'posts',
        'postContent',
        'syncState',
        'following',
        'notifications',
        'savedItems',
        'savedGroups',
        'summaries',
        'seenPosts',
      ],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('sites').clear(),
      tx.objectStore('posts').clear(),
      tx.objectStore('postContent').clear(),
      tx.objectStore('syncState').clear(),
      tx.objectStore('following').clear(),
      tx.objectStore('notifications').clear(),
      tx.objectStore('savedItems').clear(),
      tx.objectStore('savedGroups').clear(),
      tx.objectStore('summaries').clear(),
      tx.objectStore('seenPosts').clear(),
      tx.done,
    ]);
  }

  /** Evict posts older than the given age (milliseconds). */
  async evictOldPosts(maxAgeMs: number): Promise<number> {
    const db = await this.dbPromise;
    const cutoff = Date.now() - maxAgeMs;
    const allPosts = await db.getAll('posts');
    const stale = allPosts.filter((p) => p.fetchedAt < cutoff);

    if (stale.length === 0) return 0;

    const tx = db.transaction(['posts', 'postContent'], 'readwrite');
    for (const post of stale) {
      tx.objectStore('posts').delete([post.site_ID, post.ID]);
      tx.objectStore('postContent').delete([post.site_ID, post.ID]);
    }
    await tx.done;
    return stale.length;
  }
}

/** Shared singleton — all callers use the same DB connection. */
let _sharedStore: SyncStore | null = null;
export function getSharedStore(): SyncStore {
  if (!_sharedStore) _sharedStore = new SyncStore();
  return _sharedStore;
}
