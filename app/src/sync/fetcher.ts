/**
 * Concurrent HTTP executor for the sync engine.
 * Manages concurrency limits, rate limiting, and retry with backoff.
 * No DOM or React dependencies — runs in Service Worker or main thread.
 */

export interface FetchTask<T = unknown> {
  id: string;
  execute: () => Promise<T>;
  priority: number; // lower = higher priority
  retries?: number;
}

interface QueuedTask<T = unknown> {
  task: FetchTask<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  attempt: number;
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export class Fetcher {
  private maxConcurrency: number;
  private inFlight = 0;
  private queue: QueuedTask[] = [];
  private rateLimitRemaining: number | null = null;
  private retryAfterUntil: number | null = null;

  constructor(maxConcurrency: number = 6) {
    this.maxConcurrency = maxConcurrency;
  }

  /** Change the concurrency limit (e.g., 6 for startup, 3 for maintenance). */
  setConcurrency(n: number): void {
    this.maxConcurrency = n;
    this.drain();
  }

  /** Enqueue a fetch task. Returns a promise that resolves when the task completes. */
  enqueue<T>(task: FetchTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queued: QueuedTask = {
        task: task as FetchTask,
        resolve: resolve as (value: unknown) => void,
        reject,
        attempt: 0,
      };
      this.insertByPriority(queued);
      this.drain();
    });
  }

  /** Push a task to the front of the queue (highest priority). */
  enqueueFront<T>(task: FetchTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queued: QueuedTask = {
        task: task as FetchTask,
        resolve: resolve as (value: unknown) => void,
        reject,
        attempt: 0,
      };
      this.queue.unshift(queued);
      this.drain();
    });
  }

  /** Number of tasks currently executing. */
  get activeCount(): number {
    return this.inFlight;
  }

  /** Number of tasks waiting in the queue. */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Clear all pending tasks (does not cancel in-flight). */
  clearQueue(): void {
    for (const q of this.queue) {
      q.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }

  /**
   * Update rate limit state from response headers.
   * Call this after each API response.
   */
  updateRateLimits(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    if (remaining !== null) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }

    const retryAfter = headers.get('Retry-After');
    if (retryAfter !== null) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        this.retryAfterUntil = Date.now() + seconds * 1000;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private insertByPriority(item: QueuedTask): void {
    const idx = this.queue.findIndex((q) => q.task.priority > item.task.priority);
    if (idx === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(idx, 0, item);
    }
  }

  private drain(): void {
    while (this.inFlight < this.maxConcurrency && this.queue.length > 0) {
      // Respect rate limits
      if (this.retryAfterUntil && Date.now() < this.retryAfterUntil) {
        const delay = this.retryAfterUntil - Date.now();
        setTimeout(() => this.drain(), delay);
        return;
      }

      // Back off when approaching rate limit
      if (this.rateLimitRemaining !== null && this.rateLimitRemaining <= 5) {
        setTimeout(() => this.drain(), 2000);
        return;
      }

      const queued = this.queue.shift()!;
      this.inFlight++;
      this.executeTask(queued);
    }
  }

  private async executeTask(queued: QueuedTask): Promise<void> {
    try {
      queued.attempt++;
      const result = await queued.task.execute();
      queued.resolve(result);
    } catch (error) {
      const maxRetries = queued.task.retries ?? MAX_RETRIES;
      const isUnauthorized = error instanceof Error && error.message === 'UNAUTHORIZED';

      if (isUnauthorized || queued.attempt >= maxRetries) {
        queued.reject(error);
      } else {
        // Exponential backoff with jitter
        const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, queued.attempt - 1), MAX_BACKOFF_MS);
        const jitter = backoff * 0.2 * Math.random();
        setTimeout(() => {
          this.insertByPriority(queued);
          this.drain();
        }, backoff + jitter);
        return; // Don't decrement inFlight yet — the retry will
      }
    } finally {
      this.inFlight--;
    }
    this.drain();
  }
}
