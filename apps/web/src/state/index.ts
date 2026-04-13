/**
 * K_OS State Management System
 * 
 * Provides typed Zustand stores with:
 * - Persistence (localStorage or IndexedDB)
 * - Undo/Redo functionality
 * - Cross-app synchronization
 * - DevTools integration
 */

export { createStore, createIndexedDBStore } from './createStore';
export type { StoreConfig } from './createStore';

export { undoRedo, deepEqual } from './undoRedoStore';
export type { UndoRedoState, UndoRedoActions, UndoRedoConfig } from './undoRedoStore';

export { syncStore, createSyncedSlice, broadcastEvent, listenToEvents } from './syncStore';
export type { SyncConfig } from './syncStore';

// Example stores for common use cases
export * from './stores/appStore';
export * from './stores/viewportStore';
export * from './stores/preferencesStore';
