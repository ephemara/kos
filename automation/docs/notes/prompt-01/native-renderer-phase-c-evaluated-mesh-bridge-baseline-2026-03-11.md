# Prompt 01 - Native Renderer Completion Sweep

Date: 2026-03-11
Focus: Phase C vertical slice (scene/eval -> renderer auto-sync baseline)

## Why this slice

Phase B overlay alignment is complete. The next architecture bottleneck was missing bridge contracts between evaluated scene meshes and renderer sync pathways. Native sync was still primarily sculpt-handle oriented at Tauri command level.

This pass establishes a shared evaluated-mesh bridge baseline and extends command surfaces to support generic scene-mesh synchronization.

## Implemented changes

1. Added renderer bridge contracts in `k-os-renderer`.
- Created `crates/k-os-renderer/src/bridge.rs` with:
  - `EvaluatedMeshSource` trait
  - `RendererUploadBridge` trait
  - `BridgeError` error model
  - shared helper `sync_mesh_from_source(...)`

2. Extended renderer core for dirty mesh orchestration.
- `crates/k-os-renderer/src/lib.rs` now exposes:
  - `attached_meshes(viewport)` for service-level sync orchestration
  - `mark_mesh_dirty(mesh)` to flag mesh/viewports for redraw
  - `sync_mesh_from_source(viewport, mesh, source)`

3. Extended renderer service thread with source-backed sync commands.
- `crates/k-os-renderer/src/service.rs`:
  - supports `spawn_headless_service_with_source(...)`
  - tracks `dirty_meshes` in service loop
  - auto-attempts source-backed mesh sync during redraw for dirty attached meshes
  - adds commands:
    - `SyncMeshFromSource`
    - `MarkMeshDirty`

4. Wired Tauri viewport command boundary to scene runtime evaluator source.
- `src-tauri/src/commands/viewport.rs`:
  - registers a `SceneRuntimeMeshSource` implementing `EvaluatedMeshSource`
  - initializes renderer service via `spawn_headless_service_with_source`
  - adds commands:
    - `viewport_sync_scene_mesh(viewport, mesh)`
    - `viewport_mark_mesh_dirty(mesh)`

5. Extended frontend data-driven sync source contract.
- `src-frontend/services/nativeViewportBridge.ts`:
  - added `scene-mesh` source kind
- `src-frontend/services/viewportClient.ts`:
  - added `syncSceneMesh(...)`
  - added `markMeshDirty(...)`

6. Updated migration/progress docs.
- Checked off task `17.1` in `.kiro/specs/native-renderer-migration/tasks.md` with status note.
- Added Phase C bridge baseline section in `docs/NATIVE_RENDERER_PROGRESS.md`.

## Architecture impact

- Moves sync ownership from app-specific sculpt-centric command assumptions toward a reusable scene/eval contract.
- Creates a stable contract point for later Task 17.2/17.3 and Task 19 multi-viewport propagation.
- Preserves current architecture boundaries:
  - React/Tauri shell unchanged
  - renderer remains contract owner
  - scene/eval remains payload source owner

## Verification

Commands executed:
- `cargo check -p k-os-renderer` -> pass
- `cargo check -p k-os-backend` -> pass
- `npx tsc --noEmit --pretty false` -> pass
- `cargo test -p k-os-renderer service::tests::syncs_payload_and_supports_selection -- --nocapture` -> pass

Notes:
- `cargo check -p k-os-backend` emitted existing repo warnings from the build script about undocumented files in `DIRECTORY.md`; no new failures introduced by this pass.

## Remaining follow-up for Prompt 01 Phase C

1. Implement concrete `RendererUploadBridge` backed by `k-os-gpu-pipeline` (Task 17.2).
2. Integrate per-frame dirty sync and upload telemetry into renderer service thread (Task 17.3 / Task 22 overlap).
3. Expand dirty propagation across all viewports sharing a scene mesh (Task 19.2).
