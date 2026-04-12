import { StoreApi, UseBoundStore } from 'zustand';

/**
 * Sync configuration for cross-app state synchronization
 */
export interface SyncConfig<T> {
  /** Channel name for BroadcastChannel */
  channel: string;
  /** Keys to sync (if undefined, syncs entire state) */
  keys?: (keyof T)[];
  /** Debounce delay for sync operations (ms) */
  debounce?: number;
}

/**
 * Creates a synchronized store that shares state across browser tabs/windows
 * Uses BroadcastChannel API for efficient cross-context communication
 * 
 * @example
 * ```ts
 * const useThemeStore = createStore({ name: 'theme' }, (set) => ({
 *   mode: 'dark',
 *   setMode: (mode) => set({ mode }),
 * }));
 * 
 * // Enable sync
 * syncStore(useThemeStore, { channel: 'theme-sync' });
 * ```
 */
export function syncStore<T extends object>(
  store: UseBoundStore<StoreApi<T>>,
  config: SyncConfig<T>
): () => void {
  const { channel: channelName, keys, debounce = 50 } = config;

  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    console.warn('BroadcastChannel not supported, sync disabled');
    return () => {};
  }

  const channel = new BroadcastChannel(channelName);
  let debounceTimer: NodeJS.Timeout | null = null;

  // Listen for updates from other tabs
  const handleMessage = (event: MessageEvent) => {
    const { type, payload } = event.data;

    if (type === 'STATE_UPDATE') {
      const currentState = store.getState();
      const newState = keys
        ? Object.fromEntries(
            Object.entries(payload).filter(([key]) => keys.includes(key as keyof T))
          )
        : payload;

      store.setState({ ...currentState, ...newState } as T, true);
    }
  };

  channel.addEventListener('message', handleMessage);

  // Broadcast updates to other tabs
  const unsubscribe = store.subscribe((state) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      const payload = keys
        ? Object.fromEntries(
            Object.entries(state).filter(([key]) => keys.includes(key as keyof T))
          )
        : state;

      channel.postMessage({
        type: 'STATE_UPDATE',
        payload,
      });
    }, debounce);
  });

  // Cleanup function
  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    channel.removeEventListener('message', handleMessage);
    channel.close();
    unsubscribe();
  };
}

/**
 * Creates a store selector that syncs specific slices across apps
 * Useful for sharing common state (theme, user prefs, etc.) between different DCC apps
 * 
 * @example
 * ```ts
 * // In KSculpt
 * const useSculptStore = createStore({ name: 'sculpt' }, (set) => ({
 *   tool: 'brush',
 *   theme: 'dark',
 *   setTool: (tool) => set({ tool }),
 *   setTheme: (theme) => set({ theme }),
 * }));
 * 
 * // Sync only theme across apps
 * syncStore(useSculptStore, { 
 *   channel: 'global-prefs',
 *   keys: ['theme']
 * });
 * ```
 */
export function createSyncedSlice<T extends object, K extends keyof T>(
  store: UseBoundStore<StoreApi<T>>,
  keys: K[],
  channelName: string
): () => void {
  return syncStore(store, {
    channel: channelName,
    keys,
  });
}

/**
 * Broadcasts a custom event to all synced stores
 */
export function broadcastEvent(channelName: string, eventType: string, payload?: any): void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return;
  }

  const channel = new BroadcastChannel(channelName);
  channel.postMessage({
    type: eventType,
    payload,
    timestamp: Date.now(),
  });
  channel.close();
}

/**
 * Listens for custom events from synced stores
 */
export function listenToEvents(
  channelName: string,
  eventType: string,
  callback: (payload: any) => void
): () => void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return () => {};
  }

  const channel = new BroadcastChannel(channelName);

  const handleMessage = (event: MessageEvent) => {
    const { type, payload } = event.data;
    if (type === eventType) {
      callback(payload);
    }
  };

  channel.addEventListener('message', handleMessage);

  return () => {
    channel.removeEventListener('message', handleMessage);
    channel.close();
  };
}
