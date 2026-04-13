# Baking System

Real-time texture baking system for 3D meshes. Supports normal maps, curvature maps, ambient occlusion, and position maps.

## Overview

The baking system provides GPU-accelerated texture baking for various map types. It's designed to be fast, efficient, and easy to use with React hooks.

## Features

- **Normal Map Baking**: World-space and tangent-space normal maps
- **Curvature Map Baking**: Edge and cavity detection using Sobel operators
- **Ambient Occlusion Baking**: Screen-space AO with configurable samples
- **Position Map Baking**: World-space and object-space position maps
- **Caching**: Automatic caching of baked maps for performance
- **Progress Tracking**: Real-time progress callbacks
- **GPU Acceleration**: All baking operations run on the GPU

## Architecture

```
baking/
├── BakingTypes.ts          # Type definitions
├── NormalMapBaker.ts       # Normal map baking
├── CurvatureBaker.ts       # Curvature map baking
├── AOBaker.ts              # Ambient occlusion baking
├── useBaking.ts            # React hook
└── README.md               # This file
```

## Usage

### Basic Usage with Hook

```typescript
import { useBaking } from '@/three-d/systems/baking';

function MyComponent() {
  const { renderer } = useThree();
  const {
    bakeNormalMap,
    bakeCurvatureMap,
    bakeAOMap,
    bakeAllMaps,
    isBaking,
    progress,
  } = useBaking({ renderer });

  const handleBake = async (mesh: THREE.Mesh) => {
    // Bake all maps at once
    const maps = await bakeAllMaps(mesh, 1024);
    
    // Use the baked maps
    material.normalMap = maps.normalMap;
    material.aoMap = maps.aoMap;
  };

  return (
    <div>
      {isBaking && <div>Baking: {progress?.step} ({progress?.progress}%)</div>}
      <button onClick={() => handleBake(myMesh)}>Bake Maps</button>
    </div>
  );
}
```

### Baking Individual Maps

```typescript
// Bake normal map
const normalResult = await bakeNormalMap({
  mesh: myMesh,
  resolution: 2048,
  tangentSpace: true,
});

// Bake curvature map
const curvatureResult = await bakeCurvatureMap({
  mesh: myMesh,
  resolution: 1024,
  sensitivity: 1.5,
  separateChannels: true, // R=convex, G=concave
});

// Bake ambient occlusion
const aoResult = await bakeAOMap({
  mesh: myMesh,
  resolution: 1024,
  samples: 64,
  distance: 0.5,
  bias: 0.01,
  intensity: 1.0,
  useGPU: true,
});
```

### Using Bakers Directly

```typescript
import { NormalMapBaker, CurvatureBaker, AOBaker } from '@/three-d/systems/baking';

const normalBaker = new NormalMapBaker(renderer);

const result = await normalBaker.bake({
  mesh: myMesh,
  resolution: 2048,
  tangentSpace: false,
}, {
  onProgress: (progress) => {
    console.log(`${progress.step}: ${progress.progress}%`);
  },
});

// Use the baked texture
material.normalMap = result.texture;

// Cleanup
normalBaker.dispose();
```

### Caching

The `useBaking` hook automatically caches baked maps:

```typescript
const { bakeAllMaps, getCachedMaps, clearCache } = useBaking({
  renderer,
  enableCache: true,
  maxCacheSize: 10,
});

// First bake - generates maps
await bakeAllMaps(mesh);

// Second bake - uses cached maps
await bakeAllMaps(mesh); // Instant!

// Get cached maps
const cached = getCachedMaps(mesh);

// Clear cache for specific mesh
clearCache(mesh);

// Clear all cache
clearCache();
```

## Map Types

### Normal Maps

Normal maps encode surface normals for lighting calculations.

**World-Space**: Normals in world coordinates (good for static objects)
**Tangent-Space**: Normals relative to surface (good for animated objects)

```typescript
const result = await bakeNormalMap({
  mesh,
  resolution: 2048,
  tangentSpace: true, // or false for world-space
});
```

### Curvature Maps

Curvature maps detect edges (convex) and cavities (concave) on surfaces.

**Separate Channels**: R=convex/edges, G=concave/cavities
**Combined**: All channels contain same curvature value

```typescript
const result = await bakeCurvatureMap({
  mesh,
  resolution: 1024,
  sensitivity: 1.0, // Higher = more sensitive
  separateChannels: true,
  blurRadius: 0, // Optional smoothing
});
```

**Use Cases**:
- Procedural weathering (edges wear faster)
- Smart masking (paint only edges or cavities)
- Detail enhancement in shaders

### Ambient Occlusion

AO maps simulate soft shadows in crevices and corners.

```typescript
const result = await bakeAOMap({
  mesh,
  resolution: 1024,
  samples: 32, // Higher = better quality, slower
  distance: 0.5, // Ray distance
  bias: 0.01, // Prevent self-shadowing
  intensity: 1.0, // Darkness multiplier
  useGPU: true,
});
```

