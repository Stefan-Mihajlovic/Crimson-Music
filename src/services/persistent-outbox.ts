type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };

/** Serializes disk updates while allowing new events during a network flush. */
export class PersistentOutbox<T extends { id: string }> {
  private operations: Promise<unknown> = Promise.resolve();
  private flushing: Promise<void> | null = null;
  private disposed = false;
  private readonly key: string;
  private readonly storage: Storage;
  private readonly send: (item: T) => Promise<void>;
  private readonly canSend: () => boolean;
  private readonly discardRejected: (error: unknown, item: T) => boolean;

  constructor(key: string, storage: Storage, send: (item: T) => Promise<void>, canSend: () => boolean, discardRejected: (error: unknown, item: T) => boolean = () => false) {
    this.key = key;
    this.storage = storage;
    this.send = send;
    this.canSend = canSend;
    this.discardRejected = discardRejected;
  }

  private serialize<R>(operation: () => Promise<R>) {
    const pending = this.operations.catch(() => undefined).then(operation);
    this.operations = pending;
    return pending;
  }

  private async read(): Promise<T[]> {
    const raw = await this.storage.getItem(this.key);
    if (!raw) return [];
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) throw new Error('Invalid listening event outbox.');
    return items;
  }

  enqueue(item: T) {
    return this.serialize(async () => {
      if (this.disposed) return;
      const items = await this.read();
      if (items.some((pending) => pending.id === item.id)) return;
      if (items.length >= 2_000) throw new Error('Offline listening history is full. Connect to sync it.');
      await this.storage.setItem(this.key, JSON.stringify([...items, item]));
    });
  }

  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      while (!this.disposed && this.canSend()) {
        const item = await this.serialize(async () => (await this.read())[0]);
        if (!item || this.disposed || !this.canSend()) return;
        try {
          await this.send(item);
        } catch (error) {
          // A permanently invalid/expired event must not block newer history.
          // Transient failures leave the event on disk for an idempotent retry.
          if (!this.discardRejected(error, item)) throw error;
        }
        await this.serialize(async () => {
          if (this.disposed) return;
          const items = await this.read();
          await this.storage.setItem(this.key, JSON.stringify(items.filter((pending) => pending.id !== item.id)));
        });
      }
    })().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  async dispose() {
    this.disposed = true;
    await Promise.allSettled([this.operations, this.flushing]);
  }
}
