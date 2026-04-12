/**
 * Performance Optimization Hooks
 * 
 * React hooks for debouncing, throttling, and performance monitoring.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getPerformanceMonitor,
  type PerformanceStats,
  type PerformanceWarning,
} from '@/engine/performanceMonitor';

/**
 * Hook for debounced values
 * 
 * Delays updating the value until after the specified delay has passed
 * since the last change. Useful for expensive operations triggered by
 * rapid user input.
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 * 
 * @example
 * const searchTerm = useDebouncedValue(inputValue, 500);
 * useEffect(() => {
 *   // This only runs 500ms after the user stops typing
 *   performSearch(searchTerm);
 * }, [searchTerm]);
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for throttled callbacks
 * 
 * Limits how often a function can be called. The function will be called
 * at most once per delay period. Useful for expensive operations triggered
 * by continuous events like scroll or mousemove.
 * 
 * @param callback - The function to throttle
 * @param delay - Minimum delay between calls in milliseconds (default: 100ms)
 * @returns The throttled function
 * 
 * @example
 * const handleScroll = useThrottledCallback((e) => {
 *   // This runs at most once per 100ms
 *   updateScrollPosition(e.target.scrollTop);
 * }, 100);
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay = 100
): T {
  const lastRan = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = performance.now();
      const timeSinceLastRan = now - lastRan.current;

      if (timeSinceLastRan >= delay) {
        // Enough time has passed, call immediately
        callback(...args);
        lastRan.current = now;
      } else {
        // Schedule for later
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = window.setTimeout(
          () => {
            callback(...args);
            lastRan.current = performance.now();
            timeoutRef.current = null;
          },
          delay - timeSinceLastRan
        );
      }
    },
    [callback, delay]
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * Hook for performance monitoring
 * 
 * Provides access to real-time performance stats (FPS, frame time, memory).
 * Updates at 1Hz to avoid excessive re-renders.
 * 
 * @returns Current performance stats
 * 
 * @example
 * const stats = usePerformanceStats();
 * console.log(`FPS: ${stats.fps}, Frame Time: ${stats.frameTime}ms`);
 */
