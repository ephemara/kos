import { useEffect, useRef, useState } from 'react';

/**
 * Throttles a value, limiting update frequency
 * Useful for scroll handlers, resize events, etc.
 * 
 * @param value - The value to throttle
 * @param delay - Minimum delay between updates in milliseconds
 * @returns Throttled value
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(() => value);
  const lastAcceptedAtRef = useRef<number | null>(null);
  const isFirstRenderRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return () => {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }

    if (delay <= 0) {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setThrottledValue(() => value);
      lastAcceptedAtRef.current = Date.now();
      return () => {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }

    if (Object.is(throttledValue, value)) {
      return () => {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }

    const now = Date.now();
    const elapsed =
      lastAcceptedAtRef.current === null ? Infinity : now - lastAcceptedAtRef.current;

    if (elapsed >= delay) {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setThrottledValue(() => value);
      lastAcceptedAtRef.current = now;
      return () => {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setThrottledValue(() => latestValueRef.current);
      timeoutRef.current = null;
    }, delay);

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, delay, throttledValue]);

  return throttledValue;
}
