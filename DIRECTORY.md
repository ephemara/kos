# K_OS CODEBASE MAP

> **FOR AI AGENTS** | Structured format | All paths relative to repo root

```
VERSION: 0.7-alpha
LANGUAGES: TypeScript React Rust Python WGSL
APPS: 16
RUST_MODULES: 20+
GPU_MODULES: 6 (raycast, spatial, pipelines, svt, buffer_pool, zero_copy)
ARCHITECTURE: Tauri Desktop App (React Frontend + Rust Backend) + GPU Compute
NPM_PACKAGES: 234
RUST_CRATES: ~65
PYTHON_PACKAGES: ~50
LAST_AUDIT: 2025-12-15
```

> **2026 Architecture Direction**
>
> K_OS is migrating toward a layered engine model:
> - `k-os-scene` = canonical scene state backed by ECS
> - `k-os-eval` = DAG evaluation and dirty propagation
> - `k-os-gpu-pipeline` = GPU bridge and buffer ownership
> - operator crates = sculpt/mocap/baking/material/etc execution layers

> **FOR AI AGENTS:** Check arsenal docs before adding libraries!
>
> - **NPM_ARSENAL.md** - All 89 npm packages with imports
> - **CARGO_ARSENAL.md** - All Rust crates with Bevy 0.17 patterns
> - **PYTHON_ARSENAL.md** - All Python packages with examples

---

## DEV TOOLS (Installed CLI)

> **AI AGENTS:** Use these tools for better debugging and faster workflows!

```
RUST:
  bacon                    # Live-updating build TUI (run instead of cargo build)
  cargo watch -x build     # Auto-rebuild on file save
  cargo nextest run        # 60% faster tests with cleaner output
  rg "pattern"             # ripgrep - ultra-fast codebase search

PYTHON:
  ruff check .             # Lightning linter - catches errors before runtime
  python -c "from icecream import ic; ic(var)"  # Debug printing

TERMINAL:
  bat file.rs              # Syntax-highlighted file viewing
  delta                    # Beautiful git diffs (auto-used by git)

GIT (Version Control):
  git status               # See what files changed
  git diff                 # See exact line changes
  git add . && git commit -m "msg"  # Save checkpoint
  git checkout .           # UNDO all changes since last commit
  git log --oneline -5     # Show last 5 commits
```

---

## HISTORY (Why Architecture Is Fire)

```
ORIGIN: Pure JavaScript/React web app
EVOLUTION:
  1. Each K-app built as STANDALONE tool (KPainter, KSculpt, etc)
  2. Apps merged into single suite (K_OS) with shared kernel
  3. Added Tauri for desktop native + Rust performance
  4. Added Python sidecar for AI/ML
  5. Added GPU compute via wgpu for high-performance operations

CURRENT ARCHITECTURE (2025-12):
  - Tauri v2 desktop app with React + TypeScript frontend
  - Rust backend with GPU compute (wgpu) for performance-critical operations
  - Three.js for 3D rendering in React apps
  - Optional Python sidecar for AI/ML tasks
  - Optional Bevy viewport for experimental GPU rendering (not primary runtime)
  - Optional WASM build for web deployment

INSIGHT (GarageBand/Logic Pro Model):
  - SIMPLE MODE = GarageBand (polished, approachable, quick in/out)
  - ADVANCED MODE = Logic Pro (full power, pro workflow)
  - Both share the same engine (Rust modules)
  - Features trickle down from Advanced → Simple when ready
  

### NOTE

**Important Reminders**

* This is a **complete solo developer project**. With an infrastructure this huge, I (Kipp) can get stressed trying to figure out what to do next.
* You can refer to me as **Kipp** or **"Scavenger King"**.
* The entire frontend is React + Three.js with Rust backend via Tauri IPC. The architecture is stable and working well.
* If you have suggestions for improvements, please let me know. I'm an open book and very flexible.
* If you’re an AI agent helping me: I prefer **clear recommendations** over long lists of options (unless I ask), and I love creative/experimental ideas when they’re safe.
* **Solo-dev time saver request:** If you notice I’m about to spend weeks hand-coding repetitive systems, please recommend a more scalable “right way” (data-driven configs, registries, schemas, generators, parameterized assets, etc). Example: I once started coding lots of custom “sim brushes” (black holes, etc) and only later realized brushes should be a `.kbrush` asset (JSON params) so I can make 200+ brushes without writing 200+ code paths.
* **LAST IMPORTANT NOTE** ---- PLEASE BE CREATIVE AND EXPERIMENTAL WHEN YOU CAN ! WE AREN'T SOME BIG CORPORATION WHO HAS MEETINGS ABOUT NEW FEATURES ETC. THIS IS A SOLO DEV PIPELINE ! WE can do WHATEVER WE WANT (as long as it's cooler than our competitors) 



---

## KERNEL STORAGE SYSTEM

```
CONCEPT: Central asset registry shared across all apps
LOCATION: App.tsx (useKernelApp hook)

STORES:
  kernelArtifacts[]     # 3D meshes (GLB, OBJ imports + app outputs)
  kernelMaterials[]     # PBR material sets
  kernelAlphas[]        # Brush alpha textures

