import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated', delay: 500 });
    expect(result.current).toBe('initial'); // Still old value

    // Advance time but not enough
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe('initial');

    // Advance past delay
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    // Rapid updates
    rerender({ value: 'update1', delay: 500 });
    act(() => vi.advanceTimersByTime(300));

    rerender({ value: 'update2', delay: 500 });
    act(() => vi.advanceTimersByTime(300));

    rerender({ value: 'update3', delay: 500 });
    act(() => vi.advanceTimersByTime(300));

    // Should still be initial
    expect(result.current).toBe('initial');

    // Wait full delay from last update
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('update3');
  });

  it('should handle different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 1000 } }
    );

    rerender({ value: 'updated', delay: 1000 });

    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe('initial');

    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe('updated');
  });

  it('should cleanup on unmount', () => {
    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });
    unmount();

    // Should not throw or cause issues
    act(() => vi.advanceTimersByTime(1000));
  });

  it('should handle object values', () => {
    const obj1 = { id: 1, name: 'test' };
    const obj2 = { id: 2, name: 'updated' };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: obj1, delay: 500 } }
    );

    expect(result.current).toBe(obj1);

    rerender({ value: obj2, delay: 500 });
    act(() => vi.advanceTimersByTime(500));

    expect(result.current).toBe(obj2);
  });

  it('should handle array values', () => {
    const arr1 = [1, 2, 3];
    const arr2 = [4, 5, 6];

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: arr1, delay: 500 } }
    );

    expect(result.current).toBe(arr1);

    rerender({ value: arr2, delay: 500 });
    act(() => vi.advanceTimersByTime(500));

    expect(result.current).toBe(arr2);
  });

  it('should handle zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 0 } }
    );

    rerender({ value: 'updated', delay: 0 });
    
    act(() => vi.runAllTimers());
    
    expect(result.current).toBe('updated');
  });

  it('should handle undefined values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: undefined as string | undefined, delay: 500 } }
    );

    expect(result.current).toBeUndefined();

    rerender({ value: 'defined', delay: 500 });
    act(() => vi.advanceTimersByTime(500));

    expect(result.current).toBe('defined');
  });
});
