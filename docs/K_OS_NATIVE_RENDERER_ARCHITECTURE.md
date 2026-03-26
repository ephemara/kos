# K_OS Native Renderer Architecture

> Status: Proposed architecture document
>
> Purpose: Explain why K_OS should eventually move core DCC viewports from frontend-owned Three/WebGL geometry updates to a renderer-owned Rust/WGPU architecture.

## Executive Summary

K_OS has already made real progress toward a modern engine architecture:

- canonical scene state exists in `k-os-scene`
- evaluation/DAG logic exists in `k-os-eval`
- GPU bridge logic exists in `k-os-gpu-pipeline`
- viewport payloads can now be derived through the evaluator instead of only through ad hoc app-local state

However, the viewport renderer is still fundamentally frontend-owned.

Today, `WebViewport` consumes evaluator-derived mesh payloads, but those payloads are still turned into `THREE.BufferGeometry` and rendered by `THREE.WebGLRenderer` via `StudioStage`.

That means the engine is becoming data-driven, but the renderer still owns the final GPU residency model in the old way.

If K_OS wants true renderer-side GPU ownership, persistent GPU resources, and a real DCC-grade native viewport architecture, the last step is not another engine command refactor. It is a dedicated renderer architecture project.

## Current State

### What K_OS already has

- `k-os-scene`: canonical scene/source state
- `k-os-eval`: dependency graph and lazy evaluation
- `k-os-gpu-pipeline`: buffer pooling, pipeline caching, GPU bridge primitives
- `k-os-animation`: native animation asset boundary
- `k-os-kain`: native KAIN source/runtime boundary
- `zen-mocap-engine`: specialized mocap operator crate

### What the viewport currently does

The current viewport path is:

1. evaluator produces mesh payloads
2. frontend fetches mesh payloads through Tauri
3. frontend creates or updates `THREE.BufferGeometry`
4. `StudioStage` renders with `THREE.WebGLRenderer`

This is a major improvement over purely app-local mutation, but it is still not the final renderer architecture.

### Why this is not true renderer-owned GPU residency

Because the renderer still expects:

- CPU-side arrays in JavaScript
- frontend-side geometry mutation
- frontend-side material object ownership
- frontend-side upload through Three/WebGL abstractions

The backend/evaluator is authoritative for data derivation, but it is not yet authoritative for render resource ownership.

## The Architectural Gap

The gap is this:

- current model: `scene/eval -> payload -> JS geometry -> WebGL renderer`
- target model: `scene/eval -> renderer resource update -> Rust/WGPU renderer`

The target model changes the locus of ownership.

Instead of React/Three creating GPU resources from CPU arrays every time, the renderer itself owns:

- vertex/index buffers
- material bind groups
- uniform/storage buffers
- pipeline objects
- draw packets
- frame graph / render graph state

Frontend/UI still exists, but it becomes a controller and overlay layer rather than the place where core viewport render resources live.

## Why K_OS Should Do This

### 1. Persistent GPU resources

Today, the frontend still rebuilds or mutates geometry objects in a renderer abstraction that was not designed as a native DCC engine core.

A Rust/WGPU renderer can keep:

- mesh buffers resident
- material bindings resident
- draw packets stable across frames
- scene resources keyed by handles instead of object references

That reduces churn and aligns perfectly with the new scene/eval architecture.

### 2. Better scaling for large meshes and heavy workflows

K_OS is not just a painter or model viewer.
It includes:

- sculpting
- retopo
- baking
- animation
- mocap
- simulation

These workloads all benefit when the renderer consumes already-evaluated GPU resources directly instead of forcing a CPU-side JS geometry translation step.

### 3. Cleaner separation of concerns

A native renderer makes the architecture cleaner:

- scene layer owns canonical state
- evaluator owns derivation
- GPU bridge owns transport
- renderer owns draw resources and frame execution
- frontend owns UI, tools, camera intent, overlays

That boundary is much easier to reason about than “React also owns viewport mesh objects.”

### 4. Better path to lazy evaluation

Once the renderer is a real engine subsystem, K_OS can do more intelligent work such as:

- only rebuild visible resources
- only update dirty draw packets
- defer expensive uploads until the viewport requests them
- maintain renderer-local caches separate from scene canonical data

### 5. Better path for future features

This unlocks serious long-term goals:

- multiple synchronized native viewports
- overlay passes and selection passes
- GPU picking
- renderer-owned scene graph
- material preview pipelines
- bake preview passes
- WGPU-native debug overlays
- direct SPIR-V / KAIN integration in the render path

### 6. Frontend simplification

React stays valuable, but its job becomes clearer:

- inspector UI
- property panels
- content browser
- timeline
- HUD
- overlays
- viewport controls

It no longer has to be the last-mile owner of core viewport render resources.

## Feasibility

This is feasible in K_OS because several prerequisites already exist.

### Already present

- `k-os-scene`
- `k-os-eval`
- `k-os-gpu-pipeline`
- `src-tauri` command routing
- optional `crates/k-os-bevy` native rendering experiments
- existing WGPU device abstractions in `k-os-engine`

