import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { SyncStore } from './store';
import type { LightweightPost, SiteSyncState } from './protocol';
import type { WPComSite, WPComSubscription, WPComNotification } from '../api/types';

function makeSite(id: number): WPComSite {
  return {
    ID: id,
    name: `Site ${id}`,
    description: '',
    URL: `https://site${id}.wordpress.com`,
  };
}

function makePost(siteId: number, postId: number): LightweightPost {
  return {
    ID: postId,
    site_ID: siteId,
    title: `Post ${postId}`,
    excerpt: 'excerpt',
    date: new Date(2026, 3, 16, 12, 0, postId).toISOString(),
    URL: `https://site${siteId}.wordpress.com/post-${postId}`,
    author: { name: 'Test', avatar_URL: '' },
    fetchedAt: Date.now(),
  };
}

function makeSubscription(blogId: number): WPComSubscription {
  return {
    ID: blogId + 1000,
    blog_ID: blogId,
    feed_ID: blogId + 2000,
    URL: `https://site${blogId}.wordpress.com`,
    feed_URL: `https://site${blogId}.wordpress.com/feed`,
    name: `Site ${blogId}`,
    unseen_count: 3,
    site_icon: null,
    organization_id: 1,
    last_updated: Date.now(),
    is_owner: false,
  };
}

