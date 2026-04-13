# K_OS State Management System

Comprehensive state management for K_OS DCC Suite using Zustand with advanced features.

## Features

- ✅ **Typed Stores** - Full TypeScript support with type inference
- ✅ **Persistence** - localStorage or IndexedDB for large data
- ✅ **Undo/Redo** - Built-in history management
- ✅ **Cross-App Sync** - BroadcastChannel for multi-tab/window sync
- ✅ **DevTools** - Redux DevTools integration
- ✅ **Performance** - Optimized with debouncing and selective updates

## Quick Start

### Basic Store

```typescript
import { createStore } from '@/state';

interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useCounterStore = createStore<CounterState>(
  {
    name: 'counter',
    persist: true,
    devtools: true,
  },
  (set) => ({
    count: 0,
    increment: () => set((state) => ({ count: state.count + 1 })),
    decrement: () => set((state) => ({ count: state.count - 1 })),
  })
);

// Usage in components
function Counter() {
  const { count, increment } = useCounterStore();
  return <button onClick={increment}>{count}</button>;
}
```

### Undo/Redo Store

```typescript
import { create } from 'zustand';
import { undoRedo, UndoRedoState, UndoRedoActions } from '@/state';

interface EditorState {
  content: string;
}

const useEditorStore = create<UndoRedoState<EditorState> & UndoRedoActions<EditorState>>(
  undoRedo({ content: '' }, { limit: 50 })
);

// Usage
function Editor() {
  const { present, set, undo, redo, canUndo, canRedo } = useEditorStore();
  
  return (
    <div>
      <textarea 
        value={present.content}
        onChange={(e) => set({ content: e.target.value })}
      />
      <button onClick={undo} disabled={!canUndo()}>Undo</button>
      <button onClick={redo} disabled={!canRedo()}>Redo</button>
    </div>
  );
}
```

### Cross-App Synchronization

```typescript
import { createStore, syncStore } from '@/state';

interface ThemeState {
  mode: 'light' | 'dark';
  setMode: (mode: 'light' | 'dark') => void;
}

const useThemeStore = createStore<ThemeState>(
  { name: 'theme', persist: true },
  (set) => ({
    mode: 'dark',
    setMode: (mode) => set({ mode }),
  })
);

// Sync across all app instances
syncStore(useThemeStore, {
  channel: 'global-theme',
  debounce: 100,
});

// Now theme changes sync across KSculpt, KPainter, etc.
```

### IndexedDB for Large Data

```typescript
import { createIndexedDBStore } from '@/state';

interface ProjectState {
  meshes: Mesh[];
  textures: Texture[];
  // ... large data
}

const useProjectStore = createIndexedDBStore<ProjectState>(
  { name: 'project' },
  (set) => ({
    meshes: [],
    textures: [],
    // ...
  })
);
```

## Built-in Stores

### App Store

Global app state shared across all DCC applications.

```typescript
import { useAppStore } from '@/state';

function App() {
  const { activeApp, setActiveApp, recentFiles } = useAppStore();
  // ...
}
```

### Viewport Store

3D viewport configuration with persistence.

```typescript
import { useViewportStore } from '@/state';

function Viewport() {
  const { 
    cameraPosition, 
    showGrid, 
    toggleGrid,
    reset 
  } = useViewportStore();
  // ...
}
```

### Preferences Store

User preferences synced across all apps.

```typescript
import { usePreferencesStore } from '@/state';

function Settings() {
  const { 
    theme, 
    setTheme, 
    performanceMode,
    shortcuts 
  } = usePreferencesStore();
  // ...
}
```

## Advanced Patterns

### Selective Sync

Sync only specific keys across apps:

```typescript
import { createSyncedSlice } from '@/state';

// Only sync theme and uiScale, not other preferences
createSyncedSlice(
  usePreferencesStore,
  ['theme', 'uiScale'],
  'global-ui-prefs'
);
```

### Custom Events

Broadcast custom events between apps:

```typescript
import { broadcastEvent, listenToEvents } from '@/state';

// In KSculpt
broadcastEvent('app-events', 'MESH_EXPORTED', { 
  filename: 'model.obj',
  format: 'obj'
});

// In KPainter
const cleanup = listenToEvents('app-events', 'MESH_EXPORTED', (payload) => {
  console.log('Mesh exported:', payload.filename);
  // Auto-import into KPainter
});
```

### Deep Equality

Use deep equality for complex state objects:

```typescript
import { undoRedo, deepEqual } from '@/state';

const useStore = create(
  undoRedo(initialState, {
    equality: deepEqual, // Compare nested objects
  })
);
```

## Performance Tips

1. **Selective Subscriptions** - Only subscribe to needed state slices:

```typescript
// ❌ Bad - re-renders on any state change
const state = useStore();

// ✅ Good - only re-renders when count changes
const count = useStore((state) => state.count);
```

2. **Debounce Sync** - Reduce sync frequency for high-frequency updates:

```typescript
syncStore(useStore, {
  channel: 'sync',
  debounce: 100, // Wait 100ms before syncing
});
```

3. **Limit History** - Control undo/redo memory usage:

```typescript
undoRedo(initialState, {
  limit: 50, // Keep only last 50 states
});
```

## Testing

All state utilities include comprehensive tests:

```bash
npm test src-frontend/state
```

## Architecture

```
src-frontend/state/
├── createStore.ts          # Store factory with persistence
├── undoRedoStore.ts        # Undo/redo middleware
├── syncStore.ts            # Cross-app synchronization
├── stores/
│   ├── appStore.ts         # Global app state
│   ├── viewportStore.ts    # Viewport configuration
│   └── preferencesStore.ts # User preferences
└── __tests__/              # Comprehensive test suite
```

## Migration from useState

```typescript
// Before
const [count, setCount] = useState(0);

// After
const useCounterStore = createStore(
  { name: 'counter' },
  (set) => ({
    count: 0,
    setCount: (count) => set({ count }),
  })
);

const { count, setCount } = useCounterStore();
```

## Best Practices

1. **One store per domain** - Separate concerns (viewport, tools, project)
2. **Actions over direct sets** - Encapsulate logic in action functions
3. **Persist user preferences** - Enable persistence for settings
4. **Sync global state** - Use syncStore for cross-app state
5. **Test state logic** - Write tests for complex state transitions

## Resources

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
