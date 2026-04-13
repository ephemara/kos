# Terrain System

Universal terrain generation, simulation, and erosion system extracted from the Tecton feature.

## Overview

The terrain system provides a complete solution for procedural terrain generation and real-time GPU simulation. It combines CPU-based heightmap generation with GPU-accelerated physics simulation for realistic terrain effects.

## Features

- **Procedural Generation**: FBM noise, ridged multifractal, island generation
- **GPU Simulation**: Real-time hydraulic, thermal, and tectonic effects
- **CPU Erosion**: High-quality particle-based erosion algorithms
- **History Recording**: Record and playback simulation frames
- **React Integration**: Easy-to-use React hook for terrain operations

## Architecture

```
terrain/
├── TerrainTypes.ts          # Type definitions
├── TerrainSimulation.ts     # GPU simulation (ping-pong render targets)
├── HeightmapGenerator.ts    # Procedural heightmap generation
├── ErosionSimulator.ts      # CPU-based erosion algorithms
├── useTerrain.ts            # React hook
└── README.md                # This file
```

## Usage

### Basic Setup

```typescript
import { useTerrain } from '@/three-d/systems/terrain';
import { TerrainEffect } from '@/three-d/systems/terrain/TerrainTypes';

function TerrainApp() {
  const { state, actions } = useTerrain();
  const renderer = useThree((state) => state.gl);
  
  // Initialize terrain system
  useEffect(() => {
    if (renderer) {
      actions.initialize({
        resolution: 1024,
        sizeX: 10000,
        sizeZ: 10000,
        heightScale: 1200,
        seed: 12345
      }, renderer);
    }
  }, [renderer]);
  
  // Generate initial terrain
  useEffect(() => {
    if (state.isInitialized) {
      actions.generateIsland({
        octaves: 6,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 3.0
      });
    }
  }, [state.isInitialized]);
  
  return (
    <mesh>
      <planeGeometry args={[10000, 10000, 1024, 1024]} />
      <meshStandardMaterial
        displacementMap={state.heightmapTexture}
        displacementScale={1200}
      />
    </mesh>
  );
}
```

### Terrain Generation

```typescript
// Generate island with FBM noise
actions.generateIsland({
  octaves: 6,
  persistence: 0.5,
  lacunarity: 2.0,
  scale: 3.0,
  seed: 12345
});

// Generate ridged mountains
actions.generateRidged({
  octaves: 8,
  persistence: 0.6,
  lacunarity: 2.5,
  scale: 4.0
});

// Generate flat terrain
actions.generateFlat(0.5);
```

### GPU Simulation

```typescript
// Set active effect
actions.setActiveEffect(TerrainEffect.HYDRAULIC);

// Start simulation
actions.setSimulating(true);
actions.setSimSpeed(1.0);

// In animation loop
useFrame(() => {
  if (state.isSimulating) {
    actions.step();
  }
});
```

### CPU Erosion

```typescript
// Apply hydraulic erosion (high quality, slower)
await actions.applyHydraulicErosion({
  steps: 100,
  flowSpeed: 1.0,
  sedimentCapacity: 4.0,
  erosionStrength: 0.3,
  depositionStrength: 0.3,
  evaporationRate: 0.01
});

// Apply thermal erosion
await actions.applyThermalErosion({
  steps: 50,
  diffusionRate: 0.5,
  talusAngle: 30,
  strength: 0.5
});
```

### Recording and Playback

```typescript
// Start recording simulation frames
actions.startRecording();

// Run simulation...

// Stop recording
actions.stopRecording();

// Get recorded frames
const frameCount = actions.getHistoryLength();
const stats = actions.getFrameStats();
```

## Terrain Effects

The GPU simulation supports multiple real-time effects:

### TerrainEffect.ZERO_POINT (0)
No effect - stable state

### TerrainEffect.THERMAL (1)
Heat diffusion - smooths terrain based on neighbor averaging

### TerrainEffect.HYDRAULIC (2)
Water erosion - erodes peaks and deposits sediment in valleys

### TerrainEffect.WARP (3)
Spatial distortion - warps terrain using noise-based displacement

### TerrainEffect.TECTONIC (4)
Seismic shattering - creates cracks and uplift patterns

### TerrainEffect.STRATA (5)
Geological layering - creates stepped terraces

### TerrainEffect.ASTEROID (6)
Impact craters - simulates asteroid impacts (requires additional setup)

## Components

### TerrainSimulation

GPU-accelerated simulation using ping-pong render targets.

**Key Methods:**
- `step()` - Advance simulation one frame
- `setActiveEffect(effect)` - Set current effect
- `setSimulating(active)` - Enable/disable simulation
- `getCurrentHeightmap()` - Get current heightmap texture
- `recordFrame()` - Record current state to history
- `dispose()` - Clean up GPU resources