FLOW:
  App creates mesh → commits to kernel → other apps can load it
  
  KSculpt.commit(mesh) → kernelArtifacts.push(artifact)
                       ↓
  KPainter.load(artifactId) → gets mesh from kernel

BRIDGEPROPS: Passed to every app
  sharedState.artifact    # Active mesh
  sharedState.materials   # Material library
  sharedState.alphas      # Alpha library
  onCommit()              # Push to kernel
  onMaterialCommit()      # Push material
  onAlphaCommit()         # Push alpha

UI: KContentBrowser (Ctrl+Space) - Overhauled asset hub
```

---

## KOBJECT REGISTRY (Universal Identity)

```
CONCEPT: Cross-app object identity that survives export/import
LOCATION: src/core/objects/KObjectRegistry.ts

WHY: Objects lose identity when moving between apps
  - KSculpt mesh → uplink → KPainter = NEW object (identity lost!)
  - Need stable IDs that persist across apps and sessions

SOLUTION: kId System
  - Every object gets a stable K_OS ID: "k_mesh_abc123"
  - kId survives GLTF export/import via extras
  - Registry tracks: type, createdBy, parent, layer, material bindings

HOT POTATO MODE:
  1. KSculpt creates mesh → gets kId "k_mesh_abc"
  2. prepareForGLTFExport() embeds kId in GLTF extras
  3. Uplink to Kernel (GLB blob with embedded kId)
  4. KPainter loads → restoreFromGLTFImport() restores kId
  5. SAME mesh, SAME kId, across apps!

API:
  import { kObjectRegistry, useKObjectRegistry } from '@/core/objects';
  
  // Register object
  const kId = registry.register({ type: 'mesh', name: 'Hero', createdBy: 'KSculpt' });
  
  // Query objects
  const meshes = registry.query({ type: ['mesh'], createdBy: 'KPainter' });
  
  // Get by THREE.js uuid
  const obj = registry.getByThreeUuid(mesh.uuid);

FILES:
  KObjectRegistry.ts     # 830 lines - Registry class + query system
  meshRegistryBridge.ts  # 150 lines - THREE.js integration
  index.ts               # Barrel exports
```

---

## UNIVERSAL LAYER PANEL

```
CONCEPT: One layer UI component for ALL apps
LOCATION: src/core/ui/layers/UniversalLayerPanel.tsx

PROBLEM: Every app reimplemented layers differently
  - KSculpt had SubTools
  - KPainter had LayerPanel
  - KGreeble had Strata
  - KGraphos had LayerStack
  All slightly different, duplicate code everywhere

SOLUTION: Universal component with feature flags
  <UniversalLayerPanel
    layers={universalLayers}
    activeLayerId={activeLayerId}
    onSelect={(id) => ...}
    onToggleVisibility={(id) => ...}
    features={{
      add: true,
      visibility: true,
      delete: true,
      rename: false,
      opacity: true,
      duplicate: true,
    }}
    accentColor="orange"  // Per-app theming
    title="LAYERS"
  />

APPS USING IT:
  KSculpt  → "LAYERS" (orange)
  KPainter → "PAINT LAYERS" (blue)
  KGreeble → "STRATA" (emerald)
  KGraphos → "LAYER STACK" (rose)
```

---

## ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                        K_OS SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│  FRONTEND          │  BACKEND            │  ENGINE              │
│  src-frontend/     │  src-tauri/src/     │  owner crates/       │
│  React+TS          │  Rust+Tauri v2      │  Rust GPU Compute    │
│  Three.js          │  IPC Commands       │  wgpu pipelines      │
├─────────────────────────────────────────────────────────────────┤
│  OPTIONAL COMPONENTS                                            │
│  src-python/       │  Python sidecar for AI/ML (JSON-RPC)       │
│  crates/k-os-bevy/ │  Bevy viewport (experimental, not primary)  │
│  crates/k-os-wasm/ │  WASM build for web deployment             │
└─────────────────────────────────────────────────────────────────┘
```

### IPC BRIDGES

```
BRIDGE: Tauri IPC
  FROM: React (invoke())
  TO: Rust (main.rs)
  PROTOCOL: Tauri v2 commands

BRIDGE: The Leash (Optional)
  FROM: Rust (LeashMaster)
  TO: Bevy (LeashDog)
  PROTOCOL: UDP:19876
  SYNCS: window_pos cursor camera brush undo model visibility
  NOTE: Only used when Bevy viewport is active

BRIDGE: Python Bridge
  FROM: Rust (python_bridge.rs)
  TO: Python (main.py)
  PROTOCOL: JSON-RPC over stdin/stdout
```

---

## FILE MAP

### src-frontend/ (Frontend)

