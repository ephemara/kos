import { createStore } from '../createStore';
import { syncStore } from '../syncStore';

/**
 * User preferences shared across all apps
 */
export interface PreferencesState {
  /** Theme mode */
  theme: 'light' | 'dark' | 'auto';
  /** UI scale */
  uiScale: number;
  /** Auto-save enabled */
  autoSave: boolean;
  /** Auto-save interval (seconds) */
  autoSaveInterval: number;
  /** Performance mode */
  performanceMode: 'quality' | 'balanced' | 'performance';
  /** Show FPS counter */
  showFPS: boolean;
  /** Keyboard shortcuts */
  shortcuts: Record<string, string>;
  /** Actions */
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setUIScale: (scale: number) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
  setPerformanceMode: (mode: 'quality' | 'balanced' | 'performance') => void;
  toggleFPS: () => void;
  setShortcut: (action: string, key: string) => void;
  reset: () => void;
}

const defaultState = {
  theme: 'dark' as const,
  uiScale: 1.0,
  autoSave: true,
  autoSaveInterval: 300,
  performanceMode: 'balanced' as const,
  showFPS: false,
  shortcuts: {
    save: 'Ctrl+S',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Shift+Z',
    delete: 'Delete',
  },
};

export const usePreferencesStore = createStore<PreferencesState>(
  {
    name: 'preferences',
    persist: true,
    devtools: true,
  },
  (set, get) => ({
    ...defaultState,

    setTheme: (theme) => set({ theme }),
    setUIScale: (scale) => set({ uiScale: Math.max(0.5, Math.min(2.0, scale)) }),
    setAutoSave: (enabled) => set({ autoSave: enabled }),
    setAutoSaveInterval: (interval) => set({ autoSaveInterval: Math.max(30, interval) }),
    setPerformanceMode: (mode) => set({ performanceMode: mode }),
    toggleFPS: () => set({ showFPS: !get().showFPS }),
    setShortcut: (action, key) =>
      set({ shortcuts: { ...get().shortcuts, [action]: key } }),
    reset: () => set(defaultState),
  })
);

// Sync preferences across all app instances
syncStore(usePreferencesStore, {
  channel: 'k-os-preferences',
  debounce: 100,
});
