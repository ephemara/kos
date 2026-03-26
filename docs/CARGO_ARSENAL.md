# K_OS CARGO ARSENAL

> **FORMAT**: AI-optimized. Grouped by purpose. Quick reference for AI agents.
> **AGENTS**: Check here before adding new crates. Use what's available!

---

## QUICK REFERENCE

```
TOTAL_CRATES: ~63
LAST_UPDATED: 2026-03-07
BEVY_VERSION: 0.17
PHYSICS: rapier3d + salva3d
MATH: nalgebra + glam
```

---

## WORKSPACE CRATES (Internal)

| Crate | Use | Import |
|-------|-----|--------|
| `archive/k-os-engine` | Archived compatibility crate kept for migration history and old references | Archived only |
| `k-os-gpu-pipeline` | GPU pipeline manager (caching, buffer pooling, performance monitoring) | `use k_os_gpu_pipeline::*;` |
| `k-os-undo` | Universal undo/redo system with memory-aware history | `use k_os_undo::{UndoManager, UndoableAction};` |
| `k-os-asset-pipeline` | Asset import/export/processing pipeline | `use k_os_asset_pipeline::{AssetPipeline, AssetImporter};` |
| `k-os-plugin` | Dynamic plugin system with API versioning | `use k_os_plugin::{PluginManager, Plugin};` |
| `k-os-material` | PBR material system with texture management and presets | `use k_os_material::{Material, MaterialLibrary, MaterialPreset};` |
| `k-os-mesh-processing` | Advanced mesh processing (decimation, smoothing, subdivision, repair, retopology, UV unwrapping) | `use k_os_mesh_processing::{Mesh, decimation, retopology};` |
| `k-os-scene` | Canonical scene state layer backed by ECS handles/components | `use k_os_scene::{SceneWorld, MeshHandle};` |
| `k-os-scene-runtime` | Runtime scene ownership for shared mesh state, viewport bridge payloads, and scene-backed mesh sync | `use k_os_scene_runtime::mesh_state::{SCENE_WORLD, register_shared_mesh_cmd};` |
| `k-os-eval` | DAG scheduler for dependency tracking, dirty propagation, and lazy evaluation | `use k_os_eval::{EvalGraph, NodeId, DirtyReason};` |
| `k-os-renderer` | Native viewport session contract, camera/state handling, selection cache, and renderer service thread boundary | `use k_os_renderer::{RendererService, ViewportHandle, ViewportConfig};` |
| `k-os-gizmo` | Native transform-gizmo interaction core for session-based translate/rotate/scale updates and viewport-space draw data generation | `use k_os_gizmo::prelude::{Gizmo, GizmoConfig, GizmoInteraction, GizmoResult};` |
| `k-os-kain` | KAIN workspace owner: manifest-driven source registry, domain directories, compile helpers, and SPIR-V validation for `crates/k-os-kain/domains/*` | `use k_os_kain::{KainSourceAsset, list_sources, domain_dir};` |
| `k-os-animation` | Native animation asset metadata and clip representations | `use k_os_animation::{AnimationClipAsset, AnimationSourceKind};` |
| `k-os-brushes` | Brush asset, curve, kernel-registry, and brush-library ownership boundary during migration out of engine | `use k_os_brushes::{KBrushAsset, BRUSH_LIBRARY, KERNEL_REGISTRY};` |
| `k-os-config` | App configuration and registry boundary for runtime settings, schema loading, and command-facing config access | `use k_os_config::registry;` |
| `k-os-sculpt` | Sculpt domain boundary for brushes, masking, tangents, and sculpt workflows | `use k_os_sculpt::{sculpt, brush_stroke, mask};` |
| `k-os-sim` | Simulation domain boundary for CFD, fluid, physics, and quantum systems | `use k_os_sim::{cfd, fluid, physics, quantum};` |
| `k-os-scatter` | Scatter domain boundary for procedural point distribution, surface placement, and physics drop scattering | `use k_os_scatter::{poisson_disk_scatter, physics_drop_scatter, ScatterTransform};` |
| `k-os-external` | External tool/runtime integration boundary for process launchers, bridge helpers, and compatibility adapters | `use k_os_external::*;` |
| `k-os-hdr` | HDR authoring and light-environment tool boundary for command-facing HDR workflows | `use k_os_hdr::*;` |
| `k-os-io` | IO domain boundary for storage, cache, transaction, and import/export workflows | `use k_os_io::{StorageEngine, import_export, Asset};` |
| `k-os-mesh` | Mesh domain boundary for primitive generation and mesh optimization command surfaces during engine shrink-down | `use k_os_mesh::{spawn_primitive, optimize_mesh, simplify_mesh};` |
| `k-os-photogrammetry` | Photogrammetry domain boundary for reconstruction, calibration, and image-processing command workflows | `use k_os_photogrammetry::*;` |
| `k-os-rig` | Rigging domain boundary for skeleton generation, skinning, and IK command surfaces during migration out of engine | `use k_os_rig::{create_biped_skeleton, solve_ik_fabrik, Skeleton};` |
| `zen-mocap-engine` | Real-time/offline mocap pipeline (camera ingest, ONNX inference, IK/retarget outputs, take management) | `use zen_mocap_engine::*;` |
| `kos-proto` | Type-safe IPC protocol (Bevy ↔ Tauri ↔ React) - auto-generated TypeScript types | `use kos_proto::{KosMessage, KosState};` |

