# UV System

Universal UV unwrapping and editing system for 3D meshes.

## Overview

The UV system provides production-quality UV unwrapping, atlas packing, and interactive editing tools. It supports multiple projection modes, GPU acceleration, and intelligent auto-classification for optimal results.

## Features

- **Multiple Projection Modes**: Box, planar, cylindrical, spherical, camera view
- **LSCM Unwrapping**: Industry-standard conformal mapping via XAtlas
- **GPU Acceleration**: Handle 1M+ vertices in milliseconds
- **Hybrid Auto-Unwrap**: Intelligent classification (organic vs hard-surface)
- **Atlas Packing**: MaxRects algorithm for efficient UV island packing
- **Interactive Editing**: Grab and relax brushes for UV manipulation
- **React Integration**: Easy-to-use hook for React components

## Quick Start

### Using the Hook (Recommended)

```typescript
import { useUV } from '@/three-d/systems/uv';

function MyComponent() {
    const uv = useUV({
        useGpu: true,
        defaultProjection: 'BOX'
    });

    const handleUnwrap = async () => {
        await uv.performUnwrap(meshes, selectedIds, originalGeos, camera);
    };

    const handlePack = async () => {
        await uv.performPack(meshes, selectedIds);
    };

    return (
        <div>
            <select value={uv.projection} onChange={e => uv.setProjection(e.target.value)}>
                <option value="BOX">Box</option>
                <option value="LSCM">LSCM</option>
                <option value="HYBRID_AUTO">Hybrid Auto</option>
            </select>
            
            <button onClick={handleUnwrap} disabled={uv.isProcessing}>
                Unwrap
            </button>
            
            <button onClick={handlePack} disabled={uv.isProcessing}>
                Pack
            </button>
            
            {uv.uvStats && (
                <div>
                    Processed {uv.uvStats.verts} vertices in {uv.uvStats.meshes} meshes
                </div>
            )}
        </div>
    );
}
```

### Direct API Usage

```typescript
import {
    applyUVProjection,
    applyLSCM,
    applyBoxProjection,
    applyHybridAutoUnwrap,
    packUVsGPU
} from '@/three-d/systems/uv';

// Simple box projection
applyUVProjection(mesh, originalGeo, {
    projection: 'BOX',
    targetAxis: 'Y',
    coordSpace: 'LOCAL',
    scale: 1.0,
    stretchU: 1.0,
    stretchV: 1.0,
    rotation: 0,
    offsetU: 0,
    offsetV: 0,
    jitter: 0
});

// LSCM unwrapping
await applyLSCM(mesh, {
    maxIterations: 600,
    padding: 2,
    texelsPerUnit: 32,
    resolution: 1024
});

// Hybrid auto-unwrap (intelligent)
const result = await applyHybridAutoUnwrap(mesh, {
    lscmIterations: 600,
    boxPadding: 0.005,
    boxWorldAlign: true,
    boxCameraCount: 6,
    autoClassify: true
});

console.log(`Used ${result.solver} solver for ${result.classification} mesh`);

// GPU packing
await packUVsGPU(mesh, 0.01);
```

## Projection Modes

### Box Projection

Projects UVs from 6 cardinal directions (or more with multi-camera mode).

```typescript
applyBoxProjection(mesh, {
    padding: 0.005,
    worldAlign: true,
    cameraCount: 6  // 6, 14, 26, 50, or 98
});
```

**Best for**: Hard-surface models, architectural elements, props

### LSCM (Least Squares Conformal Maps)

Industry-standard conformal unwrapping using XAtlas backend.

```typescript
await applyLSCM(mesh, {
    maxIterations: 600,
    padding: 2,
    texelsPerUnit: 32,
    resolution: 1024
});
```

**Best for**: Organic models, characters, smooth surfaces

### Planar Projection

Projects UVs along a single axis.

```typescript
applyUVProjection(mesh, originalGeo, {
    projection: 'PLANAR_Y',
    coordSpace: 'WORLD',
    scale: 1.0,
    // ...
});
```

**Best for**: Floors, walls, flat surfaces

### Cylindrical Unwrap

Wraps UVs around a cylinder.