```
ENTRY: index.tsx → App.tsx (React application root)

CONFIG:
  config/appConfig.ts    # WORKFLOW array, ALL_MODULES, app routing

APPS: src/apps/
  sculpting/sculpt/
    KSculpt.tsx          # 117KB main (Three.js + Rust backend)
    constants.ts         # 8KB - All 31 brushes, matcaps, constants
    engine/              # Core sculpt engine
      meshManager.ts     # Clean Rust IPC bridge
      cursor.ts          # GPU brush cursor
    model/               # IMM/MODEL mode system
      ModelTypes.ts      # TypeScript interfaces
      ModelShapes.ts     # 26 shape definitions + createGeometry
      ModelSpawner.ts    # 19KB IMM spawn logic + merge
      useIMMInteraction.ts # 12KB ZBrush-style drag spawn
      useModelInteraction.ts # Raycast + mouse
      ModelPanel.tsx     # UI panel
      ModelShapePicker.tsx # Radix tabbed picker
      ModelModifiers.tsx # Symmetry/GridLock/Chaos
    ui/                  # AppShell panels
      TopBar.tsx         # Brush controls, GPU toggle
      LeftPanel.tsx      # Brushes/GEO/Edit tabs
      RightPanel.tsx     # Subtools/Materials
  
  surface/paint/
    KPainter.tsx         # 84KB Substance-like painter
    engine/paintEngine.tsx # WebGL painter backend (legacy)
    hooks/usePaintInput.tsx # Stroke input + Rust raycast integration
  
  surface/atlas/
    KAtlas.tsx                # UV unwrapping (XAtlas backend)
    KAtlasUVEditor.tsx        # 2D UV editor with island transform tools
    KAtlasUVIslands.ts        # UV island detection and manipulation
    KAtlasUVTransform.ts      # Transform engine (move, rotate, scale)
    KAtlasUVBrush.ts          # Brush-based UV manipulation (GRAB, RELAX)
    KAtlasUVEngine.tsx        # UV projection and GPU compute
    KAtlasUVHologram.tsx      # 3D hologram UV view
    KAtlasLSCM.ts             # LSCM unwrap via XAtlas/Rust
    KAtlasBox.ts              # Box projection
    KAtlasHybrid.ts           # Hybrid auto-unwrap
    KAtlasUVmatlink.tsx       # Material linking
    KBinPacker.ts             # UV island packing
    ui/                       # AppShell panels (LeftPanel, RightPanel)
  
  surface/bake/
    KBake.tsx                 # GPU texture baking (normal, AO, curvature, etc)
    engine/
      bakeEngine.ts           # Core baking engine with Three.js integration
      rayTracer.ts            # GPU ray tracing for baking
      cageGenerator.ts        # Automatic cage mesh generation
      cageEditor.ts           # Manual cage editing tools
      __tests__/              # Unit and performance tests
    ui/                       # AppShell panels
      TopBar.tsx              # Mesh visibility and controls
      LeftPanel.tsx           # Map type selector and bake settings
      RightPanel.tsx          # Preview and export
      CageEditPanel.tsx       # Cage editing interface
      ExportDialog.tsx        # Export configuration
      ProgressOverlay.tsx     # Baking progress display
  
  surface/graphos/
    KGraphos.tsx         # 2D Texture Painter + PBR
    ui/                  # AppShell panels
  
  surface/autopbr/
    KAutopbr.tsx         # K-Sample (AI PBR gen)
    ui/                  # AppShell panels
  
  modeling/greeble/
    KGreeble.tsx         # IMM + UE5-style modeling
    ui/                  # AppShell panels (Build/Sculpt/Edit/AI/Animate)
  
  modeling/retopo/
    KRetopo.tsx          # Retopology tool for clean quad topology
    engine/
      retopoEngine.ts    # Core retopo logic
      drawingTools.ts    # Quad drawing, strip drawing, hole filling
      topologyTools.ts   # Edge loop, dissolve, collapse, subdivide
      snapping.ts        # Surface snapping with raycasting
    ui/                  # AppShell panels
      TopBar.tsx         # Mode selector and tools
      LeftPanel.tsx      # Tool settings
      RightPanel.tsx     # Topology stats
  
  modeling/scatter/
    KScatter.tsx         # Distribution (Rust Poisson/Voronoi)
  
  modeling/cloner/
    KCloner.tsx          # C4D-style mograph + Sequencer
  
  anim/rig/
    KRig.tsx             # Skeleton/IK
  
  anim/weight/
    KWeight.tsx          # Weight painting tool for vertex groups and skeletal animation
    engine/
      weightEngine.ts    # Core weight painting engine with undo/redo
      brushSystem.ts     # Brush-based weight painting with falloff
      visualization.ts   # Weight visualization (gradient, solid, heatmap)
      transfer.ts        # Weight transfer between meshes
      __tests__/         # Unit and property-based tests
    ui/                  # AppShell panels
      TopBar.tsx         # Undo/redo and import/export
      LeftPanel.tsx      # Brush settings and visualization
      RightPanel.tsx     # Vertex group management
  
  sim/tecton/
    KTecton.tsx          # Terrain gen + Sequencer
    ui/                  # GeneratorPanel, EnvironmentPanel, SculptPanel

  sim/quantum/
    KQuantum.tsx         # AppShell Container
    KQuantumEngine.tsx   # 33KB GPGPU Simulator (Merged Chronos)
    KQuantumPresets.ts   # 42KB Physics/Shaders/Palettes
    hooks/               # Custom hooks
    ui/                  # TopBar, LeftPanel, RightPanel
  
  render/inspect/
    KInspect.tsx         # Preview (Marmoset clone)
    ui/                  # InspectorPanel, MaterialsPanel, ExportPanel
  
  bevy/                  # [NEW] Bevy Tether System
    BevyTether.tsx       # 7KB window sync + useBevyTether hook
    index.ts             # Barrel exports

CORE: src/core/
  objects/               # [NEW] Universal Object Identity System
    KObjectRegistry.ts   # 830 lines - Global object registry + kId system
    meshRegistryBridge.ts # 150 lines - THREE.js <-> Registry bridge
    index.ts             # Barrel exports
  ui/layers/             # [NEW] Universal Layer UI
    UniversalLayerPanel.tsx # 740 lines - Reusable layer panel component
    index.ts             # Barrel exports
  ui/shell/              # AppShell system (Radix + Tailwind)
    AppShell.tsx         # 18KB main shell layout + persistence
    DockPanel.tsx        # 12KB collapsible dock panels
    AppMenuBar.tsx       # 4KB File/Edit/View menus
    FloatingQuickMenu.tsx # 16KB hold-Q brush picker
    GlobalCommandPalette.tsx # 7KB Ctrl+K command palette
    QuickMenu.tsx        # 6KB basic quick menu
    Sequencer.tsx        # 14KB universal timeline component
    SplitView.tsx        # 3KB resizable split panels
    controls/            # Shared premium widgets
      TransformPanel.tsx # Transform controls (mode/space/snap)
  ui/KContentBrowser/    # [OVERHAULED] K_OS Asset Hub (Ctrl+Space)
    KContentBrowser.tsx  # 580 lines - Glassmorphic UI, LIVE tab + kId search
  ui/primitives/         # Button, Slider, etc (Radix-based)
  ui/widgets/            # AlphaMenu, generic widgets
  shaders/               # GLSL includes
  animation/             # useAnimation hook
  materials/             # PBR utils
  physics/               # Rapier wrappers
  three/                 # Three.js utils
  hooks/                 # React hooks
  perf/                  # Performance utilities

SERVICES: src/services/
  tauriClient.ts         # invoke() wrapper
  sculptClient.ts        # sculpt commands
  raycastClient.ts       # BVH raycast
  rustFluid.ts           # Salva3D fluid
  pythonBridge.ts        # Python calls
  brushDynamics.ts       # stroke interp
  pbrClient.ts           # PBR gen
  proceduralClient.ts    # noise/textures
  noiseClient.ts         # noise brush
  optimizeClient.ts      # meshopt
  remeshClient.ts        # marching cubes
  subdivideClient.ts     # catmull-clark
  retopoClient.ts        # auto-retopo commands
  bakeClient.ts          # texture baking commands
  bakeExportClient.ts    # bake export (PNG, EXR, TGA)
  projectServices.ts     # save/load
  kernelServices.ts      # asset mgmt
```

