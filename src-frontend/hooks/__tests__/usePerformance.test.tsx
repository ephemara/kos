import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePerformance } from '../usePerformance';

describe('usePerformance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default metrics', () => {
    const { result } = renderHook(() => usePerformance());

    expect(result.current.metrics).toBeDefined();
    expect(result.current.metrics.fps).toBe(0);
    expect(result.current.metrics.frameTime).toBe(0);
    expect(result.current.isMonitoring).toBe(false);
  });

  it('should start monitoring', () => {
    const { result } = renderHook(() => usePerformance());

    act(() => {
      result.current.start();
    });

    expect(result.current.isMonitoring).toBe(true);
  });

  it('should stop monitoring', () => {
    const { result } = renderHook(() => usePerformance());

    act(() => {
      result.current.start();
    });

    expect(result.current.isMonitoring).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(result.current.isMonitoring).toBe(false);
  });

  it('should update metrics on frame record', () => {
    const { result } = renderHook(() => usePerformance());

    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.recordFrame();
      vi.advanceTimersByTime(16.67);
      result.current.recordFrame();
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.metrics.fps).toBeGreaterThan(0);
  });

  it('should record custom metrics', () => {
    const { result } = renderHook(() => usePerformance());

    act(() => {
      result.current.recordMetric('renderTime', 12.5);
      result.current.recordMetric('renderTime', 15.3);
    });

    const avg = result.current.getAverageMetric('renderTime');
    expect(avg).toBeCloseTo(13.9, 1);
  });

  it('should reset metrics', () => {
    const { result } = renderHook(() => usePerformance());

    act(() => {
      result.current.recordFrame();
      result.current.recordMetric('test', 100);
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.metrics.fps).toBeGreaterThan(0);

    act(() => {
      result.current.reset();
    });

    expect(result.current.metrics.fps).toBe(0);
  });

  it('should cleanup on unmount', () => {
    const { result, unmount } = renderHook(() => usePerformance());

    act(() => {
      result.current.start();
    });

    expect(result.current.isMonitoring).toBe(true);

    unmount();

    // Should not throw or cause memory leaks
  });

  it('should handle auto-start option', () => {
    const { result } = renderHook(() => usePerformance({ autoStart: true }));

    expect(result.current.isMonitoring).toBe(true);
  });

  it('should respect update interval', () => {
    const { result } = renderHook(() => 
      usePerformance({ updateInterval: 500 })
    );

    const initialMetrics = result.current.metrics;

    act(() => {
      result.current.start();
      result.current.recordFrame();
      vi.advanceTimersByTime(400);
    });

    // Should not update yet
    expect(result.current.metrics).toBe(initialMetrics);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should update now
    expect(result.current.metrics).not.toBe(initialMetrics);
  });

  it('should provide frame history', () => {
    const { result } = renderHook(() => usePerformance());

    act(() => {
      result.current.start();
      for (let i = 0; i < 10; i++) {
        result.current.recordFrame();
        vi.advanceTimersByTime(16.67);
      }
    });

    const history = result.current.getFrameHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history.length).toBeLessThanOrEqual(10);
  });

  it('should handle rapid start/stop cycles', () => {
    const { result } = renderHook(() => usePerformance());

    act(() => {
      result.current.start();
      result.current.stop();
      result.current.start();
      result.current.stop();
      result.current.start();
    });

    expect(result.current.isMonitoring).toBe(true);
  });

  it('should maintain metrics across start/stop', () => {
    const { result } = renderHook(() => usePerformance());

    act(() => {
      result.current.start();
      result.current.recordMetric('test', 100);
      result.current.stop();
    });

    const avg1 = result.current.getAverageMetric('test');

    act(() => {
      result.current.start();
      result.current.recordMetric('test', 200);
    });

    const avg2 = result.current.getAverageMetric('test');
    expect(avg2).toBeGreaterThan(avg1);
  });
});
