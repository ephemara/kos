# Design Document: KAutoPBR Substance Parity Plus

## Overview

KAutoPBR (K-SAMPLE) is a comprehensive material sampling and PBR generation tool that matches and exceeds Adobe Substance Sampler's capabilities. The killer feature is a complete animated materials system supporting keyframe-based, procedural, and physics-based animation - functionality Substance Sampler entirely lacks.

### Core Value Proposition

KAutoPBR combines:
- Photogrammetry and 3D capture from multi-angle photos
- Advanced non-destructive layer system with 10 blend modes
- HDR environment capture and authoring with custom lighting
- AI-powered seamless tiling and perspective correction
- **Material animation system** (keyframe, procedural, physics-based) - KILLER FEATURE
- Real-time preview with optional ray tracing
- Material library with version control and tagging
- Multi-format export (SBSAR, glTF, USD, Unreal, Unity, Godot)
- AI-powered enhancement (upscaling, denoising, material identification)
- Hyperdrive plugin system for extensibility

### Technology Stack

- **Frontend**: React 18 + TypeScript + Three.js (@react-three/fiber) + Vite
- **Backend**: Tauri v2 + Rust (k-os-engine crate)
- **GPU Compute**: wgpu (WebGPU) for all compute-heavy operations
- **AI/ML**: Python sidecar with JSON-RPC communication
- **3D Rendering**: Three.js for preview, optional ray tracing via GPU
- **UI Framework**: Radix UI + Mantine + Tailwind CSS
- **Plugin System**: kosRegistry + hookBus + slotRegistry + appApiRegistry

### Design Principles

1. **GPU-First**: All compute-heavy operations use wgpu compute shaders
2. **Data-Driven**: JSON configs for presets, pipelines, export formats, animation curves
3. **Non-Destructive**: Layer-based workflow preserves original data
4. **Real-Time**: 30fps minimum for parameter adjustments and preview
5. **Extensible**: Plugin system allows community extensions
6. **Cross-App Integration**: Seamless workflow with K-Painter, K-Bake, K-Sculpt, K-Graphos

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React + TypeScript)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  KAutoPBR    │  │   Preview    │  │    Plugin    │          │
│  │  Main UI     │  │   Renderer   │  │    Matrix    │          │
│  │              │  │  (Three.js)  │  │      UI      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └─────────────────┴──────────────────┘                   │
│                           │                                      │
│                    Tauri IPC Layer                               │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────────┐
│                  Backend (Rust + k-os-engine)                    │
│  ┌────────────────────────┴────────────────────────┐            │
│  │          Material System Core                    │            │
│  │  - Material state management                     │            │
│  │  - Layer stack processing                        │            │
│  │  - Animation engine                              │            │
│  │  - Asset manager                                 │            │
│  └────┬─────────┬─────────┬─────────┬──────────────┘            │
│       │         │         │         │                            │
│  ┌────▼────┐ ┌──▼──────┐ ┌▼────────▼┐ ┌──────────────┐         │
│  │  GPU    │ │  Photo  │ │   HDR   │ │   Tiling     │         │
│  │ Compute │ │ gramme  │ │ Capture │ │   Engine     │         │
│  │ (wgpu)  │ │  try    │ │         │ │              │         │
│  └────┬────┘ └──┬──────┘ └─────────┘ └──────────────┘         │
│       │         │                                                │
│  ┌────▼─────────▼──────────────────────────────────┐            │
│  │         Export Pipeline                          │            │
│  │  SBSAR │ glTF │ USD │ Unreal │ Unity │ Godot   │            │
│  └──────────────────────────────────────────────────┘            │
│                                                                   │
│  ┌───────────────────────────────────────────────────┐           │
│  │         Plugin System Integration                 │           │
│  │  kosRegistry │ hookBus │ slotRegistry │ appApi   │           │
│  └───────────────────────────────────────────────────┘           │
└───────────────────────────┬───────────────────────────────────────┘
                            │
                     JSON-RPC Bridge
                            │
┌───────────────────────────┼───────────────────────────────────────┐
│                  Python Sidecar (AI/ML)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐         │
│  │ AI Upscaler │  │  Denoiser    │  │   Material      │         │
│  │             │  │              │  │ Identification  │         │
│  └─────────────┘  └──────────────┘  └─────────────────┘         │
│  ┌─────────────┐  ┌──────────────┐                              │
│  │ Style       │  │  Inpainting  │                              │
│  │ Transfer    │  │  (Tiling)    │                              │
│  └─────────────┘  └──────────────┘                              │
└───────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
User Input → Frontend UI → Tauri IPC → Material System Core
                                              ↓
                                    ┌─────────┴─────────┐
                                    │                   │
                              GPU Compute         Python Sidecar
                              (wgpu shaders)      (AI/ML models)
                                    │                   │
                                    └─────────┬─────────┘
                                              ↓
                                    Material State Update
                                              ↓
                                    Preview Renderer Update
                                              ↓
                                    Frontend Display
```

### Module Organization

```
K_OS/
├── src-frontend/features/material/kautopbr/
│   ├── KAutoPBR.tsx                    # Main app component
│   ├── ui/
│   │   ├── LeftPanel.tsx               # Generators, presets, library
│   │   ├── RightPanel.tsx              # Properties, maps, animation
│   │   ├── PreviewViewport.tsx         # 3D preview with Three.js
│   │   ├── LayerStack.tsx              # Layer management UI
│   │   ├── AnimationTimeline.tsx       # Keyframe editor
│   │   ├── PluginMatrix.tsx            # Extension management UI
│   │   └── ExportDialog.tsx            # Multi-format export
│   ├── engine/
│   │   ├── MaterialEngine.ts           # Frontend material state
│   │   ├── PreviewRenderer.ts          # Three.js renderer wrapper
│   │   └── AnimationPlayer.ts          # Animation playback
│   └── services/
│       └── autoPBRClient.ts            # Tauri IPC client
│
├── src-tauri/src/
│   ├── commands/
│   │   └── autopbr.rs                  # Tauri command handlers
│   └── python_bridge.rs                # Python sidecar communication
│
├── crates/k-os-engine/src/
│   ├── material/
│   │   ├── mod.rs                      # Material system core
│   │   ├── layer.rs                    # Layer stack implementation
│   │   ├── animation.rs                # Animation engine
│   │   ├── pbr_maps.rs                 # PBR map generation
│   │   ├── asset_manager.rs            # Material library
│   │   └── parser.rs                   # JSON serialization
│   ├── photogrammetry/
│   │   ├── mod.rs                      # Photogrammetry pipeline
│   │   ├── feature_matching.rs         # Camera alignment
│   │   ├── point_cloud.rs              # 3D reconstruction
│   │   └── texture_projection.rs       # UV mapping
│   ├── hdr/
│   │   ├── mod.rs                      # HDR capture system
│   │   ├── merge.rs                    # Multi-exposure merging
│   │   ├── tone_mapping.rs             # Display conversion
│   │   └── light_authoring.rs          # Custom light addition
│   ├── tiling/
│   │   ├── mod.rs                      # Tiling engine
│   │   ├── edge_analysis.rs            # Discontinuity detection
│   │   └── perspective_correction.rs   # Distortion removal
│   ├── export/
│   │   ├── mod.rs                      # Export pipeline
│   │   ├── sbsar.rs                    # Substance Archive
│   │   ├── gltf.rs                     # glTF 2.0 export
│   │   ├── usd.rs                      # USD export
│   │   └── game_engines.rs             # Unreal/Unity/Godot
│   ├── gpu/
│   │   ├── pipelines/
│   │   │   ├── pbr_generation.wgsl     # PBR map compute shader
│   │   │   ├── layer_blend.wgsl        # Layer blending shader
│   │   │   ├── tiling.wgsl             # Seamless tiling shader
│   │   │   ├── animation_eval.wgsl     # Animation evaluation
│   │   │   └── physics_sim.wgsl        # Physics simulation
│   │   └── compute.rs                  # GPU compute manager
│   └── plugin/
│       ├── mod.rs                      # Plugin system integration
│       ├── registry.rs                 # Extension registry
│       ├── hooks.rs                    # Hook system
│       └── resource_monitor.rs         # Resource limits
│
├── src-python/kos/autopbr/
│   ├── __init__.py
│   ├── upscaler.py                     # AI upscaling models
│   ├── denoiser.py                     # Denoising models
│   ├── material_classifier.py          # Material identification
│   ├── style_transfer.py               # Style transfer
│   └── inpainting.py                   # Seamless tiling inpainting
│
└── config/autopbr/
    ├── presets/                        # Material presets (JSON)
    ├── animation_presets/              # Animation presets (JSON)
    ├── export_formats/                 # Export configs (JSON)
    ├── pipelines/                      # Processing pipelines (JSON)
    └── schemas/                        # JSON schemas
        ├── material.schema.json
        ├── animation.schema.json
        └── extension.schema.json
