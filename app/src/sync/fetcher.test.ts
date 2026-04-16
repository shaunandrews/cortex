import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Fetcher, type FetchTask } from './fetcher';

function makeTask<T>(
  id: string,
  result: T,
  opts?: { priority?: number; delayMs?: number; retries?: number; shouldFail?: boolean },
): FetchTask<T> {
  return {
    id,
    priority: opts?.priority ?? 0,
    retries: opts?.retries,
    execute: () =>
      new Promise((resolve, reject) => {
        const finish = () => {
          if (opts?.shouldFail) reject(new Error('fail'));
          else resolve(result);
        };
        if (opts?.delayMs) setTimeout(finish, opts.delayMs);
        else finish();
      }),
  };
}

describe('Fetcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('executes tasks and returns results', async () => {
    const fetcher = new Fetcher(2);
    const result = await fetcher.enqueue(makeTask('a', 'hello'));
    expect(result).toBe('hello');
  });

  it('respects concurrency limit', async () => {
    const fetcher = new Fetcher(2);
    let running = 0;
    let maxRunning = 0;

    const slowTask = (id: string): FetchTask<string> => ({
      id,
      priority: 0,
      execute: () =>
        new Promise((resolve) => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          setTimeout(() => {
            running--;
            resolve(id);
          }, 100);
        }),
    });

    const promises = [
      fetcher.enqueue(slowTask('a')),
      fetcher.enqueue(slowTask('b')),
      fetcher.enqueue(slowTask('c')),
      fetcher.enqueue(slowTask('d')),
    ];

    // Advance past all timers
    await vi.advanceTimersByTimeAsync(200);
    await Promise.all(promises);

    expect(maxRunning).toBe(2);
  });

  it('processes tasks in priority order', async () => {
    const fetcher = new Fetcher(1);
    const order: string[] = [];

    const trackTask = (id: string, priority: number): FetchTask<void> => ({
      id,
      priority,
      execute: async () => {
        order.push(id);
      },
    });

    // First task starts immediately (concurrency 1), rest queue
    const blockingTask: FetchTask<void> = {
      id: 'blocker',
      priority: 0,
      execute: () =>
        new Promise((resolve) => {
          order.push('blocker');
          setTimeout(resolve, 100);
        }),
    };

    const p0 = fetcher.enqueue(blockingTask);
    // These queue up while blocker runs — should execute in priority order
    const p1 = fetcher.enqueue(trackTask('low', 10));
    const p2 = fetcher.enqueue(trackTask('high', 1));
    const p3 = fetcher.enqueue(trackTask('mid', 5));

    await vi.advanceTimersByTimeAsync(200);
    await Promise.all([p0, p1, p2, p3]);

    expect(order).toEqual(['blocker', 'high', 'mid', 'low']);
  });

  it('retries failed tasks with backoff', async () => {
    const fetcher = new Fetcher(1);
    let attempts = 0;

    const flaky: FetchTask<string> = {
      id: 'flaky',
      priority: 0,
      retries: 3,
      execute: async () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'ok';
      },
    };

    const promise = fetcher.enqueue(flaky);

    // Advance through retry backoffs
    await vi.advanceTimersByTimeAsync(10000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('does not retry UNAUTHORIZED errors', async () => {
    const fetcher = new Fetcher(1);

    const unauthorized: FetchTask<string> = {
      id: 'unauth',
      priority: 0,
      execute: async () => {
        throw new Error('UNAUTHORIZED');
      },
    };

    await expect(fetcher.enqueue(unauthorized)).rejects.toThrow('UNAUTHORIZED');
  });

  it('enqueueFront puts task at the front', async () => {
    const fetcher = new Fetcher(1);
    const order: string[] = [];

    const blockingTask: FetchTask<void> = {
      id: 'blocker',
      priority: 0,
      execute: () =>
        new Promise((resolve) => {
          order.push('blocker');
          setTimeout(resolve, 100);
        }),
    };

    const trackTask = (id: string): FetchTask<void> => ({
      id,
      priority: 5,
      execute: async () => {
        order.push(id);
      },
    });

    const p0 = fetcher.enqueue(blockingTask);
    fetcher.enqueue(trackTask('queued'));
    fetcher.enqueueFront(trackTask('front'));

    await vi.advanceTimersByTimeAsync(200);
    await p0;

    expect(order[1]).toBe('front');
  });

  it('setConcurrency changes active limit', async () => {
    const fetcher = new Fetcher(1);
    let running = 0;
    let maxRunning = 0;

    const slowTask = (id: string): FetchTask<string> => ({
      id,
      priority: 0,
      execute: () =>
        new Promise((resolve) => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          setTimeout(() => {
            running--;
            resolve(id);
          }, 100);
        }),
    });

    // Enqueue 4 tasks at concurrency 1
    const p1 = fetcher.enqueue(slowTask('a'));
    const p2 = fetcher.enqueue(slowTask('b'));
    const p3 = fetcher.enqueue(slowTask('c'));
    const p4 = fetcher.enqueue(slowTask('d'));

    // Bump concurrency — should start draining more
    fetcher.setConcurrency(4);

    await vi.advanceTimersByTimeAsync(200);
    await Promise.all([p1, p2, p3, p4]);

    // After bumping to 4, all 4 should have been able to run concurrently
    // (3 were queued, 1 was already in-flight, so maxRunning should be 4)
    expect(maxRunning).toBe(4);
  });

  it('clearQueue rejects pending tasks', async () => {
    const fetcher = new Fetcher(1);

    const blockingTask: FetchTask<void> = {
      id: 'blocker',
      priority: 0,
      execute: () => new Promise((resolve) => setTimeout(resolve, 100)),
    };

    fetcher.enqueue(blockingTask);
    const pending = fetcher.enqueue(makeTask('pending', 'never'));

    fetcher.clearQueue();
    await expect(pending).rejects.toThrow('Queue cleared');
  });

  it('tracks activeCount and pendingCount', async () => {
    const fetcher = new Fetcher(1);

    const blockingTask: FetchTask<void> = {
      id: 'blocker',
      priority: 0,
      execute: () => new Promise((resolve) => setTimeout(resolve, 100)),
    };

    fetcher.enqueue(blockingTask);
    fetcher.enqueue(makeTask('queued', 'x'));

    expect(fetcher.activeCount).toBe(1);
    expect(fetcher.pendingCount).toBe(1);

    await vi.advanceTimersByTimeAsync(200);

    expect(fetcher.activeCount).toBe(0);
    expect(fetcher.pendingCount).toBe(0);
  });
});
