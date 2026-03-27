# Zen Renderer Validation Matrix

> Purpose: define the smallest believable proof set for the Zen renderer cutover while the runtime remains hybrid.
> 
> Audience: Aegis, Sovereign, Delta, and future operators who need to validate the transition without broad test suites.

## Scope

This is not a general test plan. It is the operator validation matrix for the current renderer migration state.

Use it to decide whether the shared renderer path is stable enough to keep advancing, and whether the duplicate Zen-local renderer path is safe to delete later.

## Minimum Proof Set

1. `ZenRendererSession::sync_scene()` routes payloads through `k-os-scene-runtime::sync_shared_mesh_for_source()` and then `evaluate_viewport_payload()`.
2. Mirrored mesh info reports the same shading mode that Zen asked for before the handoff.
3. `RendererService` receives mesh sync and redraw requests after the scene mirror step.
4. Selection requests still return the raw scene mesh handle path used by Zen scene ownership.
5. The host-local presentation seam remains only a presentation seam, not a second source of draw truth.

## Invariants

### Payload correctness

- Positions, normals, and indices must survive the Zen scene bridge into scene-runtime before renderer sync.
- The evaluated viewport payload is the canonical payload source, not any host-local draw builder.

### Mesh counts

- `status_suffix()` should reflect renderer-side vertex and face counts that remain consistent with the mirrored scene mesh.
- `scene_geometry()` may remain present during the hybrid phase, but it should only represent the presentation seam.

### Selection routing

- `request_selection()` should continue to flow through `RendererService`.
- Selection results must still map back to the original scene mesh handle, not a renderer-private handle.

### Redraw behavior

- Every successful scene sync should end in a redraw request on the active viewport.
- A missing redraw request is a cutover regression even if payload sync succeeded.

### Runtime stats

- The renderer stats surface should remain readable during the migration.
- Sync latency and selection latency are the two metrics most likely to reveal hidden ownership drift.

### Shading-mode preservation

- The mirrored scene-runtime mesh must preserve Zen viewport state.
- `ShadingMode::Wireframe`, `ShadingMode::Matcap`, and `ShadingMode::Xray` must not collapse to the scene-runtime default during the mirror step.

## Regression Zones

- Normals: stale or partial normals remain the most likely visual failure mode after the mirror/eval split.
- Post-processing handoff: anything that still depends on a local viewport texture needs extra scrutiny.
- Threaded renderer service behavior: viewport creation, sync, and detach must stay consistent across the service boundary.
- Viewport texture presentation: the egui seam is still host-owned and can regress independently of renderer correctness.

## Proof Hooks

- [`M:\\K_OS\\crates\\k-os-scene-runtime\\src\\mesh_state.rs`](M:/K_OS/crates/k-os-scene-runtime/src/mesh_state.rs) now exposes `SharedMeshInfo.shading_mode` alongside bridge counts.
- [`M:\\K_OS\\crates\\zen\\src\\renderer_session.rs`](M:/K_OS/crates/zen/src/renderer_session.rs) remains the authoritative cutover boundary for scene sync, redraw, camera, and selection.
- [`M:\\K_OS\\crates\\zen-scene\\src\\lib.rs`](M:/K_OS/crates/zen-scene/src/lib.rs) remains the host-side scene extraction layer, but not the canonical payload builder.
- [`M:\\K_OS\\crates\\k-os-scene-runtime\\src\\mesh_state.rs`](M:/K_OS/crates/k-os-scene-runtime/src/mesh_state.rs) remains the canonical viewport payload evaluation path.

## Rollout Gate

Do not delete the duplicate Zen-local renderer path until all of these are true:

- representative meshes preserve shading mode through the mirror/eval path
- selection still resolves to the original scene handle
- redraw requests fire after sync
- runtime stats stay coherent with the active viewport
- the presentation seam can be explained as presentation-only in the operator guide

If any of those drift, keep the hybrid seam and fix the mirror contract before advancing cleanup.
