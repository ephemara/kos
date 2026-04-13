# 3D Systems & Applications

This directory contains everything related to 3D modeling, sculpting, rendering, and DCC (Digital Content Creation) tools built with Three.js.

## Directory Structure

```
three-d/
├── services/          # 3D-specific backend services (GPU operations)
├── systems/           # 3D systems (masking, terrain, UV, materials)
├── examples/          # 3D example applications
└── template/          # 3D starter template (coming soon)
```

## Overview

The 3D directory is designed for building professional 3D applications like:
- Digital sculpting tools (ZBrush-style)
- 3D modeling software
- CAD applications
- Game level editors
- Procedural generation tools
- UV unwrapping and texture baking
- Real-time rendering engines

## Import Rules

**Allowed Imports**:
- ✅ `three` - Three.js core
- ✅ `@react-three/fiber` - React Three Fiber
- ✅ `@react-three/drei` - Three.js helpers
- ✅ `@/shared/*` - Universal components and systems
- ✅ `@/three-d/*` - Other 3D modules
- ✅ `@/shaders/*` - Shader library

**Forbidden Imports**:
- ❌ `@/two-d/*` - Keep 2D and 3D separate

## Services

3D-specific services provide typed wrappers for GPU-accelerated backend operations:

### Core Services

#### `sculptClient.ts`
GPU-accelerated sculpting operations:

```typescript
import { sculptService } from '@/three-d/services/sculptClient';

// Initialize sculpting session
const handle = await sculptService.init(mesh);

// Apply brush stroke
await sculptService.stroke(handle, {
  points: strokePoints,
  radius: 0.5,
  intensity: 0.8,
  mode: 'add'
});

// Cleanup
await sculptService.dispose(handle);
```

#### `meshClient.ts`
Mesh operations and geometry processing:

```typescript
import { meshService } from '@/three-d/services/meshClient';

// Subdivide mesh
const subdivided = await meshService.subdivide(mesh, iterations);

// Remesh with target resolution
const remeshed = await meshService.remesh(mesh, resolution);

// Calculate normals
await meshService.computeNormals(mesh);
```

#### `raycastClient.ts`
GPU-accelerated raycasting:

```typescript
import { raycastService } from '@/three-d/services/raycastClient';

const hit = await raycastService.raycast(
  origin,
  direction,
  meshHandle
);

if (hit) {
  console.log('Hit point:', hit.point);
  console.log('Hit normal:', hit.normal);
}
```

### Advanced Services

#### `pbrClient.ts`
PBR texture generation and baking:

```typescript
import { pbrService } from '@/three-d/services/pbrClient';

const textures = await pbrService.generatePBR(mesh, {
  resolution: 2048,
  aoSamples: 64,
  curvatureSamples: 32
});
```

#### `atlasClient.ts`
UV atlas packing and optimization:

```typescript
import { atlasService } from '@/three-d/services/atlasClient';

const packed = await atlasService.pack(meshes, {
  resolution: 4096,
  padding: 4,
  rotateToFit: true
});
```

#### `maskClient.ts`
Smart masking system:

```typescript
import { maskService } from '@/three-d/services/maskClient';

// Mask by curvature
await maskService.maskByCurvature(mesh, {
  threshold: 0.5,
  invert: false
});

// Mask by height
await maskService.maskByHeight(mesh, {
  min: 0.2,
  max: 0.8
});
```

#### `dyntopoClient.ts`
Dynamic topology (Dyntopo) for adaptive mesh resolution:

```typescript
import { dyntopoService } from '@/three-d/services/dyntopoClient';

await dyntopoService.enable(mesh, {
  detailSize: 0.01,
  mode: 'relative'
});
```

## Systems

### `three/`
Core Three.js utilities and helpers:
- Scene management
- Camera controls
- Lighting systems
- Post-processing effects

### `materials/`
Material system and shader management:
- PBR materials
- Custom shaders
- Material presets
- Texture management

### `masking/`
Smart masking system for selective editing:
- Curvature-based masking
- Height-based masking
- Slope-based masking
- Cavity detection
- Mask painting and editing

### `terrain/`
GPU-accelerated terrain simulation:
- Hydraulic erosion
- Thermal erosion
- Sediment transport
- Real-time preview

### `uv/`
UV unwrapping and packing:
- LSCM unwrapping
- Atlas packing
- UV editing tools
- Seam management

### `baking/`
Texture baking system:
- Normal maps
- Ambient occlusion
- Curvature maps
- Thickness maps
- Color ID maps

### `viewport/`
3D viewport management:
- Camera controls
- Gizmos and manipulators
- Grid and helpers
- Selection system

