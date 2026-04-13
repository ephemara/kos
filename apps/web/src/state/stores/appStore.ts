import { createStore } from '../createStore';

/**
 * Global app state shared across all DCC applications
 */
export interface AppState {
  /** Current active app */
  activeApp: string | null;
  /** App initialization status */
  initialized: boolean;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Recent files */
  recentFiles: string[];
  /** Actions */
  setActiveApp: (app: string) => void;
  setInitialized: (initialized: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addRecentFile: (file: string) => void;
  clearRecentFiles: () => void;
}

export const useAppStore = createStore<AppState>(
  {
    name: 'app',
    persist: true,
    devtools: true,
  },
  (set, get) => ({
    activeApp: null,
    initialized: false,
    loading: false,
    error: null,
    recentFiles: [],

    setActiveApp: (app) => set({ activeApp: app }),
    setInitialized: (initialized) => set({ initialized }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    addRecentFile: (file) => {
      const { recentFiles } = get();
      const filtered = recentFiles.filter((f) => f !== file);
      set({ recentFiles: [file, ...filtered].slice(0, 10) });
    },

    clearRecentFiles: () => set({ recentFiles: [] }),
  })
);
