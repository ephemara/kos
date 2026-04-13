# Universal Brush System

The Universal Brush System provides a unified interface for all brush types across 2D and 3D applications. It unifies multiple brush systems that were previously scattered across the codebase:

- **3D sculpting brushes** (mesh deformation)
- **2D painting brushes** (canvas/texture painting)
- **Terrain brushes** (heightmap editing)
- **Procedural brushes** (noise-based, algorithmic)
- **Alpha brushes** (stamp-based with textures)

## Architecture

```
shared/systems/brush/
├── BrushTypes.ts          # Universal brush interfaces and types
├── AlphaBrush.ts          # Alpha texture system (stamp brushes)
├── ProceduralBrush.ts     # Procedural/noise-based brushes
├── KBrushEngine.ts        # Legacy brush engine (compatibility)
└── index.ts               # Main exports

three-d/systems/brush-3d/
├── Brush3DEngine.ts       # 3D sculpting engine
├── useBrush3D.ts          # React hook for 3D brushes
└── index.ts

two-d/systems/brush-2d/
├── Brush2DEngine.ts       # 2D painting engine
├── useBrush2D.ts          # React hook for 2D brushes
└── index.ts
```

## Core Concepts

### Brush Dimensions

Brushes are categorized by dimension:
- `2d` - Canvas painting, image editing
- `3d` - Mesh sculpting, 3D painting
- `terrain` - Heightmap editing
- `universal` - Works in any dimension

### Brush Categories

- `standard` - Classic brushes (clay, draw, smooth)
- `simulation` - Physics-based (fluid, erosion, gravity)
- `procedural` - Noise-based (perlin, voronoi, fbm)
- `alpha` - Stamp-based with alpha textures
- `paint` - Color painting brushes
- `sculpt` - Mesh deformation brushes
- `terrain` - Heightmap editing brushes
- `experimental` - Cutting-edge experimental brushes

### Brush Modes

- `add` - Add material/height
- `subtract` - Remove material/height
- `smooth` - Smooth/relax
- `flatten` - Flatten to plane
- `grab` - Move/grab vertices
- `pinch` - Pinch/pull
- `paint` - Apply color/texture
- `smudge` - Blend/smudge colors
- `clone` - Clone from source
- `fill` - Flood fill
- `noise` - Add noise
- `custom` - Custom operation

## Usage Examples

### 3D Sculpting

```typescript
import { useBrush3D } from '@/three-d/systems/brush-3d';
import { Sculpt3DBrushParams } from '@/shared/systems/brush';

function SculptingApp() {
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 128, 128), []);
  const { isReady, params, updateParams, applyDab } = useBrush3D(geometry);

  const handlePointerMove = async (event: PointerEvent) => {
    const raycaster = new THREE.Raycaster();
    // ... raycast to mesh
    
    if (intersection) {
      await applyDab(
        intersection.point,
        intersection.face.normal,
        event.pressure || 1.0
      );
    }
  };

  return (
    <mesh geometry={geometry} onPointerMove={handlePointerMove}>
      <meshStandardMaterial />
    </mesh>
  );
}
```

### 2D Painting

```typescript
import { useBrush2D } from '@/two-d/systems/brush-2d';
import { Paint2DBrushParams } from '@/shared/systems/brush';

function PaintingApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isReady, params, updateParams, startStroke, continueStroke, endStroke } = useBrush2D();

  useEffect(() => {
    if (canvasRef.current) {
      setCanvas(canvasRef.current);
    }
  }, []);

  const handlePointerDown = (e: PointerEvent) => {
    startStroke({
      position: new THREE.Vector2(e.offsetX, e.offsetY),
      pressure: e.pressure || 1.0,
      timestamp: Date.now(),
    });
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (e.buttons === 1) {
      continueStroke({
        position: new THREE.Vector2(e.offsetX, e.offsetY),
        pressure: e.pressure || 1.0,
        timestamp: Date.now(),
      });
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
    />
  );
}
```

### Alpha Textures

