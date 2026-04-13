# Performance Optimization System

The K_OS Performance Optimization System provides comprehensive tools for monitoring and optimizing frontend performance. It includes FPS tracking, memory monitoring, debouncing, throttling, and virtualized rendering.

## Components

### 1. PerformanceMonitor

Core class for tracking performance metrics and emitting warnings.

**Features:**
- Real-time FPS tracking
- Frame time measurement with smoothing
- Memory usage monitoring (Chrome/Edge)
- Performance warning system with cooldown
- Configurable thresholds

**Usage:**
```typescript
import { getPerformanceMonitor } from '@/engine/performanceMonitor';

const monitor = getPerformanceMonitor();

// Subscribe to warnings
monitor.onPerformanceWarning((warning) => {
  console.warn(`${warning.type}: ${warning.message}`);
});

// Get current stats
const stats = monitor.getStats();
console.log(`FPS: ${stats.fps}, Frame Time: ${stats.frameTime}ms`);

// Configure thresholds
monitor.setFPSThreshold(30);
monitor.setMemoryThreshold(0.8); // 80%
monitor.setFrameTimeThreshold(16); // 16ms for 60 FPS
```

### 2. Performance Hooks

React hooks for common performance optimization patterns.

#### useDebouncedValue

Delays updating a value until after a specified delay has passed since the last change.

**Use Case:** Expensive operations triggered by rapid user input (search, validation, API calls).

```typescript
import { useDebouncedValue } from '@/hooks/usePerformance';

function SearchComponent() {
  const [input, setInput] = useState('');
  const debouncedInput = useDebouncedValue(input, 500);

  useEffect(() => {
    // Only runs 500ms after user stops typing
    performExpensiveSearch(debouncedInput);
  }, [debouncedInput]);

  return <input value={input} onChange={(e) => setInput(e.target.value)} />;
}
```

#### useThrottledCallback

Limits how often a function can be called (at most once per delay period).

**Use Case:** Continuous events like scroll, mousemove, resize.

```typescript
import { useThrottledCallback } from '@/hooks/usePerformance';

function ScrollComponent() {
  const handleScroll = useThrottledCallback((e) => {
    // Runs at most once per 100ms
    updateScrollPosition(e.target.scrollTop);
  }, 100);

  return <div onScroll={handleScroll}>...</div>;
}
```

#### usePerformanceStats

Provides access to real-time performance stats (updates every second).

```typescript
import { usePerformanceStats } from '@/hooks/usePerformance';

function PerformanceHUD() {
  const stats = usePerformanceStats();

  return (
    <div>
      <div>FPS: {stats.fps}</div>
      <div>Frame Time: {stats.frameTime.toFixed(2)}ms</div>
      <div>Memory: {stats.memoryUsage?.usagePercent.toFixed(1)}%</div>
    </div>
  );
}
```

#### usePerformanceWarning

Subscribes to performance warnings.

```typescript
import { usePerformanceWarning } from '@/hooks/usePerformance';

function App() {
  usePerformanceWarning((warning) => {
    if (warning.type === 'fps') {
      // Reduce quality settings
      setQuality('low');
    } else if (warning.type === 'memory') {
      // Clear caches
      clearCaches();
    }
  });

  return <div>...</div>;
}
```

#### useAnimationFrame

Provides a callback that runs on every animation frame.

```typescript
import { useAnimationFrame } from '@/hooks/usePerformance';

function AnimatedComponent() {
  const [rotation, setRotation] = useState(0);

  useAnimationFrame((deltaTime) => {
    setRotation((r) => r + deltaTime * 0.001);
  });

  return <div style={{ transform: `rotate(${rotation}rad)` }}>...</div>;
}
```

#### useLazyRender

Delays rendering a component until needed.

```typescript
import { useLazyRender } from '@/hooks/usePerformance';

function ExpensiveComponent() {
  const shouldRender = useLazyRender(1000); // Wait 1 second

  if (!shouldRender) return null;

  return <VeryExpensiveComponent />;
}
```

#### useIntersectionObserver

Detects when an element enters the viewport (lazy loading).

```typescript
import { useIntersectionObserver } from '@/hooks/usePerformance';

function LazyImage({ src }) {
  const [ref, isVisible] = useIntersectionObserver();

  return (
    <div ref={ref}>
      {isVisible && <img src={src} />}
    </div>
  );
}
```

### 3. VirtualizedList

Efficiently renders large lists by only rendering visible items.

**Features:**
- Virtual scrolling for 10K+ items
- Configurable overscan for smooth scrolling
- RAF-based scroll handling
- Minimal re-renders

