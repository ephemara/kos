import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThrottle } from '../useThrottle';

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useThrottle('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should throttle value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // First update should go through immediately
    rerender({ value: 'update1', delay: 500 });
    expect(result.current).toBe('update1');

    // Subsequent updates within throttle window should be ignored
    rerender({ value: 'update2', delay: 500 });
    expect(result.current).toBe('update1');

    rerender({ value: 'update3', delay: 500 });
    expect(result.current).toBe('update1');

    // After throttle period, next update should go through
    act(() => vi.advanceTimersByTime(500));
    rerender({ value: 'update4', delay: 500 });
    expect(result.current).toBe('update4');
  });

  it('should allow updates after throttle period', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      { initialProps: { value: 'initial', delay: 1000 } }
    );

    rerender({ value: 'update1', delay: 1000 });
    expect(result.current).toBe('update1');

    act(() => vi.advanceTimersByTime(1000));

    rerender({ value: 'update2', delay: 1000 });
    expect(result.current).toBe('update2');
  });

  it('should handle rapid updates correctly', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      { initialProps: { value: 0, delay: 100 } }
    );

    // Rapid fire 10 updates
    for (let i = 1; i <= 10; i++) {
      rerender({ value: i, delay: 100 });
      act(() => vi.advanceTimersByTime(10));
    }

    // Should only have processed first update
    expect(result.current).toBe(1);

    // After throttle period, next update should work
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: 11, delay: 100 });
    expect(result.current).toBe(11);
  });

  it('should cleanup on unmount', () => {
    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });
    unmount();

    // Should not throw
    act(() => vi.advanceTimersByTime(1000));
  });

  it('should handle object values', () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    const obj3 = { id: 3 };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      { initialProps: { value: obj1, delay: 500 } }
    );

    expect(result.current).toBe(obj1);

    rerender({ value: obj2, delay: 500 });
    expect(result.current).toBe(obj2);

    rerender({ value: obj3, delay: 500 });
    expect(result.current).toBe(obj2); // Throttled

    act(() => vi.advanceTimersByTime(500));
    rerender({ value: obj3, delay: 500 });
    expect(result.current).toBe(obj3);
  });

  it('should handle different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      { initialProps: { value: 'initial', delay: 1000 } }
    );

    rerender({ value: 'update1', delay: 1000 });
    expect(result.current).toBe('update1');

    act(() => vi.advanceTimersByTime(500));
    rerender({ value: 'update2', delay: 1000 });
    expect(result.current).toBe('update1'); // Still throttled

    act(() => vi.advanceTimersByTime(500));
    rerender({ value: 'update3', delay: 1000 });
    expect(result.current).toBe('update3');
  });

  it('should handle zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      { initialProps: { value: 'initial', delay: 0 } }
    );

    rerender({ value: 'update1', delay: 0 });
    expect(result.current).toBe('update1');

    rerender({ value: 'update2', delay: 0 });
    expect(result.current).toBe('update2');
  });

  it('should handle function values', () => {
    const fn1 = () => 'first';
    const fn2 = () => 'second';
    const fn3 = () => 'third';

    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      { initialProps: { value: fn1, delay: 500 } }
    );

    expect(result.current).toBe(fn1);

    rerender({ value: fn2, delay: 500 });
    expect(result.current).toBe(fn2);

    rerender({ value: fn3, delay: 500 });
    expect(result.current).toBe(fn2); // Throttled

    act(() => vi.advanceTimersByTime(500));
    rerender({ value: fn3, delay: 500 });
    expect(result.current).toBe(fn3);
  });

  it('should maintain throttle across multiple cycles', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      { initialProps: { value: 0, delay: 100 } }
    );

    // Cycle 1
    rerender({ value: 1, delay: 100 });
    expect(result.current).toBe(1);

    act(() => vi.advanceTimersByTime(100));

    // Cycle 2
    rerender({ value: 2, delay: 100 });
    expect(result.current).toBe(2);

    act(() => vi.advanceTimersByTime(100));

    // Cycle 3
    rerender({ value: 3, delay: 100 });
    expect(result.current).toBe(3);
  });
});