```typescript
import { useAlphaManager, PROCEDURAL_PRESETS } from '@/shared/systems/brush';

function BrushPanel() {
  const { currentAlpha, loadedAlphas, generateAlpha, setAlpha } = useAlphaManager();

  const handleGenerateAlpha = async () => {
    // Generate a soft round brush
    const alpha = await PROCEDURAL_PRESETS.softRound();
    console.log('Generated alpha:', alpha);
  };

  const handleLoadAlpha = async (file: File) => {
    const alpha = await loadAlphaFromFile2(file);
    console.log('Loaded alpha:', alpha);
  };

  return (
    <div>
      <h3>Current Alpha: {currentAlpha?.name || 'None'}</h3>
      <button onClick={handleGenerateAlpha}>Generate Soft Round</button>
      <input type="file" onChange={(e) => handleLoadAlpha(e.target.files[0])} />
    </div>
  );
}
```

### Procedural Brushes

```typescript
import { 
  generateProceduralBrush, 
  PROCEDURAL_BRUSH_PRESETS 
} from '@/shared/systems/brush';

// Generate a terrain-like brush
const terrainBrush = PROCEDURAL_BRUSH_PRESETS.terrain(256);

// Generate custom procedural brush
const customBrush = generateProceduralBrush({
  type: 'fbm',
  size: 512,
  scale: 8.0,
  octaves: 8,
  lacunarity: 2.0,
  gain: 0.5,
  seed: Date.now(),
});

// Use as intensity modulation
const modulatedIntensity = modulateBrushIntensity(
  baseIntensity,
  x,
  y,
  brushParams,
  {
    type: 'perlin',
    size: 256,
    scale: 4.0,
    seed: 12345,
  }
);
```

## Brush Parameters

### Base Parameters (All Brushes)

```typescript
interface BaseBrushParams {
  // Core settings
  size: number;              // Brush size (world units or pixels)
  strength: number;          // Intensity (0-1)
  opacity: number;           // Opacity (0-1)
  hardness: number;          // Falloff (0-1)
  spacing: number;           // Dab spacing (0-1)
  flow: number;              // Accumulation rate (0-1)

  // Alpha texture
  alpha: AlphaInfo | null;   // Alpha texture for modulation
  alphaRotation: number;     // Rotation in degrees
  alphaScale: number;        // Scale multiplier
  alphaTiling: AlphaTiling;  // Tiling mode

  // Dynamics
  sizeJitter: number;        // Size randomness (0-1)
  rotationJitter: number;    // Rotation randomness (0-1)
  scatterAmount: number;     // Position scatter (0-1)
  strengthJitter: number;    // Strength randomness (0-1)

  // Symmetry
  symmetry: SymmetryMode;    // Symmetry mode
  radialSegments?: number;   // Radial segment count

  // Blend mode
  blendMode: BlendMode;      // Blend mode
}
```

### 3D Sculpting Parameters

```typescript
interface Sculpt3DBrushParams extends BaseBrushParams {
  mode: BrushMode;           // Operation mode
  frontFacesOnly: boolean;   // Only affect front faces
  accumulate: boolean;       // Accumulate strokes
  invert: boolean;           // Invert operation
  useGpu: boolean;           // Use GPU acceleration
  flattenNormal?: Vector3;   // Flatten plane normal
  flattenHeight?: number;    // Flatten plane height
}
```

### 2D Painting Parameters

```typescript
interface Paint2DBrushParams extends BaseBrushParams {
  color: string;             // Brush color (hex)
  mode: BrushMode;           // Operation mode
  simulatePressure: boolean; // Simulate pressure
  smoothing: number;         // Stroke smoothing (0-1)
  streamline: number;        // Stroke stabilization (0-1)
  thinning: number;          // Pressure response (0-1)
  cloneSource?: {x, y};      // Clone source position
}
```

### Terrain Brush Parameters

```typescript
interface TerrainBrushParams extends BaseBrushParams {
  position: Vector2;         // UV space position (0-1)
  mode: BrushMode;           // Operation mode
  noiseSeed?: number;        // Noise seed
  noiseScale?: number;       // Noise scale
  noiseOctaves?: number;     // Noise octaves
  erosionType?: string;      // Erosion type
}
```