```typescript
applyUVProjection(mesh, originalGeo, {
    projection: 'CYLINDRICAL',
    targetAxis: 'Y',
    // ...
});
```

**Best for**: Columns, pipes, cylindrical objects

### Spherical Unwrap

Projects UVs onto a sphere.

```typescript
applyUVProjection(mesh, originalGeo, {
    projection: 'SPHERICAL',
    // ...
});
```

**Best for**: Spheres, planets, rounded objects

### Hybrid Auto-Unwrap

Intelligently classifies mesh and chooses best solver.

```typescript
const result = await applyHybridAutoUnwrap(mesh, {
    lscmIterations: 600,
    boxPadding: 0.005,
    boxWorldAlign: true,
    autoClassify: true,
    forceMode: undefined  // or 'LSCM' or 'BOX'
});

// Result includes:
// - vertCount: number of vertices
// - time: processing time
// - classification: 'ORGANIC' | 'HARD_SURFACE' | 'MIXED'
// - solver: 'LSCM' | 'BOX' | 'HYBRID'
```

**Best for**: Unknown mesh types, batch processing

## GPU Acceleration

The UV system supports GPU-accelerated projection and packing for massive performance gains.

### GPU Projection

```typescript
import { applyGpuProjection, canUseGpuProjection } from '@/three-d/systems/uv';

if (canUseGpuProjection()) {
    const result = await applyGpuProjection(mesh, {
        mode: 'BOX',
        scale: 1.0,
        offsetU: 0,
        offsetV: 0
    });
    
    console.log(`Processed ${result.vertCount} vertices in ${result.timeMs}ms`);
}
```

**Performance**: 1M+ vertices in <10ms

### GPU Packing

```typescript
import { packUVsGPU, isGpuPackingAvailable } from '@/three-d/systems/uv';

if (isGpuPackingAvailable()) {
    const result = await packUVsGPU(mesh, 0.01);
    console.log(`Packed ${result.islandCount} islands in ${result.timeMs}ms`);
}
```

## Atlas Packing

Pack UV islands efficiently into 0-1 texture space.

### GPU Packing (Recommended)

```typescript
import { packUVsGPU } from '@/three-d/systems/uv';

await packUVsGPU(mesh, 0.01);  // 0.01 = 1% padding
```

### CPU Packing (Fallback)

```typescript
import { AtlasPacker } from '@/three-d/systems/uv';

const packer = new AtlasPacker(1.0, 1.0);
const rects = [
    { id: 0, w: 0.3, h: 0.4, x: 0, y: 0 },
    { id: 1, w: 0.2, h: 0.5, x: 0, y: 0 }
];

packer.fit(rects, 0.01);

// Rects now have x, y positions in 0-1 space
```

### Grid Packing (Simple)

```typescript
import { packUVsGrid } from '@/three-d/systems/uv';

packUVsGrid(meshes, selectedIds);
```

## Interactive UV Editing

### UV Brush

```typescript
import { UVBrush } from '@/three-d/systems/uv';

const brush = new UVBrush();

// In your pointer event handler
brush.applyBrush(
    meshes,
    selectedIds,
    camera,
    pointerNDC,
    {
        radius: 0.1,
        intensity: 0.5,
        type: 'GRAB'  // or 'RELAX'
    },
    isPointerDown,
    viewportRect
);
```

**Brush Types**:
- **GRAB**: Move UVs interactively
- **RELAX**: Smooth UV distortion using Laplacian smoothing

### UV Selection

```typescript
import { UVSelection } from '@/three-d/systems/uv';

const selection = new UVSelection();

// Select face at UV coordinate
const faceIndex = selection.selectFaceAt(mesh, new THREE.Vector2(0.5, 0.5), 0.01);

// Get selected faces
const selected = selection.getSelectedFaces();

// Clear selection
selection.clearSelection();
```

## Utilities

### Calculate UV Bounds

```typescript
import { calculateUVBounds, calculateMultiMeshUVBounds } from '@/three-d/systems/uv';

// Single mesh
const bounds = calculateUVBounds(mesh);
console.log(bounds);  // { minU, maxU, minV, maxV }

// Multiple meshes
const multiBounds = calculateMultiMeshUVBounds(meshes, selectedIds);
```

