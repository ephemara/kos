# Universal Layer System

A complete, production-ready layer management system that works across all application types (2D, 3D, and beyond). This system provides the core data structures, business logic, and React hooks needed to implement professional layer management in any application.

## Architecture Overview

The Universal Layer System is split into three parts:

```
shared/systems/layers/          # Universal core (dimension-agnostic)
├── LayerTypes.ts               # Type definitions
├── LayerManager.ts             # Business logic
├── useLayerManager.ts          # React hook
└── README.md                   # This file

two-d/systems/layers-2d/        # 2D-specific UI
├── LayerPanel2D.tsx            # 2D layer panel component
└── README.md                   # 2D usage guide

three-d/systems/layers-3d/      # 3D-specific UI
├── UniversalLayerPanel.tsx     # 3D layer panel component
└── README.md                   # 3D usage guide
```

**Key Principle**: The core system (`shared/systems/layers/`) is dimension-agnostic. It provides the data structures and logic that work for any application. The dimension-specific panels (`two-d/` and `three-d/`) provide UI components tailored to their respective use cases.

## Core Components

### 1. LayerTypes.ts

Defines the universal layer data structure and related types:

```typescript
export interface Layer {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  visible: boolean;              // Visibility toggle
  opacity: number;               // 0.0 to 1.0
  locked?: boolean;              // Prevent editing
  blendMode?: BlendMode;         // Compositing mode
  parentId?: string | null;      // For layer groups
  order: number;                 // Stack order (higher = on top)
  
  // Optional metadata
  thumbnail?: string;            // Base64 or URL
  color?: string;                // Color label (hex)
  metadata?: Record<string, any>; // Custom data
}

export type BlendMode = 
  | 'normal' | 'multiply' | 'screen' | 'overlay' 
  | 'add' | 'subtract' | 'darken' | 'lighten';

export interface LayerEvent {
  type: 'add' | 'remove' | 'update' | 'reorder' | 'select';
  layerId?: string;
  layer?: Layer;
  layers?: Layer[];
}
```

### 2. LayerManager.ts

The core business logic class that manages layer operations:

```typescript
export class LayerManager {
  // Core Operations
  addLayer(layer: Partial<Layer>): Layer
  removeLayer(id: string): void
  updateLayer(id: string, updates: Partial<Layer>): void
  
  // Selection
  setActiveLayer(id: string | null): void
  getActiveLayer(): Layer | null
  
  // Visibility
  toggleVisibility(id: string): void
  setVisibility(id: string, visible: boolean): void
  soloLayer(id: string): void  // Show only this layer
  
  // Ordering
  reorderLayer(id: string, newOrder: number): void
  moveLayerUp(id: string): void
  moveLayerDown(id: string): void
  
  // Queries
  getLayer(id: string): Layer | null
  getLayers(): Layer[]
  getVisibleLayers(): Layer[]
  getLayersByParent(parentId: string | null): Layer[]
  
  // Events
  on(event: string, callback: (data: LayerEvent) => void): void
  off(event: string, callback: (data: LayerEvent) => void): void
  emit(event: string, data: LayerEvent): void
}
```

**Key Features**:
- Event-driven architecture for reactive updates
- Automatic order management
- Parent-child relationships for layer groups
- Type-safe operations
- Immutable updates (returns new layer objects)

### 3. useLayerManager.ts

React hook that provides layer management with state synchronization:

```typescript
export function useLayerManager(options?: {
  initialLayers?: Layer[];
  onLayerChange?: (layers: Layer[]) => void;
  onActiveLayerChange?: (layer: Layer | null) => void;
}): {
  // State
  layers: Layer[];
  activeLayerId: string | null;
  activeLayer: Layer | null;
  
  // Operations
  addLayer: (layer: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  setActiveLayer: (id: string | null) => void;
  
  // Visibility
  toggleVisibility: (id: string) => void;
  setVisibility: (id: string, visible: boolean) => void;
  soloLayer: (id: string) => void;
  
  // Ordering
  reorderLayer: (id: string, newOrder: number) => void;
  moveLayerUp: (id: string) => void;
  moveLayerDown: (id: string) => void;
  
  // Queries
  getLayer: (id: string) => Layer | null;
  getVisibleLayers: () => Layer[];
  
  // Manager instance (for advanced use)
  manager: LayerManager;
}
```

