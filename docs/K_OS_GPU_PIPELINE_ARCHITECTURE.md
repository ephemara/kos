# K_OS GPU Pipeline Architecture

## Scope
- Component: `k-os-gpu-pipeline`
- Source root: `M:/K_OS/crates/k-os-gpu-pipeline`
- Primary API surface: `src/lib.rs` (`GPUPipelineManager`, `GpuComputeDevice`, cache/pool/staging/atlas/sculpt/spatial/svt modules)

## Component Purpose
`k-os-gpu-pipeline` centralizes GPU compute lifecycle for K_OS: device bootstrap, shader pipeline compilation/caching, buffer reuse, and subsystem-level compute building blocks (sculpt, atlas, raycast, spatial, virtual texturing).

The crate is the cross-domain bridge between CPU-side evaluators/scene data and GPU execution APIs (`wgpu`), exposing a stable facade to downstream crates through `lib.rs` re-exports.

## Data Flow and Ownership
1. Device lifecycle
- `GpuComputeDevice` (`src/device.rs`) owns `wgpu::Device` + `wgpu::Queue` and initializes once through a process-global singleton (`OnceCell` on native).
- Optional sync mode is controlled by env flag `K_OS_GPU_SYNC` for deterministic submit/poll behavior.

2. Manager construction
- `GPUPipelineManager` (`src/lib.rs`) receives shared `Arc<Device>` + `Arc<Queue>` and creates:
  - `PipelineCache` (compiled shader pipelines)
  - `BufferPool` (bucketed reusable buffers)
  - `PerformanceMonitor` (allocation/frame counters)
  - `ShaderHotReloader` in debug builds only

3. Shader execution path
- Caller requests pipeline by shader name via `get_or_create_pipeline`.
- `PipelineCache` resolves source (registered in-memory source or `shaders/<name>.wgsl` filesystem lookup), compiles, then caches the `ComputePipeline`.
- `execute_compute` encodes and submits compute dispatch to queue.

4. Buffer lifecycle path
- Caller requests buffer via `get_buffer(size, usage)`.
- `BufferPool` rounds size to configured bucket granularity and either reuses pooled buffer or allocates new GPU buffer.
- Caller returns buffer with `return_buffer`; pool keeps buffer only if per-bucket and total-memory limits permit.

5. Bridge uploads
- CPU byte payloads are written through `upload_bytes` to pre-allocated GPU buffers, keeping write semantics centralized.

## Extension Points
- Shader source injection: `PipelineCache::register_shader_source` enables data-driven/embedded shader registration instead of hardcoded disk files.
- Pool tuning: `GPUPipelineManager::with_config` allows per-context buffer strategy (`max_buffers_per_bucket`, `max_pool_memory`, `size_bucket_granularity`).
- GPU error handling: `register_gpu_error_handler` hooks uncaptured `wgpu` errors into host diagnostics/UI.
- Subsystem modularity: public modules (`atlas`, `sculpt`, `raycast`, `spatial`, `svt`, `brush`) can evolve independently while preserving top-level facade.
- Compatibility bridge: `pub mod gpu` in `lib.rs` keeps legacy internal import paths functional during migration.

## Known Risks and Edge Cases
- Lifetime safety risk in cache fast-path: `PipelineCache::get_or_create` uses `unsafe` reference return from an `Arc` stored behind `RwLock`; correctness depends on cache entry lifetime assumptions.
- Shader path coupling: default source load expects `shaders/<name>.wgsl`; crate shaders currently live under `src/` and feature folders, so call sites should prefer source registration or explicit path conventions.
- Metric drift risk: `PerformanceMonitor` tracks compilation/dispatch counters, but manager methods currently do not record every possible compile/dispatch path automatically.
- GPU optionality in CI: integration tests skip when no adapter/device is available, which can hide regressions unless GPU-enabled lanes exist.
- Memory pressure behavior: pool drops buffers when limits are hit; callers must not assume returned buffers are retained for warm reuse.

## Validation Commands
Run from `M:/K_OS`:

```bash
cargo check -p k-os-gpu-pipeline --all-targets
cargo test -p k-os-gpu-pipeline --test integration_tests
cargo test -p k-os-gpu-pipeline --test property_tests
```

For pipeline-level smoke verification:

```powershell
powershell -ExecutionPolicy Bypass -File M:/Shared/KainKOSBRIDGE/skills/validation-command-pack/run-pack.ps1 -Repo K_OS -Pack smoke
```

## Notes for Future Agents
- Prefer registering shader sources and configuration-driven wiring over adding new hardcoded shader lookup paths.
- Any change to `unsafe` cache reference behavior should be paired with explicit lifetime/invalidation tests.
- Keep the crate facade in `src/lib.rs` stable; downstream crates consume these re-exports broadly.
