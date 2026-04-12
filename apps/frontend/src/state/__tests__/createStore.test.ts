import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStore } from '../createStore';

describe('createStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create a basic store', () => {
    interface TestState {
      count: number;
      increment: () => void;
    }

    const useStore = createStore<TestState>(
      { name: 'test', devtools: false },
      (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      })
    );

    const { count, increment } = useStore.getState();
    expect(count).toBe(0);

    increment();
    expect(useStore.getState().count).toBe(1);
  });

  it('should persist state to localStorage', () => {
    interface TestState {
      value: string;
      setValue: (value: string) => void;
    }

    const useStore = createStore<TestState>(
      { name: 'persist-test', persist: true, devtools: false },
      (set) => ({
        value: 'initial',
        setValue: (value) => set({ value }),
      })
    );

    useStore.getState().setValue('updated');

    // Check localStorage
    const stored = localStorage.getItem('k-os-persist-test');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).state.value).toBe('updated');
  });

  it('should restore state from localStorage', () => {
    interface TestState {
      count: number;
      increment: () => void;
    }

    // First store instance
    const useStore1 = createStore<TestState>(
      { name: 'restore-test', persist: true, devtools: false },
      (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      })
    );

    useStore1.getState().increment();
    useStore1.getState().increment();
    expect(useStore1.getState().count).toBe(2);

    // Second store instance (simulates page reload)
    const useStore2 = createStore<TestState>(
      { name: 'restore-test', persist: true, devtools: false },
      (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      })
    );

    expect(useStore2.getState().count).toBe(2);
  });

  it('should handle complex state objects', () => {
    interface TestState {
      user: {
        name: string;
        age: number;
      };
      settings: {
        theme: string;
        notifications: boolean;
      };
      updateUser: (name: string, age: number) => void;
      toggleNotifications: () => void;
    }

    const useStore = createStore<TestState>(
      { name: 'complex-test', devtools: false },
      (set, get) => ({
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark', notifications: true },
        updateUser: (name, age) => set({ user: { name, age } }),
        toggleNotifications: () =>
          set({
            settings: {
              ...get().settings,
              notifications: !get().settings.notifications,
            },
          }),
      })
    );

    const { updateUser, toggleNotifications } = useStore.getState();

    updateUser('Jane', 25);
    expect(useStore.getState().user).toEqual({ name: 'Jane', age: 25 });

    toggleNotifications();
    expect(useStore.getState().settings.notifications).toBe(false);
  });

  it('should support subscriptions', () => {
    interface TestState {
      count: number;
      increment: () => void;
    }

    const useStore = createStore<TestState>(
      { name: 'sub-test', devtools: false },
      (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      })
    );

    const callback = vi.fn();
    const unsubscribe = useStore.subscribe(callback);

    useStore.getState().increment();
    expect(callback).toHaveBeenCalled();

    callback.mockClear();
    unsubscribe();

    useStore.getState().increment();
    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle arrays in state', () => {
    interface TestState {
      items: string[];
      addItem: (item: string) => void;
      removeItem: (index: number) => void;
    }

    const useStore = createStore<TestState>(
      { name: 'array-test', devtools: false },
      (set, get) => ({
        items: [],
        addItem: (item) => set({ items: [...get().items, item] }),
        removeItem: (index) =>
          set({ items: get().items.filter((_, i) => i !== index) }),
      })
    );

    const { addItem, removeItem } = useStore.getState();

    addItem('first');
    addItem('second');
    addItem('third');

    expect(useStore.getState().items).toEqual(['first', 'second', 'third']);

    removeItem(1);
    expect(useStore.getState().items).toEqual(['first', 'third']);
  });

  it('should handle nested updates', () => {
    interface TestState {
      data: {
        level1: {
          level2: {
            value: number;
          };
        };
      };
      updateValue: (value: number) => void;
    }

    const useStore = createStore<TestState>(
      { name: 'nested-test', devtools: false },
      (set, get) => ({
        data: {
          level1: {
            level2: {
              value: 0,
            },
          },
        },
        updateValue: (value) =>
          set({
            data: {
              ...get().data,
              level1: {
                ...get().data.level1,
                level2: {
                  value,
                },
              },
            },
          }),
      })
    );

    useStore.getState().updateValue(42);
    expect(useStore.getState().data.level1.level2.value).toBe(42);
  });
});
