# K_OS DCC UI Component Library

Enhanced UI components optimized for DCC (Digital Content Creation) workflows. All components follow the K_OS design system and are built with Radix UI primitives + Tailwind CSS.

## Components

### NumericInput

Drag-to-change numeric input with precision control.

**Features:**
- Click and drag horizontally to change value continuously
- Double-click to type exact value
- Automatic clamping to min/max bounds
- Configurable precision for display
- Keyboard support (arrow keys, enter)

**Validates:** Requirements 9.1, 9.2

**Usage:**
```tsx
import { NumericInput } from '@/ui/dcc';

<NumericInput
  value={10.5}
  onChange={(value) => console.log(value)}
  min={0}
  max={100}
  step={0.1}
  precision={2}
  label="Intensity"
/>
```

### VectorInput

Multi-component vector input for Vec2/Vec3/Vec4.

**Features:**
- Separate controls for each component
- Automatic component count detection (2, 3, or 4)
- Default labels (X, Y, Z, W) or custom labels
- Color-coded labels for visual clarity (X=red, Y=green, Z=blue, W=white)
- Synchronized min/max/step/precision across components

**Validates:** Requirement 9.3

**Usage:**
```tsx
import { VectorInput } from '@/ui/dcc';

<VectorInput
  value={[1.0, 2.0, 3.0]}
  onChange={(value) => console.log(value)}
  min={-10}
  max={10}
  step={0.1}
  precision={2}
/>
```

### ColorPicker

Color picker with swatches and alpha support.

**Features:**
- Visual color preview
- Popover picker with HSV/RGB controls
- Optional alpha channel
- Preset color swatches
- Hex input for precise values

**Validates:** Requirement 9.4

**Usage:**
```tsx
import { ColorPicker, Color } from '@/ui/dcc';

const [color, setColor] = useState<Color>({ r: 255, g: 0, b: 0, a: 1 });

<ColorPicker
  value={color}
  onChange={setColor}
  showAlpha={true}
  swatches={[
    { r: 255, g: 0, b: 0, a: 1 },
    { r: 0, g: 255, b: 0, a: 1 },
    { r: 0, g: 0, b: 255, a: 1 },
  ]}
/>
```

### CurveEditor

Bezier curve editor with control points.

**Features:**
- Add control points by clicking
- Move control points by dragging
- Remove control points (right-click or delete key)
- Multiple interpolation modes (linear, smooth, step)
- Grid overlay for precision
- Value display on hover

**Validates:** Requirement 9.5

**Usage:**
```tsx
import { CurveEditor, Curve } from '@/ui/dcc';

const [curve, setCurve] = useState<Curve>({
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
  interpolation: 'smooth',
});

<CurveEditor
  curve={curve}
  onChange={setCurve}
  width={400}
  height={200}
  gridLines={4}
  showValues={true}
/>
```

### GradientEditor

Gradient editor with color stops.

**Features:**
- Add color stops by clicking on the gradient bar
- Move color stops by dragging
- Remove color stops (right-click or delete key)
- Edit stop colors with integrated color picker
- Visual gradient preview
- Automatic sorting by position

**Validates:** Requirement 9.6

**Usage:**
```tsx
import { GradientEditor, Gradient } from '@/ui/dcc';

const [gradient, setGradient] = useState<Gradient>({
  stops: [
    { position: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 255, g: 255, b: 255, a: 1 } },
  ],
});

<GradientEditor
  gradient={gradient}
  onChange={setGradient}
  width={300}
  height={40}
/>
```

### NodeGraph

Node-based graph editor using @xyflow/react.

**Features:**
- Add nodes programmatically or via UI
- Create connections by dragging between node handles
- Move and arrange nodes freely
- Automatic layout support
- Minimap for navigation
- Zoom and pan controls
- Custom node and edge types
- Connection validation

**Validates:** Requirement 9.7

**Usage:**
```tsx
import { NodeGraph, defaultNodeTypes } from '@/ui/dcc';
import { Node, Edge } from '@xyflow/react';

const [nodes, setNodes] = useState<Node[]>([
  {
    id: '1',
    type: 'input',
    position: { x: 0, y: 0 },
    data: { label: 'Input Node' },
  },
  {
    id: '2',
    type: 'output',
    position: { x: 300, y: 0 },
    data: { label: 'Output Node' },
  },
]);

const [edges, setEdges] = useState<Edge[]>([
  { id: 'e1-2', source: '1', target: '2' },
]);

<NodeGraph
  nodes={nodes}
  edges={edges}
  onNodesChange={setNodes}
  onEdgesChange={setEdges}
  nodeTypes={defaultNodeTypes}
  showMinimap={true}
  showControls={true}
  showBackground={true}
/>
```

## Design System Integration

All components follow the K_OS design system:

- **Colors:** Use CSS custom properties (`var(--kos-*)`)
- **Typography:** 11px-12px font sizes, monospace for numeric values
- **Spacing:** Consistent gap and padding using Tailwind utilities
- **Borders:** Subtle borders with hover states
- **Interactions:** Smooth transitions, visual feedback on hover/active
- **Accessibility:** Keyboard navigation, ARIA labels, focus indicators

## Common Patterns

### Drag-to-Change

NumericInput and GradientEditor use drag-to-change interaction:
- Mouse down starts drag
- Mouse move updates value continuously
- Mouse up ends drag
- Cursor changes to `ew-resize` during drag

### Double-Click to Edit

NumericInput supports double-click to enter text edit mode:
- Double-click activates input field
- Enter commits changes
- Escape cancels changes

### Right-Click to Delete

CurveEditor and GradientEditor support right-click to delete:
- Right-click on control point/stop to remove
- Minimum 2 points/stops enforced

### Color Coding

VectorInput uses color-coded labels:
- X component: Red
- Y component: Green
- Z component: Blue
- W component: White

## Performance Considerations

- **Canvas Rendering:** CurveEditor and GradientEditor use canvas for efficient rendering
- **Debouncing:** Consider debouncing onChange callbacks for expensive operations
- **Memoization:** Use React.memo for components that don't need frequent re-renders
- **Virtual Scrolling:** NodeGraph uses @xyflow/react's built-in optimization

## Accessibility

All components support:
- Keyboard navigation (Tab, Arrow keys, Enter, Escape)
- Focus indicators (ring on focus-visible)
- ARIA labels and roles
- Screen reader compatibility
- Disabled states with visual feedback

## Testing

Components should be tested for:
- Value clamping (NumericInput, VectorInput)
- Drag interactions (NumericInput, CurveEditor, GradientEditor)
- Color interpolation (GradientEditor)
- Node connections (NodeGraph)
- Keyboard shortcuts
- Edge cases (min/max bounds, empty states)

## Future Enhancements

Potential improvements:
- **NumericInput:** Expression evaluation (e.g., "10 * 2")
- **VectorInput:** Lock/link components for uniform scaling
- **ColorPicker:** Color palette management, recent colors
- **CurveEditor:** Bezier handle controls, curve presets
- **GradientEditor:** Gradient presets, angle/radial gradients
- **NodeGraph:** Auto-layout algorithms, node search, undo/redo