---

## CORE FRAMEWORK

| Crate | Use | Import |
|-------|-----|--------|
| `tauri` | Desktop app framework | `use tauri::*;` |
| `tauri-plugin-shell` | Shell commands & sidecar process management | Plugin |
| `tauri-plugin-dialog` | Native OS file dialogs (Save As, Open File) — used by export pipeline to invoke native save dialog, returns file path for `write_file` | Plugin |
| `bevy_ecs` | ECS storage/scheduling backbone for canonical scene state | `use bevy_ecs::prelude::*;` |
| `serde` | Serialization | `use serde::{Serialize, Deserialize};` |
| `serde_json` | JSON parsing | `use serde_json::{json, Value};` |
| `chrono` | Date/time handling for metadata timestamps and time-based asset records | `use chrono::Utc;` |
| `glob` | File pattern matching | `use glob::glob;` |
| `uuid` | UUID generation | `use uuid::Uuid;` |
| `dirs` | Cross-platform user directories (Documents, AppData) | `use dirs::document_dir;` |

---

## GPU COMPUTE (Tier 11 - NEW!)

| Crate | Use | Import |
|-------|-----|--------|
| `wgpu` | Cross-platform GPU compute | `use wgpu::{Device, Queue, ComputePipeline};` |
| `pollster` | Block on async GPU init | `pollster::block_on(async_fn())` |
| `once_cell` | Lazy static initialization | `use once_cell::sync::OnceCell;` |
| `parking_lot` | Fast mutexes | `use parking_lot::Mutex;` |
| `bytemuck` | Pod/Zeroable buffer casting | `use bytemuck::{Pod, Zeroable};` |
| `notify` | File system watching (hot-reload) | `use notify::{Watcher, RecursiveMode};` |
| `hashbrown` | Fast hash maps | `use hashbrown::HashMap;` |

### GPU Pipeline Manager (k-os-gpu-pipeline)

```rust
use k_os_gpu_pipeline::{GPUPipelineManager, BufferPoolConfig};
use std::sync::Arc;

// Create manager
let mut manager = GPUPipelineManager::new(device, queue);

// Enable hot-reload (debug only)
#[cfg(debug_assertions)]
manager.enable_hot_reload("shaders/")?;

// Get or create pipeline (cached)
let pipeline = manager.get_or_create_pipeline("my_shader")?;

// Get buffer from pool
let buffer = manager.get_buffer(1024, wgpu::BufferUsages::STORAGE)?;

// Return to pool when done
manager.return_buffer(buffer);

// Performance stats
let stats = manager.get_performance_stats();
println!("GPU Memory: {} bytes, FPS: {}", stats.total_memory_bytes, stats.fps);
```

### Used By

- `gpu/pipelines/sculpt.rs` - GPU sculpt brushes (100x faster!)
- `gpu/pipelines/paint.rs` - GPU texture painting (future)
- `gpu/pipelines/filter.rs` - GPU image filters (future)
- `k-os-baking` - Texture baking system
- `k-os-material` - Material shader compilation