### HeightmapGenerator

Procedural heightmap generation using noise algorithms.

**Key Methods:**
- `generateFBM(width, height, params)` - Fractional Brownian Motion
- `generateIsland(width, height, params)` - Island with radial falloff
- `generateRidged(width, height, params)` - Ridged multifractal mountains
- `generateFlat(width, height, value)` - Flat plane
- `generateFromImage(imageData)` - Import from image
- `blend(heightmapA, heightmapB, factor)` - Blend two heightmaps

### ErosionSimulator

CPU-based erosion algorithms for high-quality results.

**Key Methods:**
- `hydraulicErosion(heightmap, params)` - Particle-based water erosion
- `thermalErosion(heightmap, params)` - Slope-based material sliding
- `combinedErosion(heightmap, hydraulic, thermal)` - Both erosion types
- `smooth(heightmap, radius)` - Box blur smoothing
- `terrace(heightmap, levels, smoothness)` - Create stepped levels
- `normalize(heightmap)` - Normalize to [0, 1] range

### useTerrain Hook

React hook providing complete terrain system integration.

**State:**
- `isInitialized` - Whether system is ready
- `isSimulating` - Whether simulation is running
- `activeEffect` - Current simulation effect
- `simSpeed` - Simulation speed multiplier
- `heightmapTexture` - Current heightmap texture
- `resolution` - Terrain resolution

**Actions:**
- All generation, simulation, and erosion methods
- Lifecycle management (initialize, dispose)
- Recording controls

## Performance Considerations

### GPU Simulation
- **Fast**: Real-time at 60fps for resolutions up to 2048x2048
- **Quality**: Good for interactive preview and real-time effects
- **Limitations**: Simplified physics, less accurate than CPU

### CPU Erosion
- **Slow**: Can take seconds to minutes depending on parameters
- **Quality**: High-quality, physically accurate results
- **Use Case**: Final terrain generation, offline processing

### Recommendations
- Use GPU simulation for real-time interaction
- Use CPU erosion for final high-quality results
- Start with lower resolutions (512-1024) for faster iteration
- Increase resolution (2048-4096) for final output

## Integration with Tecton

The Tecton feature uses this terrain system:

```typescript
import { useTerrain } from '@/three-d/systems/terrain';
import { TerrainEffect } from '@/three-d/systems/terrain/TerrainTypes';

// In Tecton component
const { state, actions } = useTerrain();

// Initialize with Tecton config
actions.initialize(tectonConfig, renderer);

// Generate terrain
actions.generateIsland(noiseParams);

// Run simulation
actions.setActiveEffect(TerrainEffect.HYDRAULIC);
actions.setSimulating(true);
```

## Type Definitions

All types are defined in `TerrainTypes.ts`:

- `TerrainConfig` - Core terrain configuration
- `HeightmapData` - Heightmap data structure
- `NoiseParams` - Noise generation parameters
- `HydraulicErosionParams` - Hydraulic erosion settings
- `ThermalErosionParams` - Thermal erosion settings
- `TerrainEffect` - Simulation effect enum
- `TerrainMaterial` - Material properties
- `TerrainViewMode` - Rendering modes
- And many more...

## Extending the System

### Adding New Generation Methods

```typescript
// In HeightmapGenerator.ts
generateCustom(width: number, height: number): HeightmapData {
  const data = new Float32Array(width * height * 4);
  
  // Your generation logic here
  
  return { data, width, height };
}
```

### Adding New Erosion Algorithms

```typescript
// In ErosionSimulator.ts
customErosion(heightmap: HeightmapData, params: CustomParams): HeightmapData {
  const result = new Float32Array(heightmap.data);
  
  // Your erosion logic here
  
  return { data: result, width: heightmap.width, height: heightmap.height };
}
```

### Adding New GPU Effects

```typescript
// In TerrainSimulation.ts fragment shader
// Add new effect case in shader code
if (activeEffect == 8) {
  // Your custom effect logic
}
```

## Examples

See the Tecton feature for a complete working example:
- `src-frontend/three-d/examples/tecton/`

## Dependencies

- Three.js (rendering, textures)
- React (hooks, lifecycle)
- WebGL 2.0 (GPU simulation)

## Future Enhancements

- [ ] Multi-threaded CPU erosion using Web Workers
- [ ] GPU-accelerated erosion (compute shaders)
- [ ] Vegetation placement based on terrain features
- [ ] River network generation
- [ ] Biome system integration
- [ ] Texture splatting based on slope/height
- [ ] LOD terrain mesh generation
- [ ] Terrain streaming for large worlds

## License

Part of the K_OS Hybrid template system.
