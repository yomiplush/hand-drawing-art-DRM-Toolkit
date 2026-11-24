export class InMemoryIdbBackend {
  public version = 0;
  public readonly stores = new Map<string, { keyPath: string; rows: Map<string, unknown> }>();

  clearAll(): void {
    this.version = 0;
    this.stores.clear();
  }
}

export function createInMemoryIndexedDb(initialBackend?: InMemoryIdbBackend): {
  factory: IDBFactory;
  setBackend: (b: InMemoryIdbBackend) => void;
  getBackend: () => InMemoryIdbBackend;
} {
  let backend = initialBackend ?? new InMemoryIdbBackend();

  function cloneValue<T>(v: T): T {
    if (v === undefined || v === null || typeof v !== 'object') return v;
    if (v.constructor && v.constructor.name === 'CryptoKey') {
      return v; // preserve non-extractable CryptoKey references cleanly
    }
    if (ArrayBuffer.isView(v) && v instanceof Uint8Array) {
      return new Uint8Array(v) as unknown as T;
    }
    // Handle cross-realm Uint8Array in jsdom environments
    if (
      ArrayBuffer.isView(v) &&
      Object.prototype.toString.call(v) === '[object Uint8Array]'
    ) {
      const view = v as unknown as { length: number; [idx: number]: number };
      const copy = new Uint8Array(view.length);
      for (let i = 0; i < view.length; i++) copy[i] = view[i];
      return copy as unknown as T;
    }
    if (Array.isArray(v)) {
      return v.map((item) => cloneValue(item)) as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = cloneValue(val);
    }
    return out as T;
  }

  function createObjectStoreHandle(
    storeName: string,
    scheduleFinishCheck: () => void,
    bumpPending: (delta: number) => void,
  ): IDBObjectStore {
    const getStoreDef = () => {
      const def = backend.stores.get(storeName);
      if (!def) throw new Error(`Object store not found: ${storeName}`);
      return def;
    };

    const makeReq = <T>(exec: () => T): IDBRequest<T> => {
      bumpPending(1);
      const req: Record<string, unknown> = {
        result: undefined,
        error: null,
        readyState: 'pending',
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => {
        try {
          req.result = exec();
          req.readyState = 'done';
          if (typeof req.onsuccess === 'function') {
            (req.onsuccess as (ev: unknown) => void)({ target: req });
          }
        } catch (err) {
          req.error = err instanceof Error ? err : new Error(String(err));
          req.readyState = 'done';
          if (typeof req.onerror === 'function') {
            (req.onerror as (ev: unknown) => void)({ target: req });
          }
        } finally {
          bumpPending(-1);
          scheduleFinishCheck();
        }
      });
      return req as unknown as IDBRequest<T>;
    };

    return {
      get: (key: IDBValidKey) =>
        makeReq(() => {
          const val = getStoreDef().rows.get(String(key));
          return val === undefined ? undefined : cloneValue(val);
        }),
      getAll: () =>
        makeReq(() => {
          return Array.from(getStoreDef().rows.values()).map((v) => cloneValue(v));
        }),
      put: (val: Record<string, unknown>) =>
        makeReq(() => {
          const def = getStoreDef();
          const key = String(val[def.keyPath]);
          def.rows.set(key, cloneValue(val));
          return key as IDBValidKey;
        }),
      add: (val: Record<string, unknown>) =>
        makeReq(() => {
          const def = getStoreDef();
          const key = String(val[def.keyPath]);
          if (def.rows.has(key)) {
            throw new Error(`Key already exists in ${storeName}: ${key}`);
          }
          def.rows.set(key, cloneValue(val));
          return key as IDBValidKey;
        }),
      delete: (key: IDBValidKey) =>
        makeReq(() => {
          getStoreDef().rows.delete(String(key));
          return undefined;
        }),
    } as unknown as IDBObjectStore;
  }

  const factory: IDBFactory = {
    open: (_name: string, requestedVersion = 1) => {
      const req: Record<string, unknown> = {
        result: undefined,
        error: null,
        readyState: 'pending',
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };

      queueMicrotask(() => {
        const db: Record<string, unknown> = {
          objectStoreNames: {
            contains: (storeName: string) => backend.stores.has(storeName),
          },
          createObjectStore: (storeName: string, opts?: { keyPath?: string }) => {
            const keyPath = opts?.keyPath ?? 'id';
            if (!backend.stores.has(storeName)) {
              backend.stores.set(storeName, { keyPath, rows: new Map() });
            }
            return createObjectStoreHandle(
              storeName,
              () => {},
              () => {},
            );
          },
          transaction: (storeNames: string | string[]) => {
            void storeNames;
            let pending = 0;
            let completed = false;
            const tx: Record<string, unknown> = {
              error: null,
              oncomplete: null,
              onerror: null,
              onabort: null,
              objectStore: (sName: string) =>
                createObjectStoreHandle(sName, scheduleFinishCheck, (d) => {
                  pending += d;
                }),
            };
            const scheduleFinishCheck = () => {
              queueMicrotask(() => {
                if (!completed && pending === 0) {
                  completed = true;
                  if (typeof tx.oncomplete === 'function') {
                    (tx.oncomplete as (ev: unknown) => void)({ target: tx });
                  }
                }
              });
            };
            setTimeout(() => {
              if (!completed && pending === 0) {
                completed = true;
                if (typeof tx.oncomplete === 'function') {
                  (tx.oncomplete as (ev: unknown) => void)({ target: tx });
                }
              }
            }, 0);
            return tx;
          },
          close: () => {},
        };

        req.result = db;
        req.readyState = 'done';
        if (backend.version < requestedVersion) {
          backend.version = requestedVersion;
          if (typeof req.onupgradeneeded === 'function') {
            (req.onupgradeneeded as (ev: unknown) => void)({ target: req });
          }
        }
        if (typeof req.onsuccess === 'function') {
          (req.onsuccess as (ev: unknown) => void)({ target: req });
        }
      });

      return req as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;

  return {
    factory,
    setBackend: (b: InMemoryIdbBackend) => {
      backend = b;
    },
    getBackend: () => backend,
  };
}
