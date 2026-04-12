/**
 * K-OS Console Store - Real-time Log Streaming from Bevy
 * 
 * Receives batched logs from the Bevy engine and provides:
 * - Ring buffer (max 1000 entries, oldest dropped)
 * - Level filtering (ERROR, WARN, INFO, DEBUG)
 * - Target filtering (e.g., "gpu", "sculpt")
 * - Search functionality
 */

import { create } from 'zustand';
import type { LogEntry } from './LogEntry';
import { LogLevel, logLevelToColor } from './LogLevel';

// Re-export types
export type { LogEntry };
export { LogLevel };

// ============================================================================
// TYPES
// ============================================================================

interface ConsoleFilters {
    minLevel: LogLevel;
    searchQuery: string;
    targetFilter: string | null;
}

interface ConsoleStoreState {
    // === LOG BUFFER ===
    logs: LogEntry[];
    maxLogs: number;

    // === FILTERS ===
    filters: ConsoleFilters;

    // === UI STATE ===
    isOpen: boolean;
    isPaused: boolean;
    autoScroll: boolean;

    // === ACTIONS ===
    addLogs: (entries: LogEntry[]) => void;
    clearLogs: () => void;
    setFilter: (partial: Partial<ConsoleFilters>) => void;
    setIsOpen: (open: boolean) => void;
    togglePause: () => void;
    setAutoScroll: (auto: boolean) => void;

    // === COMPUTED ===
    filteredLogs: () => LogEntry[];
}

// ============================================================================
// LOG LEVEL UTILITIES
// ============================================================================

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.FATAL]: 4,
};

export function logLevelToNumber(level: LogLevel): number {
    return LOG_LEVEL_ORDER[level] ?? 1;
}

export function logLevelColor(level: LogLevel): string {
    return logLevelToColor(level);
}

export function logLevelIcon(level: LogLevel): string {
    switch (level) {
        case LogLevel.ERROR: return '❌';
        case LogLevel.WARN: return '⚠️';
        case LogLevel.INFO: return 'ℹ️';
        case LogLevel.DEBUG: return '🔍';
        case LogLevel.FATAL: return '💀';
        default: return '📝';
    }
}

// ============================================================================
// STORE
// ============================================================================

export const useConsoleStore = create<ConsoleStoreState>((set, get) => ({
    // Initial state
    logs: [],
    maxLogs: 1000,

    filters: {
        minLevel: LogLevel.INFO,
        searchQuery: '',
        targetFilter: null,
    },

    isOpen: false,
    isPaused: false,
    autoScroll: true,

    // ========================================================================
    // ACTIONS
    // ========================================================================

    addLogs: (entries) => {
        if (get().isPaused) return;

        set((state) => {
            const newLogs = [...state.logs, ...entries];
            // Ring buffer behavior
            if (newLogs.length > state.maxLogs) {
                return { logs: newLogs.slice(-state.maxLogs) };
            }
            return { logs: newLogs };
        });
    },

    clearLogs: () => {
        set({ logs: [] });
    },

    setFilter: (partial) => {
        set((state) => ({
            filters: { ...state.filters, ...partial },
        }));
    },

    setIsOpen: (open) => {
        set({ isOpen: open });
    },

    togglePause: () => {
        set((state) => ({ isPaused: !state.isPaused }));
    },

    setAutoScroll: (auto) => {
        set({ autoScroll: auto });
    },

    // ========================================================================
    // COMPUTED (called as function for reactivity)
    // ========================================================================

    filteredLogs: () => {
        const { logs, filters } = get();
        const minLevelNum = logLevelToNumber(filters.minLevel);

        return logs.filter((log) => {
            // Level filter
            if (logLevelToNumber(log.level) < minLevelNum) return false;

            // Target filter
            if (filters.targetFilter && !log.target.includes(filters.targetFilter)) {
                return false;
            }

            // Search filter
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                const matches =
                    log.message.toLowerCase().includes(query) ||
                    log.target.toLowerCase().includes(query);
                if (!matches) return false;
            }

            return true;
        });
    },
}));

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for console logs with filtering
 */
export function useConsoleLogs() {
    const logs = useConsoleStore((s) => s.logs);
    const filters = useConsoleStore((s) => s.filters);
    const minLevelNum = logLevelToNumber(filters.minLevel);

    // Apply filters
    return logs.filter((log) => {
        if (logLevelToNumber(log.level) < minLevelNum) return false;
        if (filters.targetFilter && !log.target.includes(filters.targetFilter)) return false;
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            if (!log.message.toLowerCase().includes(query) &&
                !log.target.toLowerCase().includes(query)) return false;
        }
        return true;
    });
}

/**
 * Hook for console controls
 */
export function useConsoleControls() {
    return {
        isOpen: useConsoleStore((s) => s.isOpen),
        isPaused: useConsoleStore((s) => s.isPaused),
        autoScroll: useConsoleStore((s) => s.autoScroll),
        setIsOpen: useConsoleStore((s) => s.setIsOpen),
        togglePause: useConsoleStore((s) => s.togglePause),
        setAutoScroll: useConsoleStore((s) => s.setAutoScroll),
        clearLogs: useConsoleStore((s) => s.clearLogs),
    };
}

/**
 * Hook for console filters
 */
export function useConsoleFilters() {
    const filters = useConsoleStore((s) => s.filters);
    const setFilter = useConsoleStore((s) => s.setFilter);
    return { filters, setFilter };
}

// ============================================================================
// LOG STATS (for UI badges)
// ============================================================================

export function useLogStats() {
    const logs = useConsoleStore((s) => s.logs);

    let errors = 0;
    let warns = 0;

    for (const log of logs) {
        if (log.level === LogLevel.ERROR) errors++;
        else if (log.level === LogLevel.WARN) warns++;
    }

    return { errors, warns, total: logs.length };
}

// ============================================================================
// TAURI EVENT LISTENER
// ============================================================================

let unlisten: (() => void) | null = null;

/**
 * Start listening for log events from Bevy
 * Call this once at app startup
 */
export async function startLogListener() {
    if (unlisten) return; // Already listening

    try {
        const { listen } = await import('@tauri-apps/api/event');

        unlisten = await listen<LogEntry[]>('kos-logs', (event) => {
            useConsoleStore.getState().addLogs(event.payload);
        });

        console.log('[Console] Log listener started');
    } catch (e) {
        console.warn('[Console] Failed to start log listener:', e);
    }
}

/**
 * Stop listening for log events
 */
export function stopLogListener() {
    if (unlisten) {
        unlisten();
        unlisten = null;
    }
}