---

## MATERIAL SYSTEM (k-os-material)

PBR material system with texture management, presets, and serialization.

```rust
use k_os_material::{Material, MaterialLibrary, MaterialPreset, TextureSlot};
use glam::Vec3;

// Create material with PBR properties
let mut material = Material::new("Gold Metal");
material.set_base_color(Vec3::new(1.0, 0.766, 0.336));
material.set_metallic(1.0);
material.set_roughness(0.15);

// Add textures
material.set_texture(TextureSlot::BaseColor, "textures/albedo.png");
material.set_texture(TextureSlot::Normal, "textures/normal.png");
material.set_texture(TextureSlot::Roughness, "textures/roughness.png");

// Use presets
let gold = MaterialPreset::gold();
let glass = MaterialPreset::glass();
let plastic = MaterialPreset::plastic_red();

// Material library
let mut library = MaterialLibrary::new();
let id = library.add_material(material);

// Save/load
library.save_to_file("materials.json")?;
let loaded = MaterialLibrary::load_from_file("materials.json")?;
```

### Texture Slots

- `BaseColor` - Albedo/diffuse (sRGB)
- `Metallic` - Metallic map (linear)
- `Roughness` - Roughness map (linear)
- `Normal` - Tangent-space normal map
- `AmbientOcclusion` - AO map
- `Emissive` - Emissive color (sRGB)
- `Height` - Displacement map
- `Opacity` - Alpha/transparency

### Material Presets

**Metals**: `gold`, `silver`, `copper`, `aluminum`, `iron`, `brushed_metal`  
**Plastics**: `plastic_glossy`, `plastic_matte`, `plastic_red`, `plastic_blue`, `plastic_green`  
**Glass**: `glass`, `glass_frosted`, `glass_colored(color)`  
**Wood**: `wood`, `wood_polished`  
**Stone**: `stone`, `marble`  
**Fabric**: `fabric`, `velvet`  
**Emissive**: `neon(color)`, `led(color)`

---

## BEVY ENGINE (Tier 10)

| Crate | Use | Import |
|-------|-----|--------|
| `bevy` | Game engine / 3D renderer | `use bevy::prelude::*;` |
| `bevy_egui` | Immediate mode GUI | `use bevy_egui::{egui, EguiContexts};` |
| `bevy_panorbit_camera` | Orbit camera controls | `use bevy_panorbit_camera::*;` |
| `bevy_hanabi` | GPU particle system | `use bevy_hanabi::prelude::*;` |
| `bevy_tweening` | Animation/easing | `use bevy_tweening::*;` |
| `bevy-inspector-egui` | Entity inspector | `use bevy_inspector_egui::*;` |

### Bevy Quick Reference

```rust
// Basic app setup
App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(Startup, setup)
    .add_systems(Update, update)
    .run();

// Spawn entity
commands.spawn((
    Mesh3d(mesh),
    MeshMaterial3d(material),
    Transform::from_xyz(0.0, 0.0, 0.0),
));

// Query components
fn system(query: Query<&Transform, With<Player>>) {
    for transform in query.iter() { ... }
}

// Resources
fn system(time: Res<Time>, mut state: ResMut<GameState>) { ... }

// Events (Bevy 0.17 uses MessageReader/MessageWriter)
fn system(mut events: MessageWriter<MyEvent>) {
    events.write(MyEvent { ... });
}
```

---

## MATH & LINEAR ALGEBRA (Tier 1)