```

## Components and Interfaces

### Material System Core

The Material System is the central component managing all material data, processing, and state.


#### Rust API

```rust
// crates/k-os-engine/src/material/mod.rs

pub struct MaterialSystem {
    materials: HashMap<Uuid, Material>,
    gpu_compute: Arc<GpuCompute>,
    asset_manager: AssetManager,
    animation_engine: AnimationEngine,
    plugin_registry: PluginRegistry,
}

pub struct Material {
    pub id: Uuid,
    pub metadata: MaterialMetadata,
    pub layers: Vec<Layer>,
    pub animation: Option<AnimationData>,
    pub variants: Vec<Uuid>,
    pub base_material: Option<Uuid>,
}

pub struct MaterialMetadata {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub author: String,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
    pub version: u32,
    pub category: MaterialCategory,
}

pub enum MaterialCategory {
    Metal,
    Wood,
    Stone,
    Fabric,
    Plastic,
    Organic,
    SciFi,
    Fantasy,
}

impl MaterialSystem {
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Self;
    
    pub fn create_material(&mut self, metadata: MaterialMetadata) -> Result<Uuid>;
    pub fn load_material(&mut self, path: &Path) -> Result<Uuid>;
    pub fn save_material(&self, id: Uuid, path: &Path) -> Result<()>;
    pub fn delete_material(&mut self, id: Uuid) -> Result<()>;
    
    pub fn add_layer(&mut self, material_id: Uuid, layer: Layer) -> Result<()>;
    pub fn remove_layer(&mut self, material_id: Uuid, layer_index: usize) -> Result<()>;
    pub fn reorder_layers(&mut self, material_id: Uuid, from: usize, to: usize) -> Result<()>;
    
    pub fn set_animation(&mut self, material_id: Uuid, animation: AnimationData) -> Result<()>;
    pub fn evaluate_animation(&self, material_id: Uuid, time: f32) -> Result<MaterialState>;
    
    pub fn create_variant(&mut self, base_id: Uuid, overrides: HashMap<String, Value>) -> Result<Uuid>;
    pub fn apply_preset(&mut self, material_id: Uuid, preset: &Preset) -> Result<()>;
    
    pub fn export_material(&self, material_id: Uuid, format: ExportFormat, options: ExportOptions) -> Result<Vec<u8>>;
    
    pub fn search_materials(&self, query: &str) -> Vec<Uuid>;
    pub fn filter_materials(&self, category: MaterialCategory) -> Vec<Uuid>;
}
```

#### TypeScript API

```typescript
// src-frontend/services/autoPBRClient.ts

export interface MaterialHandle {
  id: string;
  metadata: MaterialMetadata;
  layers: Layer[];
  animation?: AnimationData;
}

export interface MaterialMetadata {
  name: string;
  description: string;
  tags: string[];
  author: string;
  createdAt: string;
  modifiedAt: string;
  version: number;
  category: MaterialCategory;
}

export class AutoPBRClient {
  async createMaterial(metadata: MaterialMetadata): Promise<string>;
  async loadMaterial(path: string): Promise<MaterialHandle>;
  async saveMaterial(id: string, path: string): Promise<void>;
  async deleteMaterial(id: string): Promise<void>;
  
  async addLayer(materialId: string, layer: Layer): Promise<void>;
  async removeLayer(materialId: string, layerIndex: number): Promise<void>;
  async reorderLayers(materialId: string, from: number, to: number): Promise<void>;
  
  async setAnimation(materialId: string, animation: AnimationData): Promise<void>;
  async evaluateAnimation(materialId: string, time: number): Promise<MaterialState>;
  
  async createVariant(baseId: string, overrides: Record<string, any>): Promise<string>;
  async applyPreset(materialId: string, presetPath: string): Promise<void>;
  
  async exportMaterial(materialId: string, format: ExportFormat, options: ExportOptions): Promise<Uint8Array>;
  
  async searchMaterials(query: string): Promise<string[]>;
  async filterMaterials(category: MaterialCategory): Promise<string[]>;
}
```

### Layer Stack System

The Layer Stack manages non-destructive material layering with blend modes and masks.

#### Rust Implementation

```rust
// crates/k-os-engine/src/material/layer.rs

pub struct Layer {
    pub id: Uuid,
    pub name: String,
    pub maps: PBRMaps,
    pub opacity: f32,
    pub blend_mode: BlendMode,
    pub mask: Option<Mask>,
    pub visible: bool,
    pub locked: bool,
}

pub struct PBRMaps {
    pub albedo: Option<TextureHandle>,
    pub normal: Option<TextureHandle>,
    pub roughness: Option<TextureHandle>,
    pub metallic: Option<TextureHandle>,
    pub ao: Option<TextureHandle>,
    pub height: Option<TextureHandle>,
    pub emissive: Option<TextureHandle>,
}

pub enum BlendMode {
    Normal,
    Multiply,
    Screen,
    Overlay,
    Add,
    Subtract,
    Divide,
    Difference,
    Darken,
    Lighten,
}

pub struct Mask {
    pub texture: TextureHandle,
    pub invert: bool,
}

pub struct LayerStack {
    layers: Vec<Layer>,
    gpu_compute: Arc<GpuCompute>,
}

