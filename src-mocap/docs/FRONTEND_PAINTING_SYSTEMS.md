# Frontend Painting Systems - Complete Reference

**Last Updated**: 2024
**Purpose**: Comprehensive documentation of ALL frontend systems that connect to the GPU backend for texture painting, sculpting, and PBR workflows.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [SVT (Sparse Virtual Texturing) System](#svt-system)
3. [Services Layer](#services-layer)
4. [Brush System](#brush-system)
5. [Mask System](#mask-system)
6. [Layer System](#layer-system)
7. [UV System](#uv-system)
8. [Shader Library](#shader-library)
9. [Paint Engine Integration](#paint-engine-integration)
10. [Data Flow](#data-flow)
11. [Performance Optimization](#performance-optimization)

---

## Architecture Overview

### System Hierarchy

```
User Input (Mouse/Tablet)
    ↓
Paint Engine (PaintSystem.ts)
    ↓
┌─────────────┬──────────────┬─────────────┬──────────────┐
│   Brush     │    Mask      │   Layer     │     UV       │
│   System    │   System     │   System    │   System     │
└─────────────┴──────────────┴─────────────┴──────────────┘
    ↓               ↓              ↓              ↓
┌────────────────────────────────────────────────────────┐
│              Services Layer (TypeScript)                │
│  sculptClient | brushClient | pbrClient | raycastClient│
└────────────────────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────────────────────┐
│              Tauri IPC (Binary/JSON)                    │
└────────────────────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────────────────────┐
│              Rust GPU Backend                           │
│  gpu/pipelines/pbr.rs | gpu/brush/ | gpu/svt/         │
└────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Services wrap Tauri commands** - Never call `invoke()` directly from UI
2. **Binary IPC for performance** - Use binary variants for large data (10-50x faster)
3. **Ping-pong buffers** - All texture operations use double buffering
4. **GPU-first** - Leverage GPU compute whenever possible
5. **Shader composition** - Reuse shader library instead of writing new shaders


---

## SVT System

**Location**: `src-frontend/three-d/systems/svt/`

### Purpose
Sparse Virtual Texturing system for streaming massive texture sets (8K+) with page-based management and LOD.

### Files

#### `svtPbrClient.ts` - Main SVT PBR Client
**Purpose**: High-level API for PBR texture painting with virtual texturing

**Key Functions**:
```typescript
class SvtPbrClient {
  // Initialize SVT session with resolution
  async init(resolution: number): Promise<number>
  
  // Paint stroke on PBR channels
  async paintStroke(
    handle: number,
    points: Float32Array,
    brush: BrushParams,
    channels: string[]
  ): Promise<void>
  
  // Export texture channel
  async exportChannel(
    handle: number,
    channel: string,
    path: string
  ): Promise<void>
  
  // Dispose session
  async dispose(handle: number): Promise<void>
}
```

**Usage Example**:
```typescript
import { svtPbrClient } from '@/three-d/systems/svt';

// Initialize
const handle = await svtPbrClient.init(4096);

// Paint
const points = new Float32Array([x, y, z, ...]);
await svtPbrClient.paintStroke(handle, points, {
  size: 50,
  hardness: 0.5,
  flow: 0.8,
  color: '#ff0000'
}, ['albedo', 'roughness']);

// Export
await svtPbrClient.exportChannel(handle, 'albedo', 'output.png');

// Cleanup
await svtPbrClient.dispose(handle);
```

**Performance Notes**:
- Supports 8K+ textures without memory issues
- Page streaming reduces VRAM usage by 80%
- LOD system for real-time preview

#### `SvtTextureSync.ts` - Texture Synchronization
**Purpose**: Manages texture page streaming and GPU synchronization

**Key Features**:
- Async page loading
- Cache management
- Dirty page tracking
- GPU upload batching

**API**:
```typescript
class SvtTextureSync {
  // Request texture page
  requestPage(pageId: number): Promise<TextureData>
  
  // Mark page as dirty (needs upload)
  markDirty(pageId: number): void
  
  // Flush dirty pages to GPU
  flushToGpu(): Promise<void>
  
  // Evict least-recently-used pages
  evictPages(count: number): void
}
```

#### `svtClient.ts` - Low-level SVT API
**Purpose**: Direct access to SVT backend

**Functions**:
```typescript
// Initialize SVT atlas
async initSvt(resolution: number, pageSize: number): Promise<number>

// Allocate virtual texture
async allocateTexture(handle: number, width: number, height: number): Promise<number>

// Update texture page
async updatePage(handle: number, pageId: number, data: Uint8Array): Promise<void>
```

### Backend Connection
- **Rust**: `crates/k-os-gpu-pipeline/src/svt/`
- **Tauri Commands**: `app_svt_init`, `app_svt_paint`, `app_svt_export`


---

## Services Layer

**Location**: `src-frontend/three-d/services/`

### Purpose
Typed TypeScript wrappers for Tauri commands. Provides error handling, type safety, and performance optimization.

### Service Pattern
```typescript
class BaseService {
  protected async invoke<T>(cmd: string, args?: any): Promise<T> {
    try {
      return await tauriInvoke(cmd, args);
    } catch (error) {
      this.handleError(error, cmd);
      throw error;
    }
  }
}
```

### sculptClient.ts - Sculpting Service

**Purpose**: High-performance brush operations for 3D sculpting

**Key Features**:
- Binary IPC for 10-50x faster mesh transfer
- GPU compute support (30x faster brushing)
- Batch stroke operations
- Rust-computed normals (SIMD optimized)

**API**:
```typescript
interface BrushResult {
  modified_indices: number[];
  new_positions: number[];
  new_normals?: number[];
  time_ms: number;
  affected_count: number;
  used_gpu: boolean;
}

const rustSculpt = {
  // Initialize mesh (BINARY - FAST!)
  initMeshBinary(
    positions: Float32Array,
    indices: Uint32Array
  ): Promise<number>
  
  // Apply brush stroke
  applyBrush(
    handle: number,
    point: [number, number, number],
    normal: [number, number, number],
    tool: string,
    radius: number,
    intensity: number,
    symmetry?: 'X' | 'NONE',
    useGpu?: boolean,
    alphaHandle?: number | null,
    delta?: [number, number, number] | null
  ): Promise<BrushResult | null>
  
  // Binary variant (2-5x faster)
  applyBrushBinary(...): Promise<DecodedBrushResult | null>
  
  // Batch strokes (10-20x less IPC overhead)
  applyBrushBatch(
    handle: number,
    strokes: Array<{
      point: [number, number, number];
      normal: [number, number, number];
      radius: number;
      intensity: number;
    }>,
    tool: string
  ): Promise<BrushResult | null>
  
  // Update positions (binary)
  updatePositionsBinary(
    handle: number,
    positions: Float32Array
  ): Promise<boolean>
  
  // Get positions (binary)
  getPositionsBinary(handle: number): Promise<Float32Array | null>
  
  // Cleanup
  dispose(handle: number): Promise<void>
}
```

**Usage Example**:
```typescript
import { rustSculpt, applyBrushResultToGeometry } from '@/three-d/services/sculptClient';

// Initialize
const handle = await rustSculpt.initMeshBinary(
  geometry.attributes.position.array,
  geometry.index.array
);

// Sculpt
const result = await rustSculpt.applyBrush(
  handle,
  [0, 0, 0],      // point
  [0, 1, 0],      // normal
  'clay',         // tool
  0.15,           // radius
  0.6,            // intensity
  'X',            // symmetry
  true            // useGpu
);

// Apply to geometry
if (result) {
  applyBrushResultToGeometry(geometry, result);
}
```

**Performance Tips**:
- Use `initMeshBinary` for meshes > 50k verts (10-50x faster than JSON)
- Use `applyBrushBinary` for 2-5x faster strokes
- Use `applyBrushBatch` for stroke interpolation (10-20x less overhead)
- Enable `useGpu` for 30x faster brushing on large meshes

**Backend**: `crates/k-os-gpu-pipeline/src/sculpt.rs`


### brushClient.ts - Brush Library Service

**Purpose**: Data-driven brush system with presets, curves, and textures

**Key Features**:
- Brush asset management
- Kernel families (stamp, smooth, grab, pinch)
- Pressure/speed/tilt curves
- Alpha texture support
- Fallback brushes for browser mode

**Data Structures**:
```typescript
interface KBrushAsset {
  id: string;
  name: string;
  category: string;
  tags: string[];
  
  kernel: {
    family: 'stamp' | 'smooth' | 'grab' | 'pinch';
    shader: string;
  };
  
  params: {
    radius: number;
    strength: number;
    hardness: number;
    spacing: number;
    accumulate: boolean;
    subtract: boolean;
    front_faces_only: boolean;
    alpha_enabled: boolean;
    jitter_position: number;
    jitter_rotation: number;
    jitter_strength: number;
    // ... more params
  };
  
  textures: {
    alpha?: string;
    normal?: string;
    roughness?: string;
  };
}
```

**API**:
```typescript
class BrushLibraryClient {
  // Initialize library
  async init(): Promise<void>
  
  // Get all brushes
  getAllBrushes(): KBrushAsset[]
  
  // Get by category
  getBrushesByCategory(category: string): KBrushAsset[]
  
  // Get specific brush
  getBrush(id: string): KBrushAsset | undefined
  
  // Save custom brush
  async saveBrush(brush: KBrushAsset): Promise<void>
  
  // Delete brush
  async deleteBrush(id: string): Promise<void>
  
  // Get default brush
  getDefaultBrush(): KBrushAsset
}

export const brushClient = new BrushLibraryClient();
```

**Built-in Brushes**:
- `clay` - Standard clay buildup
- `draw` - Precise stroke drawing
- `smooth` - Laplacian smoothing
- `move` - Grab/move vertices
- `flatten` - Flatten to plane
- `inflate` - Expand along normals
- `pinch` - Pinch/crease
- `scrape` - Trim/subtract
- `crease` - Sharp creases
- `snake_hook` - Pull/drag

**Usage**:
```typescript
import { brushClient } from '@/three-d/services/brushClient';

// Initialize
await brushClient.init();

// Get brush
const clayBrush = brushClient.getBrush('clay');

// Use brush params
const params = {
  ...clayBrush.params,
  radius: 0.2,  // Override
  strength: 0.8
};
```

**Backend**: `crates/k-os-brushes/src/`


### pbrClient.ts - PBR Generation Service

**Purpose**: Physically-based rendering material generation and management

**API**:
```typescript
class PBRService {
  // Generate PBR material from photos
  async generateMaterial(
    photos: string[],
    params: MaterialGenParams
  ): Promise<MaterialData>
  
  // Apply preset material
  async applyPreset(
    handle: number,
    presetId: string
  ): Promise<void>
  
  // Update PBR parameters
  async updatePBRParams(
    handle: number,
    params: {
      metallic: number;
      roughness: number;
      normalStrength: number;
      aoStrength: number;
    }
  ): Promise<void>
  
  // Bake PBR channels
  async bakePBR(
    handle: number,
    resolution: number
  ): Promise<{
    albedo: Uint8Array;
    normal: Uint8Array;
    roughness: Uint8Array;
    metallic: Uint8Array;
    ao: Uint8Array;
  }>
}

export const pbrService = new PBRService();
```

**Backend**: `crates/k-os-gpu-pipeline/src/pipelines/pbr.rs`

### raycastClient.ts - GPU Raycasting Service

**Purpose**: High-performance raycasting for painting and selection

**Features**:
- GPU-accelerated BVH traversal
- Multi-ray batching
- UV coordinate calculation
- Normal computation

**API**:
```typescript
interface RaycastResult {
  hit: boolean;
  point: [number, number, number];
  normal: [number, number, number];
  uv: [number, number];
  distance: number;
  faceIndex: number;
}

class RaycastService {
  // Single ray
  async raycast(
    handle: number,
    origin: [number, number, number],
    direction: [number, number, number]
  ): Promise<RaycastResult | null>
  
  // Batch rays (10x faster)
  async raycastBatch(
    handle: number,
    rays: Array<{
      origin: [number, number, number];
      direction: [number, number, number];
    }>
  ): Promise<RaycastResult[]>
}

export const raycastService = new RaycastService();
```

**Usage**:
```typescript
import { raycastService } from '@/three-d/services/raycastClient';

const result = await raycastService.raycast(
  meshHandle,
  [0, 0, 5],    // origin
  [0, 0, -1]    // direction
);

if (result?.hit) {
  console.log('Hit at:', result.point);
  console.log('UV:', result.uv);
}
```

**Backend**: `crates/k-os-gpu-pipeline/src/raycast/`

### Other Services

#### `meshClient.ts` - Mesh Operations
- Decimation, subdivision, remeshing
- Normal/tangent computation
- Mesh optimization

#### `dynameshClient.ts` - Dynamic Topology
- Adaptive subdivision
- Edge collapse
- Topology preservation

#### `atlasClient.ts` - UV Atlas Packing
- Automatic UV unwrapping
- Island packing
- Margin control


---

## Brush System

**Location**: `backup/paint/engine/` (to be extracted to `src-frontend/three-d/systems/brush-3d/`)

### Purpose
Frontend brush dynamics, alpha maps, and stroke interpolation

### Key Components

#### Brush Parameters
```typescript
interface BrushParams {
  // Core
  size: number;           // Brush radius in pixels
  hardness: number;       // 0.0 (soft) to 1.0 (hard)
  flow: number;           // Paint flow rate
  opacity: number;        // Overall opacity
  
  // Color/Material
  color: string;          // Hex color
  roughness: number;      // PBR roughness
  metalness: number;      // PBR metalness
  emission: number;       // Emission strength
  
  // Dynamics
  angle: number;          // Brush rotation
  alphaMap: THREE.Texture | null;  // Alpha texture
  
  // Projection
  projectionMode: boolean;
  worldPos: THREE.Vector3;
  
  // Smart Masking
  smartMask?: {
    edge: number;         // -1 (cavity) to 1 (edge)
    slope: number;        // -1 (bottom) to 1 (top)
    height: number;       // -1 (low) to 1 (high)
  };
  
  // Seamless
  isSeamless: boolean;    // Wrap at texture edges
}
```

#### Alpha Maps
**Purpose**: Modulate brush intensity with textures

**Usage**:
```typescript
// Load alpha texture
const alphaMap = textureLoader.load('/brushes/soft-round.png');

// Apply to brush
const params = {
  ...baseParams,
  alphaMap: alphaMap,
  angle: Math.random() * Math.PI * 2  // Random rotation
};
```

**Common Alpha Maps**:
- Soft round (Gaussian falloff)
- Hard round (Sharp edge)
- Square
- Noise (organic texture)
- Custom stamps

#### Brush Dynamics
**Purpose**: Vary brush parameters based on input

**Supported Dynamics**:
- **Pressure**: Tablet pressure → size/opacity
- **Velocity**: Stroke speed → size/spacing
- **Tilt**: Pen tilt → angle/shape
- **Random**: Jitter position/rotation/strength

**Implementation**:
```typescript
function applyDynamics(
  baseParams: BrushParams,
  pressure: number,
  velocity: number,
  tilt: number
): BrushParams {
  return {
    ...baseParams,
    size: baseParams.size * pressure,
    opacity: baseParams.opacity * pressure,
    angle: baseParams.angle + tilt * Math.PI / 4,
    // ... more dynamics
  };
}
```

### Stroke Interpolation
**Purpose**: Generate smooth strokes between input points

**Algorithm**:
```typescript
function interpolateStroke(
  start: THREE.Vector2,
  end: THREE.Vector2,
  spacing: number
): THREE.Vector2[] {
  const distance = start.distanceTo(end);
  const steps = Math.ceil(distance / spacing);
  const points: THREE.Vector2[] = [];
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push(new THREE.Vector2().lerpVectors(start, end, t));
  }
  
  return points;
}
```

**Usage**:
```typescript
// Interpolate between mouse positions
const points = interpolateStroke(lastPos, currentPos, brush.spacing);

// Paint each point
for (const point of points) {
  await paintEngine.paint(point, brushParams, layer, channels);
}
```


---

## Mask System

**Location**: `backup/paint/engine/MaskSystem.ts`

### Purpose
Dedicated high-precision masking buffer with add/subtract painting modes

### Architecture
```typescript
class MaskSystem {
  renderer: THREE.WebGLRenderer;
  target: THREE.WebGLRenderTarget;  // Single-channel float buffer
  
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  brushMesh: THREE.Mesh;
  brushMaterial: THREE.ShaderMaterial;
}
```

### Features

#### 1. Add/Subtract Modes
```typescript
// Add to mask (protect area)
maskSystem.paint(uv, brushParams, false);

// Subtract from mask (expose area)
maskSystem.paint(uv, brushParams, true);
```

**Blending**:
- **Add**: `THREE.AdditiveBlending` (Src + Dst)
- **Subtract**: `THREE.ReverseSubtractEquation` (Dst - Src)

#### 2. High-Precision Buffer
```typescript
// Float buffer for smooth gradients
const target = new THREE.WebGLRenderTarget(size, size, {
  type: THREE.HalfFloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter
});
```

#### 3. Integration with Paint System
```typescript
// Mask is automatically applied in brush shader
uniform sampler2D uMaskMap;
uniform bool uUseMask;

void main() {
  // ... brush logic ...
  
  if (uUseMask) {
    float maskVal = texture2D(uMaskMap, vMapUV).r;
    alpha *= (1.0 - maskVal);  // Reduce alpha in masked areas
  }
  
  gl_FragColor = vec4(outColor, alpha * uOpacity);
}
```

### API

```typescript
class MaskSystem {
  // Clear mask to black
  clear(): void
  
  // Paint on mask
  paint(
    uv: THREE.Vector2,
    params: BrushParams,
    subtract: boolean = false
  ): void
  
  // Get mask texture
  getTexture(): THREE.Texture
  
  // Dispose resources
  dispose(): void
}
```

### Usage Example
```typescript
import { MaskSystem } from './MaskSystem';

const maskSystem = new MaskSystem(renderer, 2048);

// Clear mask
maskSystem.clear();

// Add to mask (protect)
maskSystem.paint(new THREE.Vector2(0.5, 0.5), {
  size: 100,
  hardness: 0.5,
  flow: 0.8,
  opacity: 1.0
}, false);

// Subtract from mask (expose)
maskSystem.paint(new THREE.Vector2(0.6, 0.6), {
  size: 50,
  hardness: 0.7,
  flow: 1.0,
  opacity: 1.0
}, true);

// Use mask in painting
paintEngine.brushMaterial.uniforms.uMaskMap.value = maskSystem.target.texture;
paintEngine.brushMaterial.uniforms.uUseMask.value = true;
```

### Smart Masks
**Purpose**: Procedural masking based on mesh geometry

**Types**:
1. **Edge/Cavity Mask**: Based on curvature
2. **Slope Mask**: Based on surface normal (top/bottom facing)
3. **Height Mask**: Based on world position Y

**Implementation**:
```typescript
// Enable smart mask
brushParams.smartMask = {
  edge: 0.8,      // Paint only on edges (convex areas)
  slope: 0.5,     // Paint only on top-facing surfaces
  height: 0.0     // No height restriction
};

// Smart mask is evaluated in brush shader
if (uUseSmartMask) {
  // Edge/Cavity
  if (abs(uEdgeMask) > 0.01) {
    vec4 curv = texture2D(uCurvatureMap, meshUV);
    float edge = curv.r;
    if (uEdgeMask > 0.0) {
      alpha *= smoothstep(1.0 - uEdgeMask, 1.0, edge);
    }
  }
  
  // Slope
  if (abs(uSlopeMask) > 0.01) {
    vec3 norm = texture2D(uNormalMap, meshUV).xyz * 2.0 - 1.0;
    float up = norm.y;
    if (uSlopeMask > 0.0) {
      alpha *= smoothstep(1.0 - uSlopeMask, 1.0, up);
    }
  }
  
  // Height
  if (abs(uHeightMask) > 0.01) {
    float height = texture2D(uPositionMap, meshUV).y;
    alpha *= smoothstep(uHeightMask - 0.2, uHeightMask + 0.2, height);
  }
}
```

**Baked Maps Required**:
- `uCurvatureMap` - Computed from normals
- `uNormalMap` - World-space normals
- `uPositionMap` - World-space positions


---

## Layer System

**Location**: `src-frontend/three-d/systems/layers-3d/`

### Purpose
Universal layer management for 2D and 3D painting with ping-pong buffers and compositing

### Architecture

#### PaintLayer Structure
```typescript
class PaintLayer {
  id: string;
  name: string;
  
  // Ping-pong buffers for each channel
  channels: {
    albedo: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    normal: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    roughness: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    metalness: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    emission: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  };
  
  // Fluid simulation buffers
  fluid: {
    velocity: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    pressure: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    divergence: THREE.WebGLRenderTarget;
  };
  
  visible: boolean;
  opacity: number;
  
  // Ping-pong helpers
  getRead(channel: string): THREE.WebGLRenderTarget
  getWrite(channel: string): THREE.WebGLRenderTarget
  swap(channel: string): void
}
```

### Ping-Pong Pattern
**Purpose**: Avoid read-write conflicts on GPU

**Flow**:
```
1. Read from buffer[0]
2. Write to buffer[1]
3. Swap: buffer[0] ↔ buffer[1]
4. Repeat
```

**Implementation**:
```typescript
// Paint operation
const readTarget = layer.getRead('albedo');
const writeTarget = layer.getWrite('albedo');

// 1. Copy previous state
renderer.setRenderTarget(writeTarget);
copyMaterial.uniforms.tDiffuse.value = readTarget.texture;
renderer.render(copyScene, copyCamera);

// 2. Paint new strokes
renderer.render(paintScene, paintCamera);

// 3. Swap buffers
layer.swap('albedo');
```

### Layer Operations

#### Create Layer
```typescript
const layer = new PaintLayer('layer1', 'Base Layer', 2048, 2048);
```

#### Fill Layer
```typescript
paintEngine.fillLayer(layer, {
  albedo: [0.5, 0.5, 0.5, 1.0],
  normal: [0.5, 0.5, 1.0, 1.0],
  roughness: [0.5, 0, 0, 1.0],
  metalness: [0, 0, 0, 1.0],
  emission: [0, 0, 0, 1.0]
});
```

#### Clear Layer
```typescript
paintEngine.clearLayer(layer);
```

#### Compose Layers
```typescript
// Composite all layers into final output
paintEngine.compose(
  [layer1, layer2, layer3],  // Source layers
  outputLayer                 // Destination
);
```

**Compositing Algorithm**:
```glsl
// For each channel
for (const layer of layers) {
  if (!layer.visible || layer.opacity <= 0.001) continue;
  
  // Alpha blend
  vec4 src = texture2D(layer.texture, uv);
  vec4 dst = currentColor;
  
  float alpha = src.a * layer.opacity;
  currentColor = mix(dst, src, alpha);
}
```

### UniversalLayerPanel Component

**Location**: `src-frontend/three-d/systems/layers-3d/UniversalLayerPanel.tsx`

**Purpose**: Reusable layer UI for any painting application

**Props**:
```typescript
interface UniversalLayerPanelProps {
  manager: LayerManager;
  onLayerSelect?: (layer: Layer) => void;
  renderThumbnail?: (layer: Layer) => React.ReactNode;
  accentColor?: string;
}
```

**Features**:
- Drag-and-drop reordering
- Visibility toggle
- Opacity slider
- Blend mode selection
- Layer thumbnails
- Add/delete/duplicate

**Usage**:
```typescript
import { UniversalLayerPanel } from '@/three-d/systems/layers-3d';

function MyPaintApp() {
  const layerManager = useLayerManager();
  
  return (
    <UniversalLayerPanel
      manager={layerManager}
      onLayerSelect={(layer) => setActiveLayer(layer)}
      renderThumbnail={(layer) => <LayerThumbnail layer={layer} />}
      accentColor="blue"
    />
  );
}
```

### Layer Manager Hook
```typescript
function useLayerManager() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  
  const addLayer = useCallback((layer: Partial<Layer>) => {
    // ...
  }, []);
  
  const removeLayer = useCallback((id: string) => {
    // ...
  }, []);
  
  const reorderLayers = useCallback((startIndex: number, endIndex: number) => {
    // ...
  }, []);
  
  return {
    layers,
    activeLayerId,
    addLayer,
    removeLayer,
    reorderLayers,
    // ... more operations
  };
}
```


---

## UV System

**Location**: `src-frontend/three-d/systems/uv/`

### Purpose
UV unwrapping, projection, and editing for texture painting

### Components

#### UVProjection.ts - UV Projection Methods

**Supported Projections**:
```typescript
enum ProjectionType {
  PLANAR = 'planar',
  CYLINDRICAL = 'cylindrical',
  SPHERICAL = 'spherical',
  BOX = 'box',
  CAMERA = 'camera'
}
```

**API**:
```typescript
class UVProjection {
  // Project UVs onto mesh
  static project(
    geometry: THREE.BufferGeometry,
    type: ProjectionType,
    axis: 'X' | 'Y' | 'Z' = 'Y',
    scale: number = 1.0
  ): void
  
  // Planar projection
  static planar(
    geometry: THREE.BufferGeometry,
    axis: 'X' | 'Y' | 'Z'
  ): void
  
  // Cylindrical projection
  static cylindrical(
    geometry: THREE.BufferGeometry,
    axis: 'X' | 'Y' | 'Z'
  ): void
  
  // Spherical projection
  static spherical(geometry: THREE.BufferGeometry): void
  
  // Box projection (6-sided)
  static box(geometry: THREE.BufferGeometry): void
  
  // Camera-based projection
  static camera(
    geometry: THREE.BufferGeometry,
    camera: THREE.Camera
  ): void
}
```

**Usage**:
```typescript
import { UVProjection } from '@/three-d/systems/uv';

// Planar projection
UVProjection.project(geometry, 'planar', 'Y', 1.0);

// Cylindrical projection
UVProjection.project(geometry, 'cylindrical', 'Y', 1.0);

// Camera projection (for decals)
UVProjection.camera(geometry, camera);
```

#### UVEditor.ts - Interactive UV Editing

**Features**:
- Island selection
- Transform (move, rotate, scale)
- Unwrap/pack
- Seam editing

**API**:
```typescript
class UVEditor {
  // Select UV island
  selectIsland(uv: THREE.Vector2): number[]
  
  // Transform selected UVs
  transform(
    indices: number[],
    translation: THREE.Vector2,
    rotation: number,
    scale: THREE.Vector2
  ): void
  
  // Pack UV islands
  pack(
    geometry: THREE.BufferGeometry,
    margin: number = 0.01
  ): void
  
  // Mark seam edge
  markSeam(edgeIndex: number): void
  
  // Unwrap from seams
  unwrap(geometry: THREE.BufferGeometry): void
}
```

#### LSCMSolver.ts - Least Squares Conformal Maps

**Purpose**: High-quality UV unwrapping algorithm

**Features**:
- Angle-preserving unwrapping
- Minimal distortion
- Automatic seam detection

**API**:
```typescript
class LSCMSolver {
  // Unwrap mesh with LSCM
  static unwrap(
    geometry: THREE.BufferGeometry,
    seamEdges?: number[]
  ): void
  
  // Compute distortion metric
  static computeDistortion(
    geometry: THREE.BufferGeometry
  ): number
}
```

#### AtlasPacker.ts - UV Atlas Packing

**Purpose**: Efficiently pack UV islands into texture space

**Algorithm**: Maxrects bin packing

**API**:
```typescript
class AtlasPacker {
  // Pack UV islands
  static pack(
    islands: UVIsland[],
    width: number,
    height: number,
    margin: number = 0.01
  ): PackResult
  
  // Optimize packing
  static optimize(
    islands: UVIsland[],
    iterations: number = 100
  ): PackResult
}

interface UVIsland {
  vertices: THREE.Vector2[];
  indices: number[];
}

interface PackResult {
  islands: UVIsland[];
  utilization: number;  // 0.0 to 1.0
  wasted: number;       // Wasted space
}
```

### Usage Example
```typescript
import { UVProjection, LSCMSolver, AtlasPacker } from '@/three-d/systems/uv';

// 1. Initial projection
UVProjection.project(geometry, 'cylindrical', 'Y');

// 2. Mark seams (optional)
const seams = detectSeams(geometry);

// 3. Unwrap with LSCM
LSCMSolver.unwrap(geometry, seams);

// 4. Pack islands
const islands = extractIslands(geometry);
const packed = AtlasPacker.pack(islands, 1024, 1024, 0.01);

// 5. Apply packed UVs
applyPackedUVs(geometry, packed);
```

### Backend Integration
- **Rust**: `crates/k-os-gpu-pipeline/src/atlas/`
- **Tauri Commands**: `app_uv_unwrap`, `app_uv_pack`


---

## Shader Library

**Location**: `src-frontend/shaders/`

### Purpose
World-class collection of production-ready GPU shaders organized by functionality

### Organization

```
shaders/
├── color.ts          # 8 shaders - Color manipulation
├── filters.ts        # 10 shaders - Image filters
├── generators.ts     # 3 shaders - Procedural generation
├── lighting.ts       # 1 shader - Lighting utilities
├── math.ts           # 10 shaders - Math functions
├── noise.ts          # 12 shaders - Noise functions
├── physics.ts        # 8 shaders - Physics simulation
├── simulations.ts    # 4 shaders - Simulation effects
├── terrain.ts        # 2 shaders - Terrain rendering
└── uncategorized.ts  # 12 shaders - Misc utilities
```

### Key Shaders for Painting

#### BRUSH_FRAG - Main Brush Shader
**Purpose**: Core painting shader with masking and smart masks

**Uniforms**:
```glsl
// Core
uniform vec3 uColor;
uniform float uOpacity;
uniform float uHardness;
uniform float uAngle;

// Textures
uniform sampler2D uBrushAlpha;
uniform bool uUseBrushAlpha;
uniform sampler2D uSrcTex;
uniform bool uUseSrcTex;

// Masking
uniform sampler2D uMaskMap;
uniform bool uUseMask;

// Smart Masks
uniform bool uUseSmartMask;
uniform sampler2D uCurvatureMap;
uniform sampler2D uNormalMap;
uniform sampler2D uPositionMap;
uniform float uEdgeMask;
uniform float uSlopeMask;
uniform float uHeightMask;

// Projection
uniform bool uProjectionMode;
uniform vec3 uBrushPos;
uniform float uBrushRadius;
```

**Features**:
- Hardness falloff
- Alpha texture support
- Rotation
- Global masking
- Smart masking (edge/slope/height)
- 2D UV and 3D projection modes
- Seamless tiling

**Usage**:
```typescript
import { BRUSH_FRAG } from '@/shaders/filters';

const brushMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: new THREE.Color(1, 0, 0) },
    uOpacity: { value: 0.8 },
    uHardness: { value: 0.5 },
    // ... more uniforms
  },
  vertexShader: BRUSH_VERT,
  fragmentShader: BRUSH_FRAG,
  transparent: true,
  blending: THREE.NormalBlending
});
```

#### SIMPLEX_NOISE - Simplex Noise Function
**Purpose**: High-quality procedural noise

**Usage**:
```glsl
// Import in shader
${SIMPLEX_NOISE}

void main() {
  float n = snoise(vUv * 10.0);
  gl_FragColor = vec4(vec3(n), 1.0);
}
```

**Applications**:
- Procedural textures
- Terrain generation
- Brush jitter
- Organic patterns

#### FLUID_* Shaders - Navier-Stokes Fluid Simulation
**Purpose**: Real-time fluid simulation for paint flow

**Shaders**:
- `FLUID_ADVECT` - Advect velocity/material
- `FLUID_DIV` - Compute divergence
- `FLUID_PRESS` - Pressure solve (Jacobi)
- `FLUID_GRAD` - Subtract pressure gradient
- `FLUID_SPLAT` - Add velocity splat

**Usage**:
```typescript
import { 
  FLUID_ADVECT, 
  FLUID_DIV, 
  FLUID_PRESS, 
  FLUID_GRAD, 
  FLUID_SPLAT 
} from '@/shaders/physics';

// Fluid simulation step
function stepFluid(layer: PaintLayer) {
  // 1. Advect velocity
  advectMaterial.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
  renderer.setRenderTarget(layer.fluid.velocity[1]);
  renderer.render(scene, camera);
  swapBuffers(layer.fluid.velocity);
  
  // 2. Compute divergence
  divMaterial.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
  renderer.setRenderTarget(layer.fluid.divergence);
  renderer.render(scene, camera);
  
  // 3. Solve pressure (5 iterations)
  for (let i = 0; i < 5; i++) {
    pressMaterial.uniforms.pressureTex.value = layer.fluid.pressure[0].texture;
    pressMaterial.uniforms.divergenceTex.value = layer.fluid.divergence.texture;
    renderer.setRenderTarget(layer.fluid.pressure[1]);
    renderer.render(scene, camera);
    swapBuffers(layer.fluid.pressure);
  }
  
  // 4. Subtract gradient
  gradMaterial.uniforms.pressureTex.value = layer.fluid.pressure[0].texture;
  gradMaterial.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
  renderer.setRenderTarget(layer.fluid.velocity[1]);
  renderer.render(scene, camera);
  swapBuffers(layer.fluid.velocity);
  
  // 5. Advect material channels
  for (const channel of ['albedo', 'normal', 'roughness']) {
    advectMaterial.uniforms.sourceTex.value = layer.getRead(channel).texture;
    renderer.setRenderTarget(layer.getWrite(channel));
    renderer.render(scene, camera);
    layer.swap(channel);
  }
}
```

#### CURVATURE_COMPUTE_FRAG - Curvature Detection
**Purpose**: Compute edge/cavity masks from normals

**Uniforms**:
```glsl
uniform sampler2D tNormal;
uniform vec2 resolution;
uniform float uSpread;  // Sampling radius
```

**Algorithm**:
```glsl
// Sample neighbors
vec3 n = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
vec3 nL = texture2D(tNormal, vUv - vec2(texel.x, 0.0)).xyz * 2.0 - 1.0;
vec3 nR = texture2D(tNormal, vUv + vec2(texel.x, 0.0)).xyz * 2.0 - 1.0;
vec3 nT = texture2D(tNormal, vUv + vec2(0.0, texel.y)).xyz * 2.0 - 1.0;
vec3 nB = texture2D(tNormal, vUv - vec2(0.0, texel.y)).xyz * 2.0 - 1.0;

// Compute curvature
float edge = length(n - nL) + length(n - nR) + length(n - nT) + length(n - nB);

// R = Edges (Convex), G = Cavities
gl_FragColor = vec4(edge, edge * 0.5, 0.0, 1.0);
```

**Usage**:
```typescript
import { CURVATURE_COMPUTE_FRAG } from '@/shaders/filters';

// Bake curvature map
curvatureMaterial.uniforms.tNormal.value = normalMap.texture;
curvatureMaterial.uniforms.uSpread.value = 3.0;  // 3px spread
renderer.setRenderTarget(curvatureMap);
renderer.render(scene, camera);
```


### Complete Shader Inventory

#### Color Shaders (8)
- `GRAVITY_FRAG` - Gravity-based color flow
- `FILTER_NORMAL_FRAG` - Normal map filtering
- `FILTER_PIXEL_SORT_FRAG` - Pixel sorting effect
- `FILTER_CHROMATIC_FRAG` - Chromatic aberration
- `FILTER_GLITCH_FRAG` - Glitch effect
- `FILTER_KALEIDOSCOPE_FRAG` - Kaleidoscope effect
- `FILTER_RGB_SPLIT_FRAG` - RGB channel split
- `FILTER_VIGNETTE_FRAG` - Vignette effect

#### Filter Shaders (10)
- `BRUSH_FRAG` - Main brush shader ⭐
- `CURVATURE_COMPUTE_FRAG` - Curvature detection ⭐
- `FILTER_BLUR_FRAG` - Gaussian blur
- `FILTER_LEVELS_FRAG` - Levels adjustment
- `FILTER_EDGE_FRAG` - Edge detection (Sobel)
- `SIM_THERMAL_FRAG` - Thermal simulation
- `FILTER_SHARPEN_FRAG` - Sharpen filter
- `FILTER_HSL_FRAG` - HSL color adjustment
- `FILTER_POSTERIZE_FRAG` - Posterize effect
- `BLACK_HOLE_FRAG` - Black hole distortion ⭐

#### Generator Shaders (3)
- `FLUID_GRAD` - Fluid gradient
- `GEN_PATTERN_FRAG` - Pattern generator
- `GEN_GRADIENT_FRAG` - Gradient generator

#### Math Shaders (10)
- `RANDOM_FUNCTION` - Random number generation
- `HASH_FUNCTION` - Hash function
- `FULLSCREEN_VERTEX` - Fullscreen quad vertex shader
- `ROTATE_UV` - UV rotation utility
- `SMOOTHSTEP` - Smoothstep function
- `REMAP` - Value remapping
- `CLAMP01` - Clamp to 0-1
- `LERP` - Linear interpolation
- `INVERSE_LERP` - Inverse lerp
- `SATURATE` - Saturate (clamp 0-1)

#### Noise Shaders (12)
- `SIMPLEX_NOISE` - Simplex noise ⭐
- `CURL_NOISE_FUNC` - Curl noise
- `VELOCITY_FRAGMENT` - Particle velocity
- `VORTEX_FRAG` - Vortex distortion
- `RIVULET_FRAG` - Rivulet flow
- `PHYSICS_FRAGMENT` - Physics simulation
- `SCULPT_FRAGMENT` - Terrain sculpting
- `RENDER_FRAGMENT` - Terrain rendering
- `GEN_NOISE_FRAG` - Noise generator
- `GEN_FBM_FRAG` - Fractal Brownian Motion
- `GEN_VORONOI_FRAG` - Voronoi noise
- `SIM_NEBULA_FRAG` - Nebula simulation

#### Physics Shaders (8)
- `FLUID_ADVECT` - Fluid advection ⭐
- `FLUID_DIV` - Divergence computation ⭐
- `FLUID_PRESS` - Pressure solve ⭐
- `FLUID_GRAD` - Gradient subtraction ⭐
- `FLUID_SPLAT` - Velocity splat ⭐
- `POSITION_FRAGMENT` - Particle position
- `RENDER_VERT` - Particle rendering
- `SIM_LIQUIFY_FRAG` - Liquify effect

#### Simulation Shaders (4)
- `SIM_DRIP_FRAG` - Drip simulation
- `SIM_BLEED_FRAG` - Bleed simulation
- `SIM_WIND_FRAG` - Wind simulation
- `SIM_REACTION_FRAG` - Reaction-diffusion

#### Terrain Shaders (2)
- `RENDER_VERTEX` - Terrain vertex shader
- `CURSOR_VERTEX` - Cursor projection

### Shader Composition Patterns

#### Pattern 1: Noise + Filter
```typescript
const material = new THREE.ShaderMaterial({
  fragmentShader: `
    ${SIMPLEX_NOISE}
    ${FILTER_BLUR_FRAG}
    
    void main() {
      float n = snoise(vUv * 10.0);
      vec4 blurred = blur(n);
      gl_FragColor = blurred;
    }
  `
});
```

#### Pattern 2: Multi-pass Effects
```typescript
// Pass 1: Generate noise
renderer.setRenderTarget(noiseTarget);
renderer.render(noiseScene, camera);

// Pass 2: Apply filter
filterMaterial.uniforms.tInput.value = noiseTarget.texture;
renderer.setRenderTarget(filterTarget);
renderer.render(filterScene, camera);

// Pass 3: Composite
compositeMaterial.uniforms.tNoise.value = noiseTarget.texture;
compositeMaterial.uniforms.tFilter.value = filterTarget.texture;
renderer.setRenderTarget(null);
renderer.render(compositeScene, camera);
```

#### Pattern 3: Shader Injection
```typescript
// Inject noise into existing shader
const modifiedShader = existingShader.replace(
  'void main() {',
  `
  ${SIMPLEX_NOISE}
  void main() {
  `
);
```

### Performance Tips

1. **Minimize texture lookups** - Cache texture samples
2. **Use lower precision** - `mediump` for mobile
3. **Avoid branching** - Use `mix()` instead of `if`
4. **Precompute constants** - Move calculations to CPU
5. **Use built-in functions** - `smoothstep()`, `mix()`, etc.


---

## Paint Engine Integration

**Location**: `backup/paint/engine/PaintSystem.ts`

### Purpose
Central orchestrator that integrates all painting systems

### Architecture

```typescript
class PaintEngine {
  renderer: THREE.WebGLRenderer;
  
  // Scenes
  paintScene: THREE.Scene;
  paintCamera: THREE.OrthographicCamera;
  copyScene: THREE.Scene;
  copyCamera: THREE.OrthographicCamera;
  bakeScene: THREE.Scene;
  
  // Materials
  brushMaterial: THREE.ShaderMaterial;
  copyMaterial: THREE.ShaderMaterial;
  fillMaterial: THREE.ShaderMaterial;
  bakeMaterials: {
    normal: THREE.ShaderMaterial;
    position: THREE.ShaderMaterial;
    curvature: THREE.ShaderMaterial;
  };
  simMaterials: {
    advect: THREE.ShaderMaterial;
    div: THREE.ShaderMaterial;
    press: THREE.ShaderMaterial;
    grad: THREE.ShaderMaterial;
    splat: THREE.ShaderMaterial;
    // ... simulation materials
  };
  
  // Sub-systems
  maskSystem: MaskSystem;
  
  // Baked maps
  meshMaps: {
    normal: THREE.WebGLRenderTarget;
    position: THREE.WebGLRenderTarget;
    curvature: THREE.WebGLRenderTarget;
  };
}
```

### Core Operations

#### 1. Bake Geometry Maps
**Purpose**: Pre-compute mesh data for smart masking and projection painting

```typescript
bakeGeometry(meshes: THREE.Mesh | THREE.Mesh[]): void {
  // 1. Bake world-space normals
  this.bakeScene.overrideMaterial = this.bakeMaterials.normal;
  this.renderer.setRenderTarget(this.meshMaps.normal);
  this.renderer.render(this.bakeScene, this.paintCamera);
  
  // 2. Bake world-space positions
  this.bakeScene.overrideMaterial = this.bakeMaterials.position;
  this.renderer.setRenderTarget(this.meshMaps.position);
  this.renderer.render(this.bakeScene, this.paintCamera);
  
  // 3. Compute curvature from normals
  this.bakeMaterials.curvature.uniforms.tNormal.value = this.meshMaps.normal.texture;
  this.renderer.setRenderTarget(this.meshMaps.curvature);
  this.renderer.render(this.copyScene, this.copyCamera);
  
  // 4. Assign to brush material
  this.brushMaterial.uniforms.uCurvatureMap.value = this.meshMaps.curvature.texture;
  this.brushMaterial.uniforms.uNormalMap.value = this.meshMaps.normal.texture;
  this.brushMaterial.uniforms.uPositionMap.value = this.meshMaps.position.texture;
}
```

**When to call**: Once per mesh, or when mesh transforms change

#### 2. Paint Operation
**Purpose**: Apply brush stroke to layer

```typescript
paint(
  uv: THREE.Vector2,
  brushParams: BrushParams,
  layer: PaintLayer,
  activeChannels: { [key: string]: boolean },
  targetMesh: THREE.Mesh,
  materialTextures?: any,
  isMasking: boolean = false,
  isEraseMask: boolean = false
): void
```

**Flow**:
```
1. Check if masking mode
   ├─ Yes: Paint on mask buffer
   └─ No: Continue to step 2

2. Setup brush uniforms
   ├─ Color, opacity, hardness
   ├─ Alpha map (if any)
   ├─ Smart mask parameters
   └─ Projection mode settings

3. For each active channel:
   ├─ Copy previous state (read → write)
   ├─ Render brush strokes
   │  ├─ Calculate seamless offsets
   │  ├─ Render at each offset
   │  └─ Apply masking
   └─ Swap buffers

4. Update mask system reference
```

#### 3. Batch Painting
**Purpose**: Paint multiple strokes efficiently

```typescript
paintBatch(
  ops: { uv: THREE.Vector2, params: BrushParams }[],
  layer: PaintLayer,
  activeChannels: any,
  targetMesh: THREE.Mesh
): void {
  // Render all strokes in single pass per channel
  for (const channel of activeChannels) {
    // 1. Copy previous state ONCE
    copyTo(layer.getRead(channel), layer.getWrite(channel));
    
    // 2. Render ALL strokes
    for (const op of ops) {
      updateBrushUniforms(op.params);
      positionBrush(op.uv);
      renderer.render(paintScene, paintCamera);
    }
    
    // 3. Swap ONCE
    layer.swap(channel);
  }
}
```

**Performance**: 10-20x faster than individual paint() calls

#### 4. Fluid Simulation
**Purpose**: Simulate paint flow with Navier-Stokes

```typescript
stepFluid(
  layer: PaintLayer,
  channelsToAdvect: string[] = ['albedo'],
  dissipation: number = 0.998
): void {
  // 1. Advect velocity
  advectMaterial.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
  advectMaterial.uniforms.sourceTex.value = layer.fluid.velocity[0].texture;
  renderer.setRenderTarget(layer.fluid.velocity[1]);
  renderer.render(copyScene, copyCamera);
  swapBuffers(layer.fluid.velocity);
  
  // 2. Compute divergence
  divMaterial.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
  renderer.setRenderTarget(layer.fluid.divergence);
  renderer.render(copyScene, copyCamera);
  
  // 3. Solve pressure (Jacobi iterations)
  for (let i = 0; i < 5; i++) {
    pressMaterial.uniforms.pressureTex.value = layer.fluid.pressure[0].texture;
    pressMaterial.uniforms.divergenceTex.value = layer.fluid.divergence.texture;
    renderer.setRenderTarget(layer.fluid.pressure[1]);
    renderer.render(copyScene, copyCamera);
    swapBuffers(layer.fluid.pressure);
  }
  
  // 4. Subtract pressure gradient
  gradMaterial.uniforms.pressureTex.value = layer.fluid.pressure[0].texture;
  gradMaterial.uniforms.velocityTex.value = layer.fluid.velocity[0].texture;
  renderer.setRenderTarget(layer.fluid.velocity[1]);
  renderer.render(copyScene, copyCamera);
  swapBuffers(layer.fluid.velocity);
  
  // 5. Advect material channels
  for (const channel of channelsToAdvect) {
    advectMaterial.uniforms.sourceTex.value = layer.getRead(channel).texture;
    renderer.setRenderTarget(layer.getWrite(channel));
    renderer.render(copyScene, copyCamera);
    layer.swap(channel);
  }
}
```

**Usage**:
```typescript
// Add velocity splat on mouse move
paintEngine.splatVelocity(
  layer,
  mouseUV,
  mouseMotion,  // Delta from last frame
  brushSize
);

// Step simulation every frame
requestAnimationFrame(() => {
  paintEngine.stepFluid(layer, ['albedo', 'normal'], 0.998);
});
```

#### 5. Layer Compositing
**Purpose**: Blend all layers into final output

```typescript
compose(
  layers: PaintLayer[],
  dest: PaintLayer
): void {
  for (const channel of ['albedo', 'normal', 'roughness', 'metalness', 'emission']) {
    renderer.setRenderTarget(dest.getWrite(channel));
    renderer.clear();
    
    for (const layer of layers) {
      if (!layer.visible || layer.opacity <= 0.001) continue;
      
      copyMaterial.uniforms.tDiffuse.value = layer.getRead(channel).texture;
      copyMaterial.uniforms.uOpacity.value = layer.opacity;
      copyMaterial.blending = THREE.NormalBlending;
      renderer.render(copyScene, copyCamera);
    }
    
    dest.swap(channel);
  }
}
```

#### 6. Undo/Redo System
**Purpose**: Snapshot and restore layer state

```typescript
// Snapshot
const snapshot = paintEngine.snapshotLayer(layer);
undoStack.push(snapshot);

// Restore
const snapshot = undoStack.pop();
paintEngine.restoreLayer(layer, snapshot);

// Cleanup
paintEngine.disposeSnapshot(snapshot);
```

**Implementation**:
```typescript
snapshotLayer(layer: PaintLayer): { [key: string]: THREE.WebGLRenderTarget } {
  const snapshot: any = {};
  const channels = ['albedo', 'normal', 'roughness', 'metalness', 'emission'];
  
  for (const ch of channels) {
    const target = new THREE.WebGLRenderTarget(
      layer.getRead(ch).width,
      layer.getRead(ch).height,
      { type: THREE.HalfFloatType }
    );
    copyTo(layer.getRead(ch), target);
    snapshot[ch] = target;
  }
  
  return snapshot;
}

restoreLayer(layer: PaintLayer, snapshot: any): void {
  for (const ch of Object.keys(snapshot)) {
    copyTo(snapshot[ch], layer.getRead(ch));
    copyTo(snapshot[ch], layer.getWrite(ch));
  }
}
```


---

## Data Flow

### Complete Painting Pipeline

```
User Input (Mouse/Tablet)
    ↓
Input Handler (usePaintInput.tsx)
    ├─ Pressure
    ├─ Velocity
    ├─ Tilt
    └─ Position
    ↓
Stroke Interpolation
    ├─ Calculate spacing
    ├─ Generate intermediate points
    └─ Apply dynamics
    ↓
Raycast (GPU)
    ├─ Screen → World ray
    ├─ BVH traversal
    ├─ Hit point + normal + UV
    └─ Return to CPU
    ↓
Brush System
    ├─ Load brush preset
    ├─ Apply dynamics
    ├─ Load alpha map
    └─ Calculate parameters
    ↓
Mask System (Optional)
    ├─ Check global mask
    ├─ Evaluate smart masks
    │   ├─ Edge/cavity (curvature)
    │   ├─ Slope (normal)
    │   └─ Height (position)
    └─ Modulate alpha
    ↓
Paint Engine
    ├─ Setup brush material
    ├─ Position brush mesh
    ├─ For each active channel:
    │   ├─ Copy read → write
    │   ├─ Render brush
    │   └─ Swap buffers
    └─ Update mask reference
    ↓
Fluid Simulation (Optional)
    ├─ Splat velocity
    ├─ Advect velocity
    ├─ Compute divergence
    ├─ Solve pressure
    ├─ Subtract gradient
    └─ Advect material
    ↓
Layer Compositing
    ├─ For each visible layer:
    │   ├─ Read channel texture
    │   ├─ Apply opacity
    │   └─ Blend with destination
    └─ Output final texture
    ↓
Material Update
    ├─ Assign textures to material
    ├─ Update uniforms
    └─ Trigger render
    ↓
Display (Three.js Renderer)
```

### IPC Data Flow (Tauri)

```
Frontend (TypeScript)
    ↓
Service Layer
    ├─ sculptClient.ts
    ├─ brushClient.ts
    ├─ pbrClient.ts
    └─ raycastClient.ts
    ↓
Binary Serialization (Optional)
    ├─ Float32Array → Uint8Array
    ├─ Uint32Array → Uint8Array
    └─ 10-50x faster than JSON
    ↓
Tauri IPC
    ├─ invoke('command', args)
    ├─ Serialize to JSON/Binary
    └─ Send to Rust
    ↓
Rust Backend
    ├─ Deserialize args
    ├─ Execute GPU operation
    ├─ Serialize result
    └─ Return to frontend
    ↓
Binary Deserialization (Optional)
    ├─ Uint8Array → Float32Array
    ├─ Uint8Array → Uint32Array
    └─ Zero-copy when possible
    ↓
Apply to Three.js
    ├─ Update BufferGeometry
    ├─ Mark attributes dirty
    └─ Trigger render
```

### GPU Pipeline Flow

```
CPU (JavaScript)
    ↓
Upload to GPU
    ├─ Mesh data (positions, indices)
    ├─ Brush parameters
    ├─ Textures (alpha, material)
    └─ Uniforms
    ↓
Vertex Shader
    ├─ Transform vertices
    ├─ Calculate UVs
    └─ Pass to fragment
    ↓
Fragment Shader
    ├─ Sample textures
    ├─ Apply brush falloff
    ├─ Evaluate masks
    ├─ Calculate color
    └─ Output to render target
    ↓
Render Target (Ping-Pong)
    ├─ Write to buffer[1]
    ├─ Swap: buffer[0] ↔ buffer[1]
    └─ Read from buffer[0]
    ↓
Readback to CPU (Optional)
    ├─ Async GPU readback
    ├─ Download texture data
    └─ Export to file
```

### Performance Bottlenecks

1. **IPC Overhead**
   - **Problem**: JSON serialization is slow for large data
   - **Solution**: Use binary IPC (10-50x faster)

2. **GPU Readback**
   - **Problem**: Synchronous readback stalls pipeline
   - **Solution**: Use async readback, batch operations

3. **Texture Uploads**
   - **Problem**: Uploading 8K textures every frame
   - **Solution**: Use SVT, only upload dirty pages

4. **Stroke Interpolation**
   - **Problem**: Too many IPC calls for smooth strokes
   - **Solution**: Batch strokes, use applyBrushBatch()

5. **Normal Computation**
   - **Problem**: JS normal computation is slow
   - **Solution**: Use Rust SIMD normals (10x faster)


---

## Performance Optimization

### Binary IPC Best Practices

#### 1. Use Binary Variants for Large Data
```typescript
// ❌ Slow: JSON serialization
const handle = await rustSculpt.initMesh(positions, indices);

// ✅ Fast: Binary transfer (10-50x faster)
const handle = await rustSculpt.initMeshBinary(
  new Float32Array(positions),
  new Uint32Array(indices)
);
```

#### 2. Batch Operations
```typescript
// ❌ Slow: Multiple IPC calls
for (const point of interpolatedPoints) {
  await rustSculpt.applyBrush(handle, point, ...);
}

// ✅ Fast: Single batched call (10-20x less overhead)
await rustSculpt.applyBrushBatch(handle, interpolatedPoints, ...);
```

#### 3. Use GPU Compute
```typescript
// ❌ Slow: CPU brushing
await rustSculpt.applyBrush(handle, point, normal, tool, radius, intensity, 'NONE', false);

// ✅ Fast: GPU compute (30x faster)
await rustSculpt.applyBrush(handle, point, normal, tool, radius, intensity, 'NONE', true);
```

#### 4. Reuse Typed Arrays
```typescript
// ❌ Slow: Allocate every frame
function paint() {
  const points = new Float32Array([x, y, z]);
  await paintStroke(points);
}

// ✅ Fast: Reuse buffer
const pointsBuffer = new Float32Array(3);
function paint() {
  pointsBuffer[0] = x;
  pointsBuffer[1] = y;
  pointsBuffer[2] = z;
  await paintStroke(pointsBuffer);
}
```

### GPU Optimization

#### 1. Minimize Texture Lookups
```glsl
// ❌ Slow: Multiple lookups
vec4 c1 = texture2D(tex, uv);
vec4 c2 = texture2D(tex, uv + offset1);
vec4 c3 = texture2D(tex, uv + offset2);

// ✅ Fast: Cache lookups
vec4 c = texture2D(tex, uv);
// Reuse c
```

#### 2. Use Lower Precision
```glsl
// ❌ Slow: High precision everywhere
precision highp float;

// ✅ Fast: Use mediump when possible
precision mediump float;
uniform highp sampler2D tex;  // Only where needed
```

#### 3. Avoid Branching
```glsl
// ❌ Slow: Branching
if (condition) {
  color = vec3(1.0);
} else {
  color = vec3(0.0);
}

// ✅ Fast: Use mix()
color = mix(vec3(0.0), vec3(1.0), float(condition));
```

#### 4. Precompute Constants
```glsl
// ❌ Slow: Compute every pixel
float value = sin(time * 3.14159) * 0.5 + 0.5;

// ✅ Fast: Pass as uniform (computed on CPU)
uniform float precomputedValue;
```

### Memory Management

#### 1. Dispose Resources
```typescript
// Always dispose when done
layer.dispose();
maskSystem.dispose();
paintEngine.dispose();
geometry.dispose();
material.dispose();
texture.dispose();
```

#### 2. Reuse Render Targets
```typescript
// ❌ Slow: Create every frame
function render() {
  const target = new THREE.WebGLRenderTarget(1024, 1024);
  // ... use target
  target.dispose();
}

// ✅ Fast: Reuse target
const target = new THREE.WebGLRenderTarget(1024, 1024);
function render() {
  // ... use target
}
// Dispose once at end
```

#### 3. Use Object Pools
```typescript
// Pool for temporary vectors
const vectorPool: THREE.Vector3[] = [];
function getVector(): THREE.Vector3 {
  return vectorPool.pop() || new THREE.Vector3();
}
function releaseVector(v: THREE.Vector3): void {
  v.set(0, 0, 0);
  vectorPool.push(v);
}
```

### Rendering Optimization

#### 1. Frustum Culling
```typescript
// Only render visible objects
mesh.frustumCulled = true;
```

#### 2. LOD (Level of Detail)
```typescript
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);
lod.addLevel(mediumDetailMesh, 50);
lod.addLevel(lowDetailMesh, 100);
```

#### 3. Instancing
```typescript
// ❌ Slow: Individual meshes
for (let i = 0; i < 1000; i++) {
  scene.add(new THREE.Mesh(geometry, material));
}

// ✅ Fast: Instanced mesh
const instancedMesh = new THREE.InstancedMesh(geometry, material, 1000);
scene.add(instancedMesh);
```

#### 4. Texture Compression
```typescript
// Use compressed texture formats
const texture = loader.load('texture.ktx2');  // KTX2 compressed
```

### Profiling Tools

#### 1. Chrome DevTools
- **Performance Tab**: Record painting session
- **Memory Tab**: Check for leaks
- **Rendering Tab**: Enable paint flashing

#### 2. Three.js Stats
```typescript
import Stats from 'three/examples/jsm/libs/stats.module';

const stats = new Stats();
document.body.appendChild(stats.dom);

function animate() {
  stats.begin();
  renderer.render(scene, camera);
  stats.end();
}
```

#### 3. GPU Profiling
```typescript
// Enable GPU timing
const ext = renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2');

// Measure GPU time
const query = gl.createQuery();
gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
renderer.render(scene, camera);
gl.endQuery(ext.TIME_ELAPSED_EXT);
```

### Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Brush stroke | < 16ms | 60 FPS |
| Mesh init (100k verts) | < 100ms | Binary IPC |
| Layer composite | < 5ms | All channels |
| Fluid step | < 10ms | 512x512 |
| Undo/redo | < 50ms | Snapshot copy |
| Export texture | < 500ms | 4K PNG |

### Optimization Checklist

- [ ] Use binary IPC for large data
- [ ] Batch operations when possible
- [ ] Enable GPU compute for sculpting
- [ ] Reuse typed arrays and objects
- [ ] Minimize texture lookups in shaders
- [ ] Use appropriate precision (mediump)
- [ ] Avoid shader branching
- [ ] Precompute constants on CPU
- [ ] Dispose resources properly
- [ ] Reuse render targets
- [ ] Use object pools for temporaries
- [ ] Enable frustum culling
- [ ] Use LOD for distant objects
- [ ] Use instancing for repeated geometry
- [ ] Compress textures
- [ ] Profile regularly


---

## Quick Reference

### Essential Imports

```typescript
// SVT System
import { svtPbrClient } from '@/three-d/systems/svt';

// Services
import { rustSculpt, applyBrushResultToGeometry } from '@/three-d/services/sculptClient';
import { brushClient } from '@/three-d/services/brushClient';
import { pbrService } from '@/three-d/services/pbrClient';
import { raycastService } from '@/three-d/services/raycastClient';

// Systems
import { UniversalLayerPanel } from '@/three-d/systems/layers-3d';
import { UVProjection, LSCMSolver, AtlasPacker } from '@/three-d/systems/uv';

// Shaders
import { 
  BRUSH_FRAG, 
  SIMPLEX_NOISE, 
  FLUID_ADVECT,
  CURVATURE_COMPUTE_FRAG 
} from '@/shaders';

// Paint Engine (to be extracted)
import { PaintEngine, PaintLayer } from '@/backup/paint/engine/PaintSystem';
import { MaskSystem } from '@/backup/paint/engine/MaskSystem';
```

### Common Workflows

#### Workflow 1: Basic Texture Painting
```typescript
// 1. Initialize paint engine
const paintEngine = new PaintEngine(renderer);

// 2. Create layer
const layer = new PaintLayer('base', 'Base Layer', 2048, 2048);
paintEngine.fillLayer(layer);

// 3. Bake geometry maps
paintEngine.bakeGeometry(mesh);

// 4. Paint
paintEngine.paint(
  new THREE.Vector2(0.5, 0.5),  // UV
  {
    size: 100,
    hardness: 0.5,
    flow: 0.8,
    opacity: 1.0,
    color: '#ff0000'
  },
  layer,
  { albedo: true, roughness: true },
  mesh
);

// 5. Apply to material
material.map = layer.getRead('albedo').texture;
material.roughnessMap = layer.getRead('roughness').texture;
```

#### Workflow 2: GPU Sculpting
```typescript
// 1. Initialize mesh
const handle = await rustSculpt.initMeshBinary(
  geometry.attributes.position.array,
  geometry.index.array
);

// 2. Load brush
await brushClient.init();
const brush = brushClient.getBrush('clay');

// 3. Sculpt
const result = await rustSculpt.applyBrush(
  handle,
  [0, 0, 0],      // point
  [0, 1, 0],      // normal
  'clay',
  0.15,           // radius
  0.6,            // intensity
  'X',            // symmetry
  true            // useGpu
);

// 4. Apply result
if (result) {
  applyBrushResultToGeometry(geometry, result);
}

// 5. Cleanup
await rustSculpt.dispose(handle);
```

#### Workflow 3: Smart Masking
```typescript
// 1. Bake geometry maps
paintEngine.bakeGeometry(mesh);

// 2. Setup smart mask
const brushParams = {
  ...baseParams,
  smartMask: {
    edge: 0.8,      // Paint only on edges
    slope: 0.5,     // Paint only on top-facing
    height: 0.0     // No height restriction
  }
};

// 3. Paint with smart mask
paintEngine.paint(uv, brushParams, layer, channels, mesh);
```

#### Workflow 4: Fluid Simulation
```typescript
// 1. Add velocity on mouse move
paintEngine.splatVelocity(
  layer,
  mouseUV,
  new THREE.Vector2(deltaX, deltaY),
  brushSize
);

// 2. Step simulation every frame
function animate() {
  paintEngine.stepFluid(layer, ['albedo', 'normal'], 0.998);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

#### Workflow 5: Layer Compositing
```typescript
// 1. Create layers
const layer1 = new PaintLayer('layer1', 'Base', 2048, 2048);
const layer2 = new PaintLayer('layer2', 'Details', 2048, 2048);
const output = new PaintLayer('output', 'Output', 2048, 2048);

// 2. Paint on layers
paintEngine.paint(uv, params1, layer1, channels, mesh);
paintEngine.paint(uv, params2, layer2, channels, mesh);

// 3. Composite
paintEngine.compose([layer1, layer2], output);

// 4. Use output
material.map = output.getRead('albedo').texture;
```

### Troubleshooting

#### Problem: Painting is slow
**Solutions**:
- Use binary IPC: `initMeshBinary()`, `applyBrushBinary()`
- Enable GPU compute: `useGpu: true`
- Batch strokes: `applyBrushBatch()`
- Reduce texture resolution
- Lower brush spacing

#### Problem: Normals look wrong
**Solutions**:
- Use Rust-computed normals (included in `BrushResult`)
- Check `skipNormals: false` in `applyBrushResultToGeometry()`
- Verify mesh has normals: `geometry.computeVertexNormals()`
- Check normal map encoding (0.5, 0.5, 1.0 = up)

#### Problem: Mask not working
**Solutions**:
- Check `uUseMask: true` in brush material
- Verify mask texture is assigned: `uMaskMap.value = maskSystem.target.texture`
- Clear mask before painting: `maskSystem.clear()`
- Check mask blending mode (add/subtract)

#### Problem: Seamless painting has gaps
**Solutions**:
- Increase brush spacing overlap
- Check `isSeamless: true` in brush params
- Verify UV coordinates are in 0-1 range
- Increase seamless limit threshold

#### Problem: Smart masks not working
**Solutions**:
- Bake geometry maps first: `paintEngine.bakeGeometry(mesh)`
- Check `uUseSmartMask: true`
- Verify baked maps are assigned to brush material
- Adjust mask thresholds (edge/slope/height)

#### Problem: Memory leak
**Solutions**:
- Dispose layers: `layer.dispose()`
- Dispose snapshots: `paintEngine.disposeSnapshot(snapshot)`
- Dispose render targets when done
- Clear undo stack periodically
- Use object pools for temporaries

---

## Next Steps

### For Substance Clone Implementation

1. **Extract Paint Engine** → `src-frontend/three-d/systems/paint-3d/`
2. **Extract Mask System** → `src-frontend/three-d/systems/masking/`
3. **Create Painter Mode** → `features/substance-clone/painter/`
4. **Create Sampler Mode** → `features/substance-clone/sampler/`
5. **Integrate SVT** → Use `svtPbrClient` for 8K+ textures
6. **Add PBR Generation** → Use `pbrService` for material creation
7. **Compose UI** → Use `UniversalLayerPanel` and `shared/primitives/`

### For Other Painting Apps

1. **Study this document** - Understand all systems
2. **Copy template3D** - Start from working 3D template
3. **Import systems** - Use SVT, layers, masks, UV
4. **Wire services** - Connect to Rust backend
5. **Compose shaders** - Reuse shader library
6. **Test performance** - Profile and optimize

---

## Conclusion

This document provides a **complete reference** for all frontend painting systems. Every system is documented with:

- **Purpose** - What it does
- **API** - How to use it
- **Examples** - Working code
- **Performance** - Optimization tips
- **Integration** - How systems connect

Use this as your **single source of truth** when building painting applications. All the pieces are here - just compose them together!

**Remember**: This is a **composition task**, not a coding task. Think like a conductor, not a builder. 🎼