This means K_OS does **not** need to invent the entire architecture from zero.
It needs to replace the current viewport ownership model with a proper renderer boundary.

### Why it is not trivial

This is still a large project because it changes:

- viewport ownership
- resource lifetime
- camera/input plumbing
- picking/selection plumbing
- overlay composition
- renderer/UI communication

This is not a “change a command and we’re done” kind of task.

## What Would Change

## 1. New renderer subsystem

K_OS would need a dedicated renderer crate or module, likely something like:

- `k-os-renderer`

Responsibilities:

- viewport/surface creation
- render resource allocation
- mesh/material handle registration
- frame execution
- camera application
- selection and picking integration

## 2. New renderer-facing handles

The system would need renderer-level resources such as:

- `ViewportHandle`
- `RenderMeshHandle`
- `RenderMaterialHandle`
- `DrawPacketHandle`
- `SelectionBufferHandle`

These would be distinct from canonical scene handles.

## 3. New command/API boundary

Frontend would no longer say:

- “here is new position data, update this geometry”

Instead it would say:

- create viewport
- attach render mesh
- set camera state
- request selection result
- request viewport stats

That means more intent-based APIs, fewer raw data-based APIs.

## 4. Overlay strategy

K_OS would need a clear overlay plan.

Recommended model:

- native renderer draws scene
- React draws overlays and editor chrome on top

This avoids rewriting all UI while still making the viewport native.

## 5. Camera and input bridging

Current viewport controls are frontend-side.
A native viewport architecture would require a deliberate bridge for:

- orbit/pan/dolly input
- camera sync
- hit tests
- brush cursor location
- selection/gizmo intent

## 6. Selection/picking pipeline

Once rendering is native, picking should eventually become renderer-native too.

That implies:

- ray queries
- selection buffers or ID buffers
- hit results returned to UI

This is a net win, but it is part of the migration surface.

## Recommended Target Architecture

For K_OS, the strongest long-term option is:

- Rust/WGPU renderer for core DCC viewports
- React/Three remains for tooling, preview apps, fallback, and rapid iteration

This means:

- core apps like sculpt, retopo, inspect, baking preview, and maybe animation viewports should eventually run on the native renderer
- some apps can keep Three-based rendering if they are lower-risk, tool-like, or experimental

This is a hybrid architecture, not an absolutist rewrite.

## Proposed Migration Strategy

### Phase A: Renderer boundary definition

Goal:
- define a renderer-facing API without replacing the current viewport yet

Deliverables:

- renderer handle types
- viewport command API
- camera state API
- mesh attachment API
- selection result API

### Phase B: Single native viewport pilot

Goal:
- migrate one viewport path fully

Best candidate:
- KSculpt viewport

Why:

- highest ROI
- already deeply tied to mesh updates, raycast, sculpt state, and GPU compute
- best place to prove the architecture

### Phase C: Scene/eval -> renderer integration

Goal:
- feed evaluated mesh/material data directly into renderer-owned resources

Deliverables:

- renderer resource registry keyed by scene handles
- evaluator-produced resource updates
- GPU bridge writes into renderer-owned buffers

### Phase D: Overlay/UI integration

Goal:
- keep existing React shell while viewport becomes native

Deliverables:

- brush cursor overlay
- selection/gizmo overlay
- perf/debug overlay
- viewport frame stats

### Phase E: Expand to other DCC viewports

Likely order:

1. KSculpt
2. KRetopo
3. KInspect
4. Bake preview / material preview

## What Should Not Change

Even with a native renderer, these should remain:

- React shell and editor chrome
- content browser
- property inspectors
- timeline panels
- command palette
- plugin UI and extension system
- fallback/rapid-prototyping Three paths where appropriate

This is not a rejection of React.
It is a relocation of viewport resource ownership.

## Risks

### 1. Half-native, half-legacy confusion

If the renderer boundary is unclear, K_OS could end up with:

- scene state in Rust
- evaluation in Rust
- some resources in Rust
- some geometry still authoritative in JS

That would be worse than either model alone.

Mitigation:

- define ownership explicitly before migration

### 2. Too much renderer work too early

If everything is migrated at once, the suite will destabilize.

Mitigation:

- migrate one core viewport first

### 3. Overcoupling frontend UI to renderer internals

Mitigation:

- frontend should talk to renderer through stable viewport/selection/camera APIs
- not through direct resource implementation details

## Decision Summary

K_OS should do this eventually because:

- it aligns with the new scene/eval/bridge architecture
- it scales better for real DCC workloads
- it makes GPU resource ownership coherent
- it reduces JS-side viewport churn
- it gives K_OS a serious path to native-class viewport performance

But it should be treated as:

- a renderer architecture project
- not a small engine patch

## Recommendation

Do this next only after one more layer of engine consolidation:

- continue reducing legacy sculpt ownership
- keep KAIN/backend ownership moving into crates
- then define `k-os-renderer` and migrate KSculpt viewport first

That is the safest path to a true renderer-owned GPU residency model in K_OS.
