---
inclusion: always
---

# K_OS DCC Suite - AI Agent Steering Guide

## Architecture Overview

K_OS is a **Tauri v2 desktop application** with a React + TypeScript frontend and Rust backend. This is a **stable, production architecture** - not experimental or in migration.

**Stack:**
- Frontend: React 18 + TypeScript + Three.js + Vite
- Backend: Tauri v2 + Rust
- GPU Compute: wgpu (WebGPU) for high-performance operations
- 3D Rendering: Three.js (@react-three/fiber)
- UI: Radix UI + Mantine + Tailwind CSS

**Optional Components:**
- Python sidecar for AI/ML tasks (JSON-RPC)
- Bevy viewport (experimental, not primary runtime)
- WASM build for web deployment

## Project Philosophy

This is a **solo developer project** by Kipp (Scavenger King). Key principles:

1. **Data-Driven Everything** - Use JSON configs, registries, and schemas instead of hardcoding. If you see repetitive code patterns, suggest data-driven solutions.

2. **Library-First** - Never reinvent the wheel. Add any library that solves the problem (Rust crates, NPM packages, Python packages). Check arsenal docs first: `CARGO_ARSENAL.md`, `NPM_ARSENAL.md`, `PYTHON_ARSENAL.md`

3. **GPU-First Performance** - Target max raw power. Users with potato computers are not the target - the future is the target. Use CUDA cores and GPU access when available.

4. **Creative & Experimental** - This is not a corporation. We can do whatever we want as long as it's cooler than competitors. Suggest bold, creative ideas when safe.

5. **Solo-Dev Time Savers** - If you notice weeks of hand-coding ahead, recommend scalable solutions (generators, parameterized assets, registries, etc.)

## Code Style & Conventions

### Rust

- Use `k_os_engine` crate for all compute-heavy operations
- GPU pipelines go in `crates/k-os-engine/src/gpu/pipelines/`
- WGSL shaders must have 16-byte alignment for uniform buffers (use `vec4<f32>` not `f32` arrays)
- Feature-gate optional dependencies: `#[cfg(feature = "physics")]`
- Use `wgpu` for GPU compute, not raw graphics APIs
- Prefer `nalgebra` for math, `parry3d` for collision/raycasting
- All Tauri commands registered in `src-tauri/src/main.rs`

### TypeScript/React

- Apps live in `src-frontend/features/{category}/{app}/`
- Use Three.js for 3D rendering via `@react-three/fiber`
- Tauri IPC via `invoke()` from `@tauri-apps/api`
- Service clients in `src-frontend/services/` wrap Rust backend calls
- UI components use Radix UI primitives + Tailwind
- Shared state via Zustand or Jotai (avoid prop drilling)

### Python

- Python is **general purpose** - not just AI/ML
- Use for: mesh processing, image manipulation, procedural gen, automation, ML inference
- Scripts in `src-python/kos/scripts/` are auto-discovered
- Use `@register("name")` decorator for JSON-RPC functions

## Common Patterns

### Adding a New Rust Command

1. Implement in `crates/k-os-engine/src/modules/{module}.rs`
2. Register in `src-tauri/src/main.rs` invoke_handler
3. Create TypeScript client in `src-frontend/services/{name}Client.ts`
4. Document in `CARGO_ARSENAL.md` if adding new crates

### Adding GPU Compute Pipeline

1. Create WGSL shader in `crates/k-os-engine/src/gpu/pipelines/{name}.wgsl`
2. Implement Rust wrapper in `crates/k-os-engine/src/gpu/pipelines/{name}.rs`
3. Ensure uniform buffer alignment (16-byte boundaries)
4. Export from `crates/k-os-engine/src/gpu/pipelines/mod.rs`

### Adding a New App

1. Create folder: `src-frontend/features/{category}/{app}/`
2. Main component: `K{AppName}.tsx`
3. UI panels in `ui/` subfolder
4. Engine logic in `engine/` subfolder
5. Register in `src-frontend/config/appConfig.ts`

## Performance Guidelines

- **GPU-accelerate everything possible** - Use wgpu compute shaders for heavy operations and my custom language kain for spir-v (recommended) see the readme in the kain/supermotion folder in /k-os-engine for an example
- **Parallel processing** - Use Rayon for CPU parallelism, wgpu for GPU parallelism
- **Zero-copy when possible** - Use buffer pools and staging buffers efficiently
- **Lazy initialization** - Use `lazy_static!` and `once_cell` for expensive resources
- **Profile before optimizing** - Use `cargo flamegraph` or browser DevTools

## Common Pitfalls

### WGSL Shader Alignment

❌ **Wrong:**
```wgsl
struct Params {
    extras: array<f32, 16>,  // 4-byte stride, fails validation
}
```

✅ **Correct:**
```wgsl
struct Params {
    extras: array<vec4<f32>, 4>,  // 16-byte stride, passes validation
}
```

### Feature Gating

❌ **Wrong:**
```rust
use rapier3d::prelude::*;  // Fails if physics feature disabled
```

✅ **Correct:**
```rust
#[cfg(feature = "physics")]
use rapier3d::prelude::*;
```

### Tauri IPC

❌ **Wrong:**
```typescript
// Direct Rust struct access
const result = await invoke('get_mesh');
```

✅ **Correct:**
```typescript
// Use typed service client
import { sculptClient } from '@/services/sculptClient';
const result = await sculptClient.getMesh(handle);
```

## File Organization

```
K_OS/
├── src-frontend/          # React + TypeScript frontend
│   ├── features/          # Apps (KSculpt, KPainter, etc.)
│   ├── services/          # Tauri IPC clients
│   ├── ui/                # Shared UI components
│   └── App.tsx            # Root component
│
├── src-tauri/             # Tauri backend
│   └── src/
│       ├── main.rs        # Command registration
│       └── python_bridge.rs  # Python sidecar
│
├── crates/
│   ├── k-os-engine/       # Core Rust compute library
│   │   ├── src/gpu/       # GPU pipelines (wgpu)
│   │   └── src/modules/   # CPU modules
│   └── k-os-wasm/         # Optional WASM build
│
├── src-python/            # Python sidecar
│   └── kos/scripts/       # Auto-loaded scripts
│
└── docs/                  # Arsenal documentation
    ├── CARGO_ARSENAL.md
    ├── NPM_ARSENAL.md
    └── PYTHON_ARSENAL.md
```

## Testing & Debugging

- **Rust**: `cargo test`, `cargo nextest run` (faster)
- **TypeScript**: Vite dev server with HMR
- **GPU**: Use `gpu::benchmark` module for performance testing
- **Python**: `ruff check .` for linting
- **Build**: `cargo build --release` for production

## Documentation Requirements

After any change:
1. Update `RECENT_CHANGES.md` (increment ID, add entry)
2. If structural change (new files, renamed modules, new IPC): Update `DIRECTORY.md`
3. If adding libraries: Update appropriate arsenal doc

## Key Resources

- `DIRECTORY.md` - Complete codebase map
- `CARGO_ARSENAL.md` - All Rust crates with usage
- `NPM_ARSENAL.md` - All NPM packages with imports
- `PYTHON_ARSENAL.md` - All Python packages with examples
- `RECENT_CHANGES.md` - Changelog (AI-native format)
- `BEVYDOCS.md` - Bevy 0.17 reference (only for src-bevy/ work)

## Communication Style

When working with Kipp:
- Provide **clear recommendations** over long option lists
- Suggest **creative/experimental ideas** when safe
- Recommend **data-driven solutions** for repetitive patterns
- Be **decisive and actionable** - this is a solo dev pipeline
- **Celebrate wins** - building cool stuff is the goal
