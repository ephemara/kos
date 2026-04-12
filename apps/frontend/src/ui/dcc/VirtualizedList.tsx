/**
 * VirtualizedList Component
 * 
 * Efficiently renders large lists by only rendering visible items.
 * Uses virtual scrolling to maintain performance with 10K+ items.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

export interface VirtualizedListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Height of each item in pixels */
  itemHeight: number;
  /** Function to render each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Number of items to render outside visible area (default: 5) */
  overscan?: number;
  /** Height of the container (default: 400px) */
  height?: number;
  /** Width of the container (default: 100%) */
  width?: string | number;
  /** Class name for the container */
  className?: string;
  /** Callback when scroll position changes */
  onScroll?: (scrollTop: number) => void;
}

/**
 * VirtualizedList component for efficiently rendering large datasets
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 5,
  height = 400,
  width = '100%',
  className = '',
  onScroll,
}: VirtualizedListProps<T>): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate visible range
  const visibleCount = Math.ceil(height / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

  // Total height of all items
  const totalHeight = items.length * itemHeight;

  // Offset for positioning visible items
  const offsetY = startIndex * itemHeight;

  // Handle scroll with RAF for performance
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      requestAnimationFrame(() => {
        setScrollTop(target.scrollTop);
        onScroll?.(target.scrollTop);
      });
    },
    [onScroll]
  );

  // Render visible items
  const visibleItems = [];
  for (let i = startIndex; i < endIndex; i++) {
    const item = items[i];
    if (!item) continue;

    visibleItems.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: itemHeight,
          transform: `translateY(${i * itemHeight}px)`,
        }}
      >
        {renderItem(item, i)}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height,
        width,
        overflow: 'auto',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
}

/**
 * Hook for virtualized list state management
 */
export function useVirtualizedList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const visibleItems = items.slice(startIndex, endIndex);

  return {
    scrollTop,
    setScrollTop,
    startIndex,
    endIndex,
    visibleItems,
    totalHeight,
    offsetY,
  };
}
