# Prompt 01 - Native Renderer Completion Sweep

Date: 2026-03-11
Focus: Phase C tranche (Task 19 multi-viewport mesh sharing and redraw propagation)

## Why this slice

Phase C Task 18 established source/bridge sync and resilient failure handling, but shared scene meshes still had viewport-local redraw execution and metadata drift risk. This pass makes shared mesh propagation explicit and consistent across all attached native viewports.

## Implemented changes

1. Hardened shared render-mesh registry lifecycle ownership.
- `crates/k-os-renderer/src/lib.rs`
  - cleaned `scene_to_render` entries on viewport disposal and render-mesh detachment.
  - prevents stale registry entries from accumulating as sessions churn.

2. Added payload metadata fan-out across all shared render mesh instances.
- `crates/k-os-renderer/src/lib.rs`
  - `sync_viewport_payload(...)` now propagates payload version and vertex/index metadata to every `RenderMeshHandle` associated with the scene mesh.
  - redraw is requested for every viewport that references the updated scene mesh.

3. Added service-level multi-viewport redraw execution.
- `crates/k-os-renderer/src/service.rs`
  - `RequestRedraw` now executes all currently redraw-requested viewports in one pass.
  - keeps dirty-mesh sync keyed by scene mesh while fanning redraw to all attached viewports.

4. Added regression coverage for shared dirty propagation.
- `crates/k-os-renderer/src/service.rs`
  - new test: `dirty_mesh_redraw_propagates_to_other_viewports`.
  - verifies dirty scene mesh update from one viewport request updates stats/redraw state in another viewport attached to the same mesh.

5. Updated migration/progress tracking.
- `.kiro/specs/native-renderer-migration/tasks.md`
  - marked `19`, `19.1`, `19.2` complete with status notes.
- `docs/NATIVE_RENDERER_PROGRESS.md`
  - added Phase C Task 19 section.

## Architecture impact

- Makes shared scene mesh ownership explicitly multi-viewport at runtime, not just by registry shape.
- Reduces per-viewport sequencing assumptions by letting service redraw fan-out execute pending peers in the same pass.
- Preserves current bridge/source layering without adding renderer logic to `k-os-engine`.

## Verification

Commands executed:
- `cargo check -p k-os-renderer`
- `cargo test -p k-os-renderer service::tests::dirty_mesh_redraw_propagates_to_other_viewports -- --nocapture`
- `cargo test -p k-os-renderer service::tests -- --nocapture`

## Follow-up candidates

1. Execute Task 16 to bind scene/eval invalidation hooks directly into this shared propagation path.
2. Add Task 22.1 mesh-sync timing counters so multi-viewport fan-out cost is measurable.
3. Validate Task 20 checkpoint criteria with a focused multi-viewport integration test matrix.