impl LayerStack {
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Self;
    
    pub fn add_layer(&mut self, layer: Layer, position: usize) -> Result<()>;
    pub fn remove_layer(&mut self, index: usize) -> Result<Layer>;
    pub fn reorder(&mut self, from: usize, to: usize) -> Result<()>;
    
    pub fn set_opacity(&mut self, index: usize, opacity: f32) -> Result<()>;
    pub fn set_blend_mode(&mut self, index: usize, mode: BlendMode) -> Result<()>;
    pub fn set_mask(&mut self, index: usize, mask: Option<Mask>) -> Result<()>;
    
    pub fn blend_layers(&self) -> Result<PBRMaps>;
    pub fn blend_layers_gpu(&self) -> Result<PBRMaps>;
    
    pub fn serialize(&self) -> Result<String>;
    pub fn deserialize(json: &str, gpu_compute: Arc<GpuCompute>) -> Result<Self>;
}
```

#### GPU Compute Shader

```wgsl
// crates/k-os-engine/src/gpu/pipelines/layer_blend.wgsl

struct BlendParams {
    opacity: f32,
    blend_mode: u32,
    has_mask: u32,
    invert_mask: u32,
}

@group(0) @binding(0) var base_texture: texture_2d<f32>;
@group(0) @binding(1) var layer_texture: texture_2d<f32>;
@group(0) @binding(2) var mask_texture: texture_2d<f32>;
@group(0) @binding(3) var output_texture: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var<uniform> params: BlendParams;

fn blend_normal(base: vec4<f32>, layer: vec4<f32>) -> vec4<f32> {
    return mix(base, layer, layer.a);
}

fn blend_multiply(base: vec4<f32>, layer: vec4<f32>) -> vec4<f32> {
    return vec4<f32>(base.rgb * layer.rgb, base.a);
}

fn blend_screen(base: vec4<f32>, layer: vec4<f32>) -> vec4<f32> {
    return vec4<f32>(1.0 - (1.0 - base.rgb) * (1.0 - layer.rgb), base.a);
}

fn blend_overlay(base: vec4<f32>, layer: vec4<f32>) -> vec4<f32> {
    let result = select(
        2.0 * base.rgb * layer.rgb,
        1.0 - 2.0 * (1.0 - base.rgb) * (1.0 - layer.rgb),
        base.rgb < vec3<f32>(0.5)
    );
    return vec4<f32>(result, base.a);
}

// Additional blend modes: Add, Subtract, Divide, Difference, Darken, Lighten

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(base_texture);
    if (global_id.x >= dims.x || global_id.y >= dims.y) {
        return;
    }
    
    let coords = vec2<i32>(global_id.xy);
    var base = textureLoad(base_texture, coords, 0);
    var layer = textureLoad(layer_texture, coords, 0);
    
    // Apply mask if present
    if (params.has_mask != 0u) {
        var mask_value = textureLoad(mask_texture, coords, 0).r;
        if (params.invert_mask != 0u) {
            mask_value = 1.0 - mask_value;
        }
        layer.a *= mask_value;
    }
    
    // Apply opacity
    layer.a *= params.opacity;
    
    // Apply blend mode
    var result: vec4<f32>;
    switch (params.blend_mode) {
        case 0u: { result = blend_normal(base, layer); }
        case 1u: { result = blend_multiply(base, layer); }
        case 2u: { result = blend_screen(base, layer); }
        case 3u: { result = blend_overlay(base, layer); }
        // Additional cases for other blend modes
        default: { result = base; }
    }
    
    textureStore(output_texture, coords, result);
}
```

### Animation Engine

The Animation Engine is the killer feature, supporting keyframe, procedural, and physics-based animation.

#### Rust Implementation

```rust
// crates/k-os-engine/src/material/animation.rs

pub struct AnimationEngine {
    gpu_compute: Arc<GpuCompute>,
    expression_evaluator: ExpressionEvaluator,
    physics_simulator: PhysicsSimulator,
}

pub struct AnimationData {
    pub duration: f32,
    pub loop_mode: LoopMode,
    pub tracks: Vec<AnimationTrack>,
}

pub enum LoopMode {
    Once,
    Loop,
    PingPong,
}

pub struct AnimationTrack {
    pub parameter: AnimationParameter,
    pub animation_type: AnimationType,
}

pub enum AnimationParameter {
    AlbedoColor,
    AlbedoRed,
    AlbedoGreen,
    AlbedoBlue,
    Roughness,
    Metallic,
    EmissiveIntensity,
    EmissiveColor,
    HeightOffset,
    NormalStrength,
    UVOffsetX,
    UVOffsetY,
}

pub enum AnimationType {
    Keyframe(KeyframeAnimation),
    Procedural(ProceduralAnimation),
    Physics(PhysicsAnimation),
}

pub struct KeyframeAnimation {
    pub keyframes: Vec<Keyframe>,
    pub interpolation: InterpolationType,
}

pub struct Keyframe {
    pub time: f32,
    pub value: f32,
    pub tangent_in: Option<Vec2>,
    pub tangent_out: Option<Vec2>,
}

pub enum InterpolationType {
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
    Bezier,
}

pub struct ProceduralAnimation {
    pub expression: String,
    pub noise_config: Option<NoiseConfig>,
}

pub struct NoiseConfig {
    pub noise_type: NoiseType,
    pub frequency: f32,
    pub amplitude: f32,
    pub octaves: u32,
    pub lacunarity: f32,
    pub persistence: f32,
}

pub enum NoiseType {
    Perlin,
    Simplex,
    Worley,
}

pub struct PhysicsAnimation {
    pub simulation_type: SimulationType,
    pub parameters: HashMap<String, f32>,
}

pub enum SimulationType {
    RustSpreading,
    MossGrowth,
    Erosion,
    Weathering,
    Cracking,
    Melting,
}

impl AnimationEngine {
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Self;
    
    pub fn evaluate(&self, animation: &AnimationData, time: f32) -> Result<HashMap<AnimationParameter, f32>>;
    pub fn evaluate_keyframe(&self, keyframes: &KeyframeAnimation, time: f32) -> Result<f32>;
    pub fn evaluate_procedural(&self, procedural: &ProceduralAnimation, time: f32) -> Result<f32>;
    pub fn evaluate_physics(&mut self, physics: &PhysicsAnimation, time: f32, delta: f32) -> Result<HashMap<String, TextureHandle>>;
    
    pub fn bake_animation(&self, animation: &AnimationData, fps: u32) -> Result<Vec<MaterialState>>;
}
```

#### Expression Evaluator

```rust
// crates/k-os-engine/src/material/animation.rs (continued)

pub struct ExpressionEvaluator {
    // Uses a simple expression parser supporting:
    // - Variables: t (time)
    // - Functions: sin, cos, tan, abs, sqrt, pow, min, max, clamp, lerp
    // - Noise functions: noise, fbm
    // - Operators: +, -, *, /, ^
}

impl ExpressionEvaluator {
    pub fn new() -> Self;
    pub fn evaluate(&self, expression: &str, time: f32) -> Result<f32>;
    pub fn validate(&self, expression: &str) -> Result<()>;
}

