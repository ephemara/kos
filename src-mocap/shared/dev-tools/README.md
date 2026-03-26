# Developer Tools

Utilities for debugging and development during application runtime.

## Components

### ConsolePanel

Real-time log streaming and debugging interface for viewing backend logs.

**Features**:
- Real-time log streaming from backend (Tauri/external engines)
- Color-coded by severity (ERROR=red, WARN=yellow, INFO=blue, DEBUG=gray)
- Filterable by log level and target module
- Searchable log messages
- Pause/Resume streaming
- Auto-scroll with manual override
- Ring buffer (max 1000 entries, oldest dropped)
- Copy logs to clipboard
- Clear logs
- Collapsible with stats badge

**Usage**:

```typescript
import { ConsolePanel } from '@/shared/dev-tools';

// Add to your root layout
<App>
  <YourContent />
  <ConsolePanel />
</App>
```

**Features in Detail**:

1. **Log Levels**: ERROR, WARN, INFO, DEBUG, TRACE
2. **Filtering**: Filter by minimum level or target module
3. **Search**: Full-text search across all log messages
4. **Pause/Resume**: Pause log streaming while investigating
5. **Auto-scroll**: Automatically scrolls to latest logs (can be disabled)
6. **Stats Badge**: Shows error/warning counts when collapsed
7. **Timestamps**: Relative timestamps (minutes:seconds)
8. **Target Shortening**: Simplifies module paths for readability

**Keyboard Shortcuts**:
- Click timestamp to copy log entry
- Scroll up to disable auto-scroll
- Scroll to bottom to re-enable auto-scroll

**State Management**:

The console uses Zustand store from `@/shared/state/consoleStore`:

```typescript
import {
  useConsoleLogs,
  useConsoleControls,
  useConsoleFilters,
  useLogStats
} from '@/shared/state/consoleStore';

// Get logs
const logs = useConsoleLogs();

// Control panel
const { isOpen, isPaused, togglePause, clearLogs } = useConsoleControls();

// Filter logs
const { filters, setFilter } = useConsoleFilters();

// Get statistics
const stats = useLogStats(); // { total, errors, warns }
```

**Backend Integration**:

The console listens for log events from the backend:

```rust
// Rust backend (Tauri)
#[tauri::command]
fn emit_log(level: String, target: String, message: String) {
    app.emit_all("kos-log", LogEntry {
        level,
        target,
        message,
        timestamp: get_time(),
        frame: get_frame_count(),
    }).ok();
}
```

**Styling**:

The console uses dark theme with color-coded log levels:
- **ERROR**: Red (#ef4444)
- **WARN**: Yellow (#eab308)
- **INFO**: Cyan (#06b6d4)
- **DEBUG**: Gray (#9ca3af)
- **TRACE**: Dark gray (#6b7280)

**Performance**:

- Ring buffer limits memory usage (max 1000 entries)
- Efficient filtering with memoization
- Virtual scrolling for large log lists (future enhancement)
- Pause streaming to reduce CPU usage during investigation

## Adding New Dev Tools

To add a new developer tool:

1. **Create the component**:
```typescript
// shared/dev-tools/MyDevTool.tsx
export interface MyDevToolProps {
  // Props
}

export function MyDevTool({ }: MyDevToolProps) {
  // Implementation
}
```

2. **Export from index**:
```typescript
// shared/dev-tools/index.ts
export { MyDevTool } from './MyDevTool';
export type { MyDevToolProps } from './MyDevTool';
```

3. **Use in your app**:
```typescript
import { MyDevTool } from '@/shared/dev-tools';

<MyDevTool />
```

## Best Practices

### When to Use Dev Tools

Dev tools should be:
- **Non-intrusive**: Don't block the main UI
- **Collapsible**: Can be hidden when not needed
- **Performance-aware**: Don't impact app performance
- **Development-only**: Consider removing in production builds

### Performance Considerations

- Use ring buffers for unbounded data
- Implement pause/resume for streaming data
- Use virtual scrolling for large lists
- Debounce search and filter operations
- Memoize expensive computations

### Styling Guidelines

- Use dark theme to match app aesthetic
- Color-code by severity/importance
- Keep UI minimal and functional
- Use monospace fonts for technical data
- Provide keyboard shortcuts for power users

## Future Enhancements

Potential additions to dev-tools:

1. **Performance Monitor**: FPS, memory usage, GPU stats
2. **Network Inspector**: IPC calls, timing, payloads
3. **State Inspector**: View/edit Zustand stores
4. **Event Logger**: Track all app events
5. **Profiler**: CPU/GPU profiling integration
6. **Screenshot Tool**: Capture viewport/UI
7. **Recording Tool**: Record sessions for debugging

## Related

- [State Management](../state/README.md) - Zustand stores
- [Notifications](../../notifications/README.md) - Toast system
- [Error Handling](../../error/README.md) - Error boundaries