## Alpha Texture System

### Loading Alphas

```typescript
// From file path (Tauri only)
const alpha = await loadAlphaFromFile('/path/to/alpha.png', 'My Alpha');

// From base64 data
const alpha = await loadAlphaFromBase64(base64Data, 'My Alpha');

// From File object (browser)
const alpha = await loadAlphaFromFile2(fileObject);

// From URL
const alpha = await loadAlphaFromUrl('https://example.com/alpha.png');
```

### Procedural Alphas

```typescript
// Generate procedural alpha
const alpha = await generateProceduralAlpha('perlin', 256, {
  scale: 4,
  octaves: 4,
});

// Use presets
const softRound = await PROCEDURAL_PRESETS.softRound();
const hardRound = await PROCEDURAL_PRESETS.hardRound();
const perlinNoise = await PROCEDURAL_PRESETS.perlinNoise(4, 4);
const voronoiCells = await PROCEDURAL_PRESETS.voronoiCells(16, 0.1);
```

### Managing Alphas

```typescript
// List all loaded alphas
const alphas = await listAlphas();

// Get alpha info
const info = await getAlphaInfo(handle);

// Dispose alpha
await disposeAlpha(handle);
```

## Procedural Brush System

### Noise Types

- `perlin` - Classic Perlin noise
- `fbm` - Fractional Brownian Motion (layered noise)
- `turbulence` - Absolute value of fBm
- `voronoi` - Voronoi/Worley cells
- `cellular` - Cellular noise
- `ridged` - Ridged multifractal
- `billow` - Billowy clouds

### Generating Procedural Brushes

```typescript
// Generate intensity map
const intensityMap = generateProceduralBrush({
  type: 'fbm',
  size: 256,
  scale: 8.0,
  octaves: 8,
  lacunarity: 2.0,
  gain: 0.5,
  seed: Date.now(),
});

// Generate as ImageData (for canvas)
const imageData = generateProceduralBrushImageData(params);

// Generate as canvas
const canvas = generateProceduralBrushCanvas(params);
```

### Procedural Presets

```typescript
const organic = PROCEDURAL_BRUSH_PRESETS.organic(256);
const terrain = PROCEDURAL_BRUSH_PRESETS.terrain(256);
const chaos = PROCEDURAL_BRUSH_PRESETS.chaos(256);
const scales = PROCEDURAL_BRUSH_PRESETS.scales(256);
const ridged = PROCEDURAL_BRUSH_PRESETS.ridged(256);
const clouds = PROCEDURAL_BRUSH_PRESETS.clouds(256);
```

## Symmetry

Supported symmetry modes:
- `NONE` - No symmetry
- `X` - Mirror across X axis
- `Y` - Mirror across Y axis
- `Z` - Mirror across Z axis
- `RADIAL` - Radial symmetry (configurable segments)

```typescript
updateParams({
  symmetry: 'X', // Mirror across X axis
});

updateParams({
  symmetry: 'RADIAL',
  radialSegments: 8, // 8-way radial symmetry
});
```

## Blend Modes

Supported blend modes:
- `normal` - Standard alpha blend
- `multiply` - Darken blend
- `add` - Additive blend
- `overlay` - Contrast blend
- `screen` - Light blend
- `erase` - Erase/subtract

```typescript
updateParams({
  blendMode: 'multiply', // Darken blend
});
```

## Performance Tips

### 3D Sculpting

1. **Use GPU acceleration** - Set `useGpu: true` for 30x faster brushing
2. **Use binary IPC** - `initMeshBinary` is 10-50x faster than JSON for large meshes
3. **Batch strokes** - Use `applyBrushBatch` to reduce IPC overhead by 10-20x
4. **Limit mesh resolution** - Keep meshes under 500k vertices for real-time performance
5. **Use spatial grids** - The Rust backend uses spatial grids for O(1) neighbor queries

### 2D Painting

