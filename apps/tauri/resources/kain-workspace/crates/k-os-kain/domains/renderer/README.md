# KAIN Renderer Domain

Author native renderer compute and shading support kernels here.
Compiled to SPIR-V via `kain <file>.kn -t spirv -o <file>.spv`.

---

## Shader Pipeline Overview

```
Mesh Upload
    │
    ▼
renderer_cull_frustum.kn       — GPU frustum cull, fills visibility bitmask + draw count
    │
    ▼
renderer_surface_pass.kn       — Depth prepass: projects vertices → fills depth_out buffer
    │
    ▼  (parallel with above)
renderer_normals_recon.kn      — Pass A: accumulate area-weighted face normals per vertex
renderer_normals_normalize.kn  — Pass B: normalize accumulators → final smooth normals
    │
    ▼
[Main Shading / PBR / Solid pass — future shader]
    │
    ▼  (optional overlay)
renderer_wireframe_edges.kn    — Project edges → screen-space line segments (ShadingMode::Wireframe)
    │
    ▼
renderer_screen_composit.kn    — Tone-map (ACES/Reinhard/Linear) + gamma + vignette + wire tint
```

---

## Shaders

| File | Dispatch | Input Bindings | Output Binding | Purpose |
|------|----------|---------------|----------------|---------|
| `renderer_surface_pass.kn` | 1D (vertex) | `positions @0`, `indices @1`, `mvp @3-6` | `depth_out @2` | Depth prepass |
| `renderer_cull_frustum.kn` | 1D (instance) | `aabb_min @0`, `aabb_max @1`, `planes @4-9` | `visibility @2`, `draw_count @3` | Frustum cull |
| `renderer_normals_recon.kn` | 1D (face) | `positions @0`, `indices @1` | `normals_accum @2` | Normal reconstruction pass A |
| `renderer_normals_normalize.kn` | 1D (vertex) | `normals_accum @0` | `normals_out @1` | Normal reconstruction pass B |
| `renderer_picking_ray.kn` | 1D (face) | `positions @0`, `indices @1`, `ray @3-4` | `result @2` | Möller–Trumbore GPU picking |
| `renderer_wireframe_edges.kn` | 1D (face) | `positions @0`, `indices @1`, `view_proj @3-6` | `edge_segments @2` | Screen-space edge extraction |
| `renderer_screen_composit.kn` | 2D (pixel) | `hdr_buffer @0`, `depth_buffer @1` | `ldr_output @2` | Tone-map + post FX |

---

## Integration with `k-os-renderer`

The Rust crate (`crates/k-os-renderer`) exposes:
- `ShadingMode::Solid` → run `renderer_surface_pass` + main shading + `renderer_screen_composit`
- `ShadingMode::Wireframe` → additionally dispatch `renderer_wireframe_edges`, feed result to `renderer_screen_composit` `wire_tint_weight`
- `request_selection()` → dispatch `renderer_picking_ray` per frame for active pick rays

Normal reconstruction (`renderer_normals_recon` + `renderer_normals_normalize`) runs whenever
sculpt edits or SubD evaluations dirty the position buffer.
