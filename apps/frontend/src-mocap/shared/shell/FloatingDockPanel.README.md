# FloatingDockPanel Component

A fully-featured floating panel component with resize, drag, and docking capabilities. Built with Framer Motion for smooth animations and professional feel.

## Features

### ✅ Resize Functionality
- **All edges**: Top, right, bottom, left
- **All corners**: Top-left, top-right, bottom-left, bottom-right
- **Visual feedback**: Hover highlights on resize handles
- **Constraints**: Min/max size limits
- **Cursor changes**: Appropriate resize cursors

### ✅ Drag & Move
- **Draggable header**: Smooth drag with framer-motion
- **Viewport constraints**: Stays within screen bounds
- **Visual feedback**: Scale animation while dragging
- **Momentum**: Disabled for precise control

### ✅ Docking System
- **Magnetic zones**: 50px threshold at screen edges
- **Dock positions**: Left, right, top, bottom
- **Visual indicators**: Animated dock zone highlights
- **Smooth transitions**: Spring animations when docking/undocking
- **Docked state**: Visual glow and indicator badge

### ✅ Maximize/Minimize
- **Toggle button**: In header controls
- **Full screen**: Expands to fill viewport
- **Restore**: Returns to previous size/position

### ✅ State Persistence
- **localStorage**: Saves position, size, dock state
- **Custom keys**: Multiple panels with unique storage
- **Auto-restore**: Loads saved state on mount

### ✅ Visual Polish
- **Glassmorphism**: Backdrop blur with semi-transparent background
- **Accent glow**: Cyan glow when docked
- **Smooth shadows**: Depth with layered shadows
- **Animations**: Spring-based transitions (300ms)
- **Rounded corners**: Modern design with proper radius

## Installation

The component is already installed in the shell module:

```typescript
import { FloatingDockPanel } from '@/shared/shell';
```

## Basic Usage

```typescript
import { FloatingDockPanel } from '@/shared/shell';
import { useState } from 'react';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Panel</button>
      
      {isOpen && (
        <FloatingDockPanel
          title="My Panel"
          onClose={() => setIsOpen(false)}
        >
          <div>Panel content goes here</div>
        </FloatingDockPanel>
      )}
    </>
  );
}
```

## Props

```typescript
type FloatingDockPanelProps = {
  // Required
  title: string;                    // Panel title shown in header
  children: React.ReactNode;        // Panel content
  
  // Optional
  defaultPosition?: { x: number; y: number };  // Initial position (default: {x: 100, y: 100})
  defaultSize?: { width: number; height: number };  // Initial size (default: {width: 400, height: 300})
  minSize?: { width: number; height: number };  // Minimum size (default: {width: 200, height: 150})
  maxSize?: { width: number; height: number };  // Maximum size (default: 80% viewport)
  onClose?: () => void;             // Close handler (shows X button if provided)
  className?: string;               // Additional CSS classes
  storageKey?: string;              // localStorage key for persistence (default: 'floating-dock-panel-state')
};
```

## Advanced Examples

### Custom Size and Position

```typescript
<FloatingDockPanel
  title="Custom Panel"
  defaultPosition={{ x: 200, y: 150 }}
  defaultSize={{ width: 600, height: 400 }}
  minSize={{ width: 300, height: 200 }}
  maxSize={{ width: 1200, height: 800 }}
  onClose={() => setIsOpen(false)}
  storageKey="custom-panel-state"
>
  <div>Content</div>
</FloatingDockPanel>
```

### Multiple Panels

```typescript
function MultiplePanels() {
  const [panels, setPanels] = useState([
    { id: '1', title: 'Panel 1' },
    { id: '2', title: 'Panel 2' },
  ]);

  return (
    <>
      {panels.map((panel, index) => (
        <FloatingDockPanel
          key={panel.id}
          title={panel.title}
          defaultPosition={{ 
            x: 100 + (index * 30), 
            y: 100 + (index * 30) 
          }}
          onClose={() => removePanel(panel.id)}
          storageKey={`panel-${panel.id}`}
        >
          <div>Panel {panel.id} content</div>
        </FloatingDockPanel>
      ))}
    </>
  );
}
```

### Rich Content Panel

```typescript
<FloatingDockPanel
  title="Settings"
  defaultSize={{ width: 500, height: 600 }}
  onClose={() => setIsOpen(false)}
>
  <div className="space-y-6">
    <section>
      <h4 className="text-sm font-bold mb-2">Section 1</h4>
      <input type="text" placeholder="Input..." />
    </section>
    
    <section>
      <h4 className="text-sm font-bold mb-2">Section 2</h4>
      <textarea rows={4} placeholder="Description..." />
    </section>
    
    <div className="flex gap-2">
      <button>Save</button>
      <button>Cancel</button>
    </div>
  </div>
</FloatingDockPanel>
```

## User Interactions

### Dragging
1. Click and hold the header (with grip icon)
2. Drag the panel around the screen
3. Panel scales slightly while dragging for visual feedback
4. Release to drop at new position

