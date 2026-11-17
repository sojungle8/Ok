/**
 * Minimal transactional key-value contract shared by the IndexedDB and in-memory backends.
 * A transaction either commits every write or none.
 */
export const STORES = ["pendingResults", "runResults", "characters", "inventory", "stageProgress", "meta"] as const;
export type StoreName = (typeof STORES)[number];

export interface Tx {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put(store: StoreName, key: string, value: unknown): void;
  delete(store: StoreName, key: string): void;
}

export interface Backend {
  /** Run `fn` atomically. Throwing inside `fn` aborts every write. */
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
  getAll<T>(store: StoreName): Promise<[string, T][]>;
}

export class CrashError extends Error {
  readonly point: string;
  constructor(point: string) {
    super(`simulated crash: ${point}`);
    this.name = "CrashError";
    this.point = point;
  }
}

export type CrashPoint = "before-transaction" | "mid-transaction" | "after-commit";

/**
 * In-memory backend with fault injection for settlement tests. Writes are staged and applied on
 * commit; "mid-transaction" crashes discard the stage; "after-commit" crashes commit and then throw
 * (the caller never sees the acknowledgement).
 */
export class MemoryBackend implements Backend {
  readonly data = new Map<StoreName, Map<string, string>>(STORES.map((s) => [s, new Map()]));
  crash: CrashPoint | null = null;
  /** For mid-transaction crashes: crash after this many writes have been staged. */
  crashAfterWrites = 1;

  async transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const crash = this.crash;
    this.crash = null;
    if (crash === "before-transaction") throw new CrashError(crash);
    const staged: { store: StoreName; key: string; value: string | null }[] = [];
    const lookup = (store: StoreName, key: string): string | undefined => {
      for (let i = staged.length - 1; i >= 0; i -= 1) {
        const w = staged[i] as (typeof staged)[number];
        if (w.store === store && w.key === key) return w.value ?? undefined;
      }
      return this.data.get(store)?.get(key);
    };
    const stage = (w: (typeof staged)[number]): void => {
      staged.push(w);
      if (crash === "mid-transaction" && staged.length >= this.crashAfterWrites) throw new CrashError(crash);
    };
    const tx: Tx = {
      get: <T>(store: StoreName, key: string) => {
        const v = lookup(store, key);
        return Promise.resolve(v === undefined ? undefined : (JSON.parse(v) as T));
      },
      put: (store, key, value) => stage({ store, key, value: JSON.stringify(value) }),
      delete: (store, key) => stage({ store, key, value: null }),
    };
    const result = await fn(tx); // any throw (incl. mid crash) discards `staged`
    for (const w of staged) {
      const m = this.data.get(w.store) as Map<string, string>;
      if (w.value === null) m.delete(w.key);
      else m.set(w.key, w.value);
    }
    if (crash === "after-commit") throw new CrashError(crash);
    return result;
  }

  getAll<T>(store: StoreName): Promise<[string, T][]> {
    return Promise.resolve([...(this.data.get(store) ?? new Map<string, string>()).entries()].map(([k, v]) => [k, JSON.parse(v) as T]));
  }
}