### Create UV Grid Texture

```typescript
import { createUVGridTexture } from '@/three-d/systems/uv';

const gridTexture = createUVGridTexture(1024);
material.map = gridTexture;
```

## React Hook API

The `useUV` hook provides complete state management for UV operations.

### State

```typescript
const uv = useUV();

// Projection state
uv.projection          // Current projection mode
uv.coordSpace          // 'LOCAL' | 'WORLD'
uv.targetAxis          // 'X' | 'Y' | 'Z'
uv.isProcessing        // Processing state
uv.uvStats             // { verts, meshes, version }

// Projection parameters
uv.scale               // Scale factor
uv.stretchU            // U-axis stretch
uv.stretchV            // V-axis stretch
uv.rotation            // Rotation in degrees
uv.offsetU             // U-axis offset
uv.offsetV             // V-axis offset
uv.jitter              // Random jitter

// LSCM parameters
uv.lscmIterations      // Solver iterations
uv.lscmPadding         // Island padding
uv.lscmTexels          // Texels per unit
uv.lscmResolution      // Target resolution

// Box projection parameters
uv.boxPadding          // Island padding
uv.boxWorldAlign       // World alignment
uv.boxCameraCount      // Number of cameras

// Hybrid parameters
uv.hybridAutoClassify  // Auto-classify meshes
uv.hybridForceMode     // 'AUTO' | 'LSCM' | 'BOX'

// Capabilities
uv.gpuAvailable        // GPU acceleration available
uv.lscmAvailable       // LSCM solver available
```

### Operations

```typescript
// Perform unwrap
await uv.performUnwrap(meshes, selectedIds, originalGeos, camera);

// Perform packing
await uv.performPack(meshes, selectedIds);

// Apply preset
await uv.applyPreset('WALL', meshes, selectedIds, originalGeos);
// Presets: 'WALL' | 'FLOOR' | 'PROP' | 'ATLAS_GRID'
```

### Setters

All state has corresponding setters:

```typescript
uv.setProjection('LSCM');
uv.setCoordSpace('WORLD');
uv.setScale(2.0);
uv.setLscmIterations(1000);
// ... etc
```

## Type Definitions

All types are exported from `UVTypes.ts`:

```typescript
import type {
    ProjectionMode,
    ProjectionConfig,
    LSCMConfig,
    BoxProjectionConfig,
    HybridConfig,
    GpuProjectConfig,
    LSCMResult,
    HybridResult,
    GpuProjectResult,
    GpuPackResult,
    UVBrushType,
    UVBrushParams,
    UVStats,
    UVBounds,
    MeshClassification
} from '@/three-d/systems/uv';
```

## Architecture

### File Structure

```
three-d/systems/uv/
├── UVTypes.ts          # Type definitions
├── LSCMSolver.ts       # LSCM unwrapping
├── AtlasPacker.ts      # UV packing algorithms
├── UVEditor.ts         # Interactive editing tools
├── UVProjection.ts     # Projection algorithms
├── useUV.ts            # React hook
├── index.ts            # Exports
└── README.md           # This file
```

### Dependencies

- **Three.js**: 3D mesh manipulation
- **Tauri**: Backend communication (GPU operations, LSCM)
- **React**: Hook integration

### Backend Integration

The UV system communicates with Rust backend for:
- **LSCM unwrapping**: XAtlas solver
- **GPU projection**: WGPU compute shaders
- **GPU packing**: WGPU compute shaders
- **Mesh classification**: Geometry analysis

## Performance

### CPU Projection

- **Simple modes** (box, planar): ~1ms for 10K vertices
- **Complex modes** (cylindrical, spherical): ~2ms for 10K vertices

### GPU Projection

- **All modes**: <10ms for 1M+ vertices
- **Speedup**: 100-1000x over CPU

### LSCM Unwrapping

- **Small meshes** (<10K verts): <100ms
- **Medium meshes** (10K-100K verts): 100-500ms
- **Large meshes** (100K-1M verts): 500-2000ms

### Atlas Packing

- **CPU MaxRects**: ~10ms for 100 islands
- **GPU packing**: <5ms for 1000+ islands

## Best Practices

### 1. Use GPU When Available

