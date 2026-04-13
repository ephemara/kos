# 2D Layer System

Layer management components optimized for 2D canvas and painting applications.

## Overview

The 2D layer system provides a complete UI for managing layers in 2D canvas applications like digital painting tools, image editors, and drawing apps. It's built on top of the universal layer system from `shared/systems/layers` but optimized for 2D workflows.

## Components

### LayerPanel2D

A layer panel component tailored for 2D canvas applications with features like:

- **Layer visibility controls** - Show/hide layers
- **Layer locking** - Prevent accidental edits
- **Opacity controls** - Adjust layer transparency
- **Blend modes** - Canvas 2D composite operations
- **Drag-and-drop reordering** - Rearrange layer stack
- **Layer duplication** - Quick layer copying
- **Custom thumbnails** - Show canvas previews
- **Themeable** - Multiple accent colors

## Usage

### Basic Example

```tsx
import { useLayerManager } from '@/shared/systems/layers';
import { LayerPanel2D } from '@/two-d/systems/layers-2d';

function MyPaintApp() {
  const { manager, layers, activeLayerId } = useLayerManager({
    autoAddDefaultLayer: true,
    defaultLayerName: 'Background'
  });

  return (
    <div className="flex h-screen">
      {/* Canvas area */}
      <div className="flex-1">
        <Canvas layers={layers} activeLayerId={activeLayerId} />
      </div>

      {/* Layer panel */}
      <div className="w-64 border-l border-gray-800">
        <LayerPanel2D
          manager={manager}
          onLayerSelect={(layer) => console.log('Selected:', layer)}
          accentColor="rose"
        />
      </div>
    </div>
  );
}
```

### With Custom Thumbnails

```tsx
import { LayerPanel2D } from '@/two-d/systems/layers-2d';
import type { Layer } from '@/shared/systems/layers/LayerTypes';

function CanvasThumbnail({ layer }: { layer: Layer }) {
  // Render a thumbnail from your canvas data
  return (
    <img
      src={layer.thumbnail || '/placeholder.png'}
      alt={layer.name}
      className="w-full h-full object-cover"
    />
  );
}

function MyApp() {
  const { manager } = useLayerManager();

  return (
    <LayerPanel2D
      manager={manager}
      renderThumbnail={(layer) => <CanvasThumbnail layer={layer} />}
    />
  );
}
```

### With Blend Modes

```tsx
import { LayerPanel2D } from '@/two-d/systems/layers-2d';

function MyApp() {
  const { manager } = useLayerManager();

  const handleLayerUpdate = (layer: Layer) => {
    // Apply blend mode to canvas
    ctx.globalCompositeOperation = layer.blendMode;
    ctx.globalAlpha = layer.opacity;
    // ... render layer
  };

  return (
    <LayerPanel2D
      manager={manager}
      onLayerUpdate={handleLayerUpdate}
      showBlendModes={true}
    />
  );
}
```

### Compact Mode

```tsx
<LayerPanel2D
  manager={manager}
  compact={true}
  title="LAYERS"
/>
```

## Props

### LayerPanel2D Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `manager` | `LayerManager` | required | The layer manager instance |
| `onLayerSelect` | `(layer: Layer) => void` | - | Callback when layer is selected |
| `onLayerUpdate` | `(layer: Layer) => void` | - | Callback when layer is updated |
| `renderThumbnail` | `(layer: Layer) => ReactNode` | - | Custom thumbnail renderer |
| `accentColor` | `'blue' \| 'orange' \| 'rose' \| 'emerald' \| 'purple' \| 'cyan'` | `'rose'` | Accent color for highlights |
| `title` | `string` | `'LAYERS'` | Panel title |
| `showAddButton` | `boolean` | `true` | Show add layer button |
| `compact` | `boolean` | `false` | Compact mode for smaller panels |
| `showBlendModes` | `boolean` | `true` | Show blend mode controls |
| `showAdvancedControls` | `boolean` | `true` | Show duplicate/merge controls |

## Blend Modes

The 2D layer system supports standard Canvas 2D composite operations:

- **normal** - Standard alpha blending
- **multiply** - Multiply colors (darkens)
- **screen** - Screen colors (lightens)
- **overlay** - Combination of multiply and screen
- **add** - Additive blending (brightens)
- **subtract** - Subtractive blending (darkens)
- **difference** - Absolute difference between colors

These map directly to Canvas 2D `globalCompositeOperation` values.

## Integration with Canvas

### Rendering Layers

```tsx
function renderLayers(
  ctx: CanvasRenderingContext2D,
  layers: Layer[]
) {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Render each visible layer
  layers.forEach(layer => {
    if (!layer.visible) return;

    // Apply layer properties
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode;

    // Draw layer content
    drawLayerContent(ctx, layer);
  });

  // Reset context
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
```

### Generating Thumbnails

```tsx
function generateThumbnail(
  layer: Layer,
  size: number = 64
): string {
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = size;
  thumbCanvas.height = size;
  const thumbCtx = thumbCanvas.getContext('2d')!;

  // Draw layer content scaled down
  drawLayerContent(thumbCtx, layer, size);

  // Return data URL
  return thumbCanvas.toDataURL();
}

// Update layer with thumbnail
manager.updateLayer(layer.id, {
  thumbnail: generateThumbnail(layer)
});
```

## Keyboard Shortcuts

The layer panel supports common keyboard shortcuts:

- **Double-click layer** - Rename layer
- **Enter** - Confirm rename
- **Escape** - Cancel rename
- **Delete** - Delete selected layer (when implemented)

## Styling

The layer panel uses Tailwind CSS and CSS variables for theming. You can customize colors by overriding the accent color prop or by modifying the theme variables.

## Differences from 3D Layer Panel

The 2D layer panel differs from the 3D version (`three-d/systems/layers-3d/UniversalLayerPanel`) in several ways:

1. **Blend modes** - Uses Canvas 2D composite operations instead of Three.js blend modes
2. **Thumbnails** - Optimized for canvas image data instead of 3D renders
3. **Controls** - Includes 2D-specific features like clipping masks (future)
4. **Styling** - Different default accent color (rose vs blue)
5. **Footer** - Shows "2D CANVAS" instead of "3D SCENE"

## Future Enhancements

Planned features for the 2D layer system:

- [ ] Layer groups/folders
- [ ] Clipping masks
- [ ] Layer effects (drop shadow, glow, etc.)
- [ ] Layer styles (stroke, fill, etc.)
- [ ] Adjustment layers
- [ ] Smart objects
- [ ] Layer comps/snapshots
- [ ] Drag-and-drop file import

## Related

- **Universal Layer System** - `shared/systems/layers/` - Core layer management
- **3D Layer Panel** - `three-d/systems/layers-3d/` - 3D-specific layer panel
- **Layer Types** - `shared/systems/layers/LayerTypes.ts` - Type definitions
- **Layer Manager** - `shared/systems/layers/LayerManager.ts` - Layer management class
- **useLayerManager Hook** - `shared/systems/layers/useLayerManager.ts` - React hook

## Examples

See the following examples for complete implementations:

- **Graphos** - `two-d/examples/graphos/` - Digital painting app with layers
- **2D Template** - `features/template/` - Basic 2D starter template

## License

Part of the K_OS Hybrid Template System.