describe('SyncStore', () => {
  let store: SyncStore;

  beforeEach(async () => {
    store = new SyncStore();
    await store.clearAll();
  });

  // -------------------------------------------------------------------------
  // Sites
  // -------------------------------------------------------------------------

  describe('sites', () => {
    it('stores and retrieves sites', async () => {
      const sites = [makeSite(1), makeSite(2), makeSite(3)];
      await store.putSites(sites);

      const result = await store.getSites();
      expect(result).toHaveLength(3);
      expect(result.map((s) => s.ID).sort()).toEqual([1, 2, 3]);
    });

    it('upserts sites with the same ID', async () => {
      await store.putSites([makeSite(1)]);
      await store.putSites([{ ...makeSite(1), name: 'Updated' }]);

      const result = await store.getSites();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Updated');
    });
  });

  // -------------------------------------------------------------------------
  // Posts
  // -------------------------------------------------------------------------

  describe('posts', () => {
    it('stores and retrieves posts by site', async () => {
      const posts = [makePost(10, 1), makePost(10, 2), makePost(20, 3)];
      await store.putPosts(posts);

      const site10 = await store.getPostsBySite(10);
      expect(site10).toHaveLength(2);

      const site20 = await store.getPostsBySite(20);
      expect(site20).toHaveLength(1);
      expect(site20[0].ID).toBe(3);
    });

    it('returns empty array for sites with no posts', async () => {
      const result = await store.getPostsBySite(999);
      expect(result).toEqual([]);
    });

    it('upserts posts with the same compound key', async () => {
      await store.putPosts([makePost(10, 1)]);
      await store.putPosts([{ ...makePost(10, 1), title: 'Updated' }]);

      const result = await store.getPostsBySite(10);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Updated');
    });

    it('retrieves all posts across sites', async () => {
      await store.putPosts([makePost(10, 1), makePost(20, 2), makePost(30, 3)]);
      const all = await store.getAllPosts();
      expect(all).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Post content
  // -------------------------------------------------------------------------

  describe('postContent', () => {
    it('stores and retrieves content', async () => {
      await store.putPostContent(10, 1, '<p>Hello world</p>');

      const content = await store.getPostContent(10, 1);
      expect(content).toBe('<p>Hello world</p>');
    });

    it('returns undefined for missing content', async () => {
      const content = await store.getPostContent(99, 99);
      expect(content).toBeUndefined();
    });

    it('overwrites content on upsert', async () => {
      await store.putPostContent(10, 1, '<p>Old</p>');
      await store.putPostContent(10, 1, '<p>New</p>');

      const content = await store.getPostContent(10, 1);
      expect(content).toBe('<p>New</p>');
    });
  });

  // -------------------------------------------------------------------------
  // Sync state
  // -------------------------------------------------------------------------

  describe('syncState', () => {
    it('stores and retrieves sync state', async () => {
      const state: SiteSyncState = {
        siteId: 10,
        lastFetchedAt: Date.now(),
        lastUnseenCount: 5,
        priority: 1,
      };
      await store.putSyncState(state);

      const result = await store.getSyncState(10);
      expect(result).toEqual(state);
    });

    it('returns undefined for unknown site', async () => {
      const result = await store.getSyncState(999);
      expect(result).toBeUndefined();
    });

    it('retrieves all sync states', async () => {
      await store.putSyncState({ siteId: 1, lastFetchedAt: 0, lastUnseenCount: 0, priority: 0 });
      await store.putSyncState({ siteId: 2, lastFetchedAt: 0, lastUnseenCount: 0, priority: 0 });

      const all = await store.getAllSyncStates();
      expect(all).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Following
  // -------------------------------------------------------------------------

  describe('following', () => {
    it('stores and retrieves subscriptions', async () => {
      const subs = [makeSubscription(10), makeSubscription(20)];
      await store.putFollowing(subs);

      const result = await store.getFollowing();
      expect(result).toHaveLength(2);
      expect(result.map((s) => s.blog_ID).sort()).toEqual([10, 20]);
    });

    it('upserts subscriptions with the same blog_ID', async () => {
      await store.putFollowing([makeSubscription(10)]);
      await store.putFollowing([{ ...makeSubscription(10), unseen_count: 0 }]);

      const result = await store.getFollowing();
      expect(result).toHaveLength(1);
      expect(result[0].unseen_count).toBe(0);
    });

    it('handles empty array gracefully', async () => {
      await store.putFollowing([]);
      const result = await store.getFollowing();
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Maintenance
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------

  describe('notifications', () => {
    function makeNotification(id: number, type = 'mention'): WPComNotification {
      return {
        id,
        type,
        read: 0,
        timestamp: new Date(2026, 3, 16, 12, 0, id).toISOString(),
        subject: [{ text: `Notification ${id}` }],
        body: [],
        meta: { ids: { site: 10, post: id } },
      };
    }

    it('stores and retrieves notifications', async () => {
      const notes = [makeNotification(1), makeNotification(2), makeNotification(3, 'comment')];
      await store.putNotifications(notes);

      const result = await store.getNotifications();
      expect(result).toHaveLength(3);
      expect(result.map((n) => n.id).sort()).toEqual([1, 2, 3]);
    });

    it('upserts notifications with the same id', async () => {
      await store.putNotifications([makeNotification(1)]);
      await store.putNotifications([{ ...makeNotification(1), read: 1 }]);

      const result = await store.getNotifications();
      expect(result).toHaveLength(1);
      expect(result[0].read).toBe(1);
    });

    it('handles empty array gracefully', async () => {
      await store.putNotifications([]);
      const result = await store.getNotifications();
      expect(result).toEqual([]);
    });
  });

  describe('clearAll', () => {
    it('clears all stores', async () => {
      await store.putSites([makeSite(1)]);
      await store.putPosts([makePost(1, 1)]);
      await store.putPostContent(1, 1, '<p>content</p>');
      await store.putSyncState({ siteId: 1, lastFetchedAt: 0, lastUnseenCount: 0, priority: 0 });
      await store.putFollowing([makeSubscription(1)]);
      await store.putNotifications([
        {
          id: 1,
          type: 'mention',
          read: 0,
          timestamp: '',
          subject: [],
          body: [],
          meta: { ids: {} },
        },
      ]);

      await store.clearAll();

      expect(await store.getSites()).toEqual([]);
      expect(await store.getAllPosts()).toEqual([]);
      expect(await store.getPostContent(1, 1)).toBeUndefined();
      expect(await store.getAllSyncStates()).toEqual([]);
      expect(await store.getFollowing()).toEqual([]);
      expect(await store.getNotifications()).toEqual([]);
    });
  });

  describe('evictOldPosts', () => {
    it('removes posts older than the threshold', async () => {
      const old = { ...makePost(10, 1), fetchedAt: Date.now() - 1000 * 60 * 60 * 24 * 10 }; // 10 days ago
      const fresh = { ...makePost(10, 2), fetchedAt: Date.now() };

      await store.putPosts([old, fresh]);
      await store.putPostContent(10, 1, '<p>old content</p>');

      const evicted = await store.evictOldPosts(1000 * 60 * 60 * 24 * 7); // 7 day threshold
      expect(evicted).toBe(1);

      const remaining = await store.getPostsBySite(10);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].ID).toBe(2);

      // Content should also be evicted
      expect(await store.getPostContent(10, 1)).toBeUndefined();
    });

    it('returns 0 when nothing to evict', async () => {
      await store.putPosts([makePost(10, 1)]);
      const evicted = await store.evictOldPosts(1000 * 60 * 60 * 24 * 7);
      expect(evicted).toBe(0);
    });
  });
});
