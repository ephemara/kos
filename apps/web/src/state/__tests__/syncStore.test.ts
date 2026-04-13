import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { create } from 'zustand';
import { syncStore, broadcastEvent, listenToEvents } from '../syncStore';

// Mock BroadcastChannel
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  listeners: Map<string, Set<(event: MessageEvent) => void>> = new Map();

  static channels: Map<string, MockBroadcastChannel[]> = new Map();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, []);
    }
    MockBroadcastChannel.channels.get(name)!.push(this);
  }

  postMessage(data: any) {
    const channels = MockBroadcastChannel.channels.get(this.name) || [];
    channels.forEach((channel) => {
      if (channel !== this) {
        const event = new MessageEvent('message', { data });
        channel.dispatchEvent(event);
      }
    });
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: MessageEvent) {
    this.listeners.get('message')?.forEach((listener) => listener(event));
  }

  close() {
    const channels = MockBroadcastChannel.channels.get(this.name);
    if (channels) {
      const index = channels.indexOf(this);
      if (index > -1) {
        channels.splice(index, 1);
      }
    }
  }

  static reset() {
    this.channels.clear();
  }
}

describe('syncStore', () => {
  beforeEach(() => {
    // @ts-ignore
    global.BroadcastChannel = MockBroadcastChannel;
    MockBroadcastChannel.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    MockBroadcastChannel.reset();
  });

  it('should sync state between stores', () => {
    interface TestState {
      count: number;
      increment: () => void;
    }

    const useStore1 = create<TestState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));

    const useStore2 = create<TestState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));

    const cleanup1 = syncStore(useStore1, { channel: 'test-sync' });
    const cleanup2 = syncStore(useStore2, { channel: 'test-sync' });

    useStore1.getState().increment();
    vi.advanceTimersByTime(100);

    expect(useStore2.getState().count).toBe(1);

    cleanup1();
    cleanup2();
  });

  it('should sync only specified keys', () => {
    interface TestState {
      count: number;
      name: string;
      setCount: (count: number) => void;
      setName: (name: string) => void;
    }

    const useStore1 = create<TestState>((set) => ({
      count: 0,
      name: 'initial',
      setCount: (count) => set({ count }),
      setName: (name) => set({ name }),
    }));

    const useStore2 = create<TestState>((set) => ({
      count: 0,
      name: 'initial',
      setCount: (count) => set({ count }),
      setName: (name) => set({ name }),
    }));

    const cleanup1 = syncStore(useStore1, {
      channel: 'partial-sync',
      keys: ['count'],
    });
    const cleanup2 = syncStore(useStore2, {
      channel: 'partial-sync',
      keys: ['count'],
    });

    useStore1.getState().setCount(42);
    useStore1.getState().setName('updated');
    vi.advanceTimersByTime(100);

    expect(useStore2.getState().count).toBe(42);
    expect(useStore2.getState().name).toBe('initial'); // Not synced

    cleanup1();
    cleanup2();
  });

  it('should debounce sync operations', () => {
    interface TestState {
      count: number;
      increment: () => void;
    }

    const useStore1 = create<TestState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));

    const useStore2 = create<TestState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));

    const cleanup1 = syncStore(useStore1, {
      channel: 'debounce-sync',
      debounce: 100,
    });
    const cleanup2 = syncStore(useStore2, {
      channel: 'debounce-sync',
      debounce: 100,
    });

    // Rapid updates
    useStore1.getState().increment();
    useStore1.getState().increment();
    useStore1.getState().increment();

    vi.advanceTimersByTime(50);
    expect(useStore2.getState().count).toBe(0); // Not synced yet

    vi.advanceTimersByTime(60);
    expect(useStore2.getState().count).toBe(3); // Synced after debounce

    cleanup1();
    cleanup2();
  });

  it('should cleanup on unsubscribe', () => {
    interface TestState {
      count: number;
      increment: () => void;
    }

    const useStore1 = create<TestState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));

    const useStore2 = create<TestState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));

    const cleanup1 = syncStore(useStore1, { channel: 'cleanup-test' });
    const cleanup2 = syncStore(useStore2, { channel: 'cleanup-test' });

    useStore1.getState().increment();
    vi.advanceTimersByTime(100);
    expect(useStore2.getState().count).toBe(1);

    cleanup1();
    cleanup2();

    useStore1.getState().increment();
    vi.advanceTimersByTime(100);
    expect(useStore2.getState().count).toBe(1); // Not synced after cleanup
  });
});

describe('broadcastEvent', () => {
  beforeEach(() => {
    // @ts-ignore
    global.BroadcastChannel = MockBroadcastChannel;
    MockBroadcastChannel.reset();
  });

  afterEach(() => {
    MockBroadcastChannel.reset();
  });

  it('should broadcast custom events', () => {
    const callback = vi.fn();
    const cleanup = listenToEvents('test-channel', 'CUSTOM_EVENT', callback);

    broadcastEvent('test-channel', 'CUSTOM_EVENT', { data: 'test' });

    expect(callback).toHaveBeenCalledWith({ data: 'test' });

    cleanup();
  });

  it('should filter events by type', () => {
    const callback = vi.fn();
    const cleanup = listenToEvents('test-channel', 'EVENT_A', callback);

    broadcastEvent('test-channel', 'EVENT_A', { data: 'a' });
    broadcastEvent('test-channel', 'EVENT_B', { data: 'b' });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ data: 'a' });

    cleanup();
  });

  it('should handle multiple listeners', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const cleanup1 = listenToEvents('test-channel', 'EVENT', callback1);
    const cleanup2 = listenToEvents('test-channel', 'EVENT', callback2);

    broadcastEvent('test-channel', 'EVENT', { data: 'test' });

    expect(callback1).toHaveBeenCalledWith({ data: 'test' });
    expect(callback2).toHaveBeenCalledWith({ data: 'test' });

    cleanup1();
    cleanup2();
  });
});