// Example expressions:
// "sin(t * 2.0) * 0.5 + 0.5"  // Sine wave oscillation
// "noise(t * 0.1) * 0.3"       // Perlin noise variation
// "abs(sin(t)) * pow(t, 0.5)"  // Complex combination
```

#### Physics Simulator

```rust
// crates/k-os-engine/src/material/animation.rs (continued)

pub struct PhysicsSimulator {
    gpu_compute: Arc<GpuCompute>,
    simulation_state: HashMap<String, SimulationState>,
}

pub struct SimulationState {
    pub current_maps: PBRMaps,
    pub simulation_time: f32,
    pub seed_points: Vec<Vec2>,
}

impl PhysicsSimulator {
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Self;
    
    pub fn initialize_rust_spreading(&mut self, base_maps: PBRMaps, params: RustParams) -> Result<String>;
    pub fn initialize_moss_growth(&mut self, base_maps: PBRMaps, params: MossParams) -> Result<String>;
    pub fn initialize_erosion(&mut self, base_maps: PBRMaps, params: ErosionParams) -> Result<String>;
    
    pub fn step_simulation(&mut self, sim_id: &str, delta_time: f32) -> Result<PBRMaps>;
    pub fn reset_simulation(&mut self, sim_id: &str) -> Result<()>;
}

pub struct RustParams {
    pub spread_rate: f32,
    pub color_variation: f32,
    pub roughness_increase: f32,
    pub metallic_decrease: f32,
    pub seed_points: Vec<Vec2>,
}

pub struct MossParams {
    pub growth_rate: f32,
    pub coverage_density: f32,
    pub color_variation: f32,
    pub height_displacement: f32,
}

pub struct ErosionParams {
    pub erosion_rate: f32,
    pub depth: f32,
    pub edge_sharpness: f32,
    pub dirt_accumulation: f32,
}
```

#### GPU Physics Simulation Shader

```wgsl
// crates/k-os-engine/src/gpu/pipelines/physics_sim.wgsl

struct RustParams {
    spread_rate: f32,
    color_variation: f32,
    roughness_increase: f32,
    metallic_decrease: f32,
    delta_time: f32,
    _padding: vec3<f32>,
}

@group(0) @binding(0) var albedo_in: texture_2d<f32>;
@group(0) @binding(1) var roughness_in: texture_2d<f32>;
@group(0) @binding(2) var metallic_in: texture_2d<f32>;
@group(0) @binding(3) var rust_mask: texture_2d<f32>;  // Current rust coverage
@group(0) @binding(4) var albedo_out: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var roughness_out: texture_storage_2d<r16float, write>;
@group(0) @binding(6) var metallic_out: texture_storage_2d<r16float, write>;
@group(0) @binding(7) var rust_mask_out: texture_storage_2d<r16float, write>;
@group(0) @binding(8) var<uniform> params: RustParams;

fn hash(p: vec2<f32>) -> f32 {
    let p3 = fract(vec3<f32>(p.xyx) * 0.1031);
    let p3_dot = dot(p3, vec3<f32>(p3.yzx) + 33.33);
    return fract((p3.x + p3.y) * p3_dot);
}

@compute @workgroup_size(16, 16)
fn rust_spreading(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(albedo_in);
    if (global_id.x >= dims.x || global_id.y >= dims.y) {
        return;
    }
    
    let coords = vec2<i32>(global_id.xy);
    let uv = vec2<f32>(global_id.xy) / vec2<f32>(dims);
    
    // Load current state
    var albedo = textureLoad(albedo_in, coords, 0);
    var roughness = textureLoad(roughness_in, coords, 0).r;
    var metallic = textureLoad(metallic_in, coords, 0).r;
    var rust_coverage = textureLoad(rust_mask, coords, 0).r;
    
    // Sample neighbors for spreading
    var neighbor_rust = 0.0;
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            let neighbor_coords = coords + vec2<i32>(dx, dy);
            if (neighbor_coords.x >= 0 && neighbor_coords.x < i32(dims.x) &&
                neighbor_coords.y >= 0 && neighbor_coords.y < i32(dims.y)) {
                neighbor_rust += textureLoad(rust_mask, neighbor_coords, 0).r;
            }
        }
    }
    neighbor_rust /= 9.0;
    
    // Spread rust based on neighbors and spread rate
    let spread_amount = neighbor_rust * params.spread_rate * params.delta_time;
    rust_coverage = min(rust_coverage + spread_amount, 1.0);
    
    // Apply rust effect to material properties
    let rust_color = vec3<f32>(0.6, 0.3, 0.1);  // Orange-brown rust
    let color_noise = hash(uv * 100.0) * params.color_variation;
    let final_rust_color = rust_color + vec3<f32>(color_noise);
    
    albedo = vec4<f32>(mix(albedo.rgb, final_rust_color, rust_coverage), albedo.a);
    roughness = mix(roughness, roughness + params.roughness_increase, rust_coverage);
    metallic = mix(metallic, metallic * (1.0 - params.metallic_decrease), rust_coverage);
    
    // Write output
    textureStore(albedo_out, coords, albedo);
    textureStore(roughness_out, coords, vec4<f32>(roughness, 0.0, 0.0, 0.0));
    textureStore(metallic_out, coords, vec4<f32>(metallic, 0.0, 0.0, 0.0));
    textureStore(rust_mask_out, coords, vec4<f32>(rust_coverage, 0.0, 0.0, 0.0));
}
```

### Photogrammetry Pipeline

Reconstructs 3D meshes from multi-angle photos.

#### Rust Implementation

```rust
// crates/k-os-engine/src/photogrammetry/mod.rs

pub struct PhotogrammetryPipeline {
    gpu_compute: Arc<GpuCompute>,
}

pub struct PhotogrammetryInput {
    pub images: Vec<ImageData>,
    pub camera_intrinsics: Option<CameraIntrinsics>,
}

pub struct CameraIntrinsics {
    pub focal_length: f32,
    pub principal_point: Vec2,
    pub distortion: Vec<f32>,
}

pub struct PhotogrammetryOutput {
    pub point_cloud: PointCloud,
    pub mesh: TriangleMesh,
    pub camera_poses: Vec<CameraPose>,
    pub texture_atlas: TextureHandle,
}

pub struct PointCloud {
    pub points: Vec<Vec3>,
    pub colors: Vec<Vec3>,
    pub normals: Vec<Vec3>,
}

pub struct TriangleMesh {
    pub vertices: Vec<Vec3>,
    pub normals: Vec<Vec3>,
    pub uvs: Vec<Vec2>,
    pub indices: Vec<u32>,
}

pub struct CameraPose {
    pub position: Vec3,
    pub rotation: Quat,
}

impl PhotogrammetryPipeline {
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Self;
    
    pub fn reconstruct(&self, input: PhotogrammetryInput) -> Result<PhotogrammetryOutput>;
    
