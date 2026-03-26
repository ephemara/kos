# Prompt 01 - Native Renderer Completion Sweep

Date: 2026-03-11
Focus: Phase C tranche (Task 18.2 partial mesh buffer updates)

## Why this slice

Task 18.1 solved allocation growth policy, but mesh uploads still rewrote full buffers on every sync. This pass implemented a range-aware upload path so unchanged buffer spans are skipped and changed spans use explicit staging-copy uploads.

## Implemented changes

1. Added partial upload planning in `k-os-gpu-pipeline`.
- `crates/k-os-gpu-pipeline/src/mesh_bridge.rs`
  - introduced `GpuUploadRange` and `GpuMeshPartialUploadPlan`.
  - added `GpuMeshBridge::build_partial_upload_plan(...)`.
  - added `GpuMeshBridge::upload_partial_plan(...)`.
  - added deterministic range-diff tests for identical/full/middle-range update cases.

2. Added explicit staging-copy upload API in GPU manager.
- `crates/k-os-gpu-pipeline/src/lib.rs`
  - added `GPUPipelineManager::upload_bytes_with_staging(...)`.
  - implementation creates a COPY_SRC staging buffer and issues `copy_buffer_to_buffer` into destination GPU buffers.

3. Wired renderer bridge to use partial updates across redraw cycles.
- `crates/k-os-renderer/src/bridge.rs`
  - `PipelineRendererUploadBridge` now caches last upload plans per `RenderMeshHandle`.
  - on sync, bridge computes partial update ranges against previous payload bytes.
  - uploads only changed ranges through staging-copy path.
  - records actual uploaded bytes from partial updates into renderer telemetry.

4. Updated migration/progress tracking.
- `.kiro/specs/native-renderer-migration/tasks.md`
  - marked `18.2` complete with concrete implementation status note.
- `docs/NATIVE_RENDERER_PROGRESS.md`
  - added new section for Task 18.2 partial range uploads.

## Architecture impact

- Keeps shared GPU ownership in `k-os-gpu-pipeline`; `k-os-renderer` remains a policy/contract consumer.
- Reduces redundant upload traffic on dirty meshes with localized changes.
- Preserves existing allocation/reuse contract from Task 18.1 while adding finer-grained sync behavior.

## Verification

Commands executed:
- `cargo check -p k-os-gpu-pipeline` -> pass
- `cargo check -p k-os-renderer` -> pass
- `cargo test -p k-os-gpu-pipeline mesh_bridge::tests -- --nocapture` -> pass (4/4)
- `cargo test -p k-os-renderer bridge::tests -- --nocapture` -> pass (3/3)

## Follow-up candidates

1. Implement Task 18.3 evaluation-failure handling to preserve last valid GPU state on sync errors.
2. Continue Task 19.2 for multi-viewport dirty propagation and shared upload fan-out.
3. Add mesh-sync telemetry breakdown for partial-vs-full upload bytes in Task 22 instrumentation.