**Usage:**
```typescript
import { VirtualizedList } from '@/ui/dcc';

function LargeList() {
  const items = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
  }));

  return (
    <VirtualizedList
      items={items}
      itemHeight={40}
      height={400}
      overscan={5}
      renderItem={(item, index) => (
        <div className="p-2 border-b">
          {item.name}
        </div>
      )}
    />
  );
}
```

## Performance Thresholds

Default thresholds for performance warnings:

| Metric | Threshold | Warning Trigger |
|--------|-----------|-----------------|
| FPS | 30 | FPS drops below 30 |
| Frame Time | 16ms | Frame time exceeds 16ms (60 FPS) |
| Memory | 80% | Memory usage exceeds 80% of heap limit |

All thresholds are configurable via the PerformanceMonitor API.

## Best Practices

### 1. Debounce User Input

Always debounce expensive operations triggered by user input:

```typescript
// ❌ Bad: Runs on every keystroke
onChange={(e) => performExpensiveOperation(e.target.value)}

// ✅ Good: Runs 500ms after user stops typing
const debounced = useDebouncedValue(value, 500);
useEffect(() => performExpensiveOperation(debounced), [debounced]);
```

### 2. Throttle Continuous Events

Throttle handlers for continuous events:

```typescript
// ❌ Bad: Runs on every scroll event (60+ times per second)
onScroll={(e) => updatePosition(e.target.scrollTop)}

// ✅ Good: Runs at most once per 100ms
const handleScroll = useThrottledCallback(
  (e) => updatePosition(e.target.scrollTop),
  100
);
```

### 3. Virtualize Large Lists

Always use virtualization for lists with 100+ items:

```typescript
// ❌ Bad: Renders all 10,000 items
{items.map(item => <Item key={item.id} {...item} />)}

// ✅ Good: Only renders visible items
<VirtualizedList
  items={items}
  itemHeight={40}
  renderItem={(item) => <Item {...item} />}
/>
```

### 4. Monitor Performance in Production

Use performance monitoring to detect issues:

```typescript
usePerformanceWarning((warning) => {
  // Log to analytics
  analytics.track('performance_warning', {
    type: warning.type,
    value: warning.value,
    threshold: warning.threshold,
  });

  // Adjust quality settings
  if (warning.type === 'fps' && warning.value < 20) {
    setQuality('low');
  }
});
```

### 5. Lazy Load Heavy Components

Delay rendering expensive components:

```typescript
// ❌ Bad: Loads everything immediately
<ExpensiveComponent />

// ✅ Good: Loads after 1 second or when visible
const shouldRender = useLazyRender(1000);
{shouldRender && <ExpensiveComponent />}

// Or use intersection observer
const [ref, isVisible] = useIntersectionObserver();
<div ref={ref}>
  {isVisible && <ExpensiveComponent />}
</div>
```

## Performance Metrics

### FPS (Frames Per Second)

- **Target:** 60 FPS
- **Acceptable:** 30-60 FPS
- **Poor:** <30 FPS

### Frame Time

- **Target:** <16ms (60 FPS)
- **Acceptable:** 16-33ms (30-60 FPS)
- **Poor:** >33ms (<30 FPS)

### Memory Usage

- **Target:** <50% of heap limit
- **Acceptable:** 50-80% of heap limit
- **Poor:** >80% of heap limit

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| FPS Tracking | ✅ | ✅ | ✅ | ✅ |
| Frame Time | ✅ | ✅ | ✅ | ✅ |
| Memory API | ✅ | ❌ | ❌ | ✅ |
| RAF | ✅ | ✅ | ✅ | ✅ |
| Intersection Observer | ✅ | ✅ | ✅ | ✅ |

**Note:** Memory monitoring requires `performance.memory` API (Chrome/Edge only).

## Demo

See `src-frontend/ui/dcc/PerformanceDemo.tsx` for a complete demonstration of all performance features.

## Requirements Validation

This system validates the following requirements:

- **10.1:** Performance_Monitor tracks FPS and frame time continuously ✅
- **10.2:** Emits performance warning when FPS drops below 30 ✅
- **10.3:** Emits memory warning when usage exceeds 80% ✅
- **10.4:** Uses virtualization for large lists ✅
- **10.5:** Debounces rapid successive calls ✅
- **10.6:** Maintains UI responsiveness with frame times under 16ms ✅

## Future Enhancements

- GPU memory tracking via WebGPU
- Network performance monitoring
- Component render time profiling
- Automatic quality adjustment based on performance
- Performance budgets and alerts
- Integration with browser DevTools Performance API