**Quality Settings**:
- Draft: 16 samples, 512 resolution
- Preview: 32 samples, 1024 resolution
- Production: 64+ samples, 2048+ resolution

### Position Maps

Position maps store world-space or object-space positions.

```typescript
const result = await bakePositionMap({
  mesh,
  resolution: 1024,
  space: 'world', // or 'object'
  normalize: false,
});
```

**Use Cases**:
- Height-based masking
- Procedural effects based on position
- Custom shader effects

## Performance

### Resolution Guidelines

| Resolution | Use Case | Bake Time (approx) |
|------------|----------|-------------------|
| 256 | Preview | <50ms |
| 512 | Draft | ~100ms |
| 1024 | Production | ~200ms |
| 2048 | High Quality | ~500ms |
| 4096 | Ultra | ~2000ms |

*Times are approximate and depend on GPU, mesh complexity, and map type*

### Optimization Tips

1. **Use Caching**: Enable caching to avoid re-baking
2. **Bake in Parallel**: Use `bakeAllMaps()` to bake multiple maps simultaneously
3. **Lower Resolution**: Use 512 or 1024 for real-time applications
4. **Reduce Samples**: For AO, use 16-32 samples for preview
5. **Dispose Resources**: Always call `dispose()` when done

### Memory Management

```typescript
// Good: Dispose when done
const baker = new NormalMapBaker(renderer);
const result = await baker.bake(params);
// ... use result.texture ...
baker.dispose();

// Better: Use the hook (auto-cleanup)
const { bakeNormalMap } = useBaking({ renderer });
const result = await bakeNormalMap(params);
```

## Integration with Other Systems

### Masking System

The masking system uses the baking system internally:

```typescript
import { useMasking } from '@/three-d/systems/masking';

const { generateCurvatureMask, bakeMaps } = useMasking(renderer);

// Bake maps for masking
const maps = await bakeMaps(mesh);

// Generate mask using baked maps
const mask = await generateCurvatureMask(mesh, {
  mode: 'edge',
  threshold: 0.5,
});
```

### Material System

Use baked maps with materials:

```typescript
const maps = await bakeAllMaps(mesh);

material.normalMap = maps.normalMap;
material.aoMap = maps.aoMap;
material.aoMapIntensity = 1.0;
material.needsUpdate = true;
```

### PBR Workflow

Bake maps for PBR materials:

```typescript
// Bake AO and normal
const [aoResult, normalResult] = await Promise.all([
  bakeAOMap({ mesh, resolution: 2048, samples: 64 }),
  bakeNormalMap({ mesh, resolution: 2048, tangentSpace: true }),
]);

// Apply to PBR material
pbrMaterial.normalMap = normalResult.texture;
pbrMaterial.aoMap = aoResult.texture;
pbrMaterial.aoMapIntensity = 1.0;
```

## Advanced Features

### High-to-Low Baking

Bake details from a high-poly mesh to a low-poly mesh:

```typescript
const result = await normalBaker.bakeHighToLow(
  lowPolyMesh,
  highPolyMesh,
  2048,
  0.1 // ray distance
);
```

*Note: High-to-low baking requires ray tracing and is currently in development*

### Custom Progress Tracking

```typescript
const result = await bakeNormalMap(params, {
  onProgress: (progress) => {
    console.log(`Step: ${progress.step}`);
    console.log(`Progress: ${progress.progress}%`);
    if (progress.estimatedTimeMs) {
      console.log(`ETA: ${progress.estimatedTimeMs}ms`);
    }
  },
});
```

### Custom Renderer

```typescript
const customRenderer = new THREE.WebGLRenderer();
const { bakeNormalMap } = useBaking({ 
  renderer: customRenderer,
});
```

## API Reference

### Types

See `BakingTypes.ts` for complete type definitions:

- `BakingConfig`: Configuration for baking operations
- `BakingResult`: Result of a baking operation
- `BakedMapSet`: Collection of baked maps
- `NormalMapBakingParams`: Parameters for normal map baking
- `CurvatureMapBakingParams`: Parameters for curvature baking
- `AOBakingParams`: Parameters for AO baking
- `BakingOptions`: Options for baking operations
- `BakingProgress`: Progress callback data

### Hooks

#### `useBaking(options)`

Main baking hook with full functionality.

**Options**:
- `renderer`: WebGL renderer (required)
- `enableCache`: Enable caching (default: true)
- `maxCacheSize`: Maximum cache entries (default: 10)
- `defaultResolution`: Default texture resolution (default: 1024)

**Returns**:
- `bakeNormalMap`: Bake normal map function
- `bakeCurvatureMap`: Bake curvature map function
- `bakeAOMap`: Bake AO map function
- `bakeAllMaps`: Bake all maps function
- `getCachedMaps`: Get cached maps function
- `clearCache`: Clear cache function
- `dispose`: Cleanup function
- `isBaking`: Baking in progress flag
- `progress`: Current progress
- `error`: Last error
- `lastResult`: Last baking result
- `cache`: Cache map

