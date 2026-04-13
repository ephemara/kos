# Floating Dock System

Full-featured docking system with floating windows for K_OS DCC Suite.

## Features

- **Drag to Float**: Drag any tab out to create a floating window
- **Drag to Dock**: Drag floating windows back to dock zones (top, bottom, left, right, center)
- **Multi-Tab Panels**: Each panel can contain multiple tabs
- **Persistent Layout**: Automatically saves and restores layout state
- **Maximize/Minimize**: Window controls for floating panels
- **Resize**: Drag dividers to resize docked panels
- **Close Tabs**: Optional closable tabs
- **Cached Content**: Tabs can be cached to preserve state when switching

## Quick Start

### Option 1: Use AppShellFloating (Recommended)

```tsx
import { AppShellFloating, FloatingDockTab } from '@/ui/shell';
import { Layers, Settings } from 'lucide-react';

const dockTabs: FloatingDockTab[] = [
  {
    id: 'layers',
    title: 'Layers',
    icon: Layers,
    content: <LayersPanel />,
    closable: false,
  },
  {
    id: 'properties',
    title: 'Properties',
    icon: Settings,
    content: <PropertiesPanel />,
  },
];

function MyApp() {
  return (
    <AppShellFloating
      layoutKey="my-app"
      dockTabs={dockTabs}
      defaultDockLayout="left-right"
      topBar={<MyTopBar />}
      statusBar={<MyStatusBar />}
    >
      <MyViewport />
    </AppShellFloating>
  );
}
```

### Option 2: Use FloatingDock Directly

```tsx
import { FloatingDock, FloatingDockTab } from '@/ui/shell';

function MyCustomLayout() {
  const tabs: FloatingDockTab[] = [
    {
      id: 'tab1',
      title: 'Tab 1',
      content: <div>Content 1</div>,
    },
    {
      id: 'tab2',
      title: 'Tab 2',
      content: <div>Content 2</div>,
    },
  ];

  return (
    <div className="h-screen w-screen">
      <FloatingDock
        layoutKey="my-layout"
        tabs={tabs}
        defaultLayout="left-right"
        onLayoutChange={(layout) => console.log('Layout changed:', layout)}
      />
    </div>
  );
}
```

## FloatingDockTab Type

```typescript
type FloatingDockTab = {
  id: string;              // Unique identifier
  title: string;           // Display name
  icon?: LucideIcon;       // Optional icon component
  content: React.ReactNode; // Tab content
  closable?: boolean;      // Can user close this tab? (default: true)
  cached?: boolean;        // Cache content when switching tabs? (default: true)
};
```

## Default Layouts

- `'left-right'`: Splits tabs into left and right panels
- `'top-bottom'`: Splits tabs into top and bottom panels
- `'single'`: All tabs in one panel

## Layout Persistence

Layouts are automatically saved to localStorage with the key:
```
kos-dock-layout-{layoutKey}
```

To reset a layout, clear localStorage or change the `layoutKey`.

## Styling

The dock system uses K_OS dark theme by default. Customize via CSS variables in `floating-dock.css`:

```css
.kos-floating-dock {
  --dock-bg: #0a0a0a;
  --dock-border: #1c1c1c;
  --dock-accent: #f97316;
  /* ... more variables */
}
```

## Migration from Fixed Panels

### Before (AppShell with fixed panels):
```tsx
<AppShell
  left={{
    tabs: [
      { id: 'layers', label: 'Layers', content: <LayersPanel /> }
    ]
  }}
  right={{
    tabs: [
      { id: 'props', label: 'Properties', content: <PropsPanel /> }
    ]
  }}
>
  <Viewport />
</AppShell>
```

### After (AppShellFloating with floating dock):
```tsx
<AppShellFloating
  layoutKey="my-app"
  dockTabs={[
    { id: 'layers', title: 'Layers', content: <LayersPanel /> },
    { id: 'props', title: 'Properties', content: <PropsPanel /> },
  ]}
>
  <Viewport />
</AppShellFloating>
```

## Demo

Run the demo to see all features:

```tsx
import { FloatingDockDemo } from '@/ui/shell';

<FloatingDockDemo />
```

## Technical Details

- Built on `rc-dock` v4.0.0-alpha.2
- Supports nested layouts (horizontal/vertical splits)
- Floating windows use native browser drag-and-drop
- Layout state is JSON-serializable
- Content is React portals for performance

## Troubleshooting

**Tabs not appearing?**
- Check that each tab has a unique `id`
- Ensure `content` is a valid React node

**Layout not persisting?**
- Verify `layoutKey` is consistent across renders
- Check browser localStorage is enabled

**Styling issues?**
- Ensure `floating-dock.css` is imported in `global.css`
- Check for CSS conflicts with other libraries

## Future Enhancements

- [ ] Keyboard shortcuts for dock operations
- [ ] Tab groups/categories
- [ ] Drag-and-drop tab reordering within panels
- [ ] Snap-to-grid for floating windows
- [ ] Multi-monitor support
- [ ] Custom drop zones
