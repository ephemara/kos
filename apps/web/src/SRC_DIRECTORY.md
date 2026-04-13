# K_OS /src-frontend FRONTEND MAP

> **FOR AI AGENTS** | This is the TypeScript/React frontend of a **HYBRID DESKTOP 3D CREATIVE SUITE**
>
> ⚠️ **THIS IS NOT A WEB APP** - This is a Tauri desktop application with:
>
> - **Rust backend** (`src-tauri/`) - 50+ native commands, IPC proxy
> - **Owner crates** (`crates/`) - GPU compute, mesh operations, sculpting, sim, IO
> - **Python sidecar** (`src-python/`) - AI/ML inference, image processing
> - **Bevy engine** (`crates/k-os-bevy/`) - Native 3D viewport for heavy operations
> - **React frontend** (`src-frontend/`) - You are here! UI layer with Three.js viewports

```
VERSION: 0.7-alpha
STACK: React 18 + TypeScript + Three.js + R3F + Tauri v2
APPS: 15 creative tools
NPM_PACKAGES: 234
WORKSPACE: owner crates + src-tauri + crates/k-os-bevy
```

> **BEFORE ADDING PACKAGES:** Check `NPM_ARSENAL.md` in this directory!

---

## THE BIG PICTURE (POST-REFACTOR)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        K_OS DESKTOP APPLICATION                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              YOU ARE HERE: src-frontend/                        │   │
│   │                                                                 │   │
│   │   React + TypeScript + Three.js                                 │   │
│   │   ├── 15 creative apps (KSculpt, KPainter, etc)                 │   │
│   │   ├── AppShell UI framework (Radix-based)                       │   │
│   │   ├── Three.js viewports (per-app 3D scenes)                    │   │
│   │   └── Service clients (invoke Rust commands)                    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                          invoke() via Tauri IPC                         │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    src-tauri/ (IPC Proxy)                        │   │
│   │                                                                 │   │
│   │   Tauri v2 Command Surface                                      │   │
│   │   ├── main.rs - Command registration                            │   │
│   │   ├── leash.rs - UDP IPC to Bevy                                │   │
│   │   └── python_bridge.rs - JSON-RPC to Python                    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                          WORKSPACE CALLS                                 │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              crates/* (Owner Crates)                            │   │
│   │                                                                 │   │
│   │   Native Performance Layer                                      │   │
│   │   ├── sculpting/ - Mesh deformation (handles 10M+ vertices)    │   │
│   │   ├── mesh/ - BVH raycasting, subdivision, optimization         │   │
│   │   ├── simulation/ - Physics (Rapier), Fluid (Salva3D)          │   │
│   │   ├── textures/ - PBR gen, noise, procedural                    │   │
│   │   ├── gpu/ - WGPU compute pipelines (100x faster)               │   │
│   │   └── 16+ more Rust modules                                     │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                          JSON-RPC via stdin/stdout                      │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    src-python/ (Python Sidecar)                 │   │
│   │                                                                 │   │
│   │   AI/ML & Processing Layer                                      │   │
│   │   ├── SAM (Segment Anything) - AI masking                       │   │
│   │   ├── Stable Diffusion - Texture generation                     │   │
│   │   ├── ESRGAN - AI upscaling                                     │   │
│   │   └── Custom scripts in kos/scripts/ (auto-discovered)          │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              crates/k-os-bevy/ (Bevy Renderer)                  │   │
│   │    Bevy 0.17 + egui 3D viewport (GPU acceleration)             │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## DUAL-MODE ARCHITECTURE (GarageBand vs Logic Pro)

```
SIMPLE MODE (Default)                    ADVANCED MODE (Power Users)
─────────────────────                    ──────────────────────────
React + Three.js                         Bevy 0.17 + egui
Boots instantly                          Spawns on-demand via toggle
Beautiful React UI panels                Blender-style unified viewport
Great for most tasks                     GPU-heavy operations (10M+ poly)
All 15 apps work here                    Currently: KSculpt only

Toggle in header: [SIMPLE] / [ADVANCED]
Both modes call the SAME Rust modules - they share the engine!
```

---

## FOLDER STRUCTURE

```
src-frontend/
├── index.tsx              # Entry point
├── App.tsx                # HYPERVISOR - routes apps, kernel storage, mode toggle
├── constants.ts           # Global constants
├── types.ts               # Shared TypeScript types
│
├── config/
│   └── appConfig.ts       # WORKFLOW array - defines all apps & routing
│
├── apps/                  # ★ THE 15 CREATIVE APPLICATIONS ★
│   ├── sculpting/         # 3D mesh manipulation
│   ├── surface/           # Texturing & painting
│   ├── modeling/          # Procedural modeling
│   ├── sim/               # Simulation (terrain, particles)
│   ├── anim/              # Animation & rigging
│   └── render/            # Rendering & preview
│
├── core/                  # ★ SHARED LIBRARIES ★
│   ├── ui/                # UI framework (AppShell, DockPanel, etc)
│   ├── three/             # Three.js utilities
│   ├── shaders/           # GLSL shaders
│   ├── physics/           # Rapier physics wrappers
│   ├── materials/         # PBR material utilities
│   ├── animation/         # Animation hooks
│   └── hooks/             # React hooks
│
├── services/              # ★ RUST/PYTHON BRIDGE CLIENTS ★
│   ├── tauriClient.ts     # Base invoke() wrapper
│   ├── sculptClient.ts    # Sculpt brush commands
│   ├── raycastClient.ts   # BVH raycasting
│   ├── pythonBridge.ts    # Python script calls
│   └── ...                # 16 total service clients
│
├── components/            # Shared React components
├── hooks/                 # App-level React hooks
└── types/                 # Additional type definitions
```

---

## APPS BREAKDOWN

### src-frontend/apps/sculpting/

```
sculpt/
├── KSculpt.tsx            # 112KB - Legacy Three.js version [DEPRECATED]
├── KSculptBevy.tsx        # 25KB - Bevy-powered version [ACTIVE]
├── KSculptTopBar.tsx      # Top toolbar
├── KSculptBrushes.tsx     # Brush definitions
└── ...

WHAT IT DOES: ZBrush-style mesh sculpting with 20+ brushes
RUST CALLS: sculptClient.ts → sculpt.rs, raycast.rs, brush_dynamics.rs
```

### src-frontend/apps/surface/

```
paint/
├── KPainter.tsx           # 84KB - Substance Painter-style 3D painting
├── KPaintBrushEngine.tsx  # 35KB - Stroke interpolation, fluid sim
└── ...

graphos/
├── KGraphos.tsx           # 2D texture painting with fluid sim + animation
└── ...

atlas/
├── KAtlas.tsx             # UV unwrapping (calls XAtlas via Rust)
└── ...

autopbr/
├── KAutopbr.tsx           # AI PBR map generation
└── ...

WHAT THEY DO: Texturing, UV mapping, material authoring
RUST CALLS: pbrClient.ts, proceduralClient.ts
PYTHON CALLS: autopbr_bake.py (AI delighting, upscaling)
```

### src-frontend/apps/modeling/

```
greeble/
├── KGreeble.tsx           # IMM brush + UE5-style procedural modeling
├── KGreebleUI.tsx         # Control panels
└── ...

scatter/
├── KScatter.tsx           # Object distribution (Poisson, physics drop)
└── ...

cloner/
├── KCloner.tsx            # Cinema4D-style mograph/cloner
└── ...

WHAT THEY DO: Procedural modeling, object placement
RUST CALLS: scatterClient.ts → scatter.rs (KD-tree, Voronoi)
```

### src-frontend/apps/sim/

```
tecton/
├── KTecton.tsx            # Terrain generation + erosion sim
└── ui/                    # AppShell panels

quantum/
├── KQuantum.tsx           # AppShell container
├── KQuantumEngine.tsx     # GPGPU particle simulator (5k-10M particles)
├── KQuantumPresets.ts     # Physics presets, color palettes
└── ui/                    # TopBar, LeftPanel, RightPanel

WHAT THEY DO: Terrain, particle systems, physics sims
RUST CALLS: physics.rs (Rapier3D), fluid.rs (Salva3D)
```

### src-frontend/apps/anim/

```
rig/
├── KRig.tsx               # Skeleton rigging, IK chains
└── ...

WHAT IT DOES: Character rigging, animation
RUST CALLS: rig module (geodesic skinning)
```

### src-frontend/apps/render/

```
inspect/
├── KInspect.tsx           # Marmoset Toolbag-style preview renderer
└── ...

WHAT IT DOES: Final render preview with PBR lighting
```

---

## CORE LIBRARIES

### src-frontend/core/ui/ (UI Framework)

```
shell/
├── AppShell.tsx           # 13KB - Standard app container (TopBar + Docks)
├── DockPanel.tsx          # 12KB - Collapsible side panels
├── FloatingQuickMenu.tsx  # 14KB - Context menu (Q key)
├── Sequencer.tsx          # 14KB - Timeline/keyframe editor
├── QuickMenu.tsx          # Quick action menu
└── controls/              # Shared control widgets

KContentBrowser/           # Asset browser component
KSpaceMenu/                # Radial space menu
primitives/                # Base UI components
widgets/                   # Complex widgets
```

### src-frontend/core/three/ (Three.js Utilities)

```
Various Three.js helpers for geometry, materials, cameras, etc.
```

### src-frontend/core/shaders/ (GLSL)

```
Shared shader includes for effects, materials, post-processing
```

### src-frontend/core/physics/

```
Rapier physics wrappers for React Three Fiber
```

---

## SERVICES (Rust/Python Bridges)

```
SERVICE FILE              RUST MODULE           PURPOSE
────────────────────────────────────────────────────────────────────
src-frontend/services/tauriClient.ts            src-tauri/main.rs               Base invoke() wrapper
src-frontend/services/sculptClient.ts           crates/k-os-sculpt/src/sculpt.rs                            Mesh deformation brushes
src-frontend/services/raycastClient.ts          crates/k-os-gpu-pipeline/src/raycast/bvh.rs                 BVH raycasting (sub-ms)
src-frontend/services/maskClient.ts             crates/k-os-sculpt/src/mask.rs                              Vertex masking
src-frontend/services/brushDynamics.ts          crates/k-os-sculpt/src/brush_dynamics.rs                    Stroke interpolation
src-frontend/services/rustFluid.ts              crates/k-os-sim/src/fluid.rs                                Salva3D fluid sim
src-frontend/services/proceduralClient.ts       crates/k-os-material/src/texture_ops/mod.rs                 Noise/Voronoi textures
src-frontend/services/pbrClient.ts              crates/k-os-material/src/texture_ops/mod.rs                 Normal/AO generation
src-frontend/services/noiseClient.ts            crates/k-os-material/src/texture_ops/mod.rs                 Perlin/simplex brushes
src-frontend/services/optimizeClient.ts         crates/k-os-mesh/src/optimize.rs                            meshopt LOD
src-frontend/services/remeshClient.ts           crates/k-os-gpu-pipeline/src/pipelines/dynamesh.rs          Marching cubes
src-frontend/services/subdivideClient.ts        crates/k-os-gpu-pipeline/src/pipelines/subdivide_v2.rs      Catmull-Clark
src-frontend/services/scatterClient.ts          crates/k-os-scatter/src/lib.rs                              KD-tree Poisson
src-frontend/services/pythonBridge.ts           src-tauri/python_bridge.rs      Python script calls
src-frontend/services/kernelServices.ts         -                     Kernel asset management
src-frontend/services/projectServices.ts        -                     Save/load projects
```

---

## KERNEL STORAGE (Asset Sharing)

```
CONCEPT: Central asset registry shared across ALL apps

STORES:
  kernelArtifacts[]     # 3D meshes (GLB, OBJ imports + sculpts)
  kernelMaterials[]     # PBR material sets
  kernelAlphas[]        # Brush alpha textures

HOW IT WORKS:
  KSculpt.commit(mesh) → kernelArtifacts.push(artifact)
                       ↓
  KPainter.load(artifactId) → gets same mesh from kernel

LOCATION: App.tsx (useKernelApp hook)
UI: AssetBrowser in header ("KERNEL STORAGE" button)
```

---

## COMMON PATTERNS

### Calling Rust from React

```typescript
import { invoke } from '@tauri-apps/api/core';

// Direct invoke
const result = await invoke('sculpt_apply_brush', { 
  brushType: 'clay',
  position: [x, y, z],
  radius: 0.5 
});

// Or use service clients (recommended)
import { sculptClient } from '@/services/sculptClient';
await sculptClient.applyBrush({ ... });
```

### Calling Python from React

```typescript
import { pythonBridge } from '@/services/pythonBridge';

// Run a Python script
const result = await pythonBridge.runScript('autopbr_bake', {
  imagePath: '/path/to/texture.png',
  delight: true
});
```

### Using AppShell (Standard App Layout)

```tsx
import { AppShell, DockPanel } from '@/core/ui/shell';

function MyApp() {
  return (
    <AppShell
      topBar={<MyTopBar />}
      leftDock={<DockPanel title="Tools">...</DockPanel>}
      rightDock={<DockPanel title="Properties">...</DockPanel>}
    >
      <ThreeCanvas />
    </AppShell>
  );
}
```

---

## NAVIGATION PATTERNS

```
FIND APP:           src-frontend/apps/{category}/{appName}/K{AppName}.tsx
FIND APP UI:        src-frontend/apps/{category}/{appName}/ui/
FIND SERVICE:       src-frontend/services/{name}Client.ts
FIND UI COMPONENT:  src-frontend/core/ui/{component}/
FIND SHARED HOOK:   src-frontend/core/hooks/{hookName}.ts

ADD NEW APP:
  1. Create folder: src-frontend/apps/{category}/{newApp}/
  2. Create main file: K{NewApp}.tsx
  3. Register in config/appConfig.ts WORKFLOW array
  4. Add to App.tsx routing
```

---

## THE OTHER DIRECTORIES (For Context)

You're working in `src-frontend/`, but here's what the other folders do:

```
src-tauri/          Tauri IPC Proxy
├── src/
│   ├── main.rs     Tauri entry, 50+ command registrations
│   ├── leash.rs    UDP IPC to Bevy (window sync, brush state)
│   └── python_bridge.rs  JSON-RPC to Python

crates/             Owner crates
├── k-os-sculpt/    Sculpt runtime + masks + brush dynamics
├── k-os-gpu-pipeline/ WGPU compute pipelines
└── ...             Other domain owners

crates/k-os-bevy/   Bevy 0.17 Renderer
└── src/            Bevy plugins + egui UI

src-python/         Python sidecar
├── main.py         JSON-RPC server
└── kos/
    ├── ml.py       SAM, SD, ESRGAN wrappers
    └── scripts/    Auto-discovered scripts (drop .py files here)
```

---

## DO's AND DON'Ts

### DO ✓

- Use `invoke()` for compute-heavy operations (Rust is 10-100x faster)
- Use `pythonBridge.runScript()` for AI/ML inference
- Use AppShell pattern for new apps (consistent UX)
- Check NPM_ARSENAL.md before adding packages
- Use Three.js for 3D viewports (React Three Fiber preferred)

### DON'T ✗

- Don't implement heavy algorithms in TypeScript (use Rust)
- Don't assume this is a regular web app (it's desktop-native)
- Don't duplicate patterns - check core/ for existing utilities
- Don't ignore the kernel storage system for asset management

---

## SIZE REFERENCE

```
FILE                      SIZE    NOTES
──────────────────────────────────────────
KSculpt.tsx               112KB   Legacy, being replaced by Bevy
KPainter.tsx              84KB    Largest active app
App.tsx                   38KB    Hypervisor, kernel, routing
KQuantumEngine.tsx        ~25KB   GPGPU particle simulator
AppShell.tsx              13KB    Standard app container
DockPanel.tsx             12KB    Collapsible panels
```

---

## RELATED DOCS

```
./NPM_ARSENAL.md              # All 234 npm packages with imports
../DIRECTORY.md               # Full project map (NEW STRUCTURE)
../RECENT_CHANGES.md          # Recent modifications
../docs/BEVYDOCS.md           # Bevy 0.17 syntax reference
../src-tauri/TAURI_DIRECTORY.md  # Tauri IPC proxy documentation
../crates/                   # Owner crates
```