    // Internal steps
    fn extract_features(&self, images: &[ImageData]) -> Result<Vec<FeatureSet>>;
    fn match_features(&self, features: &[FeatureSet]) -> Result<FeatureMatches>;
    fn estimate_camera_poses(&self, matches: &FeatureMatches) -> Result<Vec<CameraPose>>;
    fn triangulate_points(&self, matches: &FeatureMatches, poses: &[CameraPose]) -> Result<PointCloud>;
    fn generate_mesh(&self, point_cloud: &PointCloud) -> Result<TriangleMesh>;
    fn project_textures(&self, mesh: &TriangleMesh, images: &[ImageData], poses: &[CameraPose]) -> Result<TextureHandle>;
}
```

Uses libraries:
- Feature detection: SIFT/ORB via `image-features` crate
- Structure from Motion: Custom implementation or `colmap-rs` bindings
- Mesh generation: Poisson surface reconstruction via `meshlab-rs` or custom
- Texture projection: Custom GPU shader

### HDR Capture System

Merges multi-exposure images and adds custom lighting.

#### Rust Implementation

```rust
// crates/k-os-engine/src/hdr/mod.rs

pub struct HDRCapture {
    gpu_compute: Arc<GpuCompute>,
}

pub struct HDRMergeInput {
    pub exposures: Vec<(ImageData, f32)>,  // (image, exposure_value)
}

pub struct HDRImage {
    pub data: Vec<f32>,  // RGB float data
    pub width: u32,
    pub height: u32,
    pub format: HDRFormat,
}

pub enum HDRFormat {
    RadianceRGBE,
    OpenEXR,
}

pub struct Light {
    pub light_type: LightType,
    pub position: Vec3,
    pub direction: Vec3,
    pub intensity: f32,
    pub color_temperature: f32,
}

pub enum LightType {
    Point,
    Directional,
    Area { width: f32, height: f32 },
}

impl HDRCapture {
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Self;
    
    pub fn merge_exposures(&self, input: HDRMergeInput) -> Result<HDRImage>;
    pub fn convert_to_equirectangular(&self, panorama: ImageData) -> Result<HDRImage>;
    pub fn add_light(&self, hdr: &HDRImage, light: Light) -> Result<HDRImage>;
    pub fn tone_map(&self, hdr: &HDRImage, method: ToneMappingMethod) -> Result<ImageData>;
    
    pub fn save_hdr(&self, hdr: &HDRImage, path: &Path) -> Result<()>;
    pub fn load_hdr(&self, path: &Path) -> Result<HDRImage>;
}

pub enum ToneMappingMethod {
    Reinhard,
    Filmic,
    ACES,
    Uncharted2,
}
```

### Tiling Engine

AI-powered seamless tiling and perspective correction.

#### Rust Implementation

```rust
// crates/k-os-engine/src/tiling/mod.rs

pub struct TilingEngine {
    gpu_compute: Arc<GpuCompute>,
    python_bridge: Arc<PythonBridge>,
}

pub struct TilingParams {
    pub seamless_strength: f32,
    pub perspective_correction: bool,
    pub smart_crop: bool,
    pub remove_folds: bool,
}

impl TilingEngine {
    pub fn new(gpu_compute: Arc<GpuCompute>, python_bridge: Arc<PythonBridge>) -> Self;
    
    pub fn make_seamless(&self, texture: &ImageData, params: TilingParams) -> Result<ImageData>;
    
    // Internal steps
    fn analyze_edges(&self, texture: &ImageData) -> Result<EdgeAnalysis>;
    fn inpaint_edges(&self, texture: &ImageData, analysis: &EdgeAnalysis) -> Result<ImageData>;
    fn correct_perspective(&self, texture: &ImageData) -> Result<ImageData>;
    fn remove_folds(&self, texture: &ImageData) -> Result<ImageData>;
    fn validate_seamlessness(&self, texture: &ImageData) -> Result<f32>;  // Returns similarity score
}
```

Calls Python sidecar for AI inpainting:

```python
# src-python/kos/autopbr/inpainting.py

from kos.rpc import register
import torch
from diffusers import StableDiffusionInpaintPipeline

@register("inpaint_edges")
async def inpaint_edges(image: bytes, mask: bytes, strength: float) -> bytes:
    """Use AI inpainting to blend texture edges seamlessly."""
    # Load model (cached)
    pipe = StableDiffusionInpaintPipeline.from_pretrained(
        "runwayml/stable-diffusion-inpainting",
        torch_dtype=torch.float16
    ).to("cuda")
    
    # Convert bytes to PIL images
    image_pil = Image.open(io.BytesIO(image))
    mask_pil = Image.open(io.BytesIO(mask))
    
    # Inpaint
    result = pipe(
        prompt="seamless texture",
        image=image_pil,
        mask_image=mask_pil,
        strength=strength
    ).images[0]
    
    # Convert back to bytes
    buffer = io.BytesIO()
    result.save(buffer, format="PNG")
    return buffer.getvalue()
```

### Export Pipeline

Multi-format material export system supporting SBSAR, glTF, USD, and game engine formats.

**Implementation details**:

```rust
pub struct ExportPipeline {
    exporters: HashMap<ExportFormat, Box<dyn MaterialExporter>>,
}

pub trait MaterialExporter: Send + Sync {
    fn export(&self, material: &Material, options: &ExportOptions) -> Result<Vec<u8>>;
    fn validate(&self, material: &Material) -> Result<()>;
}
```

Key libraries:
- `gltf` crate for glTF 2.0 export
- `usd-rs` or Python USD for USD export
- `image` crate for texture format conversion
- `zip` crate for SBSAR packaging

### Plugin System Integration

KAutoPBR integrates with the K_OS Hyperdrive plugin system for extensibility.

#### Architecture

```
Extension Manifest → kosRegistry → Validation → Activation
                                        ↓
                              hookBus Registration
                              slotRegistry Registration
                              appApiRegistry Access
                                        ↓
                              Resource Monitoring
                              Capability Enforcement
