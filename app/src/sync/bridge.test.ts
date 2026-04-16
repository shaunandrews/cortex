import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { SyncBridge } from './bridge';
import type {
  WPComPostsResponse,
  WPComFollowingResponse,
  WPComSite,
  WPComNotification,
} from '../api/types';
import type { InfiniteData } from '@tanstack/react-query';

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
        {
          ID: 20,
          name: 'P2 Site 2',
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
            unseen_count: 2,
            site_icon: null,
            organization_id: 1,
            last_updated: 0,
            is_owner: false,
          },
          {
            ID: 2,
            blog_ID: 20,
            feed_ID: 200,
            URL: '',
            feed_URL: '',
            name: 'P2 Site 2',
            unseen_count: 0,
            site_icon: null,
            organization_id: 1,
            last_updated: 0,
            is_owner: false,
          },
        ],
        page: 1,
        number: 200,
        total_subscriptions: 2,
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
        unseen_count: 2,
        site_icon: null,
        organization_id: 1,
        last_updated: 0,
        is_owner: false,
      },
      {
        ID: 2,
        blog_ID: 20,
        feed_ID: 200,
        URL: '',
        feed_URL: '',
        name: 'P2 Site 2',
        unseen_count: 0,
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
        found: 2,
        posts: [
          {
            ID: 1,
            site_ID: siteId,
            title: 'Post 1',
            excerpt: 'e1',
            date: '2026-04-16T12:00:00Z',
            URL: '',
            author: { name: 'Test', avatar_URL: '' },
          },
          {
            ID: 2,
            site_ID: siteId,
            title: 'Post 2',
            excerpt: 'e2',
            date: '2026-04-16T11:00:00Z',
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
      title: 'Post 1',
      content: '<p>Full content</p>',
      excerpt: 'e1',
      date: '2026-04-16T12:00:00Z',
      URL: '',
      author: { name: 'Test', avatar_URL: '' },
    }),
  ),
  getNotifications: vi.fn(() =>
    Promise.resolve({
      notes: [
        {
          id: 1,
          type: 'mention',
          read: 0,
          timestamp: '2026-04-16T12:00:00Z',
          subject: [{ text: 'Alice mentioned you' }],
          body: [],
          meta: { ids: { site: 10, post: 1 } },
        },
      ],
    }),
  ),
}));

// Clear IDB between tests
async function clearIDB() {
  const { SyncStore } = await import('./store');
  const s = new SyncStore();
  await s.clearAll();
}

describe('SyncBridge (direct mode)', () => {
  let queryClient: QueryClient;
  let bridge: SyncBridge;

  beforeEach(async () => {
    await clearIDB();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    bridge = new SyncBridge(queryClient, 'direct');
  });

  afterEach(() => {
    bridge.stop();
    queryClient.clear();
  });

  it('populates React Query p2-sites cache after start', async () => {
    await bridge.start('test-token', []);

    const sites = queryClient.getQueryData<WPComSite[]>(['p2-sites']);
    expect(sites).toBeDefined();
    expect(sites!).toHaveLength(2);
  });

  it('populates React Query notifications cache after start', async () => {
    await bridge.start('test-token', []);

    const notifications = queryClient.getQueryData<WPComNotification[]>(['notifications']);
    expect(notifications).toBeDefined();
    expect(notifications!).toHaveLength(1);
    expect(notifications![0].type).toBe('mention');
  });

  it('populates React Query following cache', async () => {
    await bridge.start('test-token', []);

    const following = queryClient.getQueryData(['following']);
    expect(following).toBeDefined();
    expect(Array.isArray(following)).toBe(true);
  });

  it('populates React Query p2-posts cache as InfiniteData', async () => {
    await bridge.start('test-token', []);

    const postsData = queryClient.getQueryData<InfiniteData<WPComPostsResponse>>(['p2-posts', 10]);
    expect(postsData).toBeDefined();
    expect(postsData!.pages).toHaveLength(1);
    expect(postsData!.pages[0].posts).toHaveLength(2);
    expect(postsData!.pageParams).toEqual([1]);
  });

  it('does not populate individual p2-post cache with lightweight posts', async () => {
    await bridge.start('test-token', []);

    // Lightweight posts (no content) should NOT be written to individual cache
    // to avoid blocking useP2Post from fetching the full version
    const post = queryClient.getQueryData(['p2-post', 10, 1]);
    expect(post).toBeUndefined();
  });

  it('hydrates from IndexedDB on subsequent startup', async () => {
    // First start populates IDB
    await bridge.start('test-token', []);
    bridge.stop();

    // Clear React Query cache
    queryClient.clear();
    expect(queryClient.getQueryData(['p2-sites'])).toBeUndefined();

    // Create new bridge, hydrate from IDB
    const bridge2 = new SyncBridge(queryClient, 'direct');
    await bridge2.hydrateFromStore();

    const sites = queryClient.getQueryData<WPComSite[]>(['p2-sites']);
    expect(sites).toBeDefined();
    expect(sites!.length).toBeGreaterThan(0);

    const postsData = queryClient.getQueryData<InfiniteData<WPComPostsResponse>>(['p2-posts', 10]);
    expect(postsData).toBeDefined();
    expect(postsData!.pages[0].posts.length).toBeGreaterThan(0);

    const notifications = queryClient.getQueryData<WPComNotification[]>(['notifications']);
    expect(notifications).toBeDefined();
    expect(notifications!.length).toBeGreaterThan(0);

    bridge2.stop();
  });

  it('exposes sync status', async () => {
    const statuses: string[] = [];
    bridge.onStatusChange((s) => statuses.push(s.phase));

    await bridge.start('test-token', []);

    // Should have transitioned through phases
    expect(statuses.length).toBeGreaterThan(0);
    // Final status should be maintaining
    expect(bridge.getStatus().phase).toBe('maintaining');
  });
});