```typescript
const uv = useUV({ useGpu: true });

if (uv.gpuAvailable) {
    // GPU path is automatically used
}
```

### 2. Choose Right Projection Mode

- **Organic meshes**: Use LSCM or Hybrid Auto
- **Hard-surface**: Use Box projection
- **Flat surfaces**: Use Planar projection
- **Unknown**: Use Hybrid Auto

### 3. Validate Meshes for LSCM

```typescript
import { validateMeshForLSCM } from '@/three-d/systems/uv';

const validation = validateMeshForLSCM(mesh);
if (!validation.valid) {
    console.warn('Mesh issues:', validation.issues);
    // Use fallback projection
}
```

### 4. Pack After Unwrapping

```typescript
await uv.performUnwrap(meshes, selectedIds, originalGeos);
await uv.performPack(meshes, selectedIds);
```

### 5. Use Presets for Common Cases

```typescript
// Wall texture
await uv.applyPreset('WALL', meshes, selectedIds, originalGeos);

// Floor texture
await uv.applyPreset('FLOOR', meshes, selectedIds, originalGeos);

// Props
await uv.applyPreset('PROP', meshes, selectedIds, originalGeos);
```

## Examples

### Example 1: Simple Unwrap

```typescript
import { useUV } from '@/three-d/systems/uv';

function SimpleUnwrap() {
    const uv = useUV();
    
    return (
        <button onClick={() => uv.performUnwrap(meshes, selectedIds, originalGeos)}>
            Unwrap
        </button>
    );
}
```

### Example 2: Advanced Configuration

```typescript
import { useUV } from '@/three-d/systems/uv';

function AdvancedUnwrap() {
    const uv = useUV({ useGpu: true });
    
    const handleUnwrap = async () => {
        uv.setProjection('HYBRID_AUTO');
        uv.setHybridAutoClassify(true);
        uv.setLscmIterations(1000);
        uv.setBoxCameraCount(14);
        
        await uv.performUnwrap(meshes, selectedIds, originalGeos);
        await uv.performPack(meshes, selectedIds);
    };
    
    return <button onClick={handleUnwrap}>Smart Unwrap</button>;
}
```

### Example 3: Direct API

```typescript
import { applyLSCM, packUVsGPU } from '@/three-d/systems/uv';

async function unwrapAndPack(mesh: THREE.Mesh) {
    // Unwrap
    await applyLSCM(mesh, {
        maxIterations: 600,
        padding: 2,
        texelsPerUnit: 32,
        resolution: 1024
    });
    
    // Pack
    await packUVsGPU(mesh, 0.01);
}
```

## Troubleshooting

### LSCM Fails

**Problem**: LSCM unwrapping throws error

**Solutions**:
1. Check mesh is manifold (no holes, no non-manifold edges)
2. Validate mesh with `validateMeshForLSCM()`
3. Use fallback: `applyLSCMWithFallback()`
4. Try Hybrid Auto mode instead

### GPU Not Available

**Problem**: GPU operations not working

**Solutions**:
1. Check Tauri environment: `canUseGpuProjection()`
2. Verify backend is running
3. Use CPU fallback automatically provided

### Poor UV Quality

**Problem**: UVs are stretched or distorted

**Solutions**:
1. Try different projection mode
2. Increase LSCM iterations
3. Use Hybrid Auto for intelligent selection
4. Adjust scale and stretch parameters

### Slow Performance

**Problem**: Unwrapping takes too long

**Solutions**:
1. Enable GPU acceleration
2. Reduce LSCM iterations
3. Use simpler projection mode (Box instead of LSCM)
4. Process meshes in batches

## Future Enhancements

- [ ] Seam editing tools
- [ ] UV island rotation and alignment
- [ ] Texture density visualization
- [ ] UV distortion analysis
- [ ] Multi-threaded CPU projection
- [ ] WebGPU support for web builds
- [ ] UV animation support
- [ ] Advanced packing strategies

## Contributing

When adding new features to the UV system:

1. Add types to `UVTypes.ts`
2. Implement core logic in appropriate file
3. Update `useUV` hook if needed
4. Add examples to README
5. Update tests

## License

Part of the K_OS Hybrid template system.