```

#### Key Components

**kosRegistry**: Central extension registry managing lifecycle
**hookBus**: Event system for material processing hooks
**slotRegistry**: UI extension points for custom components
**appApiRegistry**: Cross-app communication
**ResourceMonitor**: Tracks memory, CPU, file handles per extension
**PluginContext**: Capability-based access control

#### Extension Types

1. **Filter Extensions**: Image processing filters (blur, sharpen, denoise)
2. **Generator Extensions**: Procedural texture generators
3. **Material Processor Extensions**: Custom PBR map generation
4. **Export Format Extensions**: Custom export formats
5. **Import Format Extensions**: Custom import formats
6. **Animation Effect Extensions**: Custom animation effects
7. **Theme Extensions**: UI themes
8. **Shader Extensions**: Custom WGSL compute shaders
9. **Command Extensions**: Command palette commands

#### Security Model

- Capability-based access control via PluginContext
- Resource limits: 512MB memory, 5s execution time, 100 file handles
- Automatic termination on limit exceeded
- Crash isolation prevents cascade failures
- Future: Code signing for marketplace extensions

## Data Models

All material data uses JSON with schema validation for round-trip fidelity.

Key data structures:
- **Material**: UUID, metadata, layers (1-64), animation data, variants
- **Layer**: UUID, name, PBR maps, opacity, blend mode, mask
- **Animation**: Duration, loop mode, tracks (keyframe/procedural/physics)
- **Preset**: Category, processing params, layer/animation templates
- **Export Config**: Format, texture resolutions, texture formats, animation support

All data uses JSON with schema validation for round-trip fidelity.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Material Serialization Round-Trip

*For any* valid material with layers, animation data, and metadata, serializing to JSON then deserializing must produce an equivalent material with identical layer configuration, animation keyframes, and metadata.

**Validates: Requirements 2.10, 2.11, 5.10, 5.11, 9.12, 19.6**

### Property 2: PBR Map Generation Completeness

*For any* valid photogrammetry reconstruction, the Material_System must generate all six PBR map types: albedo, normal, roughness, metallic, AO, and height maps, with each map being non-null and having valid dimensions.

**Validates: Requirements 1.10**

### Property 3: Layer Blend Determinism

*For any* layer stack with specified blend modes and opacity values, recomputing the blend must produce identical output when given the same input layers, regardless of how many times it's computed.

**Validates: Requirements 2.6**

### Property 4: HDR Merge Performance

*For any* 8K resolution HDR image merge operation using GPU acceleration, the operation must complete within 5 seconds.

**Validates: Requirements 3.11**

### Property 5: Seamless Tiling Validation

*For any* texture processed by the Tiling_Engine, the edge pixel similarity between opposite edges must be within 5% tolerance, validating seamlessness.

**Validates: Requirements 4.7**

### Property 6: Tiling Retry Limit

*For any* tiling operation that fails validation, the system must retry with adjusted parameters up to exactly 3 times before returning failure.

**Validates: Requirements 4.9**

### Property 7: Animation Playback Frame Rate

*For any* material animation playback, the system must maintain at least 60 frames per second, updating material parameters at this minimum rate.

**Validates: Requirements 5.5**

### Property 8: Expression Evaluation Error Reporting

*For any* invalid procedural animation expression, the Animation_Engine must return an error message that includes the failing expression text.

**Validates: Requirements 6.11**

### Property 9: Physics Simulation Map Updates

*For any* physics-based animation simulation frame, the system must update all five map types: albedo, roughness, metallic, height, and normal maps.

**Validates: Requirements 7.10**

### Property 10: Preview Lighting Update Latency

*For any* lighting change in the preview renderer, the preview must update within 100 milliseconds.

**Validates: Requirements 8.10**

### Property 11: Material UUID Uniqueness

*For any* two materials created by the Asset_Manager, their UUIDs must be unique and conform to valid UUID format.

**Validates: Requirements 9.2**

### Property 12: Export Validation

*For any* material export operation, the Export_Pipeline must validate the output file and report any validation errors that occur.

**Validates: Requirements 10.12**

### Property 13: Denoising Effectiveness

*For any* texture processed by AI denoising, the noise level must be reduced by at least 80% while preserving texture detail (measured by edge preservation metric).

**Validates: Requirements 11.5**

### Property 14: Material Transfer UUID Preservation

*For any* material transferred between K_OS apps via Workflow_Bridge, the material UUID must remain unchanged after transfer.

**Validates: Requirements 12.8**

### Property 15: Batch Processing Error Isolation

*For any* batch processing operation where one item fails, the system must log the error and continue processing all remaining items without stopping.

**Validates: Requirements 13.9**

### Property 16: Preset Serialization Round-Trip

*For any* valid material preset, serializing to JSON then deserializing must produce an equivalent preset with identical settings, layer configurations, and animation data.

**Validates: Requirements 14.2**

### Property 17: Preset Validation

*For any* imported preset file, the Material_System must validate the format against the preset schema and report any validation errors.

**Validates: Requirements 14.7**

### Property 18: Real-Time Parameter Update Latency

*For any* material parameter adjustment, the Preview_Renderer must update the preview within 33 milliseconds (30 fps minimum).

**Validates: Requirements 15.1**

### Property 19: Variant Propagation

*For any* base material property change, all variant materials must reflect the change unless that specific property has been overridden in the variant.

**Validates: Requirements 16.4**

### Property 20: GPU Fallback Continuity

*For any* GPU compute operation when GPU acceleration is unavailable, the system must fall back to CPU processing, display a warning, and produce equivalent results.

**Validates: Requirements 17.4**

### Property 21: GPU Memory Reporting

*For any* GPU compute operation, the system must report current GPU memory usage and available memory to the user.

**Validates: Requirements 17.10**

### Property 22: Configuration Hot-Reload

*For any* configuration file modification, the Material_System must reload the configuration and apply changes without requiring application restart.

**Validates: Requirements 18.5**

### Property 23: Configuration Schema Validation

*For any* JSON configuration file loaded by the Material_System, the file must be validated against its corresponding JSON schema.

**Validates: Requirements 18.6**

### Property 24: Parse Error Reporting

*For any* invalid material JSON, the parser must return an error message containing the line number and column number of the parsing failure.

**Validates: Requirements 19.7**

### Property 25: Performance Budget Warnings

*For any* operation that exceeds its performance budget (e.g., frame time > 33ms), the system must display a warning to the user.

**Validates: Requirements 20.8**

### Property 26: Extension Manifest Validation

*For any* extension loaded by the plugin system, the manifest must be validated against the extension schema before activation.

**Validates: Requirements 21.4**

### Property 27: Invalid Extension Error Handling

*For any* extension with an invalid manifest, the system must log an error and display the extension in Plugin Matrix with 'error' status.

**Validates: Requirements 21.6**

### Property 28: Extension Resource Limit Enforcement

*For any* extension operation that exceeds resource limits (memory, execution time, or file handles), the system must terminate the operation, log a warning, and update the Plugin Matrix health indicator.

**Validates: Requirements 21.10**

### Property 29: Extension Crash Isolation

*For any* extension that crashes during execution, the system must isolate the crash, set the extension status to 'error', display it in Plugin Matrix, and continue operating normally.

**Validates: Requirements 21.19**

## Error Handling

### Error Categories

1. **User Input Errors**: Invalid parameters, missing files, unsupported formats
2. **Processing Errors**: GPU failures, AI model errors, insufficient memory
3. **System Errors**: File I/O failures, network errors, plugin crashes
4. **Performance Errors**: Timeout exceeded, resource limits hit

### Error Handling Strategy

```rust
// crates/k-os-engine/src/material/error.rs

#[derive(Debug, thiserror::Error)]
pub enum MaterialError {
    #[error("Invalid layer index: {0}")]
    InvalidLayerIndex(usize),
    
    #[error("GPU compute failed: {0}")]
    GpuComputeError(String),
    
    #[error("Animation evaluation failed: {0}")]
    AnimationError(String),
    
    #[error("Serialization failed: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Python bridge error: {0}")]
    PythonError(String),
    
    #[error("Extension error: {extension_id} - {message}")]
    ExtensionError {
        extension_id: String,
        message: String,
    },
    
    #[error("Resource limit exceeded: {resource} - {limit}")]
    ResourceLimitExceeded {
        resource: String,
        limit: String,
    },
}

