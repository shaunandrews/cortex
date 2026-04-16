import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler, type SchedulerEvent } from './scheduler';
import { SyncStore } from './store';
import { Fetcher } from './fetcher';
import type {
  WPComSite,
  WPComSubscription,
  WPComPostsResponse,
  WPComFollowingResponse,
} from '../api/types';

// ---------------------------------------------------------------------------
// Mock the API layer
// ---------------------------------------------------------------------------

const mockP2Sites: WPComSite[] = [
  {
    ID: 10,
    name: 'Site A',
    description: '',
    URL: 'https://a.wordpress.com',
    options: { is_wpforteams_site: true },
  },
  {
    ID: 20,
    name: 'Site B',
    description: '',
    URL: 'https://b.wordpress.com',
    options: { is_wpforteams_site: true },
  },
  {
    ID: 30,
    name: 'Non-P2',
    description: '',
    URL: 'https://c.wordpress.com',
    options: { is_wpforteams_site: false },
  },
];

const mockSubscriptions: WPComSubscription[] = [
  {
    ID: 1,
    blog_ID: 10,
    feed_ID: 100,
    URL: '',
    feed_URL: '',
    name: 'Site A',
    unseen_count: 3,
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
    name: 'Site B',
    unseen_count: 0,
    site_icon: null,
    organization_id: 1,
    last_updated: 0,
    is_owner: false,
  },
];

function makeMockPostsResponse(siteId: number): WPComPostsResponse {
  return {
    found: 2,
    posts: [
      {
        ID: 1,
        site_ID: siteId,
        title: 'Post 1',
        excerpt: '',
        date: '2026-04-16T12:00:00Z',
        URL: '',
        author: { name: 'Test', avatar_URL: '' },
      },
      {
        ID: 2,
        site_ID: siteId,
        title: 'Post 2',
        excerpt: '',
        date: '2026-04-16T11:00:00Z',
        URL: '',
        author: { name: 'Test', avatar_URL: '' },
      },
    ],
  };
}

vi.mock('../api/wpcom', () => ({
  getMySites: vi.fn(() => Promise.resolve({ sites: mockP2Sites })),
  getFollowingPage1: vi.fn(
    (): Promise<WPComFollowingResponse> =>
      Promise.resolve({
        subscriptions: mockSubscriptions,
        page: 1,
        number: 200,
        total_subscriptions: 2,
      }),
  ),
  getFollowing: vi.fn(() => Promise.resolve(mockSubscriptions)),
  getSitePostsLightweight: vi.fn((_token: string, siteId: number) =>
    Promise.resolve(makeMockPostsResponse(siteId)),
  ),
  getPost: vi.fn(() => Promise.resolve(makeMockPostsResponse(10).posts[0])),
  getNotifications: vi.fn(() =>
    Promise.resolve({
      notes: [
        {
          id: 1,
          type: 'mention',
          read: 0,
          timestamp: '2026-04-16T12:00:00Z',
          subject: [{ text: 'Alice mentioned you on Design Review' }],
          body: [],
          meta: { ids: { site: 10, post: 1 } },
          title: 'Design Review',
          url: '',
        },
      ],
    }),
  ),
}));

describe('Scheduler', () => {
  let store: SyncStore;
  let fetcher: Fetcher;
  let scheduler: Scheduler;
  let events: SchedulerEvent[];

  beforeEach(async () => {
    store = new SyncStore();
    await store.clearAll();
    fetcher = new Fetcher(6);
    scheduler = new Scheduler(store, fetcher);
    events = [];
    scheduler.onUpdate((event) => events.push(event));
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('transitions through phases: idle → bootstrapping → prefetching → maintaining', async () => {
    expect(scheduler.phase).toBe('idle');

    const startPromise = scheduler.start('test-token', []);
    expect(scheduler.phase).toBe('bootstrapping');

    await startPromise;
    expect(scheduler.phase).toBe('maintaining');
  });

  it('emits sites and following events during bootstrap', async () => {
    await scheduler.start('test-token', []);

    const siteEvents = events.filter((e) => e.type === 'sites');
    expect(siteEvents).toHaveLength(1);
    // Should only include P2 sites (not the non-P2 site)
    expect((siteEvents[0] as { type: 'sites'; sites: WPComSite[] }).sites).toHaveLength(2);

    const followingEvents = events.filter((e) => e.type === 'following');
    expect(followingEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('emits notifications event during bootstrap', async () => {
    await scheduler.start('test-token', []);

    const notifEvents = events.filter((e) => e.type === 'notifications');
    expect(notifEvents).toHaveLength(1);
    if (notifEvents[0].type === 'notifications') {
      expect(notifEvents[0].notifications).toHaveLength(1);
    }
  });

  it('emits posts events during prefetch', async () => {
    await scheduler.start('test-token', []);

    const postEvents = events.filter((e) => e.type === 'posts');
    // Should have fetched posts for both P2 sites
    expect(postEvents).toHaveLength(2);
  });

  it('stores sites and posts in IndexedDB', async () => {
    await scheduler.start('test-token', []);

    const sites = await store.getSites();
    expect(sites).toHaveLength(2);

    const posts10 = await store.getPostsBySite(10);
    expect(posts10.length).toBeGreaterThan(0);
  });

  it('prioritizes starred sites with unread content', async () => {
    const postOrder: number[] = [];

    const { getSitePostsLightweight } = await import('../api/wpcom');
    (getSitePostsLightweight as ReturnType<typeof vi.fn>).mockImplementation(
      (_token: string, siteId: number) => {
        postOrder.push(siteId);
        return Promise.resolve(makeMockPostsResponse(siteId));
      },
    );

    // Use concurrency 1 so order is deterministic
    const serialFetcher = new Fetcher(1);
    const serialScheduler = new Scheduler(store, serialFetcher);

    // Site 10 has 3 unseen, site 20 has 0 unseen
    // Starring site 20 shouldn't change that 10 goes first (unread beats starred-no-unread)
    await serialScheduler.start('test-token', [20]);
    serialScheduler.stop();

    expect(postOrder[0]).toBe(10); // unread
    expect(postOrder[1]).toBe(20); // starred but no unread
  });

  it('emits status events with progress', async () => {
    await scheduler.start('test-token', []);

    const statusEvents = events.filter((e) => e.type === 'status');
    expect(statusEvents.length).toBeGreaterThan(0);

    const lastStatus = statusEvents[statusEvents.length - 1] as {
      type: 'status';
      progress: { fetched: number; total: number };
    };
    expect(lastStatus.progress.fetched).toBe(lastStatus.progress.total);
  });

  it('stop() returns to idle and clears timers', async () => {
    await scheduler.start('test-token', []);
    expect(scheduler.phase).toBe('maintaining');

    scheduler.stop();
    expect(scheduler.phase).toBe('idle');
  });

  it('setTabVisible does not crash', async () => {
    await scheduler.start('test-token', []);
    expect(scheduler.phase).toBe('maintaining');

    scheduler.setTabVisible(false);
    scheduler.setTabVisible(true);

    expect(scheduler.phase).toBe('maintaining');
  });
});
