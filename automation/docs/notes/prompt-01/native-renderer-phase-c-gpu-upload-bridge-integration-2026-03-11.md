# Prompt 01 - Native Renderer Completion Sweep

Date: 2026-03-11
Focus: Phase C tranche (Task 17.2 + 17.3 GPU upload bridge integration)

## Why this slice

The prior Phase C baseline established evaluated mesh source contracts and dirty-sync entry points, but renderer service still used payload-only synchronization. This pass completes the next architecture step by wiring a concrete `k-os-gpu-pipeline` upload bridge into the live dirty-mesh sync path.

## Implemented changes

1. Implemented concrete renderer upload bridge backed by `k-os-gpu-pipeline`.
- `crates/k-os-renderer/src/bridge.rs`
  - added `PipelineRendererUploadBridge`
  - provisions internal `GPUPipelineManager`
  - uses `GpuMeshBridge` to:
    - build upload plans from evaluated payloads
    - allocate/reuse GPU buffers keyed by `RenderMeshHandle`
    - upload position/normal/index bytes
  - reports upload-byte totals back into renderer mesh runtime telemetry

2. Extended renderer mesh/runtime telemetry model.
- `crates/k-os-renderer/src/mesh.rs`
  - added `gpu_upload_bytes` on `RenderMeshRuntime`
- `crates/k-os-renderer/src/lib.rs`
  - added `gpu_device_queue()` GPU-handle accessor
  - added `set_render_mesh_upload_bytes(...)`
  - includes runtime upload-byte accounting in `viewport_mesh_totals(...)`

3. Integrated upload bridge into renderer service thread.
- `crates/k-os-renderer/src/service.rs`
  - added `spawn_headless_service_with_source_and_bridge(...)`
  - service loop now auto-provisions `PipelineRendererUploadBridge` when:
    - an `EvaluatedMeshSource` exists and
    - renderer GPU device/queue are available
  - dirty mesh sync before redraw now prefers bridge `sync_mesh(...)`
  - `SyncMeshFromSource` command now routes through bridge when available
  - headless/source-only fallback path remains intact

4. Added renderer dependency on GPU ownership crate.
- `crates/k-os-renderer/Cargo.toml`
  - added `k-os-gpu-pipeline` workspace dependency

5. Updated migration/progress documentation.
- `.kiro/specs/native-renderer-migration/tasks.md`
  - marked `17`, `17.2`, and `17.3` complete with implementation status notes
- `docs/NATIVE_RENDERER_PROGRESS.md`
  - added "Phase C GPU upload bridge integration" status section

## Architecture impact

- Moves mesh upload ownership toward the intended boundary:
  - `k-os-gpu-pipeline` owns GPU allocation/upload plumbing
  - `k-os-renderer` owns viewport/session orchestration and bridge contracts
- Reduces risk of renderer-side duplicated GPU infrastructure.
- Keeps source-only sync available for non-GPU/headless contexts.

## Verification

Commands executed:
- `cargo check -p k-os-renderer` -> pass
- `cargo test -p k-os-renderer service::tests::syncs_payload_and_supports_selection -- --nocapture` -> pass
- `cargo check -p k-os-backend` -> pass (existing DIRECTORY.md coverage warnings only)
- `npx tsc --noEmit --pretty false` -> pass

## Follow-up candidates

1. Start Task 18.1 by promoting renderer bridge buffer reuse policy into a shared update strategy (allocation thresholds and explicit resize telemetry).
2. Implement Task 18.2 partial buffer uploads using staging strategy in `k-os-gpu-pipeline`.
3. Continue Task 19.2 propagation for multi-viewport shared scene meshes.
