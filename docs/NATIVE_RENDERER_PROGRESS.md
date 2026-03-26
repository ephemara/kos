# Native Renderer Progress

## Purpose

This document explains the current native renderer migration state in concrete terms:

- what has already been implemented
- what is genuinely native today
- what still depends on Three.js as transitional backing state
- what the next architecture moves should be

This is intended as a working handoff and alignment document for multiple agents.

## Executive Summary

K_OS is no longer in a purely Three.js-owned viewport architecture.

The suite now has a real native viewport boundary built around:

- `k-os-renderer` for viewport handles, camera state, redraw requests, stats, and selection contracts
- `src-tauri/src/commands/viewport.rs` for the Tauri command surface
- `src-tauri/src/viewport_host.rs` for native host transport
- `crates/k-os-bevy` as the current WGPU-native viewport host implementation
- `src-frontend/features/viewport/NativeViewport.tsx` as the shared React controller for native viewports

The migration is currently in a hybrid state:

- React/Tauri still own shell UI, panels, and editor chrome
- Bevy/WGPU currently owns actual native viewport presentation
- `k-os-renderer` owns the suite-level viewport/session contract
- several apps are already on the shared native host boundary
- Three.js still exists in some apps as transitional backing state

This is the correct direction. The remaining work is mostly about removing transitional hidden Three ownership, not rethinking the architecture again.

## What Has Been Implemented

### 1. Shared native viewport contract

The following core renderer/service pieces exist:

- `crates/k-os-renderer`
  - viewport handles
  - render mesh handles
  - camera validation
  - redraw request API
  - stats query API
  - CPU picking cache keyed by evaluated mesh payloads
  - renderer service thread

Primary files:

- [crates/k-os-renderer/src/lib.rs](/abs/path-placeholder)
- [crates/k-os-renderer/src/service.rs](/abs/path-placeholder)
- [crates/k-os-renderer/src/picking.rs](/abs/path-placeholder)
- [crates/k-os-renderer/src/types.rs](/abs/path-placeholder)

Validation:

- `cargo test -p k-os-renderer` passes

### 2. Tauri viewport command surface

Viewport commands now exist for:

- create/dispose viewport
- attach/detach mesh
- set camera
- request redraw
- request selection
- get stats
- sync sculpt mesh payload
- sync primitive for native fallback
- send native host input relay events

Primary file:

- [src-tauri/src/commands/viewport.rs](/abs/path-placeholder)

### 3. Native host adapter

The native host adapter exists and now transports:

- viewport payload paths
- primitive load messages
- cursor updates
- camera rotate updates
- camera zoom updates
- brush stroke relay
- snapshot relay

Primary file:

- [src-tauri/src/viewport_host.rs](/abs/path-placeholder)

### 4. Bevy native host path

The current actual native viewport presentation path is Bevy/WGPU via the leash architecture.

Important points:

- this is now the real native surface path
- `native-viewport.html` is no longer the important presentation mechanism
- Bevy receives direct viewport payloads and native host interaction events

Primary files:

- [crates/k-os-bevy/src/main.rs](/abs/path-placeholder)
- [crates/k-os-bevy/src/leash.rs](/abs/path-placeholder)

### 5. Shared React controller

`NativeViewport.tsx` is now the shared native viewport controller for the suite.

It currently handles:

- viewport session lifecycle
- native host tethering through `BevyTether`
- camera input
- selection requests
- pointer/NDC event emission
- optional native host cursor/camera relay
- stats display
- generic sync source consumption

Primary file:

- [src-frontend/features/viewport/NativeViewport.tsx](/abs/path-placeholder)

### 6. Data-driven sync source layer

Native viewport sync now uses a data-driven source contract instead of app-specific hardcoded paths.

Supported sync source kinds:

- `none`
- `sculpt-handle`
- `primitive`
- `artifact-path`
- `artifact-blob`

Primary file:

- [src-frontend/services/nativeViewportBridge.ts](/abs/path-placeholder)

This is important because it makes the native host path reusable across the suite instead of KSculpt-specific.

### 7. Native overlay coordinate contract (2026-03-11)

`NativeViewport` now uses a shared overlay coordinate contract for:

- window/client -> local overlay conversion
- local overlay -> NDC conversion
- NDC -> local overlay conversion
- live overlay bounds tracking for resize/scroll/DPI changes

