import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { undoRedo, deepEqual, UndoRedoState, UndoRedoActions } from '../undoRedoStore';

describe('undoRedoStore', () => {
  it('should initialize with empty history', () => {
    interface TestState {
      value: string;
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({ value: 'initial' })
    );

    const state = useStore.getState();
    expect(state.present).toEqual({ value: 'initial' });
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it('should add to history on set', () => {
    interface TestState {
      value: string;
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({ value: 'initial' })
    );

    useStore.getState().set({ value: 'updated' });

    const state = useStore.getState();
    expect(state.present).toEqual({ value: 'updated' });
    expect(state.past).toEqual([{ value: 'initial' }]);
    expect(state.future).toEqual([]);
  });

  it('should undo changes', () => {
    interface TestState {
      value: number;
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({ value: 0 })
    );

    useStore.getState().set({ value: 1 });
    useStore.getState().set({ value: 2 });
    useStore.getState().set({ value: 3 });

    expect(useStore.getState().present).toEqual({ value: 3 });

    useStore.getState().undo();
    expect(useStore.getState().present).toEqual({ value: 2 });

    useStore.getState().undo();
    expect(useStore.getState().present).toEqual({ value: 1 });
  });

  it('should redo changes', () => {
    interface TestState {
      value: number;
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({ value: 0 })
    );

    useStore.getState().set({ value: 1 });
    useStore.getState().set({ value: 2 });
    useStore.getState().undo();
    useStore.getState().undo();

    expect(useStore.getState().present).toEqual({ value: 0 });

    useStore.getState().redo();
    expect(useStore.getState().present).toEqual({ value: 1 });

    useStore.getState().redo();
    expect(useStore.getState().present).toEqual({ value: 2 });
  });

  it('should clear future on new change after undo', () => {
    interface TestState {
      value: number;
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({ value: 0 })
    );

    useStore.getState().set({ value: 1 });
    useStore.getState().set({ value: 2 });
    useStore.getState().undo();

    expect(useStore.getState().future.length).toBe(1);

    useStore.getState().set({ value: 3 });
    expect(useStore.getState().future).toEqual([]);
    expect(useStore.getState().present).toEqual({ value: 3 });
  });

  it('should respect history limit', () => {
    interface TestState {
      value: number;
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({ value: 0 }, { limit: 3 })
    );

    for (let i = 1; i <= 10; i++) {
      useStore.getState().set({ value: i });
    }

    const state = useStore.getState();
    expect(state.past.length).toBeLessThanOrEqual(3);
    expect(state.present).toEqual({ value: 10 });
  });

  it('should check canUndo and canRedo', () => {
    interface TestState {
      value: number;
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({ value: 0 })
    );

    expect(useStore.getState().canUndo()).toBe(false);
    expect(useStore.getState().canRedo()).toBe(false);

    useStore.getState().set({ value: 1 });
    expect(useStore.getState().canUndo()).toBe(true);
    expect(useStore.getState().canRedo()).toBe(false);

    useStore.getState().undo();
    expect(useStore.getState().canUndo()).toBe(false);
    expect(useStore.getState().canRedo()).toBe(true);
  });

  it('should reset history', () => {
    interface TestState {
      value: number;
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({ value: 0 })
    );

    useStore.getState().set({ value: 1 });
    useStore.getState().set({ value: 2 });

    useStore.getState().reset({ value: 99 });

    const state = useStore.getState();
    expect(state.present).toEqual({ value: 99 });
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it('should clear history', () => {
    interface TestState {
      value: number;
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({ value: 0 })
    );

    useStore.getState().set({ value: 1 });
    useStore.getState().set({ value: 2 });

    useStore.getState().clear();

    const state = useStore.getState();
    expect(state.present).toEqual({ value: 2 });
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it('should use custom equality function', () => {
    interface TestState {
      value: number;
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({ value: 0 }, {
        equality: (a, b) => a.value === b.value,
      })
    );

    useStore.getState().set({ value: 1 });
    useStore.getState().set({ value: 1 }); // Same value

    expect(useStore.getState().past.length).toBe(1); // Should not add duplicate
  });

  it('should handle complex objects', () => {
    interface TestState {
      user: {
        name: string;
        age: number;
      };
      settings: {
        theme: string;
      };
    }

    const useStore = create<UndoRedoState<TestState> & UndoRedoActions<TestState>>(
      undoRedo({
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
      })
    );

    useStore.getState().set({
      user: { name: 'Jane', age: 25 },
      settings: { theme: 'dark' },
    });

    useStore.getState().set({
      user: { name: 'Jane', age: 25 },
      settings: { theme: 'light' },
    });

    expect(useStore.getState().past.length).toBe(2);

    useStore.getState().undo();
    expect(useStore.getState().present.settings.theme).toBe('dark');

    useStore.getState().undo();
    expect(useStore.getState().present.user.name).toBe('John');
  });
});

describe('deepEqual', () => {
  it('should compare primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('test', 'test')).toBe(true);
    expect(deepEqual('test', 'other')).toBe(false);
  });

  it('should compare objects', () => {
    expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('should compare nested objects', () => {
    expect(
      deepEqual(
        { a: { b: { c: 1 } } },
        { a: { b: { c: 1 } } }
      )
    ).toBe(true);

    expect(
      deepEqual(
        { a: { b: { c: 1 } } },
        { a: { b: { c: 2 } } }
      )
    ).toBe(false);
  });

  it('should compare arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('should handle null and undefined', () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual({ a: null }, { a: null })).toBe(true);
  });
});
