/**
 * IndexedDB store for the sync engine.
 * Uses the `idb` library for a thin promise wrapper around native IDB.
 *
 * Four object stores:
 *   sites       – P2 site metadata, keyed by site ID
 *   posts       – Lightweight posts (no full content), compound key [siteId, postId]
 *   postContent – Full HTML content, compound key [siteId, postId]
 *   syncState   – Per-site sync metadata, keyed by site ID
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { WPComSite, WPComSubscription } from '../api/types';
import type { LightweightPost, SiteSyncState } from './protocol';

const DB_NAME = 'cortex-sync';
const DB_VERSION = 1;

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
  // Maintenance
  // ---------------------------------------------------------------------------

  async clearAll(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(
      ['sites', 'posts', 'postContent', 'syncState', 'following'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('sites').clear(),
      tx.objectStore('posts').clear(),
      tx.objectStore('postContent').clear(),
      tx.objectStore('syncState').clear(),
      tx.objectStore('following').clear(),
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