### src-tauri/ (Rust Backend)

```
ENTRY: src/main.rs
  REGISTERS: 50+ Tauri commands
  MANAGES: PythonBridge (optional), LeashMaster (optional, for Bevy viewport)

CORE FILES:
  src/main.rs            # Tauri entry + all command registration
  src/leash.rs           # UDP IPC to Bevy (optional, only when Bevy viewport active)
  src/python_bridge.rs   # JSON-RPC to Python sidecar
  src/baking.rs          # Texture baking commands (normal, AO, curvature, etc)
  src/kos_bridge.rs      # K_OS bridge utilities
  src/kos_commands.rs    # K_OS command handlers
  src/kain_commands.rs   # KAIN source registry/build/runtime command bridge
  src/mocap_bridge.rs    # Mocap bridge and command forwarding
  src/viewport_host.rs   # Viewport host-side payload coordination

BEVY VIEWPORT (OPTIONAL): crates/k-os-bevy/
  NOTE: Experimental GPU rendering viewport, NOT the primary runtime
  main.rs                # Bevy entry (egui shell + plugins)
  mod.rs                 # Module registry
  asset_browser.rs       # egui asset browser
  camera_experimental.rs # Camera experiments
  viewport/
    plugin.rs             # Viewport plugin wiring
    import.rs             # Asset import (GLTF/Primitives)
    selection.rs          # Picking & selection
    materials.rs          # PBR material library
    layers.rs             # Blender-like layer system
    gizmo.rs              # Gizmo (Move/Rotate/Scale)
  tools/
    sculpt.rs             # Bevy sculpt tool + GPU systems
    sculpt_panel.rs       # Sculpt egui panels
  ui/
    components.rs         # egui components/widgets
    layers_panel.rs       # egui layers panel

MODULES: src/modules/            # Tauri-specific command handlers
  mod.rs                 # Main registry + backwards-compat re-exports
  
  core/                  # Foundational systems
    linalg.rs            # CG solver, sparse math
    mesh_state.rs        # Shared mesh registry (RwLock)
    bridge.rs            # IPC bridge utils

COMMAND ADAPTERS: src/commands/
  brush_gpu.rs          # Brush GPU command adapters
  gpu_benchmark.rs      # GPU benchmark command adapters
  gpu_raycast.rs        # GPU raycast command adapters
  io_paths.rs           # IO/path command adapters
  mesh_ops.rs           # Primitive and mesh operation adapters
  photogrammetry.rs     # Photogrammetry command adapters
  rigging.rs            # Rigging and IK command adapters
  scene_mesh.rs         # Scene mesh command adapters
  scene_state.rs        # Scene state command adapters
  texture_ops.rs        # Texture/material command adapters
  
  NOTE: Most compute-heavy operations delegated to owner crates under crates/
        See the domain crate sections below for GPU pipelines and modules

```

