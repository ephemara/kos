/**
 * State Management
 * 
 * Global state stores and utilities for the application.
 */

// Mode detection
export {
    isRunningInTauri,
    isRunningInWeb,
    getMode,
    ifTauri
} from './mode';

// Event bus
export { eventBus, EventBus } from './eventBus';

// Stores
export {
    useConsoleStore,
    useConsoleLogs,
    useConsoleControls,
    useConsoleFilters,
    useLogStats,
    logLevelToNumber,
    logLevelColor,
    logLevelIcon,
    startLogListener,
    stopLogListener,
    type LogEntry,
    type LogLevel
} from './consoleStore';

// Performance HUD utilities
export {
    getPerfHudEntries,
    clearPerfHudEntries,
    pushPerfHudEntry,
    subscribePerfHud,
    type PerfHudEntry
} from './perfHudStore';