## Usage Examples

### Basic Setup

```typescript
import { useLayerManager } from '@/shared/systems/layers';

function MyApp() {
  const layerManager = useLayerManager({
    initialLayers: [
      { name: 'Background', visible: true, opacity: 1.0 }
    ],
    onLayerChange: (layers) => {
      console.log('Layers updated:', layers);
    }
  });
  
  return (
    <div>
      <button onClick={() => layerManager.addLayer({ name: 'New Layer' })}>
        Add Layer
      </button>
      
      {layerManager.layers.map(layer => (
        <div key={layer.id}>
          {layer.name} - {layer.visible ? 'Visible' : 'Hidden'}
        </div>
      ))}
    </div>
  );
}
```

### With 2D Layer Panel

```typescript
import { useLayerManager } from '@/shared/systems/layers';
import { LayerPanel2D } from '@/two-d/systems/layers-2d';

function My2DApp() {
  const layerManager = useLayerManager();
  
  return (
    <LayerPanel2D
      layers={layerManager.layers}
      activeLayerId={layerManager.activeLayerId}
      onSelect={layerManager.setActiveLayer}
      onToggleVisibility={layerManager.toggleVisibility}
      onDelete={layerManager.removeLayer}
      onAdd={() => layerManager.addLayer({ name: 'New Layer' })}
      features={{
        add: true,
        visibility: true,
        delete: true,
        opacity: true,
        solo: true
      }}
      accentColor="rose"
    />
  );
}
```

### With 3D Layer Panel

```typescript
import { useLayerManager } from '@/shared/systems/layers';
import { UniversalLayerPanel } from '@/three-d/systems/layers-3d';

function My3DApp() {
  const layerManager = useLayerManager();
  
  return (
    <UniversalLayerPanel
      layers={layerManager.layers}
      activeLayerId={layerManager.activeLayerId}
      onSelect={layerManager.setActiveLayer}
      onToggleVisibility={layerManager.toggleVisibility}
      onDelete={layerManager.removeLayer}
      onAdd={() => layerManager.addLayer({ name: 'New Layer' })}
      features={{
        add: true,
        visibility: true,
        delete: true,
        lock: true,
        solo: true,
        reorder: true,
        thumbnails: true
      }}
      accentColor="blue"
    />
  );
}
```

### Advanced: Custom Layer Operations

```typescript
import { useLayerManager } from '@/shared/systems/layers';

function AdvancedLayerApp() {
  const layerManager = useLayerManager();
  
  // Listen to layer events
  useEffect(() => {
    const handleLayerAdd = (event: LayerEvent) => {
      console.log('Layer added:', event.layer);
    };
    
    layerManager.manager.on('add', handleLayerAdd);
    return () => layerManager.manager.off('add', handleLayerAdd);
  }, [layerManager.manager]);
  
  // Merge layers
  const mergeLayers = (sourceId: string, targetId: string) => {
    const source = layerManager.getLayer(sourceId);
    const target = layerManager.getLayer(targetId);
    
    if (source && target) {
      // Your merge logic here
      layerManager.removeLayer(sourceId);
      layerManager.updateLayer(targetId, {
        name: `${target.name} + ${source.name}`
      });
    }
  };
  
  // Duplicate layer
  const duplicateLayer = (id: string) => {
    const layer = layerManager.getLayer(id);
    if (layer) {
      layerManager.addLayer({
        name: `${layer.name} Copy`,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode
      });
    }
  };
  
  return (
    <div>
      {/* Your UI */}
    </div>
  );
}
```

### Custom Metadata

