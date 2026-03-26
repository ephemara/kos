# FloatingDockPanel Integration Guide

Quick guide for integrating FloatingDockPanel into ZenMocap features.

## Quick Start

### 1. Import the Component

```typescript
import { FloatingDockPanel } from '@/shared/shell';
```

### 2. Add State Management

```typescript
const [isPanelOpen, setIsPanelOpen] = useState(false);
```

### 3. Render the Panel

```typescript
{isPanelOpen && (
  <FloatingDockPanel
    title="My Panel"
    onClose={() => setIsPanelOpen(false)}
  >
    <div>Panel content</div>
  </FloatingDockPanel>
)}
```

## Common Use Cases in ZenMocap

### 1. Webcam Preview Panel

```typescript
import { FloatingDockPanel } from '@/shared/shell';
import { WebcamPreview } from '@/features/ZenMocap/components/WebcamPreview';

function ZenMocapApp() {
  const [showWebcam, setShowWebcam] = useState(false);

  return (
    <>
      <Button onClick={() => setShowWebcam(true)}>
        Show Webcam
      </Button>

      {showWebcam && (
        <FloatingDockPanel
          title="Webcam Preview"
          defaultSize={{ width: 640, height: 480 }}
          defaultPosition={{ x: 50, y: 50 }}
          onClose={() => setShowWebcam(false)}
          storageKey="zenmocap-webcam-panel"
        >
          <WebcamPreview />
        </FloatingDockPanel>
      )}
    </>
  );
}
```

### 2. Performance Stats Panel

```typescript
import { FloatingDockPanel } from '@/shared/shell';
import { PerformanceStats } from '@/features/ZenMocap/components/PerformanceStats';

function ZenMocapApp() {
  const [showStats, setShowStats] = useState(false);

  return (
    <>
      <Button onClick={() => setShowStats(true)}>
        Show Stats
      </Button>

      {showStats && (
        <FloatingDockPanel
          title="Performance"
          defaultSize={{ width: 300, height: 400 }}
          defaultPosition={{ x: window.innerWidth - 350, y: 50 }}
          onClose={() => setShowStats(false)}
          storageKey="zenmocap-stats-panel"
        >
          <PerformanceStats />
        </FloatingDockPanel>
      )}
    </>
  );
}
```

### 3. Settings Panel

```typescript
import { FloatingDockPanel } from '@/shared/shell';
import { SessionSettings } from '@/features/ZenMocap/components/SessionSettings';

function ZenMocapApp() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <Button onClick={() => setShowSettings(true)}>
        Settings
      </Button>

      {showSettings && (
        <FloatingDockPanel
          title="Session Settings"
          defaultSize={{ width: 500, height: 600 }}
          onClose={() => setShowSettings(false)}
          storageKey="zenmocap-settings-panel"
        >
          <SessionSettings />
        </FloatingDockPanel>
      )}
    </>
  );
}
```

### 4. Take Manager Panel

```typescript
import { FloatingDockPanel } from '@/shared/shell';
import { TakeManager } from '@/features/ZenMocap/components/TakeManager';

function ZenMocapApp() {
  const [showTakes, setShowTakes] = useState(false);

  return (
    <>
      <Button onClick={() => setShowTakes(true)}>
        Manage Takes
      </Button>

      {showTakes && (
        <FloatingDockPanel
          title="Takes"
          defaultSize={{ width: 400, height: 500 }}
          defaultPosition={{ x: 50, y: 50 }}
          onClose={() => setShowTakes(false)}
          storageKey="zenmocap-takes-panel"
        >
          <TakeManager />
        </FloatingDockPanel>
      )}
    </>
  );
}
```

### 5. Model Selector Panel