export function usePerformanceStats(): PerformanceStats {
  const [stats, setStats] = useState<PerformanceStats>(() =>
    getPerformanceMonitor().getStats()
  );

  useEffect(() => {
    // Update stats every second
    const interval = setInterval(() => {
      setStats(getPerformanceMonitor().getStats());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return stats;
}

/**
 * Hook for performance warnings
 * 
 * Subscribes to performance warnings (low FPS, high memory usage, etc.)
 * and calls the provided callback when warnings occur.
 * 
 * @param callback - Function to call when a warning occurs
 * 
 * @example
 * usePerformanceWarning((warning) => {
 *   console.warn(`Performance warning: ${warning.message}`);
 *   if (warning.type === 'memory') {
 *     // Reduce quality settings
 *   }
 * });
 */
export function usePerformanceWarning(
  callback: (warning: PerformanceWarning) => void
): void {
  useEffect(() => {
    const monitor = getPerformanceMonitor();
    const unsubscribe = monitor.onPerformanceWarning(callback);
    return unsubscribe;
  }, [callback]);
}

export interface UsePerformanceOptions {
  autoStart?: boolean;
  updateInterval?: number;
  maxFrameHistory?: number;
}

export interface UsePerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
}

export interface UsePerformanceController {
  metrics: UsePerformanceMetrics;
  isMonitoring: boolean;
  start: () => void;
  stop: () => void;
  recordFrame: (frameTime?: number) => void;
  recordMetric: (name: string, value: number) => void;
  getAverageMetric: (name: string) => number;
  getFrameHistory: () => number[];
  reset: () => void;
}

const DEFAULT_FRAME_TIME = 1000 / 60;

export function usePerformance(
  options: UsePerformanceOptions = {}
): UsePerformanceController {
  const {
    autoStart = false,
    updateInterval = 1000,
    maxFrameHistory = 120,
  } = options;

  const [metrics, setMetrics] = useState<UsePerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
  });
  const [isMonitoring, setIsMonitoring] = useState(autoStart);
  const isMonitoringRef = useRef(autoStart);
  const frameHistoryRef = useRef<number[]>([]);
  const metricHistoryRef = useRef<Record<string, number[]>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFrameTimestampRef = useRef<number | null>(null);

  const computeMetrics = useCallback(() => {
    const history = frameHistoryRef.current;
    if (history.length === 0) {
      return;
    }

    const total = history.reduce((sum, value) => sum + value, 0);
    const frameTime = total / history.length;
    const fps = frameTime > 0 ? 1000 / frameTime : 0;
    const perfWithMemory = performance as Performance & {
      memory?: { usedJSHeapSize?: number };
    };

    setMetrics({
      fps,
      frameTime,
      memoryUsage: perfWithMemory.memory?.usedJSHeapSize ?? 0,
    });
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isMonitoringRef.current = false;
    setIsMonitoring(false);
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current !== null) {
      return;
    }

    isMonitoringRef.current = true;
    intervalRef.current = setInterval(() => {
      computeMetrics();
    }, updateInterval);

    setIsMonitoring(true);
  }, [computeMetrics, updateInterval]);

  const recordFrame = useCallback((frameTime?: number) => {
    const now = Date.now();
    const resolvedFrameTime =
      typeof frameTime === 'number'
        ? frameTime
        : lastFrameTimestampRef.current == null
          ? DEFAULT_FRAME_TIME
          : Math.max(0, now - lastFrameTimestampRef.current);

    lastFrameTimestampRef.current = now;
    frameHistoryRef.current = [...frameHistoryRef.current, resolvedFrameTime].slice(
      -maxFrameHistory
    );
    if (!isMonitoringRef.current) {
      const fps = resolvedFrameTime > 0 ? 1000 / resolvedFrameTime : 0;
      const perfWithMemory = performance as Performance & {
        memory?: { usedJSHeapSize?: number };
      };
      setMetrics({
        fps,
        frameTime: resolvedFrameTime,
        memoryUsage: perfWithMemory.memory?.usedJSHeapSize ?? 0,
      });
    }
  }, [maxFrameHistory]);

  const recordMetric = useCallback((name: string, value: number) => {
    const history = metricHistoryRef.current[name] ?? [];
    metricHistoryRef.current[name] = [...history, value].slice(-maxFrameHistory);
  }, [maxFrameHistory]);

  const getAverageMetric = useCallback((name: string) => {
    const history = metricHistoryRef.current[name] ?? [];
    if (history.length === 0) {
      return 0;
    }
    return history.reduce((sum, value) => sum + value, 0) / history.length;
  }, []);

  const getFrameHistory = useCallback(() => {
    return [...frameHistoryRef.current];
  }, []);

  const reset = useCallback(() => {
    frameHistoryRef.current = [];
    metricHistoryRef.current = {};
    lastFrameTimestampRef.current = null;
    setMetrics({
      fps: 0,
      frameTime: 0,
      memoryUsage: 0,
    });
  }, []);

  useEffect(() => {
    if (autoStart) {
      start();
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoStart, start]);

  return {
    metrics,
    isMonitoring,
    start,
    stop,
    recordFrame,
    recordMetric,
    getAverageMetric,
    getFrameHistory,
    reset,
  };
}

/**
 * Hook for RAF-based animation loop
 * 
 * Provides a callback that runs on every animation frame.
 * Automatically handles cleanup on unmount.
 * 
 * @param callback - Function to call on each frame
 * @param enabled - Whether the loop is enabled (default: true)
 * 
 * @example
 * useAnimationFrame((deltaTime) => {
 *   // Update animation state
 *   updatePosition(deltaTime);
 * });
 */
export function useAnimationFrame(
  callback: (deltaTime: number) => void,
  enabled = true
): void {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  const animate = useCallback(
    (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        callback(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    },
    [callback]
  );

  useEffect(() => {
    if (enabled) {
      requestRef.current = requestAnimationFrame(animate);
      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
      };
    }
  }, [enabled, animate]);
}

/**
 * Hook for measuring component render time
 * 
 * Logs render time to console in development mode.
 * Useful for identifying performance bottlenecks.
 * 
 * @param componentName - Name of the component for logging
 * 
 * @example
 * function MyComponent() {
 *   useRenderTime('MyComponent');
 *   // ... component code
 * }
 */
export function useRenderTime(componentName: string): void {
  const renderStartTime = useRef<number>(performance.now());

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(
        `[Performance] ${componentName} render took ${renderTime.toFixed(2)}ms (>16ms)`
      );
    }
    renderStartTime.current = performance.now();
  });
}

/**
 * Hook for lazy loading components
 * 
 * Delays rendering a component until it's needed, reducing initial load time.
 * 
 * @param delay - Delay in milliseconds before showing the component (default: 0)
 * @returns Whether the component should be rendered
 * 
 * @example
 * function MyComponent() {
 *   const shouldRender = useLazyRender(1000);
 *   if (!shouldRender) return null;
 *   return <ExpensiveComponent />;
 * }
 */
export function useLazyRender(delay = 0): boolean {
  const [shouldRender, setShouldRender] = useState(delay === 0);

  useEffect(() => {
    if (delay > 0) {
      const timeout = setTimeout(() => {
        setShouldRender(true);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [delay]);

  return shouldRender;
}

/**
 * Hook for intersection observer (lazy loading on scroll)
 * 
 * Detects when an element enters the viewport.
 * Useful for lazy loading images or components.
 * 
 * @param options - IntersectionObserver options
 * @returns [ref, isIntersecting]
 * 
 * @example
 * const [ref, isVisible] = useIntersectionObserver();
 * return (
 *   <div ref={ref}>
 *     {isVisible && <ExpensiveComponent />}
 *   </div>
 * );
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return [ref, isIntersecting];
}