```typescript
// Add custom metadata to layers
layerManager.addLayer({
  name: 'Sculpt Layer',
  metadata: {
    polyCount: 150000,
    subdivisionLevel: 3,
    brushType: 'clay'
  }
});

// Access metadata
const layer = layerManager.getLayer(layerId);
if (layer?.metadata) {
  console.log('Poly count:', layer.metadata.polyCount);
}
```

## Event System

The LayerManager emits events for all operations:

```typescript
const manager = new LayerManager();

// Listen to events
manager.on('add', (event) => {
  console.log('Layer added:', event.layer);
});

manager.on('remove', (event) => {
  console.log('Layer removed:', event.layerId);
});

manager.on('update', (event) => {
  console.log('Layer updated:', event.layer);
});

manager.on('reorder', (event) => {
  console.log('Layers reordered:', event.layers);
});

manager.on('select', (event) => {
  console.log('Layer selected:', event.layerId);
});
```

## Integration with Existing Systems

### Paint System Integration

```typescript
import { useLayerManager } from '@/shared/systems/layers';
import { PaintEngine } from '@/features/paint/engine/PaintSystem';

function PaintApp() {
  const layerManager = useLayerManager();
  const paintEngineRef = useRef<PaintEngine>();
  
  // Sync layers with paint engine
  useEffect(() => {
    if (!paintEngineRef.current) return;
    
    const engine = paintEngineRef.current;
    
    // Add layer to paint engine when added to manager
    const handleAdd = (event: LayerEvent) => {
      if (event.layer) {
        engine.addPaintLayer(event.layer.id, event.layer.name);
      }
    };
    
    // Remove from paint engine when removed from manager
    const handleRemove = (event: LayerEvent) => {
      if (event.layerId) {
        engine.removePaintLayer(event.layerId);
      }
    };
    
    layerManager.manager.on('add', handleAdd);
    layerManager.manager.on('remove', handleRemove);
    
    return () => {
      layerManager.manager.off('add', handleAdd);
      layerManager.manager.off('remove', handleRemove);
    };
  }, [layerManager.manager]);
  
  return (
    <div>
      {/* Your paint UI */}
    </div>
  );
}
```

### Graphos Integration

```typescript
import { useLayerManager } from '@/shared/systems/layers';
import { GraphosEngine } from '@/two-d/examples/graphos/KGraphosEngine';

function GraphosApp() {
  const layerManager = useLayerManager();
  const engineRef = useRef<GraphosEngine>();
  
  // Sync visibility changes
  useEffect(() => {
    const handleUpdate = (event: LayerEvent) => {
      if (event.layer && engineRef.current) {
        const engineLayer = engineRef.current.getLayer(event.layer.id);
        if (engineLayer) {
          engineLayer.visible = event.layer.visible;
          engineLayer.opacity = event.layer.opacity;
          engineRef.current.compose();
        }
      }
    };
    
    layerManager.manager.on('update', handleUpdate);
    return () => layerManager.manager.off('update', handleUpdate);
  }, [layerManager.manager]);
  
  return (
    <div>
      {/* Your Graphos UI */}
    </div>
  );
}
```

## Best Practices

### 1. Use the Hook for React Components

Always use `useLayerManager` in React components instead of creating `LayerManager` instances directly:

```typescript
// ✅ Good
const layerManager = useLayerManager();

// ❌ Bad
const manager = new LayerManager();
```

### 2. Provide Initial Layers

Initialize with at least one layer for better UX:

```typescript
const layerManager = useLayerManager({
  initialLayers: [
    { name: 'Background', visible: true, opacity: 1.0 }
  ]
});
```

### 3. Use Callbacks for Side Effects

Use the callback options to sync with external systems:

```typescript
const layerManager = useLayerManager({
  onLayerChange: (layers) => {
    // Sync with backend, save to localStorage, etc.
    saveLayersToBackend(layers);
  },
  onActiveLayerChange: (layer) => {
    // Update UI, focus viewport, etc.
    if (layer) {
      focusLayer(layer.id);
    }
  }
});
```

### 4. Clean Up Event Listeners

Always clean up event listeners in useEffect:

```typescript
useEffect(() => {
  const handler = (event: LayerEvent) => {
    // Handle event
  };
  
  layerManager.manager.on('add', handler);
  return () => layerManager.manager.off('add', handler);
}, [layerManager.manager]);
```

### 5. Use Metadata for Custom Data

Store application-specific data in the metadata field:

```typescript
layerManager.addLayer({
  name: 'Custom Layer',
  metadata: {
    // Your custom data
    customField: 'value',
    nestedData: { foo: 'bar' }
  }
});
```

## Dimension-Specific Panels

### 2D Panel (LayerPanel2D)

Optimized for 2D canvas applications:
- Compact design for canvas workflows
- Focus on painting and drawing features
- Optimized for large layer counts
- See: `two-d/systems/layers-2d/README.md`

### 3D Panel (UniversalLayerPanel)

Feature-rich panel for 3D applications:
- Thumbnails for 3D objects
- Poly count display
- Material indicators
- Advanced features (groups, reordering, etc.)
- See: `three-d/systems/layers-3d/README.md`

## Migration Guide

### From Old UniversalLayerPanel

If you're using the old `@/ui/layers/UniversalLayerPanel`:

```typescript
// Old
import { UniversalLayerPanel } from '@/ui/layers';

// New (3D)
import { UniversalLayerPanel } from '@/three-d/systems/layers-3d';
import { useLayerManager } from '@/shared/systems/layers';

// New (2D)
import { LayerPanel2D } from '@/two-d/systems/layers-2d';
import { useLayerManager } from '@/shared/systems/layers';
```

The API is mostly compatible, but now you should use `useLayerManager` for state management.

## Performance Considerations

### Large Layer Counts

The system is optimized for hundreds of layers:
- Efficient reordering with order numbers (no array manipulation)
- Event batching for bulk operations
- Memoized queries and filters

### Memory Management

Layers are lightweight objects. For applications with many layers:
- Use thumbnails sparingly (they increase memory usage)
- Clean up metadata when layers are removed
- Consider pagination for very large layer counts (1000+)

### React Rendering

The hook uses React state, so updates trigger re-renders:
- Use `React.memo` for layer list items
- Avoid inline functions in render
- Use callbacks for expensive operations

## Testing

### Unit Tests

```typescript
import { LayerManager } from '@/shared/systems/layers';

describe('LayerManager', () => {
  it('should add a layer', () => {
    const manager = new LayerManager();
    const layer = manager.addLayer({ name: 'Test' });
    
    expect(manager.getLayers()).toHaveLength(1);
    expect(layer.name).toBe('Test');
  });
  
  it('should reorder layers', () => {
    const manager = new LayerManager();
    const layer1 = manager.addLayer({ name: 'Layer 1' });
    const layer2 = manager.addLayer({ name: 'Layer 2' });
    
    manager.reorderLayer(layer1.id, 2);
    
    const layers = manager.getLayers();
    expect(layers[0].id).toBe(layer2.id);
    expect(layers[1].id).toBe(layer1.id);
  });
});
```

### Integration Tests

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useLayerManager } from '@/shared/systems/layers';

describe('useLayerManager', () => {
  it('should manage layer state', () => {
    const { result } = renderHook(() => useLayerManager());
    
    act(() => {
      result.current.addLayer({ name: 'Test Layer' });
    });
    
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.layers[0].name).toBe('Test Layer');
  });
});
```

## API Reference

See individual files for detailed API documentation:
- `LayerTypes.ts` - Type definitions
- `LayerManager.ts` - Core business logic
- `useLayerManager.ts` - React hook

## Contributing

When extending the layer system:

1. Keep the core (`shared/systems/layers/`) dimension-agnostic
2. Add dimension-specific features to the appropriate panel
3. Use events for loose coupling
4. Document new features in this README
5. Add tests for new functionality

## Examples

See working examples in:
- `three-d/examples/paint/` - 3D painting with layers
- `two-d/examples/graphos/` - 2D canvas with layers
- `three-d/examples/sculpting/` - 3D sculpting with layers (future)

## License

Part of the K_OS Template System - MIT License