### `layers-3d/`
3D layer management:
- Mesh layers
- Visibility and locking
- Layer hierarchy
- Thumbnail generation

### `brush-3d/`
3D brush system for sculpting:
- Brush presets
- Brush dynamics
- Alpha textures
- Symmetry modes

### `objects/`
3D object management:
- Primitive creation
- Object transforms
- Instancing
- LOD management

### `physics/`
Physics simulation:
- Rigid body dynamics
- Soft body simulation
- Cloth simulation
- Collision detection

### `studio/`
Studio lighting and rendering:
- HDRI environments
- Studio light rigs
- Shadow management
- Render settings

## Examples

### `sculpting/`
Full-featured digital sculpting application (ZBrush-style):
- Multi-resolution sculpting
- Dynamic topology
- Brush library
- Symmetry modes
- Layer system

### `paint/`
3D texture painting:
- Direct mesh painting
- PBR workflow
- Brush system
- Layer compositing

### `inspect/`
3D model inspector and analyzer:
- Mesh statistics
- Topology analysis
- UV visualization
- Normal inspection

### `atlas/`
UV atlas generation and packing:
- Automatic unwrapping
- Manual seam editing
- Atlas optimization
- Export tools

### `autopbr/`
Automatic PBR texture generation:
- AO baking
- Curvature maps
- Normal maps
- Material ID maps

### `scatter/`
Procedural scattering system:
- Instance scattering
- Weight painting
- Distribution controls
- Performance optimization

### `tecton/`
Procedural terrain generation:
- Heightmap generation
- Erosion simulation
- Biome placement
- Export tools

### `quantum/`
Particle system and simulations:
- N-body simulation
- Fluid dynamics
- Attractor systems
- Visualization

### `greeble/`
Procedural detail generation:
- Surface detailing
- Panel generation
- Mechanical details
- Sci-fi elements

### `cloner/`
Array and cloning tools:
- Linear arrays
- Radial arrays
- Path following
- Instance management

## Creating a 3D Application

### 1. Start with the Template

```typescript
// three-d/examples/my-app/MyApp.tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { AppShell } from '@/shared/shell';
import { sculptService } from '@/three-d/services/sculptClient';

export const MyApp: React.FC = () => {
  return (
    <AppShell>
      <ToolPanel>
        {/* Your 3D tools */}
      </ToolPanel>
      <Canvas>
        <OrbitControls />
        <ambientLight intensity={0.5} />
        <Scene />
      </Canvas>
    </AppShell>
  );
};
```

### 2. Use 3D Systems

```typescript
import { useMasking } from '@/three-d/systems/masking';
import { useLayerManager } from '@/three-d/systems/layers-3d';
import { useTerrain } from '@/three-d/systems/terrain';

const masking = useMasking();
const layers = useLayerManager();
const terrain = useTerrain();
```

### 3. Integrate GPU Services

```typescript
const handleSculpt = async (mesh: THREE.Mesh, points: Vector3[]) => {
  const handle = await sculptService.init(mesh);
  
  await sculptService.stroke(handle, {
    points,
    radius: brushSize,
    intensity: brushStrength,
    mode: isAddMode ? 'add' : 'subtract'
  });
  
  // Update mesh geometry
  const newGeometry = await sculptService.getGeometry(handle);
  mesh.geometry = newGeometry;
  
  await sculptService.dispose(handle);
};
```

### 4. Register Your Module

```typescript
// shared/config/modules.manifest.ts
{
  id: 'my-3d-app',
  name: 'My 3D App',
  category: '3d',
  entryComponent: lazy(() => import('@/three-d/examples/my-app')),
  requiredCapabilities: ['tauri', 'three', 'wgpu']
}
```

## Three.js Best Practices

### Memory Management

```typescript
// Always dispose of geometries and materials
const cleanup = () => {
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach(m => m.dispose());
  } else {
    mesh.material.dispose();
  }
};

// Dispose of textures
texture.dispose();

// Remove from scene
scene.remove(mesh);
```

### Performance Optimization

```typescript
// Use instancing for repeated objects
const instancedMesh = new THREE.InstancedMesh(
  geometry,
  material,
  count
);

// Frustum culling
mesh.frustumCulled = true;

// LOD (Level of Detail)
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);
lod.addLevel(mediumDetailMesh, 50);
lod.addLevel(lowDetailMesh, 100);
```

### Efficient Rendering

```typescript
// Use BufferGeometry
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

// Update only what changed
geometry.attributes.position.needsUpdate = true;

// Use indexed geometry
geometry.setIndex(indices);
```

