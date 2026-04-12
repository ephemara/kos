# K_OS /src-tauri RUST BACKEND MAP

> **FOR AI AGENTS** | This is the **TAURI IPC PROXY** of a desktop 3D creative suite
>
> ⚠️ **STOP REINVENTING THE WHEEL** - We have **~60 crates** already installed!
> Check `../docs/CARGO_ARSENAL.md` BEFORE writing custom implementations!
> 
> **⚠️ MAJOR REFACTOR**: This crate is now a thin IPC proxy. Heavy compute lives in owner crates under `crates/`

```
STACK: Rust + Tauri v2 (IPC Proxy Only)
TOTAL_CRATES: ~60 (across workspace)
COMMANDS: 50+ Tauri IPC commands
WORKSPACE: owner crates + src-tauri + crates/k-os-bevy
```

---

## THE BIG PICTURE (POST-REFACTOR)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        K_OS DESKTOP APPLICATION                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                 src-frontend/ (React Frontend)                   │   │
│   │    UI Layer - calls YOU via invoke()                            │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                          invoke() via Tauri IPC                         │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              ★ YOU ARE HERE: src-tauri/ ★                       │   │
│   │                                                                 │   │
│   │   main.rs ─────────────────────────────────────────────────     │   │
│   │   │ Tauri entry point                                           │   │
│   │   │ Registers 50+ commands                                      │   │
│   │   │ Spawns Bevy process                                         │   │
│   │   │                                                             │   │
│   │   ├── leash.rs ─────────────────────────────────────────────    │   │
│   │   │   UDP IPC to Bevy (window sync, brush state)                │   │
│   │   │                                                             │   │
│   │   └── python_bridge.rs ─────────────────────────────────────    │   │
│   │       JSON-RPC to Python sidecar                                │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                          WORKSPACE CALLS                                 │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │           crates/* owner crates (Heavy Compute)                 │   │
│   │   ├── modules/ ─────────────────────────────────────────────    │   │
│   │   │   ├── sculpting/  Mesh deformation, raycast, brushes        │   │
│   │   │   ├── mesh/       Subdivide, remesh, optimize               │   │
│   │   │   ├── simulation/ Physics (Rapier), Fluid (Salva3D)         │   │
│   │   │   ├── textures/   PBR gen, noise, procedural                │   │
│   │   │   ├── rig/        Skeleton, IK, skinning                    │   │
│   │   │   ├── atlas/      UV unwrapping (XAtlas)                    │   │
│   │   │   └── core/       Mesh state, linear algebra                │   │
│   │   │                                                             │   │
│   │   ├── gpu/ ────────────────────────────────────────────────    │   │
│   │   │   WGPU compute pipelines (sculpt, PBR, raycast)            │   │
│   │   │                                                             │   │
│   │   └── brushes/ ─────────────────────────────────────────────    │   │
│   │       Modular brush system (.kbrush assets)                    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                          JSON-RPC via stdin/stdout                      │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    src-python/ (Python Sidecar)                 │   │
│   │    AI/ML inference, image processing                            │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              crates/k-os-bevy/ (Bevy Renderer)                  │   │
│   │    Bevy 0.17 + egui 3D viewport                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ CRITICAL: USE EXISTING CRATES

**BEFORE implementing ANYTHING custom, check if we already have a crate:**

| Need | USE THIS | DON'T reinvent |
|------|----------|----------------|
| Raycasting | `parry3d` | Custom ray-triangle |
| KD-Tree/Spatial | `kiddo` | Custom tree structures |
| Physics | `rapier3d` | Custom collision |
| Fluid sim | `salva3d` | Custom SPH |
| Noise/Procedural | `noise` crate | Custom Perlin |
| UV unwrapping | `xatlas-rs` | Custom LSCM |
| Mesh optimization | `meshopt` | Custom simplification |
| Parallel loops | `rayon` | Manual threading |
| Fast mutex | `parking_lot` | std::sync::Mutex |
| Marching cubes | `isosurface` | Custom isosurface |
| Color spaces | `palette` | Custom RGB→LAB |
| Compression | `lz4_flex` | Custom compression |
| Voronoi | `voronoice` | Custom Voronoi |
| R-Tree | `rstar` | Custom spatial index |
| BVH | `bvh` crate | Custom BVH |

```yaml
> **FULL CRATE LIST:** See `../docs/CARGO_ARSENAL.md` in project root!
> **HEAVY COMPUTE:** Now in owner crates under `crates/`
> **GPU PIPELINES:** Now in `crates/k-os-gpu-pipeline/src/`
> **BEVY RENDERER:** Now in `crates/k-os-bevy/src/`
```

---

## FOLDER STRUCTURE (POST-REFACTOR)

```
src-tauri/                      # ★ THIN IPC PROXY ONLY ★
├── Cargo.toml                  # Dependencies (minimal)
├── build.rs                    # "The Sentry" - compile-time checks
├── tauri.conf.json             # Tauri config
│
└── src/
    ├── main.rs                # 15KB - Tauri entry, 50+ command registrations
    ├── leash.rs               # 16KB - UDP IPC to Bevy (LeashMaster)
    ├── python_bridge.rs       # 11KB - JSON-RPC to Python sidecar
    │
    └── bevy/                  # [MOVED] Legacy files - use crates/k-os-bevy/ instead
        # NOTE: This folder only contains legacy stubs
        # Actual Bevy code is now in crates/k-os-bevy/
```

## WORKSPACE STRUCTURE

```
├── crates/*                   # ★ OWNER CRATES ★
│   ├── k-os-sculpt/          # Sculpt runtime
│   ├── k-os-gpu-pipeline/    # Shared GPU runtime/pipelines
│   ├── k-os-mesh/            # Mesh ops + atlas
│   └── ...                   # Other domain owners
│
├── src-tauri/                 # ★ IPC PROXY ★
│   └── src/main.rs            # Command registration only
│
└── crates/k-os-bevy/          # ★ BEVY RENDERER ★
    └── src/                   # Bevy plugins + egui UI
```

---

## MODULES BREAKDOWN

### modules/core/ (Foundational)

```
linalg.rs        # 14KB - CG solver, sparse matrices (uses nalgebra-sparse)
mesh_state.rs    # 9KB  - Global mesh registry (RwLock<MeshData>)
bridge.rs        # IPC utilities

PURPOSE: Shared state and math utilities
CRATES USED: nalgebra, nalgebra-sparse, parking_lot
```

### modules/sculpting/ (Mesh Deformation)

```
sculpt.rs        # 37KB - Mesh deformation brushes (20+ brush types)
raycast.rs       # 24KB - BVH raycasting (sub-ms response)
brush_dynamics.rs # 8KB - Stroke interpolation, symmetry
mask.rs          # 15KB - Vertex masking (paint/clear/invert/grow/shrink)

PURPOSE: ZBrush-style sculpting engine
CRATES USED: parry3d, bvh, rayon, kiddo
```

### modules/mesh/ (Mesh Operations)

```
subdivide.rs     # 14KB - Catmull-Clark subdivision
remesh.rs        # 12KB - Marching cubes + adaptive remeshing
optimize.rs      # 11KB - meshopt LOD generation
primitive_gen.rs # 15KB - Quad sphere/cube/cylinder generators

PURPOSE: Mesh processing pipeline
CRATES USED: meshopt, isosurface, rayon
```

### modules/simulation/ (Physics)

```
physics.rs       # 9KB  - Rapier3D rigid body simulation
fluid.rs         # 16KB - Salva3D SPH fluid (UV-space painting)
quantum.rs       # 36KB - GPGPU particle system state

PURPOSE: Physics and fluid dynamics
CRATES USED: rapier3d, salva3d, nalgebra
```

### modules/textures/ (Procedural)

```
procedural.rs    # 16KB - Voronoi, noise patterns, cellular
pbr_generator.rs # 14KB - Normal/AO/Roughness map generation
noise_brush.rs   # 6KB  - Perlin/simplex noise brushes

PURPOSE: Texture generation
CRATES USED: noise, voronoice, image, imageproc
```

### modules/rig/ (Animation)

```
skeleton.rs      # 6KB - Bone hierarchy, transforms
ik.rs            # 7KB - Inverse kinematics chains
skinning.rs      # 11KB - Geodesic skinning weights
solver.rs        # 7KB - IK solver
commands.rs      # Tauri command wrappers

PURPOSE: Character rigging
CRATES USED: nalgebra, rayon
```

### modules/atlas/ (UV)

```
wrapper.rs       # 14KB - XAtlas FFI wrapper
lscm.rs          # 3KB - LSCM unwrapping utils

PURPOSE: UV unwrapping
CRATES USED: xatlas-rs
```

### scatter.rs (Distribution)

```
scatter.rs       # 17KB - KD-tree Poisson, physics drop, Voronoi scatter

PURPOSE: Object placement algorithms
CRATES USED: kiddo, voronoice, rapier3d, fastrand
```

---

## BEVY ENGINE (Advanced Mode)

```
bevy/
├── main.rs              # 39KB - Bevy entry, LeashDog, systems
├── sculpt.rs            # 37KB - Real-time sculpt preview
├── layers.rs            # 12KB - Blender-style layer system
├── layers_ui.rs         # 6KB  - Layer panel UI (egui)
├── materials.rs         # 12KB - PBR material library
├── selection.rs         # 12KB - Picking & selection
├── import.rs            # 11KB - Asset import (GLTF, primitives)
├── asset_browser.rs     # 24KB - egui asset browser
├── camera_experimental.rs # 22KB - Camera experiments
├── egui_components.rs   # 10KB - Reusable egui widgets
├── gizmo.rs             # 3KB  - Transform gizmos
└── mod.rs               # Module registry

SPAWNED VIA: leash.rs → UDP:19876
TOGGLE: Header [SIMPLE] / [ADVANCED] button in React UI
```

### Bevy 0.17 Critical Changes

```rust
// ❌ OLD (0.14) - DON'T USE THESE
commands.spawn(PbrBundle { mesh, material, ..default() });
events: EventReader<MyEvent>
app.add_event::<MyEvent>()

// ✅ NEW (0.17) - USE THESE
commands.spawn((Mesh3d(mesh), MeshMaterial3d(mat), Transform::default()));
events: MessageReader<MyEvent>
app.add_message::<MyEvent>()
```

---

## IPC BRIDGES

### Tauri IPC (Frontend → Rust)

```rust
// In main.rs - register command
#[tauri::command]
fn sculpt_apply_brush(brush_type: String, position: [f32; 3]) -> Result<(), String> {
    // Implementation
}

// Register in invoke_handler
.invoke_handler(tauri::generate_handler![sculpt_apply_brush, ...])
```

### The Leash (Rust → Bevy)

```
PROTOCOL: UDP:19876
SENDER: leash.rs (LeashMaster)
RECEIVER: bevy/main.rs (LeashDog)

SYNCS:
  - Window position/size
  - Mouse cursor
  - Camera state
  - Brush parameters
  - Undo commands
  - Model data
  - Visibility toggle
```

### Python Bridge (Rust → Python)

```rust
// In python_bridge.rs
pub fn run_script(script: &str, params: Value) -> Result<Value, Error> {
    // JSON-RPC over stdin/stdout to src-python/main.py
}
```

---

## ADDING A NEW TAURI COMMAND

```rust
// 1. Add function in the appropriate owner crate under crates/
pub fn my_operation(data: &[f32]) -> Vec<f32> {
    // Use existing crates!
    use rayon::prelude::*;
    data.par_iter().map(|x| x * 2.0).collect()
}

// 2. Add command wrapper in src-tauri/src/main.rs
#[tauri::command]
fn my_command(input: Vec<f32>) -> Result<Vec<f32>, String> {
    Ok(k_os_engine::your_module::my_operation(&input))
}

// 3. Register in invoke_handler
.invoke_handler(tauri::generate_handler![
    my_command,
    // ... existing commands
])

// 4. Create TypeScript client in src-frontend/services/myClient.ts
export async function myOperation(input: number[]): Promise<number[]> {
    return await invoke('my_command', { input });
}
```

---

## COMMON PATTERNS

### Parallel Processing (ALWAYS use for 1000+ items)

```rust
use rayon::prelude::*;

// ✅ Parallel
vertices.par_iter_mut().for_each(|v| {
    v.position += offset;
});

// ❌ Sequential (slow for large meshes)
for v in vertices.iter_mut() {
    v.position += offset;
}
```

### Spatial Queries (USE KIDDO)

```rust
use kiddo::KdTree;

// Build tree once
let mut tree: KdTree<f32, 3> = KdTree::new();
for (i, v) in vertices.iter().enumerate() {
    tree.add(&[v.x, v.y, v.z], i as u64);
}

// Query (O(log n) instead of O(n))
let nearest = tree.nearest_one(&[x, y, z]);
```

### Thread-Safe State (USE PARKING_LOT)

```rust
use parking_lot::RwLock;

// ✅ Fast (2-5x faster than std)
lazy_static! {
    static ref MESH_STATE: RwLock<MeshData> = RwLock::new(MeshData::default());
}

// ❌ Slow
static MESH_STATE: std::sync::RwLock<MeshData> = ...;
```

### Raycasting (USE PARRY3D)

```rust
use parry3d::query::Ray;

let ray = Ray::new(origin.into(), direction.into());
if let Some(hit) = trimesh.cast_ray(&ray, max_dist, true) {
    let hit_point = ray.point_at(hit);
}
```

---

## BUILD SYSTEM

### "The Sentry" (build.rs)

```
Compile-time checks that FAIL THE BUILD if:
  - Using deprecated Bevy 0.14 patterns (PbrBundle, EventReader, etc.)
  - Files created but DIRECTORY.md not updated
  - Python deps not documented in PYTHON_ARSENAL.md
```

### Dev Build (Fast Compile)

```bash
cd src-tauri && bacon  # Live TUI, auto-rebuild
# OR
cargo build           # Single build
```

### Release Build (Max Performance)

```bash
cargo build --release
# Profile settings in Cargo.toml enable LTO, single codegen unit
```

---

## SIZE REFERENCE

```
FILE                      SIZE    PURPOSE
─────────────────────────────────────────────────────────
bevy/main.rs              39KB    Bevy entry + all systems
sculpt.rs (bevy)          37KB    Bevy sculpt preview
sculpt.rs (modules)       37KB    Mesh deformation brushes
quantum.rs                36KB    GPGPU particle state
raycast.rs                24KB    BVH raycasting
asset_browser.rs          24KB    egui file browser
camera_experimental.rs    22KB    Camera systems
scatter.rs                17KB    KD-tree Poisson
procedural.rs             16KB    Noise patterns
leash.rs                  16KB    UDP IPC to Bevy
main.rs                   16KB    Tauri entry, commands
```

---

## DO's AND DON'Ts

### DO ✓

- **Check CARGO_ARSENAL.md** before implementing anything
- **Use rayon** for any loop over 1000+ items
- **Use parking_lot** instead of std::sync
- **Use kiddo** for spatial queries
- **Use parry3d** for raycasting
- **Follow Bevy 0.17 patterns** (Mesh3d, MessageReader)
- **Run bacon** for live feedback

### DON'T ✗

- **DON'T** write custom BVH/KD-tree/Voronoi (crates exist!)
- **DON'T** use old Bevy patterns (PbrBundle, EventReader)
- **DON'T** use std::sync::Mutex (parking_lot is 2-5x faster)
- **DON'T** write sequential loops for vertex processing
- **DON'T** implement custom noise (noise crate has everything)

---

## RELATED DOCS

```
../docs/CARGO_ARSENAL.md    # ★ FULL CRATE LIST WITH IMPORTS ★
../DIRECTORY.md              # Complete project map (NEW STRUCTURE)
../RECENT_CHANGES.md         # Recent modifications
../docs/BEVYDOCS.md          # Bevy 0.17 syntax reference
../crates/k-os-bevy/         # Bevy renderer code
../crates/                   # Owner crates
```