### archive/k-os-engine/ (Archived Compatibility Crate)

```
NOTE: Standalone Rust crate for GPU-accelerated compute operations
      Used by both Tauri backend and optional WASM build

GPU COMPUTE: src/gpu/           # WGPU Accelerated
  mod.rs                 # Module root + exports
  device.rs              # WGPU device/queue singleton (lazy init)
  staging.rs             # Staging buffer pool for GPU→CPU readback
  buffer_pool.rs         # Generic buffer pooling
  zero_copy.rs           # Zero-copy buffer management
  benchmark.rs           # GPU performance testing
  
  pipelines/             # Compute shaders
    mod.rs               # Pipeline exports
    sculpt.rs            # GPU sculpt - ALL 31 brushes in WGSL
    sculpt_crystal.wgsl  # Crystal sculpting shader
    subdivide_v2.rs      # GPU subdivision
    dynamesh.rs          # Dynamic remeshing
    marching_cubes_tables.rs # Marching cubes lookup tables
    pbr.rs               # GPU PBR generation
                         # Normal/Roughness/Metallic/AO/Height/Curvature/Emissive
  
  raycast/               # GPU BVH Raycasting
    mod.rs               # Module exports
    bvh.rs               # LBVH construction + Möller-Trumbore intersection
  
  spatial/               # GPU Spatial Indexing
    mod.rs               # Module exports
    grid.rs              # GPU spatial grid for candidate selection
    grid_build.wgsl      # Grid construction compute shader
    query.wgsl           # Spatial query compute shader
  
  svt/                   # Sparse Virtual Texturing (16K painting)
    mod.rs               # SVT module root
    engine.rs            # Page table + physical cache + compute
    manager.rs           # CPU-side LRU tile management

MODULES: src/modules/
  sculpting/             # Vertex manipulation
    sculpt.rs            # Mesh deformation, 31 brushes, staleness tracking
    mask.rs              # Vertex masking operations
    raycast.rs           # BVH + UV raycast
    brush_dynamics.rs    # Stroke interpolation & symmetry
    brushes/             # Modular brush implementations
  
  mesh/                  # Mesh operations
    subdivide.rs         # Catmull-Clark subdivision
    remesh.rs            # Marching cubes isosurface
    optimize.rs          # meshopt LOD generation
    primitive_gen.rs     # Quad sphere/cube/cylinder generators
  
  simulation/            # Physics & Fluid & Particles
    physics.rs           # Rapier3D rigid body
    fluid.rs             # Salva3D SPH (UV-space)
    quantum.rs           # GPU particle simulation backend
  
  textures/              # Texture generation
    procedural.rs        # Voronoi, noise patterns
    pbr_generator.rs     # Normal/AO map generation + seamless tiling
    noise_brush.rs       # Perlin/simplex brushes
```

### crates/k-os-wasm/ (WASM Build - Optional)

```
NOTE: Web deployment build using k-os-engine
      Allows running K_OS in browser with WebGPU support
```

### src-python/ (Python Sidecar)

```
ENTRY: main.py (JSON-RPC server)

NOTE: Python is GENERAL PURPOSE - not just AI/ML!
  Use for: mesh processing, image manipulation, procedural gen,
  automation, data processing, ML inference, ANYTHING Python excels at.
  
MODULES: kos/
  mesh.py                # trimesh ops
  textures.py            # image processing
  ml.py                  # SAM SD ESRGAN
  procedural.py          # noise terrain
  autopbr/               # AutoPBR and interchange helpers
    ai_processor.py      # AI-assisted material processing
    inpainting.py        # Texture inpainting helpers
    photogrammetry_helper.py # Photogrammetry-side material helpers
    usd_exporter.py      # USD export bridge
    usd_rpc.py           # USD RPC helpers

SCRIPTS: kos/scripts/   # Auto-loaded, callable from frontend
  autopbr_bake.py        # AI PBR maps
  scatter_analysis.py    # ML scatter
  procedural_spawner.py  # proc objects
  example.py             # template
  dynamesh_remesh.py     # Dynamesh/remesh script bridge
  hello.py               # Minimal smoke-test script
  thumbnail.py           # Thumbnail generation helper

UI TOOLING: src-python/UI/
  generator_manager.py   # Generator registry/dispatch
  library_manager.py     # Asset library indexing and lookup
  models.py              # Shared generator models
  preview_manager.py     # Preview rendering and cache orchestration
  run_tests.py           # Python UI test runner
  tauri_bridge.py        # Python/Tauri bridge helpers
  template_manager.py    # Template loading and expansion
  themes.py              # UI theme definitions
  validators.py          # Input and asset validators
  verify_brush_generator.py # Brush generator verification utility
  animation/
    motion_library.py    # Motion/sprite animation library helpers
    sprite_sheet.py      # Sprite sheet generation helpers
    svg_animator.py      # SVG animation generation helpers
  external/
    imagemagick.py       # ImageMagick bridge utilities
    gimp.py              # GIMP bridge utilities
    inkscape.py          # Inkscape bridge utilities
  generators/
    alpha_generator.py   # Alpha asset generator
    brush_generator.py   # Brush asset generator
    cursor_generator.py  # Cursor asset generator
    icon_generator.py    # Icon asset generator
    overlay_generator.py # Overlay asset generator
    pattern_generator.py # Pattern asset generator
  test_alpha_generator.py   # Alpha generator tests
  test_base_generator.py    # Base generator tests
  test_brush_generator.py   # Brush generator tests
  test_animation.py         # Animation tooling tests
  test_example_templates.py # Template example tests
  test_format_conversion.py # Format conversion tests
  test_generator_manager.py # Generator manager tests
  test_icon_gallery.py      # Icon gallery tests
  test_icon_generator.py    # Icon generator tests
  test_models.py            # Generator model tests
  test_template_manager.py  # Template manager tests
  tests/
    test_caching.py         # Cache behavior tests
    test_duplicate_detection.py # Duplicate detection tests
  verify_models.py          # Generator model verification
  
ADD NEW SCRIPTS: Just drop .py files in kos/scripts/ - auto-discovered!
```