### Docking
1. Drag panel near any screen edge (within 50px)
2. Visual indicator shows dock zone (animated border)
3. Release to dock the panel
4. Docked panel shows cyan glow and "DOCKED" badge
5. Drag away from edge to undock

### Resizing
1. Hover over any edge or corner
2. Cursor changes to resize cursor
3. Click and drag to resize
4. Min/max constraints are enforced
5. Panel stays within viewport bounds

### Maximizing
1. Click maximize button in header (square icon)
2. Panel expands to fill entire viewport
3. Click minimize button to restore previous size

### Closing
1. Click X button in header (if onClose provided)
2. Panel closes and state is saved

## Styling

The component uses CSS variables from the K_OS design system:

```css
/* Background */
--kos-surface-primary      /* Panel background */
--kos-surface-secondary    /* Header background */

/* Borders */
--kos-border-primary       /* Default border */
--kos-accent-primary       /* Docked border (cyan) */

/* Text */
--kos-text-primary         /* Title text */
--kos-text-secondary       /* Content text */
--kos-text-muted           /* Muted text */

/* Effects */
--kos-radius-lg            /* Border radius */
backdrop-blur-xl           /* Glassmorphism */
```

### Custom Styling

Add custom classes via the `className` prop:

```typescript
<FloatingDockPanel
  title="Custom Styled"
  className="border-2 border-red-500 shadow-2xl"
>
  <div>Content</div>
</FloatingDockPanel>
```

## State Persistence

The panel automatically saves its state to localStorage:

```typescript
{
  position: { x: number, y: number },
  size: { width: number, height: number },
  dockPosition: 'left' | 'right' | 'top' | 'bottom' | 'floating',
  isMaximized: boolean
}
```

### Custom Storage Key

Use unique storage keys for multiple panels:

```typescript
<FloatingDockPanel
  title="Panel 1"
  storageKey="panel-1-state"
>
  <div>Content</div>
</FloatingDockPanel>

<FloatingDockPanel
  title="Panel 2"
  storageKey="panel-2-state"
>
  <div>Content</div>
</FloatingDockPanel>
```

### Clear Saved State

```typescript
localStorage.removeItem('floating-dock-panel-state');
```

## Performance

### Optimizations
- **Zero re-renders**: Uses refs for drag position
- **Framer Motion**: GPU-accelerated animations
- **Event delegation**: Efficient resize handling
- **Lazy state updates**: Only saves on interaction end

### Best Practices
- Use `storageKey` for multiple panels
- Provide `onClose` for cleanup
- Set appropriate `minSize`/`maxSize` for content
- Use `defaultPosition` to avoid overlapping panels

## Accessibility

- **Keyboard**: Focus management for header controls
- **ARIA**: Proper labels on buttons
- **Screen readers**: Semantic HTML structure
- **Focus trap**: (TODO) Trap focus when panel is active

## Browser Support

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile**: Touch events supported (drag/resize)

## Known Limitations

1. **Z-index**: Fixed at 9999 (may conflict with modals)
2. **Multi-monitor**: Docking only works on primary screen
3. **Touch**: Resize handles may be small on mobile
4. **Rotation**: No support for rotated panels

## Future Enhancements

- [ ] Snap to grid
- [ ] Snap to other panels
- [ ] Minimize to taskbar
- [ ] Panel groups/tabs
- [ ] Keyboard shortcuts
- [ ] Touch gestures (pinch to resize)
- [ ] Custom dock zones
- [ ] Panel stacking (z-index management)

## Troubleshooting

### Panel not appearing
- Check if `isOpen` state is true
- Verify panel is not off-screen (check saved state)
- Clear localStorage if state is corrupted

### Resize not working
- Ensure panel is not docked (undock first)
- Check if panel is maximized (minimize first)
- Verify min/max size constraints

### Docking not triggering
- Drag panel center near edge (within 50px)
- Check if viewport is large enough
- Try different edges

### State not persisting
- Verify `storageKey` is unique
- Check localStorage is enabled
- Clear corrupted state and try again

## Examples

See `FloatingDockPanel.example.tsx` for comprehensive examples:
- Basic usage
- Custom size and position
- Multiple panels
- Rich content
- Settings panel

## API Reference

### Types

```typescript
type DockPosition = 'left' | 'right' | 'top' | 'bottom' | 'floating';

type PanelState = {
  position: { x: number; y: number };
  size: { width: number; height: number };
  dockPosition: DockPosition;
  isMaximized: boolean;
};

type ResizeHandle = 
  | 'top' | 'right' | 'bottom' | 'left'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
```

### Constants

```typescript
const DOCK_THRESHOLD = 50;  // pixels from edge
const MIN_SIZE = { width: 200, height: 150 };
const MAX_SIZE = { width: window.innerWidth * 0.8, height: window.innerHeight * 0.8 };
const DEFAULT_SIZE = { width: 400, height: 300 };
const DEFAULT_POSITION = { x: 100, y: 100 };
```

## Contributing

When modifying this component:
1. Maintain TypeScript types
2. Test all resize handles
3. Test all dock positions
4. Verify state persistence
5. Check animations are smooth
6. Update this README

## License

Part of the ZenMocap/K_OS project.