| Crate | Use | Import |
|-------|-----|--------|
| `nalgebra` | N-dimensional linear algebra | `use nalgebra::{Vector3, Matrix4};` |
| `nalgebra-sparse` | Sparse matrices | `use nalgebra_sparse::*;` |
| `glam` | Fast SIMD math (Bevy's math) | `use glam::{Vec3, Mat4, Quat};` |
| `maath` | Extra math utilities | Via npm (JS) |

### When to use which

- **glam** - For Bevy code, SIMD-optimized, simple API
- **nalgebra** - For complex linear algebra, sparse solving, scientific

---

## PHYSICS (Tier 3)

| Crate | Use | Import |
|-------|-----|--------|
| `rapier3d` | Physics engine | `use rapier3d::prelude::*;` |
| `salva3d` | SPH fluid simulation | `use salva3d::*;` |
| `parry3d` | Collision/raycasting | `use parry3d::query::*;` |

### Physics Quick Reference

```rust
// Rapier - Create physics world
let mut physics_pipeline = PhysicsPipeline::new();
let mut rigid_body_set = RigidBodySet::new();
let mut collider_set = ColliderSet::new();

// Add rigid body
let rb = RigidBodyBuilder::dynamic()
    .translation(vector![0.0, 10.0, 0.0])
    .build();
let handle = rigid_body_set.insert(rb);

// Parry - Raycast
let ray = Ray::new(origin.into(), direction.into());
if let Some(hit) = trimesh.cast_ray(&ray, max_dist, true) {
    // hit.toi = distance
}
```

---

## GEOMETRY & MESH (Tier 2)

| Crate | Use | Import |
|-------|-----|--------|
| `xatlas-rs` | UV unwrapping | `use xatlas::*;` |
| `meshopt` | Mesh optimization | `use meshopt::*;` |
| `isosurface` | Marching cubes | `use isosurface::*;` |
| `bvh` | BVH acceleration | `use bvh::*;` |

---

## NOISE & PROCEDURAL (Tier 2)

| Crate | Use | Import |
|-------|-----|--------|
| `noise` | Procedural noise | `use noise::{Perlin, Fbm, NoiseFn};` |
| `noise-functions` | Fast noise (static tables) | `use noise_functions::*;` |
| `voronoice` | Voronoi diagrams | `use voronoice::*;` |

### Noise Quick Reference

```rust
use noise::{Perlin, NoiseFn, Fbm};

let perlin = Perlin::new(seed);
let value = perlin.get([x, y, z]); // Returns -1.0 to 1.0

let fbm: Fbm<Perlin> = Fbm::new(seed)
    .set_octaves(4)
    .set_frequency(1.0);
```

---

## SPATIAL DATA STRUCTURES

| Crate | Use | Import |
|-------|-----|--------|
| `kiddo` | KD-Tree (fast!) | `use kiddo::KdTree;` |
| `rstar` | R-Tree | `use rstar::RTree;` |
| `fixedbitset` | Fixed-size bitset (fast dirty tracking) | `use fixedbitset::FixedBitSet;` |

### KD-Tree Quick Reference

```rust
use kiddo::KdTree;

let mut tree: KdTree<f32, 3> = KdTree::new();
tree.add(&[x, y, z], index);

// Nearest neighbor
let nearest = tree.nearest_one(&[x, y, z]);
```

---

## IMAGE PROCESSING (Tier 4)

| Crate | Use | Import |
|-------|-----|--------|
| `image` | Image I/O | `use image::{DynamicImage, RgbaImage};` |
| `imageproc` | Image operations | `use imageproc::*;` |
| `fast_image_resize` | SIMD resize (15x faster!) | `use fast_image_resize::*;` |

---

## COMPRESSION (Tier 5)

| Crate | Use | Import |
|-------|-----|--------|
| `lz4_flex` | Fast compression | `use lz4_flex::{compress, decompress};` |
| `zstd` | High-ratio compression | `use zstd::*;` |

### When to use which

- **lz4_flex** - Undo history, real-time (faster)
- **zstd** - Asset storage, exports (smaller)

---

## CONCURRENCY (Tier 6)

| Crate | Use | Import |
|-------|-----|--------|
| `rayon` | Parallel iterators | `use rayon::prelude::*;` |
| `crossbeam` | Channels, queues | `use crossbeam::channel;` |
| `tokio` | Async runtime for Tauri commands, background tasks, and event streams | `use tokio::{spawn, task};` |
| `parking_lot` | Fast mutexes | `use parking_lot::{Mutex, RwLock};` |

### Rayon Quick Reference

```rust
use rayon::prelude::*;

// Parallel iterator
vertices.par_iter_mut().for_each(|v| {
    v.position += displacement;
});

// Parallel chunks
data.par_chunks(1024).for_each(|chunk| { ... });
```

---

## MEMORY (Tier 7)

| Crate | Use | Import |
|-------|-----|--------|
| `memmap2` | Memory-mapped files | `use memmap2::Mmap;` |
| `ndarray` | N-dimensional arrays | `use ndarray::Array2;` |
| `bytemuck` | Safe casting | `use bytemuck::{Pod, Zeroable};` |
| `half` | 16-bit floats | `use half::f16;` |

---

## COLOR SCIENCE (Tier 8)

| Crate | Use | Import |
|-------|-----|--------|
| `palette` | Color space conversions | `use palette::{Srgb, Lab, Hsv};` |

### Color Quick Reference

```rust
use palette::{Srgb, Lab, IntoColor};

let srgb = Srgb::new(1.0, 0.5, 0.0);
let lab: Lab = srgb.into_color(); // Convert to LAB
```

---

## SERIALIZATION

| Crate | Use | Import |
|-------|-----|--------|
| `bincode` | Binary serialization | `use bincode::{serialize, deserialize};` |
| `rkyv` | Zero-copy deserialization | `use rkyv::*;` |
| `specta` | TypeScript type generation (via Tauri) | `use specta::Type;` |

---

## RANDOM

| Crate | Use | Import |
|-------|-----|--------|
| `rand` | Full RNG | `use rand::Rng;` |
| `fastrand` | Simple fast RNG | `use fastrand;` |

### When to use which

- **fastrand** - Simple random numbers, faster
- **rand** - Distributions, seeding, crypto-grade

---

## LOGGING

| Crate | Use | Import |
|-------|-----|--------|
| `log` | Logging facade | `use log::{info, warn, error};` |
| `env_logger` | Logger implementation | Init in main() |

---

## UTILITIES

| Crate | Use | Import |
|-------|-----|--------|
| `lazy_static` | Static initialization | `lazy_static! { static ref X: T = ...; }` |
| `base64` | Base64 encoding | `use base64::{encode, decode};` |

---

## PROFILE SETTINGS

### Release (Max Performance)

```toml
[profile.release]
lto = true           # Link-time optimization
codegen-units = 1    # Single codegen unit
panic = "abort"      # No unwinding
opt-level = 3        # Max optimization
```

### Dev (Fast Compile)

```toml
[profile.dev]
opt-level = 1        # Some optimization
debug = 0            # No debug symbols (faster link)
incremental = true   # Incremental compilation

[profile.dev.package."*"]
opt-level = 2        # Optimize deps (they don't change)
```

---

## BEVY 0.17 BREAKING CHANGES

> ⚠️ **CRITICAL**: These patterns changed from 0.14 to 0.17

| Old (0.14) | New (0.17) |
|------------|------------|
| `PbrBundle` | `(Mesh3d, MeshMaterial3d, Transform)` |
| `MaterialMeshBundle` | `(Mesh3d, MeshMaterial3d, Transform)` |
| `EventReader<T>` | `MessageReader<T>` |
| `EventWriter<T>` | `MessageWriter<T>` |
| `events.iter()` | `events.read()` |
| `app.add_event::<T>()` | `app.add_message::<T>()` |
| `Handle<Mesh>` in query | `Mesh3d` component |
| `ResMut<Assets<Mesh>>` for meshes | Still works |

### Correct Bevy 0.17 Spawn

```rust
commands.spawn((
    Mesh3d(meshes.add(Sphere::new(1.0))),
    MeshMaterial3d(materials.add(StandardMaterial::default())),
    Transform::from_xyz(0.0, 0.0, 0.0),
));
```

---

## NOTES FOR AI AGENTS

1. **Use glam** for Bevy math, nalgebra for complex linear algebra
2. **Use rayon** `.par_iter()` for any loop over 1000+ items
3. **Use parking_lot** instead of std::sync::Mutex (2-5x faster)
4. **Use kiddo** KD-Tree for spatial queries (faster than linear search)
5. **Use lz4_flex** for real-time compression (undo), zstd for storage
6. **Use imageproc** for image operations, fast_image_resize for scaling
7. **Check Bevy 0.17 patterns** - bundles are GONE, use tuple components
8. **MessageReader/MessageWriter** replaced EventReader/EventWriter in 0.17