---

## BEVY 0.17 COMPAT (Optional - for Bevy viewport only)

> ⚠️ NOTE: Only relevant if working with crates/k-os-bevy/ experimental viewport
> ⚠️ AI TRAINING DATA = 0.14-0.15 | THIS PROJECT = 0.17

```
RENAMED:
  Event           → Message          (for buffered)
  EventWriter<T>  → MessageWriter<T>
  EventReader<T>  → MessageReader<T>
  .add_event()    → .add_message()
  on_event::      → on_message::
  Handle::Weak    → Handle::Uuid
  weak_handle!    → uuid_handle!
  JustifyText     → Justify
  finished()      → is_finished()    (Timer)

BEHAVIOR:
  Query::single() → Returns Result (no panic)
  Transform in UI → Use UiTransform (no Z)
  Bundles         → Use Required Components

MODULE MOVES:
  bevy::render::view::Visibility → bevy::camera::visibility::Visibility
  bevy::render::primitives::*    → bevy::camera::primitives::*
  Shader                         → bevy_shader::Shader
  PointLight                     → bevy_light::PointLight
  Mesh                           → bevy_mesh::Mesh

INTERNAL ENTITIES:
  Observers/one-shots hidden by default
  Query with Allow<Internal> to access

SPAWN PATTERN:
  OLD: commands.spawn(PbrBundle { mesh, material, ..default() })
  NEW: commands.spawn((Mesh3d(mesh), MeshMaterial3d(mat)))
```

---


## NAVIGATION PATTERNS

```
FIND APP:          src-frontend/apps/{category}/{app}
FIND APP UI:       src-frontend/apps/{category}/{app}/ui/
FIND RUST MODULE:  crates/{owner-crate}/src/{module}.rs
FIND TAURI CMD:    src-tauri/src/main.rs → invoke_handler
FIND TS CLIENT:    src-frontend/services/{name}Client.ts
FIND PYTHON FUNC:  src-python/kos/scripts/{name}.py
FIND GPU PIPELINE: crates/k-os-gpu-pipeline/src/pipelines/{name}.rs
FIND RUST MODULE:  src-tauri/src/modules/{name}.rs
FIND TAURI CMD:    src-tauri/src/main.rs → invoke_handler
FIND TS CLIENT:    src/services/{name}Client.ts
FIND PYTHON FUNC:  src-python/kos/scripts/{name}.py

ADD RUST COMMAND:
  1. Add fn to the appropriate owner crate under crates/ (for compute)
     OR src-tauri/src/modules/{mod}.rs (for IPC handlers)
  2. Register in src-tauri/src/main.rs invoke_handler
  3. Create client in src-frontend/services/

ADD PYTHON FUNCTION:
  1. Add to src-python/kos/scripts/{name}.py
  2. Use @register("name") decorator
  3. Call via python.runScript() from TS

MODIFY LEASH (Optional - only if using Bevy viewport):
  MESSAGES: src-tauri/src/leash.rs LeashMessage enum
  SENDER:   src-tauri/src/main.rs leash_* functions
  RECEIVER: crates/k-os-bevy/src/main.rs follow_master()
```

---

## SIZE REFERENCE

```
FILE                      SIZE    NOTES
──────────────────────────────────────────
KSculpt.tsx               112KB   React + Three.js sculpting app
KPainter.tsx              84KB    React + Three.js painting app
KPaintBrushEngine.tsx     35KB    Stroke logic
sculpt.rs (k-os-sculpt)   37KB    Rust sculpt core
raycast/bvh.rs (k-os-gpu-pipeline)  24KB    BVH + UV raycast
sculpt_crystal.wgsl       ~4KB    GPU sculpting shader
```

---

## UPDATE RULES