The shared contract currently drives:

- brush cursor overlay placement
- gizmo SVG viewbox sizing
- HUD anchoring relative to viewport bounds

Primary files:

- [src-frontend/features/viewport/overlayCoordinates.ts](/abs/path-placeholder)
- [src-frontend/features/viewport/NativeViewport.tsx](/abs/path-placeholder)

### 8. Phase C evaluated-mesh bridge baseline (2026-03-11)

`k-os-renderer` now has an explicit evaluated-mesh bridge contract for scene/eval-driven mesh sync:

- `EvaluatedMeshSource` trait in `k-os-renderer` defines viewport payload fetch by `MeshHandle`
- renderer service startup can now receive a concrete evaluated mesh source
- Tauri viewport commands now expose generic scene-mesh sync and dirty-mark hooks (`viewport_sync_scene_mesh`, `viewport_mark_mesh_dirty`)
- native sync source contract now includes `scene-mesh` in frontend bridge typing

Primary files:

- [crates/k-os-renderer/src/bridge.rs](/abs/path-placeholder)
- [crates/k-os-renderer/src/service.rs](/abs/path-placeholder)
- [src-tauri/src/commands/viewport.rs](/abs/path-placeholder)
- [src-frontend/services/nativeViewportBridge.ts](/abs/path-placeholder)

### 9. Phase C GPU upload bridge integration (2026-03-11)

`k-os-renderer` now includes a concrete GPU-backed upload bridge path that consumes `k-os-gpu-pipeline` instead of leaving bridge sync as a payload-only contract:

- `PipelineRendererUploadBridge` now provisions `GPUPipelineManager` with renderer GPU handles
- evaluated payloads are converted via `GpuMeshBridge::plan_from_viewport_payload(...)`
- GPU buffers are allocated and reused per `RenderMeshHandle`, with reallocation only when needed
- dirty mesh sync in service thread now prefers bridge sync and performs upload before redraw
- source-only sync path remains available as a headless fallback when GPU handles are unavailable
- renderer mesh runtime now tracks upload-byte telemetry per mesh for frame stats aggregation

Primary files:

- [crates/k-os-renderer/src/bridge.rs](/abs/path-placeholder)
- [crates/k-os-renderer/src/service.rs](/abs/path-placeholder)
- [crates/k-os-renderer/src/lib.rs](/abs/path-placeholder)
- [crates/k-os-gpu-pipeline/src/mesh_bridge.rs](/abs/path-placeholder)

### 10. Phase C buffer-pool resize policy integration (2026-03-11)

Task 18.1 now has a concrete buffer sizing policy integrated across `k-os-renderer` and `k-os-gpu-pipeline`:

- renderer bridge now requests explicit GPU buffer capacities through `GpuMeshBufferSizing`
- sizing uses growth-with-headroom policy rather than exact-fit allocations
- existing GPU buffers are reused when capacity remains sufficient
- buffer reallocation happens only when required mesh payload size exceeds current capacity
- upload path still uses `k-os-gpu-pipeline` pool/manager ownership and does not reintroduce renderer-local GPU allocation code

Primary files:

- [crates/k-os-renderer/src/bridge.rs](/abs/path-placeholder)
- [crates/k-os-gpu-pipeline/src/mesh_bridge.rs](/abs/path-placeholder)

### 11. Phase C partial mesh buffer updates via staging ranges (2026-03-11)

Task 18.2 now has a concrete partial update path integrated across `k-os-renderer` and `k-os-gpu-pipeline`:

- `GpuMeshBridge` now computes byte-range deltas between previous and current mesh payloads per buffer stream (positions, normals, indices)
- unchanged streams skip upload entirely for that sync
- changed streams upload only the changed byte ranges instead of full-buffer rewrites
- uploads now use explicit staging-buffer copy commands through `GPUPipelineManager::upload_bytes_with_staging(...)`
- `PipelineRendererUploadBridge` caches prior upload plans per `RenderMeshHandle` so range diffing persists across redraw cycles
- renderer mesh telemetry now records actual uploaded bytes from the partial update result

Primary files:

- [crates/k-os-gpu-pipeline/src/mesh_bridge.rs](/abs/path-placeholder)
- [crates/k-os-gpu-pipeline/src/lib.rs](/abs/path-placeholder)
- [crates/k-os-renderer/src/bridge.rs](/abs/path-placeholder)

### 12. Phase C evaluation-failure redraw resilience (2026-03-11)

Task 18.3 now has explicit failure-path behavior in renderer service sync orchestration:

- redraw-path mesh sync failures from evaluated sources are treated as soft failures
- last valid renderer/GPU state is preserved when sync fails
- failed meshes stay dirty for retry on subsequent redraws
- service emits structured sync error logs with viewport/mesh context
- explicit `SyncMeshFromSource` command calls still return hard errors to callers, but now include structured logging context

Primary files:

- [crates/k-os-renderer/src/service.rs](/abs/path-placeholder)

### 13. Phase C multi-viewport shared mesh propagation (2026-03-11)

Task 19 now has concrete shared-mesh propagation behavior in `k-os-renderer`:

- `scene_to_render` now acts as an explicit shared render-mesh registry with cleanup on viewport dispose and render-mesh detach.
- shared scene payload sync now fans out version/count state updates to every associated `RenderMeshHandle` (not only the initiating viewport instance).
- per-scene sync now avoids multi-viewport stale metadata drift during dirty mesh updates.
- service redraw now executes all pending redraw-requested viewports in a single command pass, so shared dirty meshes trigger redraw across all attached viewport sessions.
- dirty mesh sync remains keyed by scene mesh handle, preserving single-sync semantics for shared meshes while still updating all viewport-facing render instances.

Primary files:

- [crates/k-os-renderer/src/lib.rs](/abs/path-placeholder)
- [crates/k-os-renderer/src/service.rs](/abs/path-placeholder)

### 14. Phase D telemetry expansion baseline (2026-03-12)

Task 22.1 now has concrete telemetry coverage in the renderer runtime contract:

- `FrameStats` now exposes `mesh_sync_time_ms`, `selection_latency_ms`, and `gpu_memory_bytes` in addition to frame/draw/upload counters.
- `RequestRedraw` now records per-command mesh sync time across dirty-mesh bridge/source synchronization before redraw execution.
- `RequestSelection` now tracks per-viewport selection latency with exponential smoothing to reduce single-sample jitter.
- `current_frame_stats(...)` now reports resident GPU memory estimates from attached mesh geometry totals (`vertex_count`/`index_count` sizing), instead of only upload traffic.
- Native viewport diagnostics HUD now surfaces the expanded telemetry fields so runtime behavior is inspectable without external tracing.

Primary files:

- [crates/k-os-renderer/src/types.rs](/abs/path-placeholder)
- [crates/k-os-renderer/src/lib.rs](/abs/path-placeholder)
- [crates/k-os-renderer/src/service.rs](/abs/path-placeholder)
- [src-frontend/services/viewportClient.ts](/abs/path-placeholder)
- [src-frontend/features/viewport/NativeViewport.tsx](/abs/path-placeholder)

## Which Apps Are On The Native Boundary

### KSculpt

Current state:

- deepest native integration in the suite
- native viewport feature flag exists
- native camera control exists
- native selection exists
- native brush start/move/end path exists
- direct sculpt payload sync exists
- hidden `StudioStage` is reduced

Still transitional:

- hidden Three mesh/state ownership still exists
- some sculpt-state lifecycle is still backed by `sceneRef.current.meshes`
- native mode is not yet fully independent from the old mesh carrier

### KInspect

Current state:

- native mode feature flag exists
- native presentation on shared host boundary exists
- artifact sync uses shared sync source contract

Still transitional:

- native mode is presentation-first, not full native inspect semantics

### KRetopo

Current state:

- native mode feature flag exists
- native presentation on shared host boundary exists
- artifact sync uses shared sync source contract

Still transitional:

- retopo tool interaction is still legacy/Three-owned

### KPainter

Current state:

- native mode feature flag exists
- native presentation on shared host boundary exists
- primitive/artifact sync source wiring exists
- native input now provides pointer events and brush relay

Still transitional:

- paint execution is still driven by the legacy paint engine
- native host receives stroke intent, but native paint-state ownership is not complete
- hidden canvas still exists as a state carrier

### KAutoPBR

Current state:

