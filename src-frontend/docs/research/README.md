# K_OS Architecture Research

**Last Updated:** 2026-03-09  
**Status:** Active Research & Implementation

---

## Overview

This directory contains comprehensive research documents for K_OS's migration from Three.js (WebGL) to native `k-os-renderer` (Rust + wgpu + winit) with multi-window architecture.

---

## Documents

### 1. [NATIVE_RENDERER_INTEGRATION.md](./NATIVE_RENDERER_INTEGRATION.md)
**Priority:** CRITICAL - Read this first

Complete guide to k-os-renderer integration:
- Architecture overview (React overlay + native viewport)
- Data flow (viewport creation, mesh attachment, camera control)
- RenderGraph system (compute shader execution)
- Performance characteristics (4-8x FPS improvement)
- Integration patterns (transparent overlay, handle-based state)
- Migration checklist

**Key Insight:** React becomes a "dumb renderer" for UI only, floating transparently over the native wgpu viewport. All 3D data lives in Rust.

---

### 2. [MULTI_WINDOW_ARCHITECTURE.md](./MULTI_WINDOW_ARCHITECTURE.md)
**Priority:** HIGH - Multi-window migration roadmap

8-10 week migration plan:
- Phase 1: Native viewport integration (Week 1-2)
- Phase 2: Terminal window (Week 3)
- Phase 3: Asset browser (Week 4-5)
- Phase 4: Material editor (Week 6-7)
- Phase 5: KAIN IDE (Week 8-10)

**Key Insight:** Tauri as window manager, not browser. Each complex widget gets its own OS window for true native composition.

---

### 3. [IPC_OPTIMIZATION_PATTERNS.md](./IPC_OPTIMIZATION_PATTERNS.md)
**Priority:** HIGH - Eliminates IPC bottlenecks

Six optimization patterns:
1. Handle-based architecture (1-4ms latency)
2. Event-driven updates (0.5-2ms latency)
3. Shared memory buffers (<0.5ms latency)
4. GPU-side operations (RenderGraph)
5. Batch operations (5000+ ops/batch)

**Key Insight:** Never serialize mesh data through IPC. Use handles and GPU-side operations.

---

### 4. [DATA_ORIENTED_ARCHITECTURE.md](./DATA_ORIENTED_ARCHITECTURE.md)
**Priority:** FOUNDATIONAL - Guides all design decisions

Core principles:
- Structure of Arrays (SoA) vs Object-Oriented Programming (OOP)
- Cache-friendly memory layouts
- GPU-first storage (wgpu buffers)
- ECS patterns (flat entity arrays)

**Key Insight:** Performance is won or lost in the CPU cache. Separate data from logic.

---

### 5. [ui_architecture_deepdive.md](./ui_architecture_deepdive.md)
**Priority:** MEDIUM - React UI justification

Why React + Tauri beats egui:
- Studio-grade DCC components (NumericInput, NodeGraph, CurveEditor)
- Radix UI primitives (accessibility, focus management)
- Framer Motion (hardware-accelerated animations)
- Years of UI engineering vs starting from scratch

**Key Insight:** Don't throw away $100M of React UI work. Float it over the native renderer.

---

## Quick Start

### For New Developers

1. Read [NATIVE_RENDERER_INTEGRATION.md](./NATIVE_RENDERER_INTEGRATION.md) first
2. Understand the transparent overlay pattern
3. Review handle-based architecture in [IPC_OPTIMIZATION_PATTERNS.md](./IPC_OPTIMIZATION_PATTERNS.md)
4. Study data-oriented principles in [DATA_ORIENTED_ARCHITECTURE.md](./DATA_ORIENTED_ARCHITECTURE.md)

### For Implementation

1. Follow migration checklist in [NATIVE_RENDERER_INTEGRATION.md](./NATIVE_RENDERER_INTEGRATION.md)
2. Use patterns from [IPC_OPTIMIZATION_PATTERNS.md](./IPC_OPTIMIZATION_PATTERNS.md)
3. Apply principles from [DATA_ORIENTED_ARCHITECTURE.md](./DATA_ORIENTED_ARCHITECTURE.md)
4. Reference [MULTI_WINDOW_ARCHITECTURE.md](./MULTI_WINDOW_ARCHITECTURE.md) for window management

---

## Architecture Summary

### The Stack

