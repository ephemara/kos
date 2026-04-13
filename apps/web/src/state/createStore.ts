// @ts-nocheck
import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

/**
 * Store configuration options
 */
export interface StoreConfig<T> {
  /** Store name for devtools */
  name: string;
  /** Enable persistence */
  persist?: boolean;
  /** Persistence options */
  persistOptions?: Partial<PersistOptions<T>>;
  /** Enable devtools integration */
  devtools?: boolean;
}

/**
 * Creates a typed Zustand store with optional persistence and devtools
 * 
 * @example
 * ```ts
 * interface CounterState {
 *   count: number;
 *   increment: () => void;
 * }
 * 
 * const useCounterStore = createStore<CounterState>({
 *   name: 'counter',
 *   persist: true,
 * }, (set) => ({
 *   count: 0,
 *   increment: () => set((state) => ({ count: state.count + 1 })),
 * }));
 * ```
 */
export function createStore<T extends object>(
  config: StoreConfig<T>,
  initializer: StateCreator<T, [], []>
) {
  const { name, persist: enablePersist, persistOptions, devtools: enableDevtools = true } = config;

  let store = initializer;

  // Add persistence middleware
  if (enablePersist) {
    store = persist(store, {
      name: `k-os-${name}`,
      ...persistOptions,
    }) as StateCreator<T, [], []>;
  }

  // Add devtools middleware
  if (enableDevtools && typeof window !== 'undefined') {
    store = devtools(store, { name: `K_OS/${name}` }) as StateCreator<T, [], []>;
  }

  return create<T>()(store);
}

/**
 * Creates a store with IndexedDB persistence for large data
 */
export function createIndexedDBStore<T extends object>(
  config: Omit<StoreConfig<T>, 'persistOptions'>,
  initializer: StateCreator<T, [], []>
) {
  return createStore<T>(
    {
      ...config,
      persist: true,
      persistOptions: {
        storage: {
          getItem: async (name: string) => {
            const db = await openDB();
            const tx = db.transaction('store', 'readonly');
            const store = tx.objectStore('store');
            const result = await store.get(name);
            return result?.value || null;
          },
          setItem: async (name: string, value: string) => {
            const db = await openDB();
            const tx = db.transaction('store', 'readwrite');
            const store = tx.objectStore('store');
            await store.put({ key: name, value });
          },
          removeItem: async (name: string) => {
            const db = await openDB();
            const tx = db.transaction('store', 'readwrite');
            const store = tx.objectStore('store');
            await store.delete(name);
          },
        },
      },
    },
    initializer
  );
}

/**
 * Opens IndexedDB connection
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('k-os-store', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store', { keyPath: 'key' });
      }
    };
  });
}
// @ts-nocheck
