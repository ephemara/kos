# 3D Layer System

Universal layer panel component for 3D applications. Works with the `LayerManager` from `shared/systems/layers`.

## Overview

The `UniversalLayerPanel` provides a complete layer management UI for 3D applications with:

- **Visibility controls**: Show/hide layers
- **Lock controls**: Prevent layer editing
- **Solo mode**: Show only one layer
- **Drag-and-drop reordering**: Reorder layers in the stack
- **Opacity control**: Adjust layer transparency
- **Blend modes**: Control how layers composite
- **Custom thumbnails**: Render custom layer previews
- **Themeable**: Accent colors for branding

## Usage

### Basic Example

```tsx
import { useLayerManager } from '@/shared/systems/layers';
import { UniversalLayerPanel } from '@/three-d/systems/layers-3d';

function MyApp() {
  const { manager, layers, activeLayerId } = useLayerManager();

  return (
    <UniversalLayerPanel
      manager={manager}
      onLayerSelect={(layer) => console.log('Selected:', layer)}
      accentColor="blue"
    />
  );
}
```

### With Custom Thumbnails

```tsx
import { UniversalLayerPanel } from '@/three-d/systems/layers-3d';
import type { Layer } from '@/shared/systems/layers/LayerTypes';

function MyApp() {
  const { manager } = useLayerManager();

  const renderThumbnail = (layer: Layer) => {
    // Render custom thumbnail based on layer data
    return (
      <img
        src={layer.thumbnail || '/default-thumbnail.png'}
        alt={layer.name}
        className="w-full h-full object-cover"
      />
    );
  };

  return (
    <UniversalLayerPanel
      manager={manager}
      renderThumbnail={renderThumbnail}
      accentColor="orange"
    />
  );
}
```

### With Layer Update Callbacks

```tsx
import { UniversalLayerPanel } from '@/three-d/systems/layers-3d';

function MyApp() {
  const { manager } = useLayerManager();

  const handleLayerSelect = (layer: Layer) => {
    console.log('Layer selected:', layer.name);
    // Update 3D scene to show selected layer
  };

  const handleLayerUpdate = (layer: Layer) => {
    console.log('Layer updated:', layer);
    // Update 3D scene to reflect layer changes
  };

  return (
    <UniversalLayerPanel
      manager={manager}
      onLayerSelect={handleLayerSelect}
      onLayerUpdate={handleLayerUpdate}
      accentColor="emerald"
    />
  );
}
```

### Compact Mode

```tsx
<UniversalLayerPanel
  manager={manager}
  compact={true}
  title="MESHES"
  accentColor="purple"
/>
```

## Props

### UniversalLayerPanelProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `manager` | `LayerManager` | **required** | The LayerManager instance to control layers |
| `onLayerSelect` | `(layer: Layer) => void` | `undefined` | Callback when a layer is selected |
| `onLayerUpdate` | `(layer: Layer) => void` | `undefined` | Callback when a layer is updated |
| `renderThumbnail` | `(layer: Layer) => React.ReactNode` | `undefined` | Custom thumbnail renderer |
| `accentColor` | `'blue' \| 'orange' \| 'rose' \| 'emerald' \| 'purple' \| 'cyan'` | `'blue'` | Accent color for highlights |
| `title` | `string` | `'LAYERS'` | Panel title |
| `showAddButton` | `boolean` | `true` | Whether to show the add layer button |
| `compact` | `boolean` | `false` | Compact mode for smaller panels |

## Features

### Layer Controls

Each layer has the following controls:

- **Eye icon**: Toggle visibility
- **Lock icon**: Toggle lock state
- **Headphones icon**: Toggle solo mode
- **Drag handle**: Reorder layers
- **Up/Down arrows**: Move layer in stack
- **Trash icon**: Delete layer

### Active Layer Controls

When a layer is active (selected), additional controls appear:

- **Opacity slider**: Adjust layer opacity (0-100%)
- **Blend mode selector**: Choose blend mode (normal, multiply, screen, etc.)

### Layer Interactions

- **Single click**: Select layer
- **Double click**: Rename layer
- **Drag**: Reorder layers

## Integration with LayerManager

The panel works with the universal `LayerManager` from `shared/systems/layers`:

```tsx
import { LayerManager } from '@/shared/systems/layers/LayerManager';
import { useLayerManager } from '@/shared/systems/layers/useLayerManager';

// Option 1: Use the hook (recommended)
const { manager, layers, activeLayerId } = useLayerManager();

// Option 2: Create manager manually
const manager = new LayerManager();
manager.addLayer({ name: 'Background' });
manager.addLayer({ name: 'Foreground' });
```

## Styling

The panel uses CSS variables from the theme system:

- `--kos-surface-primary`: Background colors
- `--kos-border-primary`: Border colors
- `--kos-text-primary`: Text colors

Accent colors are applied to:
- Active layer highlight
- Solo button when active
- Opacity slider
- Blend mode selector

## Accessibility

- All buttons have `title` attributes for tooltips
- Keyboard navigation supported (Enter to rename, Escape to cancel)
- Focus states for all interactive elements
- Disabled states for unavailable actions

## Examples

See these examples for usage patterns:

- `three-d/examples/paint/` - 3D texture painting with layers
- `three-d/examples/sculpting/` - Sculpting with mesh layers
- `three-d/examples/greeble/` - Procedural detail with layers

## Related Systems

- `shared/systems/layers/` - Universal layer types and manager
- `two-d/systems/layers-2d/` - 2D-specific layer panel
- `shared/primitives/` - UI primitives used by the panel