1. **Adjust spacing** - Higher spacing = fewer dabs = better performance
2. **Simplify strokes** - Use `simplifyStroke` to reduce point count
3. **Use hardware acceleration** - Enable `willReadFrequently: false` on canvas context
4. **Batch operations** - Group multiple dabs into single canvas operation
5. **Use offscreen canvas** - Render to offscreen canvas and composite

### Alpha Textures

1. **Reuse alphas** - Load once, use many times
2. **Use appropriate resolution** - 256x256 is usually sufficient
3. **Generate procedurally** - Faster than loading from disk
4. **Cache generated alphas** - Store in alpha manager for reuse

## Integration with Features

### Sculpting Feature

The sculpting feature uses `Brush3DEngine` for mesh deformation:

```typescript
import { useBrush3D } from '@/three-d/systems/brush-3d';

const { applyDab, updateParams } = useBrush3D(geometry);

// Apply brush stroke
await applyDab(hitPoint, hitNormal, pressure);
```

### Paint Feature

The paint feature uses `Brush3DEngine` for texture painting on meshes:

```typescript
import { useBrush3D } from '@/three-d/systems/brush-3d';
import { PBRPaintParams } from '@/shared/systems/brush';

// Paint with PBR channels
updateParams({
  color: '#ff0000',
  roughness: 0.5,
  metalness: 0.0,
  activeChannels: {
    albedo: true,
    roughness: true,
    metalness: false,
  },
});
```

### Graphos Feature

The Graphos feature uses `Brush2DEngine` for canvas painting:

```typescript
import { useBrush2D } from '@/two-d/systems/brush-2d';

const { startStroke, continueStroke, endStroke } = useBrush2D(canvas);

// Paint on canvas
startStroke(point);
continueStroke(point);
endStroke();
```

### Tecton Feature

The Tecton feature uses terrain-specific brush parameters:

```typescript
import { TerrainBrushParams } from '@/shared/systems/brush';

const terrainBrush: TerrainBrushParams = {
  ...DEFAULT_BRUSH_PARAMS,
  position: new THREE.Vector2(0.5, 0.5),
  mode: 'add',
  noiseSeed: 12345,
  noiseScale: 4.0,
  noiseOctaves: 6,
};
```

## Migration Guide

### From Old Brush System

**Before:**
```typescript
import { brushEngine } from '@/systems/brush/KBrushEngine';

const settings = brushEngine.getSettings();
brushEngine.setSettings({ size: 0.2 });
```

**After:**
```typescript
import { useBrush3D } from '@/three-d/systems/brush-3d';

const { params, updateParams } = useBrush3D(geometry);
updateParams({ size: 0.2 });
```

### From Feature-Specific Brushes

**Before (Sculpting):**
```typescript
// Custom sculpting brush implementation
const applyBrush = (point, normal) => {
  // Custom logic
};
```

**After:**
```typescript
import { useBrush3D } from '@/three-d/systems/brush-3d';

const { applyDab } = useBrush3D(geometry);
await applyDab(point, normal, pressure);
```

## Future Enhancements

- [ ] WebGPU compute shaders for browser-based GPU brushing
- [ ] Brush recording and playback
- [ ] Brush macro system (combine multiple brushes)
- [ ] AI-assisted brush generation
- [ ] Brush marketplace integration
- [ ] Real-time collaborative brushing
- [ ] Brush animation timeline
- [ ] Custom brush scripting (Lua/JavaScript)

## Related Systems

- **Layer System** - Brush strokes can be applied to specific layers
- **Masking System** - Smart masks can modulate brush intensity
- **Terrain System** - Terrain brushes integrate with erosion simulation
- **UV System** - Texture painting requires UV coordinates
- **Material System** - PBR painting affects material channels

## References

- [Rust Sculpting Backend](../../../crates/k-os-sculpt/src/)
- [Alpha Texture Pool](../../../crates/k-os-gpu-pipeline/src/brush/)
- [Brush Library](../../../src-tauri/resources/KBrushes/)
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) - Smooth stroke library
