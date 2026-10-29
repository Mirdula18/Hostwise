/**
 * In-memory token bucket per client IP. State lives in one isolate only, so this is
 * best effort; a Cloudflare WAF rule can add a global limit on top.
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; updated: number }>();

  constructor(
    private readonly capacity = 20,
    private readonly windowMs = 5 * 60 * 1000,
    private readonly maxKeys = 10_000,
  ) {}

  /** Consumes one token for `key`; false means the request should be rejected. */
  take(key: string, now: number = Date.now()): boolean {
    const refillPerMs = this.capacity / this.windowMs;
    const b = this.buckets.get(key) ?? { tokens: this.capacity, updated: now };
    const tokens = Math.min(this.capacity, b.tokens + (now - b.updated) * refillPerMs);
    if (tokens < 1) {
      this.buckets.set(key, { tokens, updated: now });
      return false;
    }
    if (!this.buckets.has(key) && this.buckets.size >= this.maxKeys) this.evict(now);
    this.buckets.set(key, { tokens: tokens - 1, updated: now });
    return true;
  }

  /** Drops buckets that have fully refilled, then the oldest if still full. */
  private evict(now: number): void {
    for (const [k, b] of this.buckets) {
      if (now - b.updated >= this.windowMs) this.buckets.delete(k);
    }
    if (this.buckets.size >= this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) this.buckets.delete(oldest);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}