#### `useQuickBaking(renderer)`

Simplified hook for quick baking.

**Returns**: Same as `useBaking` plus:
- `quickBake`: Quick bake function (1024 resolution, all maps)

### Classes

#### `NormalMapBaker`

Bakes normal maps from mesh geometry.

**Methods**:
- `bake(params, options)`: Bake normal map
- `bakeHighToLow(lowPoly, highPoly, resolution, rayDistance, options)`: High-to-low baking
- `dispose()`: Cleanup resources

#### `CurvatureBaker`

Bakes curvature maps using Sobel edge detection.

**Methods**:
- `bake(params, options)`: Bake curvature map
- `dispose()`: Cleanup resources

#### `AOBaker`

Bakes ambient occlusion using screen-space techniques.

**Methods**:
- `bake(params, options)`: Bake AO map
- `dispose()`: Cleanup resources

## Examples

### Example 1: Bake and Apply Normal Map

```typescript
function BakeNormalExample() {
  const { renderer } = useThree();
  const { bakeNormalMap } = useBaking({ renderer });
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);

  const handleBake = async () => {
    if (!mesh) return;

    const result = await bakeNormalMap({
      mesh,
      resolution: 2048,
      tangentSpace: true,
    });

    // Apply to material
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.normalMap = result.texture;
      mesh.material.needsUpdate = true;
    }
  };

  return <button onClick={handleBake}>Bake Normal Map</button>;
}
```

### Example 2: Bake All Maps with Progress

```typescript
function BakeAllExample() {
  const { renderer } = useThree();
  const { bakeAllMaps, progress, isBaking } = useBaking({ renderer });

  const handleBake = async (mesh: THREE.Mesh) => {
    const maps = await bakeAllMaps(mesh, 1024, {
      onProgress: (p) => console.log(`${p.step}: ${p.progress}%`),
    });

    // Apply all maps
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.normalMap = maps.normalMap;
    material.aoMap = maps.aoMap;
    material.needsUpdate = true;
  };

  return (
    <div>
      {isBaking && <div>Baking: {progress?.step}</div>}
      <button onClick={() => handleBake(myMesh)}>Bake All</button>
    </div>
  );
}
```

### Example 3: Curvature-Based Weathering

```typescript
function WeatheringExample() {
  const { renderer } = useThree();
  const { bakeCurvatureMap } = useBaking({ renderer });

  const applyWeathering = async (mesh: THREE.Mesh) => {
    // Bake curvature (edges wear faster)
    const result = await bakeCurvatureMap({
      mesh,
      resolution: 1024,
      sensitivity: 1.5,
      separateChannels: true,
    });

    // Use in shader
    const material = new THREE.ShaderMaterial({
      uniforms: {
        curvatureMap: { value: result.texture },
        wearAmount: { value: 0.5 },
      },
      fragmentShader: `
        uniform sampler2D curvatureMap;
        uniform float wearAmount;
        
        void main() {
          vec4 curv = texture2D(curvatureMap, vUv);
          float edgeWear = curv.r * wearAmount; // Edges wear more
          
          // Apply weathering based on edge wear
          vec3 color = mix(baseColor, wornColor, edgeWear);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    mesh.material = material;
  };

  return <button onClick={() => applyWeathering(myMesh)}>Apply Weathering</button>;
}
```

## Troubleshooting

### Maps appear black or empty

- Ensure mesh has valid UVs: `mesh.geometry.attributes.uv`
- Check mesh is visible and has geometry
- Verify renderer is initialized

### Baking is slow

- Reduce resolution (try 512 or 1024)
- For AO, reduce samples (try 16 or 32)
- Enable caching to avoid re-baking
- Use GPU acceleration (enabled by default)

### Out of memory errors

- Reduce resolution
- Clear cache more frequently
- Dispose of unused textures
- Reduce max cache size

### Tangent-space normals not working

- Ensure geometry has tangents: `geometry.computeTangents()`
- Check geometry has valid UVs
- Verify normal map is applied correctly

## Future Enhancements

- [ ] High-to-low baking with ray tracing
- [ ] Thickness map baking
- [ ] Height map baking
- [ ] Bent normal baking
- [ ] Multi-threaded CPU baking
- [ ] Baking from multiple meshes
- [ ] Custom baking shaders
- [ ] Baking to specific UV channels

## Related Systems

- **Masking System**: Uses baking for procedural masks
- **Material System**: Applies baked maps to materials
- **PBR System**: Integrates baked maps into PBR workflow
- **UV System**: Provides UVs for baking

## Contributing

When adding new baking features:

1. Add types to `BakingTypes.ts`
2. Create baker class (e.g., `ThicknessBaker.ts`)
3. Update `useBaking.ts` hook
4. Add tests
5. Update this README
6. Add examples

## License

Part of the K_OS Template System.
