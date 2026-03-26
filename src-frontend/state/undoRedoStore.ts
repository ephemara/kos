import { StateCreator } from 'zustand';

/**
 * Undo/Redo state interface
 */
export interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * Undo/Redo actions
 */
export interface UndoRedoActions<T> {
  set: (newPresent: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: (newPresent: T) => void;
  clear: () => void;
}

/**
 * Configuration for undo/redo middleware
 */
export interface UndoRedoConfig {
  /** Maximum number of history entries */
  limit?: number;
  /** Equality function to determine if state changed */
  equality?: <T>(a: T, b: T) => boolean;
}

/**
 * Creates an undo/redo wrapper for a Zustand store
 * 
 * @example
 * ```ts
 * interface EditorState {
 *   content: string;
 * }
 * 
 * const useEditorStore = create<UndoRedoState<EditorState> & UndoRedoActions<EditorState>>(
 *   undoRedo({ content: '' }, { limit: 50 })
 * );
 * 
 * // Usage
 * useEditorStore.getState().set({ content: 'new content' });
 * useEditorStore.getState().undo();
 * useEditorStore.getState().redo();
 * ```
 */
export function undoRedo<T>(
  initialState: T,
  config: UndoRedoConfig = {}
): StateCreator<UndoRedoState<T> & UndoRedoActions<T>, [], []> {
  const { limit = 100, equality = (a, b) => a === b } = config;

  return (set, get) => ({
    past: [],
    present: initialState,
    future: [],

    set: (newPresent: T) => {
      const { present, past } = get();

      // Don't add to history if state hasn't changed
      if (equality(present, newPresent)) {
        return;
      }

      set({
        past: [...past.slice(-limit + 1), present],
        present: newPresent,
        future: [],
      });
    },

    undo: () => {
      const { past, present, future } = get();

      if (past.length === 0) {
        return;
      }

      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      set({
        past: newPast,
        present: previous,
        future: [present, ...future],
      });
    },

    redo: () => {
      const { past, present, future } = get();

      if (future.length === 0) {
        return;
      }

      const next = future[0];
      const newFuture = future.slice(1);

      set({
        past: [...past, present],
        present: next,
        future: newFuture,
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    reset: (newPresent: T) => {
      set({
        past: [],
        present: newPresent,
        future: [],
      });
    },

    clear: () => {
      const { present } = get();
      set({
        past: [],
        present,
        future: [],
      });
    },
  });
}

/**
 * Deep equality check for objects
 */
export function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as any)[key], (b as any)[key])) return false;
  }

  return true;
}
