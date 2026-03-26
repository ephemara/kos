/**
 * Performance Optimization System Demo
 * 
 * Demonstrates the performance monitoring and optimization features.
 */

import React, { useState } from 'react';
import { VirtualizedList } from './VirtualizedList';
import {
  useDebouncedValue,
  useThrottledCallback,
  usePerformanceStats,
  usePerformanceWarning,
} from '@/hooks/usePerformance';
import { formatBytes, formatMs } from '@/engine/performanceMonitor';

export function PerformanceDemo() {
  const [searchTerm, setSearchTerm] = useState('');
  const [scrollPosition, setScrollPosition] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Debounced search (only updates 500ms after user stops typing)
  const debouncedSearch = useDebouncedValue(searchTerm, 500);

  // Throttled scroll handler (runs at most once per 100ms)
  const handleScroll = useThrottledCallback((scrollTop: number) => {
    setScrollPosition(scrollTop);
  }, 100);

  // Performance stats (updates every second)
  const stats = usePerformanceStats();

  // Performance warnings
  usePerformanceWarning((warning) => {
    const message = `[${warning.type}] ${warning.message} (${warning.value.toFixed(1)} / ${warning.threshold})`;
    setWarnings((prev) => [...prev.slice(-4), message]);
  });

  // Generate large dataset for virtualized list demo
  const items = React.useMemo(
    () =>
      Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 1000,
      })),
    []
  );

  // Filter items based on debounced search
  const filteredItems = React.useMemo(() => {
    if (!debouncedSearch) return items;
    return items.filter((item) =>
      item.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [items, debouncedSearch]);

  return (
    <div className="p-6 space-y-6 bg-black/90 text-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Performance Optimization System</h1>
        <p className="text-white/60 mb-6">
          Demonstrates FPS tracking, memory monitoring, debouncing, throttling, and virtualized lists.
        </p>

        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="text-sm text-white/60 mb-1">FPS</div>
            <div className="text-3xl font-bold">{stats.fps}</div>
            <div className="text-xs text-white/40 mt-1">
              Target: 60 FPS
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="text-sm text-white/60 mb-1">Frame Time</div>
            <div className="text-3xl font-bold">{formatMs(stats.frameTime)}</div>
            <div className="text-xs text-white/40 mt-1">
              Target: &lt;16ms
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="text-sm text-white/60 mb-1">Memory Usage</div>
            <div className="text-3xl font-bold">
              {stats.memoryUsage
                ? `${stats.memoryUsage.usagePercent.toFixed(1)}%`
                : 'N/A'}
            </div>
            <div className="text-xs text-white/40 mt-1">
              {stats.memoryUsage
                ? `${formatBytes(stats.memoryUsage.usedJSHeapSize)} / ${formatBytes(stats.memoryUsage.jsHeapSizeLimit)}`
                : 'Memory API not available'}
            </div>
          </div>
        </div>

        {/* Performance Warnings */}
        {warnings.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <div className="text-sm font-bold text-yellow-500 mb-2">
              Performance Warnings
            </div>
            <div className="space-y-1">
              {warnings.map((warning, i) => (
                <div key={i} className="text-xs text-yellow-500/80 font-mono">
                  {warning}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debounced Search Demo */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Debounced Search</h2>
          <p className="text-sm text-white/60 mb-4">
            Type to search. The search only executes 500ms after you stop typing,
            preventing expensive operations on every keystroke.
          </p>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search items..."
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/40"
          />
          <div className="mt-2 text-xs text-white/40 font-mono">
            Input: "{searchTerm}" → Debounced: "{debouncedSearch}"
          </div>
        </div>

        {/* Virtualized List Demo */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Virtualized List</h2>
          <p className="text-sm text-white/60 mb-4">
            Rendering {filteredItems.length.toLocaleString()} items efficiently.
            Only visible items are rendered, maintaining 60 FPS.
          </p>

          <div className="mb-2 text-xs text-white/40 font-mono">
            Scroll Position: {scrollPosition.toFixed(0)}px
          </div>

          <VirtualizedList
            items={filteredItems}
            itemHeight={40}
            height={400}
            className="bg-black/50 border border-white/10 rounded-lg"
            onScroll={handleScroll}
            renderItem={(item, index) => (
              <div className="flex items-center justify-between px-4 h-full border-b border-white/5 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-white/40 font-mono w-16">
                    #{item.id}
                  </div>
                  <div className="text-sm">{item.name}</div>
                </div>
                <div className="text-sm text-white/60 font-mono">
                  {item.value.toFixed(2)}
                </div>
              </div>
            )}
          />

          <div className="mt-4 text-xs text-white/40">
            💡 Try scrolling quickly - notice how smooth it remains even with 10,000 items!
          </div>
        </div>

        {/* Usage Examples */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">Usage Examples</h2>
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-white/60 mb-2">Debounced Value:</div>
              <pre className="bg-black/50 p-3 rounded border border-white/10 overflow-x-auto">
                <code className="text-xs text-green-400">{`const searchTerm = useDebouncedValue(inputValue, 500);
useEffect(() => {
  // Only runs 500ms after user stops typing
  performSearch(searchTerm);
}, [searchTerm]);`}</code>
              </pre>
            </div>

            <div>
              <div className="text-white/60 mb-2">Throttled Callback:</div>
              <pre className="bg-black/50 p-3 rounded border border-white/10 overflow-x-auto">
                <code className="text-xs text-green-400">{`const handleScroll = useThrottledCallback((e) => {
  // Runs at most once per 100ms
  updateScrollPosition(e.target.scrollTop);
}, 100);`}</code>
              </pre>
            </div>

            <div>
              <div className="text-white/60 mb-2">Performance Monitoring:</div>
              <pre className="bg-black/50 p-3 rounded border border-white/10 overflow-x-auto">
                <code className="text-xs text-green-400">{`const stats = usePerformanceStats();
usePerformanceWarning((warning) => {
  console.warn(\`Performance warning: \${warning.message}\`);
});`}</code>
              </pre>
            </div>

            <div>
              <div className="text-white/60 mb-2">Virtualized List:</div>
              <pre className="bg-black/50 p-3 rounded border border-white/10 overflow-x-auto">
                <code className="text-xs text-green-400">{`<VirtualizedList
  items={largeDataset}
  itemHeight={40}
  height={400}
  renderItem={(item, index) => (
    <div>{item.name}</div>
  )}
/>`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
