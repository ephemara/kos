# 2D Systems & Applications

This directory contains everything related to 2D canvas applications, digital painting, image editing, and 2D creative tools.

## Directory Structure

```
two-d/
├── services/          # 2D-specific backend services
├── systems/           # 2D systems (brush, layers, canvas)
├── examples/          # 2D example applications
└── template/          # 2D starter template (coming soon)
```

## Overview

The 2D directory is designed for building canvas-based applications like:
- Digital painting tools
- Image editors
- 2D animation software
- Procedural texture generators
- Node-based compositing tools

## Import Boundary Rules

**CRITICAL**: Files in `two-d/` **CANNOT** import Three.js or any 3D libraries:
- ❌ `three`
- ❌ `@react-three/fiber`
- ❌ `@react-three/drei`
- ❌ Any Three.js-related packages

This boundary is enforced at build time to keep 2D applications lightweight and prevent unnecessary dependencies.

**Allowed Imports**:
- ✅ `@/shared/*` - Universal components and systems
- ✅ `@/two-d/*` - Other 2D modules
- ✅ Standard React, TypeScript, and utility libraries

## Services

2D-specific services for backend integration:

### `noiseClient.ts`
GPU-accelerated noise generation for procedural textures.

```typescript
import { noiseService } from '@/two-d/services/noiseClient';

const noiseData = await noiseService.generateNoise({
  width: 512,
  height: 512,
  type: 'simplex',
  octaves: 4,
  frequency: 2.0
});
```

### `proceduralClient.ts`
Procedural texture and pattern generation.

```typescript
import { proceduralService } from '@/two-d/services/proceduralClient';

const texture = await proceduralService.generatePattern({
  type: 'voronoi',
  resolution: 1024,
  seed: 12345
});
```

## Systems

### `brush-2d/`
2D brush engine for digital painting:
- Pressure-sensitive strokes
- Brush dynamics (size, opacity, flow)
- Texture brushes
- Blend modes

### `layers-2d/`
2D layer management system:
- Layer stack with blend modes
- Opacity and visibility controls
- Layer groups and organization
- Thumbnail generation

## Examples

### `graphos/`
Node-based procedural texture generator:
- Visual node editor
- Real-time preview
- Export to various formats
- Shader-based processing

## Creating a 2D Application

### 1. Start with the Template

```typescript
// two-d/examples/my-app/MyApp.tsx
import { AppShell } from '@/shared/shell';
import { Button, Slider } from '@/shared/primitives';
import { noiseService } from '@/two-d/services/noiseClient';

export const MyApp: React.FC = () => {
  return (
    <AppShell>
      <ToolPanel>
        {/* Your 2D tools */}
      </ToolPanel>
      <Canvas>
        {/* Your 2D canvas */}
      </Canvas>
    </AppShell>
  );
};
```

### 2. Use 2D Systems

```typescript
import { useBrush2D } from '@/two-d/systems/brush-2d';
import { useLayerManager } from '@/two-d/systems/layers-2d';

const brush = useBrush2D();
const layers = useLayerManager();
```

### 3. Register Your Module

```typescript
// shared/config/modules.manifest.ts
{
  id: 'my-2d-app',
  name: 'My 2D App',
  category: '2d',
  entryComponent: lazy(() => import('@/two-d/examples/my-app')),
  requiredCapabilities: ['canvas']
}
```

## Canvas Best Practices

### Use OffscreenCanvas for Performance

```typescript
const canvas = document.createElement('canvas');
const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker('./canvas-worker.ts');
worker.postMessage({ canvas: offscreen }, [offscreen]);
```

### Implement Efficient Rendering

```typescript
// Only redraw when needed
let needsRedraw = false;

function render() {
  if (!needsRedraw) return;
  
  ctx.clearRect(0, 0, width, height);
  // Draw your content
  
  needsRedraw = false;
}

requestAnimationFrame(render);
```

### Handle High-DPI Displays

```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
ctx.scale(dpr, dpr);
```

## Shader Integration

2D applications can use shaders from the shader library:

```typescript
import { SIMPLEX_NOISE } from '@/shaders/utils/noise';
import { BLUR_FILTER } from '@/shaders/two-d/filters';

// Use in WebGL context
const fragmentShader = `
  ${SIMPLEX_NOISE}
  ${BLUR_FILTER}
  
  void main() {
    // Your shader code
  }
`;
```

## State Management

### Local State
Use React hooks for component-specific state:

```typescript
const [brushSize, setBrushSize] = useState(10);
const [color, setColor] = useState('#000000');
```

### Global State
Use Zustand for app-wide state:

```typescript
import { create } from 'zustand';

interface CanvasState {
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (zoom: number) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  zoom: 1,
  pan: { x: 0, y: 0 },
  setZoom: (zoom) => set({ zoom })
}));
```

## Performance Tips

1. **Batch Canvas Operations**: Group multiple draw calls together
2. **Use Layers**: Separate static and dynamic content
3. **Implement Dirty Rectangles**: Only redraw changed regions
4. **Offload to Workers**: Use Web Workers for heavy computations
5. **Cache Rendered Content**: Store frequently used elements
6. **Optimize Image Loading**: Use appropriate formats and sizes

## Testing

### Unit Tests
Test individual functions and utilities:

```typescript
describe('Brush2D', () => {
  it('should apply pressure to brush size', () => {
    const brush = createBrush({ size: 10 });
    const result = brush.applyPressure(0.5);
    expect(result.size).toBe(5);
  });
});
```

### Integration Tests
Test system interactions:

```typescript
describe('Layer System', () => {
  it('should composite layers correctly', () => {
    const manager = createLayerManager();
    manager.addLayer({ name: 'Base' });
    manager.addLayer({ name: 'Overlay', blendMode: 'multiply' });
    
    const result = manager.composite();
    expect(result).toBeDefined();
  });
});
```

## Common Patterns

### Brush Stroke Recording

```typescript
interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

const recordStroke = (points: StrokePoint[]) => {
  // Store for undo/redo
  strokeHistory.push(points);
};
```

### Layer Compositing

```typescript
const compositeLayer = (
  base: ImageData,
  overlay: ImageData,
  blendMode: BlendMode,
  opacity: number
) => {
  const result = ctx.createImageData(base.width, base.height);
  
  for (let i = 0; i < base.data.length; i += 4) {
    // Apply blend mode and opacity
    result.data[i] = blend(base.data[i], overlay.data[i], blendMode, opacity);
    // ... RGB channels
  }
  
  return result;
};
```

### Undo/Redo System

```typescript
class HistoryManager {
  private history: ImageData[] = [];
  private currentIndex = -1;
  
  snapshot(data: ImageData) {
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(data);
    this.currentIndex++;
  }
  
  undo(): ImageData | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }
  
  redo(): ImageData | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }
}
```

## Resources

- [Canvas API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Shader Library](../shaders/README.md)
- [Shared Primitives](../shared/primitives/README.md)

## Contributing

When adding new 2D features:

1. Keep it 2D-only (no Three.js imports)
2. Use shared primitives for UI
3. Document your systems with README files
4. Add usage examples
5. Write tests for core functionality
6. Follow the existing patterns

## Migration Notes

If you're migrating from the old structure:
- Old `src/systems/canvas/` → `two-d/systems/`
- Old `src/apps/paint/` → `two-d/examples/`
- Old `src/services/2d/` → `two-d/services/`