## Shader Integration

3D applications have full access to the shader library:

```typescript
import { NAVIER_STOKES_FRAG } from '@/shaders/three-d/physics';
import { SIMPLEX_NOISE } from '@/shaders/utils/noise';
import { PBR_LIGHTING } from '@/shaders/three-d/lighting';

const material = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    ${SIMPLEX_NOISE}
    ${PBR_LIGHTING}
    
    varying vec2 vUv;
    
    void main() {
      // Your shader code
    }
  `,
  uniforms: {
    // Your uniforms
  }
});
```

## State Management

### Scene State
Use refs for Three.js objects:

```typescript
const sceneRef = useRef<THREE.Scene>(null);
const cameraRef = useRef<THREE.Camera>(null);
const meshRef = useRef<THREE.Mesh>(null);
```

### App State
Use Zustand for global 3D state:

```typescript
import { create } from 'zustand';

interface Scene3DState {
  activeMesh: THREE.Mesh | null;
  camera: THREE.Camera | null;
  setActiveMesh: (mesh: THREE.Mesh | null) => void;
}

export const useScene3DStore = create<Scene3DState>((set) => ({
  activeMesh: null,
  camera: null,
  setActiveMesh: (mesh) => set({ activeMesh: mesh })
}));
```

## Performance Tips

1. **Use Instancing**: For repeated geometry
2. **Implement LOD**: Multiple detail levels
3. **Frustum Culling**: Automatic with Three.js
4. **Occlusion Culling**: For complex scenes
5. **Texture Atlasing**: Reduce draw calls
6. **Geometry Merging**: Combine static meshes
7. **GPU Compute**: Offload to Rust backend
8. **Web Workers**: For heavy CPU tasks

## Testing

### Unit Tests

```typescript
describe('SculptService', () => {
  it('should initialize sculpting session', async () => {
    const mesh = createTestMesh();
    const handle = await sculptService.init(mesh);
    expect(handle).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
describe('Masking System', () => {
  it('should apply curvature mask correctly', async () => {
    const mesh = createTestMesh();
    await maskService.maskByCurvature(mesh, { threshold: 0.5 });
    
    const mask = await maskService.getMask(mesh);
    expect(mask).toBeDefined();
  });
});
```

## Common Patterns

### Brush Stroke System

```typescript
interface BrushStroke {
  points: THREE.Vector3[];
  normals: THREE.Vector3[];
  pressures: number[];
  radius: number;
  intensity: number;
}

const applyBrushStroke = async (stroke: BrushStroke) => {
  await sculptService.stroke(meshHandle, {
    points: stroke.points,
    radius: stroke.radius,
    intensity: stroke.intensity,
    mode: brushMode
  });
};
```

### Layer Compositing

```typescript
const compositeLayers = (layers: Layer3D[]) => {
  const merged = new THREE.BufferGeometry();
  
  layers.filter(l => l.visible).forEach(layer => {
    merged.merge(layer.mesh.geometry);
  });
  
  return merged;
};
```

### Undo/Redo for Geometry

```typescript
class GeometryHistory {
  private history: THREE.BufferGeometry[] = [];
  private currentIndex = -1;
  
  snapshot(geometry: THREE.BufferGeometry) {
    const clone = geometry.clone();
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(clone);
    this.currentIndex++;
  }
  
  undo(): THREE.BufferGeometry | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex].clone();
    }
    return null;
  }
}
```

## GPU Backend Integration

All heavy operations are offloaded to the Rust GPU backend:

```typescript
// Frontend (TypeScript)
const result = await sculptService.stroke(handle, params);

// ↓ Tauri IPC ↓

// Backend (Rust)
#[tauri::command]
async fn app_sculpt_stroke(
    handle: usize,
    params: BrushParams
) -> Result<(), String> {
    // GPU compute with WGPU
    gpu_sculpt_stroke(handle, params)
}
```

## Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [Drei Helpers](https://github.com/pmndrs/drei)
- [Shader Library](../shaders/README.md)
- [GPU Backend](../../crates/k-os-gpu-pipeline/README.md)

## Contributing

When adding new 3D features:

1. Use Three.js and React Three Fiber
2. Offload heavy operations to GPU backend
3. Use shared primitives for UI
4. Document your systems with README files
5. Add usage examples
6. Write tests for core functionality
7. Follow existing patterns

## Migration Notes

If you're migrating from the old structure:
- Old `src/systems/three/` → `three-d/systems/`
- Old `src/apps/sculpting/` → `three-d/examples/`
- Old `src/services/3d/` → `three-d/services/`