- native mode feature flag exists
- native presentation on shared host boundary exists
- artifact sync exists
- primitive fallback sync exists
- native camera relay exists
- more of the old preview loop is skipped in native mode

Still transitional:

- some preview/material state still lives in the old Three-based path for legacy mode and shared state continuity

## What Still Depends On Three.js

Three.js is still present in these roles:

### Transitional backing state

Especially in:

- KSculpt
- KPainter

These apps still use hidden Three-side scene/mesh state as a carrier while native presentation and interaction are being extracted.

### Legacy fallback mode

Apps still support fallback/legacy operation when native mode is off.

That is intentional and should remain until native paths are stable.

### Some preview/material state

Especially in:

- KAutoPBR
- KPainter

These still have old preview/material update code paths that remain valid in legacy mode.

## Architectural Assessment

This is the correct architecture direction.

Why:

1. The suite is moving viewport ownership out of the frontend.
2. The sync boundary is becoming shared and data-driven.
3. React is staying where it is strongest: shell UI and plugin-facing editor UX.
4. Native rendering is moving where it belongs: viewport host and renderer layers.

What would be wrong:

- trying to delete Three.js all at once
- replacing React/Tauri immediately with egui-only shell
- letting every app invent its own native sync path

What is happening instead:

- shared contract first
- host boundary second
- app migration third
- hidden backing-state removal last

That is the right order.

## Remaining Architecture Problems

### 1. KSculpt still uses hidden Three-backed state in native mode

This is the biggest remaining architectural debt.

The viewport is increasingly native, but the backing mesh/state carrier is not fully native yet.

### 2. KPainter has native input but not native paint-state ownership

This is good progress, but still transitional.

The next jump is not another UI change. It is moving more paint-state/control ownership into the native path.

### 3. KAutoPBR still has some legacy preview ownership

Native mode now avoids more of the old preview loop, but not all preview/material state is native-owned yet.

### 4. Bevy is currently the concrete native host, not yet a fully separate `k-os-renderer`-owned presentation runtime

This is acceptable right now.

But long-term:

- `k-os-renderer` should remain the stable renderer contract
- Bevy should be treated as host/runtime implementation, not the architecture itself

## Recommended Next Roadmap

### Priority 1: Finish KSculpt native state extraction and nuke threejs (THREEJS MUST GO GET IT OUTTA HERE)

Goal:

- make KSculpt native mode stop using hidden Three as the backing mesh/state carrier

Recommended moves:

1. introduce a native sculpt-state carrier that mirrors or replaces `sceneRef.current.meshes`
2. stop creating/maintaining hidden sculpt meshes in native mode where possible
3. route more sculpt lifecycle through Rust/native state instead of Three-owned scene state

### Priority 2: Push KPainter into native paint-state ownership (NUKE THREEJS)

Goal:

- move from native input relay to more native execution ownership

Recommended moves:

1. define a native paint-state sync contract, not just sync source contract
2. move active stroke/channel/layer state handoff into a shared native interface
3. reduce reliance on hidden canvas and old engine state in native mode

### Priority 3: Tighten KAutoPBR native state 

Goal:

- make native mode less dependent on old preview/material state

Recommended moves:

1. move primitive fallback selection fully into native sync semantics
2. reduce old `meshRef/current` preview assumptions in native mode
3. keep legacy path intact, but isolate it more cleanly

### Priority 4: Create a suite-wide native app migration playbook

Goal:

- stop doing migrations ad hoc

Recommended content:

1. app requirements for native migration
2. required sync source type
3. whether app needs:
   - camera relay
   - cursor relay
   - brush relay
   - state sync
4. what legacy ownership must be removed before calling the app “native-complete”

## Suggested Immediate Work Split

If multiple agents continue:

### Agent A

- KSculpt backing-state reduction

### Agent B

- KPainter native paint-state contract

### Agent C

- KAutoPBR native preview/material cleanup

### Agent D

- docs and migration playbook updates

## Bottom Line

The migration is real.

It is no longer a mock architecture.

The suite now has:

- a shared native viewport controller
- a shared sync-source model
- a native host implementation
- multiple apps on the same host boundary

The remaining work is not “should we do this?”

The remaining work is:

- remove transitional Three-backed state ownership app by app
- standardize native app-state contracts
- keep the architecture shared across the suite