```typescript
import { FloatingDockPanel } from '@/shared/shell';
import { ModelSelector } from '@/features/ZenMocap/components/ModelSelector';

function ZenMocapApp() {
  const [showModels, setShowModels] = useState(false);

  return (
    <>
      <Button onClick={() => setShowModels(true)}>
        Select Model
      </Button>

      {showModels && (
        <FloatingDockPanel
          title="AI Models"
          defaultSize={{ width: 450, height: 550 }}
          onClose={() => setShowModels(false)}
          storageKey="zenmocap-models-panel"
        >
          <ModelSelector />
        </FloatingDockPanel>
      )}
    </>
  );
}
```

## Best Practices

### 1. Use Unique Storage Keys

Each panel should have a unique storage key to persist state independently:

```typescript
storageKey="zenmocap-webcam-panel"
storageKey="zenmocap-stats-panel"
storageKey="zenmocap-settings-panel"
```

### 2. Set Appropriate Default Positions

Position panels to avoid overlap:

```typescript
// Top-left
defaultPosition={{ x: 50, y: 50 }}

// Top-right
defaultPosition={{ x: window.innerWidth - 350, y: 50 }}

// Bottom-left
defaultPosition={{ x: 50, y: window.innerHeight - 450 }}

// Bottom-right
defaultPosition={{ x: window.innerWidth - 350, y: window.innerHeight - 450 }}
```

### 3. Set Appropriate Sizes

Match panel size to content:

```typescript
// Small panel (stats, controls)
defaultSize={{ width: 300, height: 400 }}

// Medium panel (settings, lists)
defaultSize={{ width: 450, height: 550 }}

// Large panel (webcam, preview)
defaultSize={{ width: 640, height: 480 }}
```

### 4. Handle Close Properly

Always provide onClose to clean up state:

```typescript
onClose={() => {
  setIsPanelOpen(false);
  // Additional cleanup if needed
  cleanupResources();
}}
```

### 5. Conditional Rendering

Only render panels when needed to save resources:

```typescript
{isPanelOpen && (
  <FloatingDockPanel {...props}>
    <ExpensiveComponent />
  </FloatingDockPanel>
)}
```

## Advanced Patterns

### Panel Manager Hook

Create a custom hook to manage multiple panels:

```typescript
// hooks/usePanelManager.ts
import { useState } from 'react';

type PanelId = 'webcam' | 'stats' | 'settings' | 'takes' | 'models';

export function usePanelManager() {
  const [openPanels, setOpenPanels] = useState<Set<PanelId>>(new Set());

  const openPanel = (id: PanelId) => {
    setOpenPanels(prev => new Set(prev).add(id));
  };

  const closePanel = (id: PanelId) => {
    setOpenPanels(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const togglePanel = (id: PanelId) => {
    if (openPanels.has(id)) {
      closePanel(id);
    } else {
      openPanel(id);
    }
  };

  const isPanelOpen = (id: PanelId) => openPanels.has(id);

  return {
    openPanels,
    openPanel,
    closePanel,
    togglePanel,
    isPanelOpen,
  };
}
```

Usage:

```typescript
function ZenMocapApp() {
  const panels = usePanelManager();

  return (
    <>
      <Button onClick={() => panels.togglePanel('webcam')}>
        Toggle Webcam
      </Button>
      <Button onClick={() => panels.togglePanel('stats')}>
        Toggle Stats
      </Button>

      {panels.isPanelOpen('webcam') && (
        <FloatingDockPanel
          title="Webcam"
          onClose={() => panels.closePanel('webcam')}
          storageKey="zenmocap-webcam-panel"
        >
          <WebcamPreview />
        </FloatingDockPanel>
      )}

      {panels.isPanelOpen('stats') && (
        <FloatingDockPanel
          title="Stats"
          onClose={() => panels.closePanel('stats')}
          storageKey="zenmocap-stats-panel"
        >
          <PerformanceStats />
        </FloatingDockPanel>
      )}
    </>
  );
}
```

### Panel Configuration

Define panel configurations in a central location:

```typescript
// config/panels.ts
export const PANEL_CONFIGS = {
  webcam: {
    title: 'Webcam Preview',
    defaultSize: { width: 640, height: 480 },
    defaultPosition: { x: 50, y: 50 },
    storageKey: 'zenmocap-webcam-panel',
  },
  stats: {
    title: 'Performance Stats',
    defaultSize: { width: 300, height: 400 },
    defaultPosition: { x: window.innerWidth - 350, y: 50 },
    storageKey: 'zenmocap-stats-panel',
  },
  settings: {
    title: 'Settings',
    defaultSize: { width: 500, height: 600 },
    defaultPosition: { x: 100, y: 100 },
    storageKey: 'zenmocap-settings-panel',
  },
};
```

Usage:

```typescript
<FloatingDockPanel
  {...PANEL_CONFIGS.webcam}
  onClose={() => panels.closePanel('webcam')}
>
  <WebcamPreview />
</FloatingDockPanel>
```

### Keyboard Shortcuts

Add keyboard shortcuts to toggle panels:

```typescript
import { useHotkeys } from 'react-hotkeys-hook';

function ZenMocapApp() {
  const panels = usePanelManager();

  useHotkeys('ctrl+w', () => panels.togglePanel('webcam'));
  useHotkeys('ctrl+s', () => panels.togglePanel('stats'));
  useHotkeys('ctrl+,', () => panels.togglePanel('settings'));

  // ... rest of component
}
```

## Styling Tips

### Custom Panel Styles

```typescript
<FloatingDockPanel
  title="Custom Styled"
  className="border-2 border-[color:var(--kos-accent-primary)]"
>
  <div className="space-y-4">
    {/* Content with consistent spacing */}
  </div>
</FloatingDockPanel>
```

### Content Layout

Use consistent spacing and layout:

```typescript
<FloatingDockPanel title="Panel">
  <div className="space-y-6">
    <section>
      <h4 className="text-sm font-bold mb-2">Section Title</h4>
      <div className="space-y-2">
        {/* Section content */}
      </div>
    </section>
    
    <section>
      <h4 className="text-sm font-bold mb-2">Another Section</h4>
      <div className="space-y-2">
        {/* Section content */}
      </div>
    </section>
  </div>
</FloatingDockPanel>
```

## Performance Considerations

### Lazy Loading

Lazy load panel content to improve initial load time:

```typescript
const WebcamPreview = lazy(() => import('./components/WebcamPreview'));

{showWebcam && (
  <FloatingDockPanel title="Webcam" onClose={() => setShowWebcam(false)}>
    <Suspense fallback={<div>Loading...</div>}>
      <WebcamPreview />
    </Suspense>
  </FloatingDockPanel>
)}
```

### Memoization

Memoize expensive panel content:

```typescript
const MemoizedStats = memo(PerformanceStats);

<FloatingDockPanel title="Stats" onClose={...}>
  <MemoizedStats />
</FloatingDockPanel>
```

### Cleanup

Clean up resources when panel closes:

```typescript
useEffect(() => {
  if (!isPanelOpen) {
    // Cleanup resources
    stopWebcam();
    clearInterval(statsInterval);
  }
}, [isPanelOpen]);
```

## Troubleshooting

### Panel Not Appearing

1. Check if state is true
2. Verify conditional rendering
3. Check z-index conflicts
4. Clear localStorage if corrupted

### Panel Off-Screen

1. Clear localStorage
2. Set explicit defaultPosition
3. Check viewport size

### Performance Issues

1. Lazy load content
2. Memoize components
3. Reduce re-renders
4. Clean up on unmount

## Next Steps

1. Implement panels in ZenMocap features
2. Test on different screen sizes
3. Add keyboard shortcuts
4. Create panel presets
5. Add panel manager UI

## Resources

- `FloatingDockPanel.tsx` - Component source
- `FloatingDockPanel.README.md` - Full documentation
- `FloatingDockPanel.example.tsx` - Usage examples
- `FloatingDockPanel.TEST_CHECKLIST.md` - Testing guide
