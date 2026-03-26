# Prompt 01 - Native Renderer Completion Sweep

Date: 2026-03-11
Focus: Phase C tranche (Task 18.1 buffer-pool resize policy integration)

## Why this slice

Task 17 established a GPU-backed upload bridge, but allocation behavior was still exact-fit and embedded in renderer-side checks. This pass hardens Task 18.1 by moving sizing intent into an explicit bridge policy and pipeline-owned sizing contract.

## Implemented changes

1. Added explicit mesh buffer sizing contract in `k-os-gpu-pipeline`.
- `crates/k-os-gpu-pipeline/src/mesh_bridge.rs`
  - introduced `GpuMeshBufferSizing`.
  - added `GpuMeshBridge::allocate_buffers_with_sizing(...)` for explicit capacity requests.
  - kept `allocate_buffers(...)` as a compatibility wrapper.
- `crates/k-os-gpu-pipeline/src/lib.rs`
  - exports `GpuMeshBufferSizing` in the crate public surface.

2. Implemented growth-with-headroom buffer capacity policy in renderer bridge.
- `crates/k-os-renderer/src/bridge.rs`
  - added `next_buffer_capacity(required, current)` policy helper.
  - policy behavior:
    - reuse existing buffer when already large enough.
    - allocate with headroom for first allocation.
    - grow beyond immediate required bytes when existing capacity is too small.
  - `PipelineRendererUploadBridge` now computes explicit per-buffer capacities and allocates through `GpuMeshBufferSizing`.

3. Added policy-focused tests.
- `crates/k-os-renderer/src/bridge.rs`
  - validates reuse when capacity suffices.
  - validates headroom on first allocation.
  - validates growth behavior on undersized buffers.

4. Updated migration/progress docs.
- `.kiro/specs/native-renderer-migration/tasks.md`
  - marked `18.1` complete with implementation status note.
- `docs/NATIVE_RENDERER_PROGRESS.md`
  - added "Phase C buffer-pool resize policy integration" section.

## Architecture impact

- Keeps GPU resource ownership in `k-os-gpu-pipeline` while allowing `k-os-renderer` to control sync strategy via typed sizing input.
- Reduces allocator churn risk from repeated mesh growth events by avoiding exact-fit reallocations.
- Preserves compatibility behavior and avoids engine-local GPU ownership expansion.

## Verification

Commands executed:
- `cargo check -p k-os-gpu-pipeline` -> pass
- `cargo check -p k-os-renderer` -> pass
- `cargo test -p k-os-renderer bridge::tests -- --nocapture` -> pass

## Follow-up candidates

1. Implement Task 18.2 partial buffer updates with staging-based range uploads.
2. Implement Task 18.3 failure-mode policy to preserve prior valid GPU buffers on evaluator errors.
3. Continue Task 19.2 update propagation for shared scene meshes across multiple viewports.
