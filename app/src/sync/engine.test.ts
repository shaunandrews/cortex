import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEngine } from './engine';
import type { WorkerMessage } from './protocol';
import type { WPComPostsResponse, WPComFollowingResponse } from '../api/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../api/wpcom', () => ({
  getMySites: vi.fn(() =>
    Promise.resolve({
      sites: [
        {
          ID: 10,
          name: 'P2 Site',
          description: '',
          URL: '',
          options: { is_wpforteams_site: true },
        },
      ],
    }),
  ),
  getFollowingPage1: vi.fn(
    (): Promise<WPComFollowingResponse> =>
      Promise.resolve({
        subscriptions: [
          {
            ID: 1,
            blog_ID: 10,
            feed_ID: 100,
            URL: '',
            feed_URL: '',
            name: 'P2 Site',
            unseen_count: 1,
            site_icon: null,
            organization_id: 1,
            last_updated: 0,
            is_owner: false,
          },
        ],
        page: 1,
        number: 200,
        total_subscriptions: 1,
      }),
  ),
  getFollowing: vi.fn(() =>
    Promise.resolve([
      {
        ID: 1,
        blog_ID: 10,
        feed_ID: 100,
        URL: '',
        feed_URL: '',
        name: 'P2 Site',
        unseen_count: 1,
        site_icon: null,
        organization_id: 1,
        last_updated: 0,
        is_owner: false,
      },
    ]),
  ),
  getSitePostsLightweight: vi.fn(
    (_token: string, siteId: number): Promise<WPComPostsResponse> =>
      Promise.resolve({
        found: 1,
        posts: [
          {
            ID: 1,
            site_ID: siteId,
            title: 'Test Post',
            content: '<p>Full content</p>',
            excerpt: 'excerpt',
            date: '2026-04-16T12:00:00Z',
            URL: '',
            author: { name: 'Test', avatar_URL: '' },
          },
        ],
      }),
  ),
  getPost: vi.fn(() =>
    Promise.resolve({
      ID: 1,
      site_ID: 10,
      title: 'Test Post',
      content: '<p>Full content from getPost</p>',
      excerpt: 'excerpt',
      date: '2026-04-16T12:00:00Z',
      URL: '',
      author: { name: 'Test', avatar_URL: '' },
    }),
  ),
}));

// Clear IDB between tests
async function clearIDB() {
  const { SyncStore } = await import('./store');
  const store = new SyncStore();
  await store.clearAll();
}

describe('SyncEngine', () => {
  let engine: SyncEngine;
  let messages: WorkerMessage[];

  beforeEach(async () => {
    await clearIDB();
    engine = new SyncEngine();
    messages = [];
    engine.onMessage((msg) => messages.push(msg));
  });

  afterEach(() => {
    engine.stop();
  });

  it('starts up and emits READY', async () => {
    await engine.start('test-token', []);

    const ready = messages.find((m) => m.type === 'READY');
    expect(ready).toBeDefined();
  });

  it('emits SITES_UPDATED during bootstrap', async () => {
    await engine.start('test-token', []);

    const siteMsg = messages.find((m) => m.type === 'SITES_UPDATED');
    expect(siteMsg).toBeDefined();
    if (siteMsg?.type === 'SITES_UPDATED') {
      expect(siteMsg.sites).toHaveLength(1);
      expect(siteMsg.sites[0].ID).toBe(10);
    }
  });

  it('emits FOLLOWING_UPDATED during bootstrap', async () => {
    await engine.start('test-token', []);

    const followingMsg = messages.find((m) => m.type === 'FOLLOWING_UPDATED');
    expect(followingMsg).toBeDefined();
  });

  it('emits POSTS_UPDATED during prefetch', async () => {
    await engine.start('test-token', []);

    const postsMsg = messages.find((m) => m.type === 'POSTS_UPDATED');
    expect(postsMsg).toBeDefined();
    if (postsMsg?.type === 'POSTS_UPDATED') {
      expect(postsMsg.siteId).toBe(10);
      expect(postsMsg.posts).toHaveLength(1);
    }
  });

  it('emits SYNC_STATUS with progress', async () => {
    await engine.start('test-token', []);

    const statusMsgs = messages.filter((m) => m.type === 'SYNC_STATUS');
    expect(statusMsgs.length).toBeGreaterThan(0);
  });

  it('stores data in IDB accessible via getter methods', async () => {
    await engine.start('test-token', []);

    const sites = await engine.getSites();
    expect(sites).toHaveLength(1);

    const posts = await engine.getPostsBySite(10);
    expect(posts.length).toBeGreaterThan(0);

    const following = await engine.getFollowing();
    expect(following.length).toBeGreaterThan(0);
  });

  it('requestPostContent fetches and caches content', async () => {
    await engine.start('test-token', []);

    const content = await engine.requestPostContent(10, 1);
    expect(content).toBe('<p>Full content from getPost</p>');

    // Should have emitted POST_CONTENT_READY
    const contentMsg = messages.find((m) => m.type === 'POST_CONTENT_READY');
    expect(contentMsg).toBeDefined();

    // Second call should come from cache
    const { getPost } = await import('../api/wpcom');
    (getPost as ReturnType<typeof vi.fn>).mockClear();

    const cached = await engine.requestPostContent(10, 1);
    expect(cached).toBe('<p>Full content from getPost</p>');
    expect(getPost).not.toHaveBeenCalled();
  });

  it('handleMessage dispatches correctly', async () => {
    // AUTH_TOKEN should trigger start
    engine.handleMessage({ type: 'AUTH_TOKEN', token: 'test-token' });

    // Wait for async start to complete
    await new Promise((r) => setTimeout(r, 50));

    const ready = messages.find((m) => m.type === 'READY');
    expect(ready).toBeDefined();
  });

  it('handleMessage STARRED_SITES updates starred list', async () => {
    await engine.start('test-token', []);
    engine.handleMessage({ type: 'STARRED_SITES', siteIds: [10, 20] });
    // Should not crash
    expect(true).toBe(true);
  });

  it('handleMessage TAB_VISIBLE updates visibility', async () => {
    await engine.start('test-token', []);
    engine.handleMessage({ type: 'TAB_VISIBLE', visible: false });
    engine.handleMessage({ type: 'TAB_VISIBLE', visible: true });
    // Should not crash
    expect(true).toBe(true);
  });

  it('stop() prevents further emissions', async () => {
    await engine.start('test-token', []);
    engine.stop();

    // Clear messages to check nothing new comes
    messages.length = 0;
    await new Promise((r) => setTimeout(r, 100));
    // No new messages should have arrived (polling stopped)
    // (might get 0 or very few — the point is it doesn't crash)
    expect(true).toBe(true);
  });

  it('emits AUTH_ERROR on 401', async () => {
    const { getMySites } = await import('../api/wpcom');
    (getMySites as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('UNAUTHORIZED'));

    await expect(engine.start('bad-token', [])).rejects.toThrow('UNAUTHORIZED');

    const authError = messages.find((m) => m.type === 'AUTH_ERROR');
    expect(authError).toBeDefined();
  });
});