pub type Result<T> = std::result::Result<T, MaterialError>;
```

### Error Recovery

- **GPU Fallback**: Automatically fall back to CPU processing if GPU fails
- **Retry Logic**: Tiling engine retries up to 3 times with adjusted parameters
- **Graceful Degradation**: Preview continues with lower quality if performance budget exceeded
- **Crash Isolation**: Extension crashes don't affect core system
- **Batch Processing**: One item failure doesn't stop batch processing
- **Validation**: All inputs validated before processing to fail fast

### User-Facing Error Messages

```typescript
// src-frontend/services/autoPBRClient.ts

class AutoPBRError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AutoPBRError';
  }
}

// User-friendly error mapping
const ERROR_MESSAGES: Record<string, string> = {
  'InvalidLayerIndex': 'Layer not found. The layer may have been deleted.',
  'GpuComputeError': 'GPU processing failed. Falling back to CPU processing.',
  'AnimationError': 'Animation evaluation failed. Check your expression syntax.',
  'ResourceLimitExceeded': 'Extension exceeded resource limits and was terminated.',
};
```

## Testing Strategy

### Dual Testing Approach

KAutoPBR uses both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Specific examples, edge cases, integration points
**Property Tests**: Universal properties across all inputs

### Property-Based Testing

Using `proptest` crate (Rust) and `fast-check` (TypeScript) for property-based testing.

**Configuration**: Minimum 100 iterations per property test due to randomization.

**Test Tagging**: Each property test references its design document property:
```rust
// Feature: kautopbr-substance-parity-plus, Property 1: Material Serialization Round-Trip
#[test]
fn prop_material_serialization_roundtrip() {
    proptest!(|(material in arb_material())| {
        let json = material.serialize()?;
        let deserialized = Material::deserialize(&json)?;
        prop_assert_eq!(material, deserialized);
    });
}
```

### Test Coverage by Component

**Material System Core**:
- Property 1: Serialization round-trip
- Property 11: UUID uniqueness
- Property 19: Variant propagation
- Unit tests: Layer operations, metadata updates

**Layer Stack**:
- Property 3: Blend determinism
- Unit tests: Blend modes, opacity, masks, reordering

**Animation Engine**:
- Property 7: Frame rate maintenance
- Property 8: Expression error reporting
- Property 9: Physics simulation map updates
- Unit tests: Keyframe interpolation, noise functions, specific expressions

**Photogrammetry Pipeline**:
- Property 2: PBR map completeness
- Unit tests: Feature matching, mesh generation, texture projection

**HDR Capture**:
- Property 4: Merge performance
- Unit tests: Exposure merging, tone mapping, light addition

**Tiling Engine**:
- Property 5: Seamless validation
- Property 6: Retry limit
- Property 13: Denoising effectiveness
- Unit tests: Edge analysis, perspective correction

**Export Pipeline**:
- Property 12: Export validation
- Unit tests: Format-specific exports (SBSAR, glTF, USD, etc.)

**Plugin System**:
- Property 26: Manifest validation
- Property 27: Invalid extension error handling
- Property 28: Resource limit enforcement
- Property 29: Crash isolation
- Unit tests: Hook registration, slot rendering, capability checks

**Performance**:
- Property 4: HDR merge performance (< 5s for 8K)
- Property 7: Animation frame rate (≥ 60fps)
- Property 10: Preview lighting update (< 100ms)
- Property 18: Parameter update latency (< 33ms)
- Property 25: Performance budget warnings

### Integration Tests

- Material creation → layer addition → animation → export workflow
- Photogrammetry → PBR generation → tiling → export
- Extension loading → hook registration → material processing → cleanup
- Cross-app material transfer (KAutoPBR → K-Painter → K-Bake)

### Performance Benchmarks

```rust
// crates/k-os-engine/benches/material_bench.rs

use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn bench_layer_blend(c: &mut Criterion) {
    c.bench_function("layer_blend_4k", |b| {
        b.iter(|| {
            // Benchmark 4K layer blending
        });
    });
}

fn bench_animation_eval(c: &mut Criterion) {
    c.bench_function("animation_eval_60fps", |b| {
        b.iter(|| {
            // Benchmark animation evaluation at 60fps
        });
    });
}

criterion_group!(benches, bench_layer_blend, bench_animation_eval);
criterion_main!(benches);
```

## Performance Considerations

### GPU Acceleration Strategy

**All compute-heavy operations use wgpu compute shaders**:
- Layer blending (10+ blend modes)
- PBR map generation from photogrammetry
- Seamless tiling edge inpainting
- Animation evaluation (procedural expressions, physics simulation)
- HDR merging and tone mapping
- Texture filtering and upscaling

**Buffer Management**:
- Use buffer pools for frequently allocated buffers
- Staging buffers for CPU→GPU transfers
- Tile large textures (>8K) to avoid GPU memory exhaustion
- Async compute to avoid blocking UI thread

**Performance Budgets**:
- Preview update: < 33ms (30fps minimum)
- Parameter adjustment: < 33ms
- Lighting change: < 100ms
- HDR merge (8K): < 5s
- Animation playback: ≥ 60fps

### CPU Parallelism

Use `rayon` for CPU-parallel operations:
- Batch processing multiple materials
- Feature extraction in photogrammetry
- Parallel texture encoding during export

### Memory Management

**Texture Streaming**:
- Load textures on-demand
- Unload unused textures after timeout
- Compress textures in memory (BC7/ASTC)

**Material Library**:
- Lazy-load material thumbnails
- Cache recently accessed materials
- Limit in-memory material count (configurable)

### Optimization Techniques

1. **Lazy Evaluation**: Don't compute until needed
2. **Caching**: Cache blend results, animation frames, export outputs
3. **Incremental Updates**: Only recompute changed layers
4. **LOD System**: Lower quality preview during interaction
5. **Async Processing**: Background tasks for AI operations

## Security Considerations

### Plugin System Security

**Capability-Based Access Control**:
```rust
pub struct PluginContext {
    capabilities: HashSet<Capability>,
    resource_monitor: Arc<ResourceMonitor>,
}

pub enum Capability {
    MaterialAccess,
    LayerAccess,
    GpuCompute,
    FileIO,
    Network,
    AppApi,
}

