# k-os-gpu-pipeline - Agent Notes

## Purpose
`k-os-gpu-pipeline` is the shared GPU compute backbone for K_OS. It centralizes:
- device/bootstrap lifecycle (`GpuComputeDevice`)
- compute pipeline compilation/cache (`PipelineCache`)
- reusable buffer and staging pools (`BufferPool`, `StagingBufferPool`)
- domain compute modules (sculpt, atlas, raycast, spatial, SVT, normals)
- optional shader hot reload in debug (`ShaderHotReloader`)

Primary sources:
- [`M:/K_OS/crates/k-os-gpu-pipeline/src/lib.rs`](M:/K_OS/crates/k-os-gpu-pipeline/src/lib.rs)
- [`M:/K_OS/crates/k-os-gpu-pipeline/src/device.rs`](M:/K_OS/crates/k-os-gpu-pipeline/src/device.rs)

## Data Flow And Ownership
1. Callers initialize/acquire a shared `GpuComputeDevice` singleton.
2. `GPUPipelineManager` composes cache + pool + perf monitor over shared `wgpu::Device`/`Queue`.
3. Shader names resolve through `PipelineCache` (`shaders/<name>.wgsl` lookup or registered source).
4. Work dispatch writes data via queue/buffers, executes compute passes, and updates performance counters.
5. Specialized modules (atlas/sculpt/raycast/spatial/svt) consume this core layer.

Ownership boundaries:
- This crate owns GPU orchestration primitives and compatibility re-exports under `gpu`.
- Scene semantics and higher-level authoring logic belong to dependent crates (`k-os-scene`, `k-os-kain`, `k-os-eval`, etc.).
- Mesh upload buffer-growth policy is centralized here (`mesh_bridge::next_buffer_capacity*`) so renderer/domain consumers do not diverge on allocation heuristics.

## Extension Points
- Register embedded shader sources through `PipelineCache::register_shader_source`.
- Tune reuse/memory pressure with `BufferPoolConfig` instead of hardcoding allocator behavior.
- Hook centralized GPU error routing via `register_gpu_error_handler`.
- Add new compute domains under `src/<domain>` and re-export through `lib.rs`.

## Known Risks / Edge Cases
- `PipelineCache::get_or_create` uses an unsafe reference return pattern tied to cache lifetime assumptions; invalidation behavior must remain consistent with those assumptions.
- Shader file lookup defaults to relative `shaders/<name>.wgsl`; runtime CWD drift can cause false "not found" failures.
- Global singleton initialization (`GpuComputeDevice`) must stay race-safe across host/runtime entry points.
- `K_OS_GPU_SYNC` forces synchronous polling and can hide latency issues while reducing throughput.
- Hot-reload signaling is timing-sensitive and intentionally non-deterministic in tests.

## Validation Commands
From [`M:/K_OS`](M:/K_OS):

```powershell
cargo check -p k-os-gpu-pipeline --all-targets
cargo test -p k-os-gpu-pipeline
```
