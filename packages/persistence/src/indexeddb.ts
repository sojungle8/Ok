import { STORES, type Backend, type StoreName, type Tx } from "./backend.ts";

const DB_VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
  });
}

/** IndexedDB backend: one readwrite transaction over all stores per settlement (atomic by spec). */
export class IndexedDbBackend implements Backend {
  readonly #db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.#db = db;
  }

  static open(name: string, factory: IDBFactory = indexedDB): Promise<IndexedDbBackend> {
    return new Promise((resolve, reject) => {
      const r = factory.open(name, DB_VERSION);
      r.onupgradeneeded = () => {
        for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s);
      };
      r.onsuccess = () => resolve(new IndexedDbBackend(r.result));
      r.onerror = () => reject(r.error ?? new Error("IndexedDB open failed"));
    });
  }

  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const t = this.#db.transaction([...STORES], "readwrite");
    const done = new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onabort = () => reject(t.error ?? new Error("transaction aborted"));
      t.onerror = () => reject(t.error ?? new Error("transaction failed"));
    });
    const tx: Tx = {
      get: <T>(store: StoreName, key: string) => req(t.objectStore(store).get(key) as IDBRequest<T | undefined>),
      put: (store, key, value) => {
        t.objectStore(store).put(value, key);
      },
      delete: (store, key) => {
        t.objectStore(store).delete(key);
      },
    };
    return fn(tx).then(
      async (result) => {
        await done;
        return result;
      },
      async (err: unknown) => {
        try {
          t.abort();
        } catch {
          /* already finished */
        }
        await done.catch(() => undefined);
        throw err;
      },
    );
  }

  async getAll<T>(store: StoreName): Promise<[string, T][]> {
    const t = this.#db.transaction(store, "readonly");
    const os = t.objectStore(store);
    const [keys, values] = await Promise.all([req(os.getAllKeys()), req(os.getAll() as IDBRequest<T[]>)]);
    return keys.map((k, i) => [typeof k === "string" ? k : JSON.stringify(k), values[i] as T]);
  }

  close(): void {
    this.#db.close();
  }
}
