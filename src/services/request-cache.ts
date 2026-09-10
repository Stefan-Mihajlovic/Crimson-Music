/** Small TTL/LRU cache that coalesces concurrent requests and never retains failures. */
export class RequestCache {
  private readonly values = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly capacity: number;

  constructor(capacity = 150) {
    this.capacity = capacity;
  }

  async get<T>(key: string, load: () => Promise<T>, ttlMs = 0): Promise<T> {
    const cached = this.values.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.values.delete(key);
      this.values.set(key, cached);
      return cached.value as T;
    }
    this.values.delete(key);
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const request = Promise.resolve().then(load).then((value) => {
      if (ttlMs > 0 && this.pending.get(key) === request) {
        this.values.set(key, { value, expiresAt: Date.now() + ttlMs });
        while (this.values.size > this.capacity) {
          this.values.delete(this.values.keys().next().value!);
        }
      }
      return value;
    }).finally(() => {
      if (this.pending.get(key) === request) this.pending.delete(key);
    });
    this.pending.set(key, request);
    return request;
  }

  clear() {
    this.values.clear();
    this.pending.clear();
  }
}