impl PluginContext {
    pub fn check_capability(&self, cap: Capability) -> Result<()> {
        if self.capabilities.contains(&cap) {
            Ok(())
        } else {
            Err(MaterialError::ExtensionError {
                extension_id: self.id.clone(),
                message: format!("Missing capability: {:?}", cap),
            })
        }
    }
}
```

**Resource Limits**:
- Memory: 512MB per extension (configurable)
- Execution time: 5s per operation
- File handles: 100 max
- Automatic termination on limit exceeded

**Sandboxing**:
- Extensions run in same process but with restricted access
- No direct access to other extensions' data
- File system access restricted to material library directory
- Network access requires explicit permission
- GPU compute limited to allocated buffers

**Crash Isolation**:
```rust
pub fn execute_extension_hook(
    extension_id: &str,
    hook: &str,
    data: HookData,
) -> Result<HookData> {
    match std::panic::catch_unwind(|| {
        // Execute extension hook
    }) {
        Ok(result) => result,
        Err(panic) => {
            log::error!("Extension {} crashed: {:?}", extension_id, panic);
            registry.set_status(extension_id, ExtensionStatus::Error);
            Err(MaterialError::ExtensionError {
                extension_id: extension_id.to_string(),
                message: "Extension crashed".to_string(),
            })
        }
    }
}
```

### Data Validation

**Input Validation**:
- All user inputs validated before processing
- JSON schema validation for all config files
- Image format validation before loading
- Expression syntax validation before evaluation

**Output Validation**:
- Export files validated before saving
- Seamless tiling validated (5% edge tolerance)
- Animation keyframes validated (time ordering)
- Material UUIDs validated (uniqueness, format)

### File System Security

- Restrict file access to material library directory
- Validate file paths to prevent directory traversal
- Sanitize filenames to prevent injection
- Check file sizes before loading

## Integration with K_OS Ecosystem

### Cross-App Communication

**Workflow Bridge Architecture**:
```typescript
// src-frontend/services/workflowBridge.ts

export class WorkflowBridge {
  async sendToKPainter(materialId: string): Promise<void> {
    const material = await autoPBRClient.getMaterial(materialId);
    await invoke('workflow_send_material', {
      targetApp: 'kpainter',
      materialData: material,
    });
  }
  
  async sendToKBake(materialId: string): Promise<void> {
    const material = await autoPBRClient.getMaterial(materialId);
    await invoke('workflow_send_material', {
      targetApp: 'kbake',
      materialData: material,
    });
  }
  
  async importFromKGraphos(nodeGraphId: string): Promise<string> {
    const materialData = await invoke('workflow_import_from_kgraphos', {
      nodeGraphId,
    });
    return await autoPBRClient.createMaterialFromData(materialData);
  }
}
```

**Material UUID Tracking**:
- UUIDs preserved across app transfers
- Material provenance tracked (source app, creation time)
- Version history maintained across apps

### App API Registry Integration

```typescript
// Register KAutoPBR APIs for other apps to call
appApiRegistry.register('kautopbr', {
  createMaterial: async (params) => { /* ... */ },
  applyPreset: async (materialId, presetId) => { /* ... */ },
  exportMaterial: async (materialId, format) => { /* ... */ },
  getMaterialThumbnail: async (materialId) => { /* ... */ },
});

// Call other app APIs
const mesh = await appApiRegistry.call('ksculpt', 'getCurrentMesh');
const material = await autoPBRClient.createMaterialFromMesh(mesh);
```

### Shared Material Library

- Central material library accessible by all K_OS apps
- Consistent material format across apps
- Thumbnail generation for quick browsing
- Tag-based organization and search

## Recommended Libraries

### Rust Crates

**Core**:
- `wgpu` - GPU compute (already in use)
- `nalgebra` - Math operations
- `uuid` - UUID generation
- `serde` + `serde_json` - Serialization
- `thiserror` - Error handling
- `rayon` - CPU parallelism

**Image Processing**:
- `image` - Image loading/saving/format conversion
- `imageproc` - Image processing operations
- `fast_image_resize` - High-performance resizing

**Photogrammetry**:
- `akaze` - Feature detection (AKAZE algorithm)
- `opencv-rust` - OpenCV bindings (SIFT, feature matching)
- `nalgebra` - Camera pose estimation
- `meshlab-rs` or custom - Poisson surface reconstruction

**HDR**:
- `exr` - OpenEXR format support
- `image-hdr` - Radiance RGBE format

**Export**:
- `gltf` - glTF 2.0 reading/writing
- `zip` - SBSAR packaging
- Python USD bindings via sidecar

**Testing**:
- `proptest` - Property-based testing
- `criterion` - Benchmarking

### Python Packages

**AI/ML**:
- `torch` - PyTorch for neural networks
- `diffusers` - Stable Diffusion for inpainting
- `transformers` - Pre-trained models
- `opencv-python` - Computer vision

**Image Processing**:
- `Pillow` - Image manipulation
- `scikit-image` - Image processing algorithms
- `numpy` - Numerical operations

**3D/USD**:
- `pxr` - Pixar USD Python bindings
- `trimesh` - Mesh processing

### TypeScript/NPM Packages

**3D Rendering**:
- `three` + `@react-three/fiber` - Three.js React integration (already in use)
- `@react-three/drei` - Three.js helpers

**UI**:
- `@radix-ui/*` - UI primitives (already in use)
- `@mantine/core` - UI components (already in use)
- `framer-motion` - Animations

**State Management**:
- `zustand` - Lightweight state management
- `jotai` - Atomic state management

**Testing**:
- `fast-check` - Property-based testing for TypeScript
- `vitest` - Unit testing

**Utilities**:
- `uuid` - UUID generation
- `zod` - Runtime type validation

## Implementation Recommendations

### Phase 1: Core Material System (Weeks 1-2)
- Material data structures and serialization
- Layer stack with GPU blending
- Asset manager with UUID tracking
- Basic preview renderer

### Phase 2: Animation Engine (Weeks 3-4)
- Keyframe animation system
- Expression evaluator for procedural animation
- Animation timeline UI
- **KILLER FEATURE COMPLETE**

### Phase 3: Photogrammetry & HDR (Weeks 5-6)
- Feature detection and matching
- 3D reconstruction pipeline
- HDR merging and tone mapping
- Light authoring

### Phase 4: AI Integration (Week 7)
- Python sidecar setup
- AI upscaling models
- Denoising models
- Seamless tiling inpainting

### Phase 5: Export Pipeline (Week 8)
- glTF exporter
- USD exporter
- Game engine exporters (Unreal, Unity, Godot)
- SBSAR packaging

### Phase 6: Plugin System (Week 9)
- Extension registry and lifecycle
- Hook system integration
- Slot system integration
- Plugin Matrix UI
- Resource monitoring

### Phase 7: Physics Animation (Week 10)
- Rust spreading simulation
- Moss growth simulation
- Erosion simulation
- GPU compute shaders for physics

### Phase 8: Polish & Optimization (Weeks 11-12)
- Performance profiling and optimization
- Property-based test suite
- Documentation
- Preset library (20+ presets)

## Conclusion

KAutoPBR represents a comprehensive material sampling and PBR generation tool that exceeds Substance Sampler's capabilities through its killer feature: **animated materials**. The system combines photogrammetry, HDR capture, AI enhancement, non-destructive layering, and a powerful plugin system into a GPU-accelerated, data-driven pipeline.

Key differentiators:
- **Material animation** (keyframe, procedural, physics-based)
- **Hyperdrive plugin system** for extensibility
- **GPU-first architecture** for maximum performance
- **Data-driven configuration** for flexibility
- **Cross-app integration** within K_OS ecosystem

The design prioritizes correctness through property-based testing, performance through GPU acceleration, and extensibility through the plugin system. With 29 correctness properties covering all critical functionality, the system ensures reliable operation across all use cases.