```
┌─────────────────────────────────────────────────────────────┐
│ React UI Layer (Tauri - Transparent Overlay)                │
│ ├─ AppShell (Menu, Toolbar, Panels)                         │
│ ├─ Properties Panel (right dock)                            │
│ ├─ Outliner (left dock)                                     │
│ ├─ Sequencer (bottom dock)                                  │
│ └─ CENTER: Transparent hole (background: transparent)       │
└─────────────────────────────────────────────────────────────┘
                          ↕ IPC (Handles Only)
┌─────────────────────────────────────────────────────────────┐
│ k-os-renderer (Native Rust Process)                         │
│ ├─ winit event loop (native window)                         │
│ ├─ wgpu context (direct GPU access)                         │
│ ├─ RenderGraph (compute shader execution)                   │
│ ├─ ViewportRuntime (camera, meshes, state)                  │
│ └─ RendererService (command processing)                     │
└─────────────────────────────────────────────────────────────┘
         ↑ Shines through transparent Tauri overlay
```

### Key Principles

1. **React is "Dumb Renderer"** - UI only, no 3D data
2. **Rust is "Brain"** - Owns all scene/mesh/GPU state
3. **Handles, Not Data** - React holds u64 handles, not vertex arrays
4. **GPU-First** - All operations on GPU via RenderGraph
5. **Event-Driven** - Async updates, no blocking IPC

---

## Performance Targets

| Metric | Legacy (Three.js) | Target (k-os-renderer) | Improvement |
|--------|-------------------|------------------------|-------------|
| Viewport FPS | 30-60 | 120-240 | 4-8x |
| Brush Latency | 16-32ms | 1-4ms | 8-16x |
| Mesh Upload | 100-500ms | 5-20ms | 20-50x |
| State Sync | 50-100ms | 2-10ms | 10-25x |
| GPU Memory | WebGL (limited) | Direct wgpu | Native access |

---

## Migration Status

### Phase 1: Core Integration (In Progress)
- [x] k-os-renderer crate implemented
- [x] Viewport creation/disposal
- [x] Mesh attachment/detachment
- [x] Camera control
- [x] RenderGraph execution
- [x] Selection (picking)
- [ ] React `rendererClient.ts` service
- [ ] Zustand `viewportStore.ts`
- [ ] Transparent overlay component

### Phase 2: Feature Parity (Planned)
- [ ] Shading modes (solid, wireframe, textured)
- [ ] Grid rendering
- [ ] Gizmos (transform, rotate, scale)
- [ ] Multi-viewport support
- [ ] Screenshot/export

### Phase 3: Multi-Window (Planned)
- [ ] Terminal window
- [ ] Asset browser window
- [ ] Material editor window
- [ ] KAIN IDE window

---

## Best Practices

### DO ✅

1. **Store all mesh data in Rust** - React never touches vertex data
2. **Use handles for references** - ViewportHandle, RenderMeshHandle, MeshHandle
3. **Emit events for updates** - Frame stats, selection, errors
4. **Keep operations on GPU** - RenderGraph for all compute
5. **Follow data-oriented design** - SoA, cache-friendly, GPU-first

### DON'T ❌

1. **Serialize mesh data through IPC** - Use handles instead
2. **Duplicate state in React** - Rust is source of truth
3. **Block on IPC calls** - Use async/await
4. **Download GPU data to CPU** - Keep operations on GPU
5. **Use OOP for scene data** - Use ECS/flat arrays

---

## Contributing

When adding new research:

1. Create new `.md` file in this directory
2. Add entry to this README
3. Follow existing document structure
4. Include code examples
5. Add performance benchmarks
6. Update migration status

---

## References

### External Documentation
- [wgpu Documentation](https://wgpu.rs/)
- [winit Documentation](https://docs.rs/winit/)
- [Tauri Multi-Window](https://tauri.app/v1/guides/features/multiwindow/)
- [WGSL Specification](https://www.w3.org/TR/WGSL/)
- [Data-Oriented Design Book](https://www.dataorienteddesign.com/dodbook/)

### K_OS Documentation
- `DIRECTORY.md` - Complete codebase map
- `CARGO_ARSENAL.md` - All Rust crates
- `NPM_ARSENAL.md` - All NPM packages
- `RECENT_CHANGES.md` - Changelog

---

**Status:** Active research and implementation  
**Owner:** Kipp (Scavenger King)  
**Timeline:** 8-10 weeks for full migration

