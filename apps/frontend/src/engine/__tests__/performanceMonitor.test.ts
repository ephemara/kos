import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceMonitor } from '../performanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.destroy();
    vi.useRealTimers();
  });

  describe('FPS Tracking', () => {
    it('should track FPS accurately', () => {
      const callback = vi.fn();
      monitor.subscribe(callback);

      // Simulate 60 FPS (16.67ms per frame)
      for (let i = 0; i < 60; i++) {
        monitor.recordFrame();
        vi.advanceTimersByTime(16.67);
      }

      vi.advanceTimersByTime(1000); // Trigger update

      expect(callback).toHaveBeenCalled();
      const metrics = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(metrics.fps).toBeGreaterThan(55);
      expect(metrics.fps).toBeLessThan(65);
    });

    it('should detect low FPS', () => {
      const callback = vi.fn();
      monitor.subscribe(callback);

      // Simulate 30 FPS (33.33ms per frame)
      for (let i = 0; i < 30; i++) {
        monitor.recordFrame();
        vi.advanceTimersByTime(33.33);
      }

      vi.advanceTimersByTime(1000);

      const metrics = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(metrics.fps).toBeGreaterThan(25);
      expect(metrics.fps).toBeLessThan(35);
    });

    it('should calculate frame time correctly', () => {
      const callback = vi.fn();
      monitor.subscribe(callback);

      monitor.recordFrame();
      vi.advanceTimersByTime(16.67);
      monitor.recordFrame();
      vi.advanceTimersByTime(1000);

      const metrics = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(metrics.frameTime).toBeGreaterThan(15);
      expect(metrics.frameTime).toBeLessThan(18);
    });

    it('should maintain frame history', () => {
      for (let i = 0; i < 150; i++) {
        monitor.recordFrame();
        vi.advanceTimersByTime(16.67);
      }

      const history = monitor.getFrameHistory();
      expect(history.length).toBeLessThanOrEqual(120); // Max 120 frames
    });
  });

  describe('Memory Monitoring', () => {
    it('should track memory usage', () => {
      const callback = vi.fn();
      monitor.subscribe(callback);

      // Mock performance.memory
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 50 * 1024 * 1024, // 50MB
          totalJSHeapSize: 100 * 1024 * 1024, // 100MB
          jsHeapSizeLimit: 2048 * 1024 * 1024, // 2GB
        },
        configurable: true,
      });

      vi.advanceTimersByTime(1000);

      expect(callback).toHaveBeenCalled();
      const metrics = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(metrics.memory.used).toBe(50);
      expect(metrics.memory.total).toBe(100);
      expect(metrics.memory.limit).toBe(2048);
    });

    it('should handle missing memory API', () => {
      const callback = vi.fn();
      monitor.subscribe(callback);

      // Remove performance.memory
      Object.defineProperty(performance, 'memory', {
        value: undefined,
        configurable: true,
      });

      vi.advanceTimersByTime(1000);

      const metrics = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(metrics.memory.used).toBe(0);
      expect(metrics.memory.total).toBe(0);
    });

    it('should detect memory leaks', () => {
      const callback = vi.fn();
      monitor.subscribe(callback);

      // Simulate increasing memory usage
      let memoryUsage = 50;
      Object.defineProperty(performance, 'memory', {
        get: () => ({
          usedJSHeapSize: memoryUsage * 1024 * 1024,
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 2048 * 1024 * 1024,
        }),
        configurable: true,
      });

      for (let i = 0; i < 10; i++) {
        memoryUsage += 10; // Increase by 10MB each second
        vi.advanceTimersByTime(1000);
      }

      const metrics = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(metrics.memory.used).toBeGreaterThan(100);
    });
  });

  describe('Custom Metrics', () => {
    it('should record custom metrics', () => {
      monitor.recordMetric('renderTime', 12.5);
      monitor.recordMetric('renderTime', 15.3);
      monitor.recordMetric('renderTime', 11.8);

      const avg = monitor.getAverageMetric('renderTime');
      expect(avg).toBeCloseTo(13.2, 1);
    });

    it('should handle non-existent metrics', () => {
      const avg = monitor.getAverageMetric('nonExistent');
      expect(avg).toBe(0);
    });

    it('should limit metric history', () => {
      for (let i = 0; i < 200; i++) {
        monitor.recordMetric('test', i);
      }

      const avg = monitor.getAverageMetric('test');
      expect(avg).toBeGreaterThan(100); // Should only average last 100 values
    });
  });

  describe('Subscriptions', () => {
    it('should notify subscribers on update', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      monitor.subscribe(callback1);
      monitor.subscribe(callback2);

      monitor.recordFrame();
      vi.advanceTimersByTime(1000);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should allow unsubscribing', () => {
      const callback = vi.fn();
      const unsubscribe = monitor.subscribe(callback);

      monitor.recordFrame();
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      monitor.recordFrame();
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle multiple unsubscribes', () => {
      const callback = vi.fn();
      const unsubscribe = monitor.subscribe(callback);

      unsubscribe();
      unsubscribe(); // Should not throw

      monitor.recordFrame();
      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle', () => {
    it('should start and stop monitoring', () => {
      const callback = vi.fn();
      monitor.subscribe(callback);

      monitor.start();
      monitor.recordFrame();
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalled();

      callback.mockClear();
      monitor.stop();
      monitor.recordFrame();
      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should clean up on destroy', () => {
      const callback = vi.fn();
      monitor.subscribe(callback);

      monitor.destroy();
      monitor.recordFrame();
      vi.advanceTimersByTime(1000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should reset metrics', () => {
      monitor.recordFrame();
      monitor.recordMetric('test', 100);
      vi.advanceTimersByTime(1000);

      monitor.reset();

      const history = monitor.getFrameHistory();
      const avg = monitor.getAverageMetric('test');

      expect(history.length).toBe(0);
      expect(avg).toBe(0);
    });
  });

  describe('Performance Thresholds', () => {
    it('should detect performance warnings', () => {
      const callback = vi.fn();
      monitor.subscribe(callback);

      // Simulate low FPS (20 FPS)
      for (let i = 0; i < 20; i++) {
        monitor.recordFrame();
        vi.advanceTimersByTime(50);
      }

      vi.advanceTimersByTime(1000);

      const metrics = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(metrics.fps).toBeLessThan(30);
    });

    it('should detect high frame times', () => {
      const callback = vi.fn();
      monitor.subscribe(callback);

      monitor.recordFrame();
      vi.advanceTimersByTime(100); // 100ms frame time
      monitor.recordFrame();
      vi.advanceTimersByTime(1000);

      const metrics = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(metrics.frameTime).toBeGreaterThan(50);
    });
  });
});