```
!CRITICAL FOR AI AGENTS!

AFTER ANY CHANGE:
  1. Update RECENT_CHANGES.md (increment ID, add entry)
  
AFTER STRUCTURAL CHANGE:
  2. Update this file (DIRECTORY.md)
  
STRUCTURAL = new files, renamed modules, new IPC, deprecated features

KEEP ENTRIES COMPACT. ONE LINE PER FIELD.
```

---

## RELATED DOCS

```
BEVYDOCS.md                                  # ⚠️ BEVY 0.17 REFERENCE (only for crates/k-os-bevy/ work)
src-frontend/core/README.md                  # Core lib usage
src-python/README.md                         # Python guide  
src-frontend/apps/surface/paint/KPainter_Overview.md  # KPainter arch
archive/k-os-engine/README.md                # Archived compatibility-crate documentation
RECENT_CHANGES.md                            # Changelog (AI-native format)
```

## Auto-Generated Map

<!-- AUTO-GENERATED-CONTENT:START -->
- **assets/**
- **public/**
  - **hdr/**
  - **matcaps/**
  - **primitives/**
  - **primitives_glb/**
  - **xatlas/**
- **referenceforquantum/**
  - [ChronosContext.tsx](referenceforquantum\ChronosContext.tsx) `(6.6KB, 164 lines)` - *Status*
  - [ChronosEngine.tsx](referenceforquantum\ChronosEngine.tsx) `(13.8KB, 282 lines)`
  - [ChronosExport.ts](referenceforquantum\ChronosExport.ts) `(9.9KB, 186 lines)` - *Utils*
  - [ChronosShaders.ts](referenceforquantum\ChronosShaders.ts) `(19.0KB, 535 lines)` - *1. VELOCITY KERNEL (THE BRAIN - INJECTABLE)*
  - [ChronosUI.tsx](referenceforquantum\ChronosUI.tsx) `(24.1KB, 320 lines)`
  - [KChronos.tsx](referenceforquantum\KChronos.tsx) `(304B, 11 lines)`
  - [KQuantum.tsx](referenceforquantum\KQuantum.tsx) `(74.9KB, 1156 lines)`
- **src/**
  - **apps/**
    - **anim/**
    - **modeling/**
    - **render/**
    - **sculpting/**
    - **sim/**
    - **surface/**
  - **components/**
    - [AssetBrowser.tsx](src\components\AssetBrowser.tsx) `(23.2KB, 372 lines)`
    - [BootSequence.tsx](src\components\BootSequence.tsx) `(21.0KB, 390 lines)`
    - [ProjectSelector.tsx](src\components\ProjectSelector.tsx) `(3.7KB, 68 lines)`
  - **config/**
    - [appConfig.ts](src\config\appConfig.ts) `(5.2KB, 115 lines)`
  - **core/**
    - **animation/**
    - **audio/**
    - **geometry/**
    - **hooks/**
    - **input/**
    - **io/**
    - **materials/**
    - **math/**
    - **physics/**
    - **render/**
    - **services/**
    - **shaders/**
    - **surface/**
    - **three/**
    - **types/**
    - **ui/**
    - **utils/**
  - **hooks/**
    - [useAltCamera.ts](src\hooks\useAltCamera.ts) `(1.7KB, 54 lines)` - *Track state to prevent fighting with other tools (like Gizmo)*
    - [useAppSettings.ts](src\hooks\useAppSettings.ts) `(3.5KB, 109 lines)`
    - [useKernelApp.ts](src\hooks\useKernelApp.ts) `(8.7KB, 230 lines)`
  - **services/**
    - [brushDynamics.ts](src\services\brushDynamics.ts) `(7.3KB, 242 lines)` - *Check if we're running in Tauri*
    - [kernelServices.ts](src\services\kernelServices.ts) `(6.9KB, 214 lines)`
    - [maskClient.ts](src\services\maskClient.ts) `(6.8KB, 243 lines)` - *Check if we're running in Tauri*
    - [noiseClient.ts](src\services\noiseClient.ts) `(4.1KB, 150 lines)` - *Type definitions matching Rust structs*
    - [optimizeClient.ts](src\services\optimizeClient.ts) `(6.2KB, 199 lines)` - *Type definitions matching Rust structs*
    - [pbrClient.ts](src\services\pbrClient.ts) `(3.6KB, 140 lines)` - *============================================================================*
    - [proceduralClient.ts](src\services\proceduralClient.ts) `(4.8KB, 175 lines)` - *============================================================================*
    - [projectServices.ts](src\services\projectServices.ts) `(8.1KB, 246 lines)`
    - [pythonBridge.ts](src\services\pythonBridge.ts) `(5.8KB, 212 lines)`
    - [raycastClient.ts](src\services\raycastClient.ts) `(21.4KB, 705 lines)` - *Type definitions matching Rust structs*
    - [remeshClient.ts](src\services\remeshClient.ts) `(4.7KB, 162 lines)` - *Type definitions matching Rust structs*
    - [rustFluid.ts](src\services\rustFluid.ts) `(11.2KB, 383 lines)` - *Check if we're running in Tauri*
    - [scatterClient.ts](src\services\scatterClient.ts) `(4.7KB, 175 lines)` - *============================================================================*
    - [sculptClient.ts](src\services\sculptClient.ts) `(7.4KB, 229 lines)` - *Type definitions matching Rust structs*
    - [subdivideClient.ts](src\services\subdivideClient.ts) `(3.5KB, 117 lines)` - *Type definitions matching Rust structs*
    - [tauriClient.ts](src\services\tauriClient.ts) `(8.3KB, 277 lines)`
  - **types/**
    - [three-mesh-bvh.d.ts](src\types\three-mesh-bvh.d.ts) `(227B, 9 lines)`
    - [webgpu.d.ts](src\types\webgpu.d.ts) `(471B, 21 lines)`
  - [App.tsx](src\App.tsx) `(37.3KB, 704 lines)`
  - [DIRECTORY.md](src\DIRECTORY.md) `(186B, 19 lines)`
  - [NPM_ARSENAL.md](src\NPM_ARSENAL.md) `(17.4KB, 380 lines)`
  - [SRC_DIRECTORY.md](src\SRC_DIRECTORY.md) `(17.0KB, 447 lines)`
  - [constants.ts](src\constants.ts) `(1.0KB, 43 lines)`
  - [index.tsx](src\index.tsx) `(349B, 15 lines)`
  - [types.ts](src\types.ts) `(910B, 52 lines)`
- **src-python/**
  - ****pycache**/**
  - **ilovebuttons/**
  - **kos/**
    - ****pycache**/**
    - **scripts/**
    - [**init**.py](src-python\kos\__init__.py) `(285B, 13 lines)`
    - [api.py](src-python\kos\api.py) `(467B, 15 lines)` - *Add scripts folder to path for dynamic loading*
    - [mesh.py](src-python\kos\mesh.py) `(5.4KB, 171 lines)`
    - [ml.py](src-python\kos\ml.py) `(8.0KB, 232 lines)`
    - [procedural.py](src-python\kos\procedural.py) `(9.4KB, 288 lines)`
    - [textures.py](src-python\kos\textures.py) `(5.8KB, 190 lines)`
  - **windows_related_scripts/**
    - **texturedls/**
    - [dl_hdri.py](src-python\windows_related_scripts\dl_hdri.py) `(4.3KB, 106 lines)`
    - [dl_model.py](src-python\windows_related_scripts\dl_model.py) `(11.6KB, 352 lines)`
    - [dl_rigmodel.py](src-python\windows_related_scripts\dl_rigmodel.py) `(12.9KB, 390 lines)`
    - [dl_texture.py](src-python\windows_related_scripts\dl_texture.py) `(10.4KB, 328 lines)`
    - [img_convert.py](src-python\windows_related_scripts\img_convert.py) `(3.3KB, 78 lines)`
    - [organize_desktop.py](src-python\windows_related_scripts\organize_desktop.py) `(2.6KB, 70 lines)`
  - [README.md](src-python\README.md) `(2.6KB, 96 lines)`
  - [build.py](src-python\build.py) `(1.4KB, 51 lines)`
  - [main.py](src-python\main.py) `(5.2KB, 170 lines)` - *!/usr/bin/env python3*
- **src-tauri/**
  - **assets/**
  - **capabilities/**
  - **gen/**
    - **schemas/**
  - **icons/**
  - **src/**
    - **bevy/**
    - **modules/**
    - [leash.rs](src-tauri\src\leash.rs) `(15.3KB, 398 lines)` - *! The Leash - IPC Bridge between Tauri and Bevy*
    - [main.rs](src-tauri\src\main.rs) `(15.4KB, 455 lines)` - *! K_OS Backend - High-Performance Rust Engine*
    - [python_bridge.rs](src-tauri\src\python_bridge.rs) `(11.1KB, 375 lines)` - *! K_OS Python Bridge*
  - [DIRECTORY.md](src-tauri\DIRECTORY.md) `(175B, 17 lines)`
  - [TAURI_DIRECTORY.md](src-tauri\TAURI_DIRECTORY.md) `(17.2KB, 473 lines)`
  - [build.rs](src-tauri\build.rs) `(12.6KB, 310 lines)` - *1. Get Project Root (we are in src-tauri, so go up one level)*
- **tools/**
  - [autodocs.py](tools\autodocs.py) `(2.4KB, 74 lines)`
  - [cleanup_docs.py](tools\cleanup_docs.py) `(1.9KB, 48 lines)` - *Files we MUST NOT delete*
  - [smart_docs.py](tools\smart_docs.py) `(4.8KB, 143 lines)` - *Configuration*
- [BEVYDOCS.md](BEVYDOCS.md) `(12.6KB, 421 lines)`
- [CARGO_ARSENAL.md](CARGO_ARSENAL.md) `(9.1KB, 345 lines)`
- [DIRECTORY.md](DIRECTORY.md) `(19.8KB, 531 lines)`
- [NPM_ARSENAL.md](NPM_ARSENAL.md) `(13.7KB, 270 lines)`
- [PYTHON_ARSENAL.md](PYTHON_ARSENAL.md) `(11.5KB, 426 lines)`
- [RECENT_CHANGES.md](RECENT_CHANGES.md) `(42.2KB, 1215 lines)`
- [vite.config.ts](vite.config.ts) `(455B, 19 lines)`
<!-- AUTO-GENERATED-CONTENT:END -->
