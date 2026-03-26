# Requirements Document: Native Renderer Migration

## Introduction

K_OS is migrating core DCC viewport rendering from frontend-owned Three.js/WebGL to a native Rust/WGPU renderer architecture. The renderer will own viewport surfaces, GPU resources, frame execution, and render mesh residency. React remains responsible for shell UI, panels, HUD, and overlays. Three.js remains supported for non-migrated apps and fallback paths.

These requirements intentionally reflect the architecture decisions in the design document:
- native viewport hosting for the pilot
- renderer-owned frame loop
- CPU BVH picking for KSculpt Phase B
- benchmark-based performance targets

## Glossary

- **Renderer**: Native Rust/WGPU subsystem that owns viewport resources and frame execution
- **ViewportHandle**: Stable handle to a native viewport session
- **RenderMeshHandle**: Stable handle to a renderer-owned mesh resource
- **SceneMesh**: Canonical mesh data in `k-os-scene`
- **Evaluator**: `k-os-eval` graph producing derived mesh outputs
- **GPU Bridge**: `k-os-gpu-pipeline` allocation/upload path between evaluated data and renderer resources
- **Native viewport session**: Dedicated native viewport window/surface controlled by React and Tauri
- **Redraw request**: Intent signal telling the renderer a viewport should be refreshed
- **Recommended GPU tier**: The named hardware class used for benchmark targets

## Requirement 1: Native viewport session lifecycle

**User Story:** As a DCC artist, I want native viewports to open quickly and clean up correctly, so that core tools can use high-performance rendering without leaking resources.

### Acceptance Criteria

1. WHEN a core DCC app opens a native viewport, THE system SHALL create a native viewport session and return a `ViewportHandle`
2. WHEN a viewport session is created, THE renderer SHALL own the underlying native surface lifecycle
3. WHEN a viewport session is closed, THE renderer SHALL free associated viewport resources
4. WHEN multiple viewport sessions are opened, THE renderer SHALL support at least 16 concurrent sessions per renderer instance
5. IF viewport creation fails, THEN THE system SHALL return a descriptive error and SHALL NOT leak viewport resources

## Requirement 2: Renderer-owned frame execution

**User Story:** As a developer, I want the native renderer to own frame pacing, so that rendering does not depend on frontend IPC calls every frame.

### Acceptance Criteria

1. THE frontend SHALL NOT be required to call a per-frame render command for native viewports
2. WHEN camera, tool, resize, or dirty-scene changes occur, THE frontend SHALL be able to request redraw through an intent command
3. WHEN a redraw condition exists, THE renderer SHALL schedule and execute the next frame internally
4. WHEN a frame completes, THE renderer SHALL expose frame telemetry through events or a stats query API
5. IF no redraw condition exists, THEN THE renderer MAY remain idle and SHALL NOT spin a wasteful busy loop

## Requirement 3: Mesh attachment and GPU residency

**User Story:** As a DCC artist, I want meshes to stay GPU-resident once attached, so that sculpting and inspection do not rebuild frontend geometry on every update.

### Acceptance Criteria

1. WHEN a mesh is attached by `MeshHandle`, THE renderer SHALL create or reuse a renderer-owned mesh resource and return a `RenderMeshHandle`
2. WHEN a mesh is attached, THE renderer SHALL keep its vertex and index buffers resident until detach, eviction, or viewport disposal
3. WHEN evaluator-derived mesh data changes, THE renderer SHALL update resident GPU resources without requiring frontend `BufferGeometry` recreation
4. WHEN the same scene mesh is attached to multiple viewports, THE renderer SHALL reuse GPU mesh resources where feasible
5. IF GPU memory is exhausted, THEN THE renderer SHALL return an out-of-memory style error and maintain process stability

## Requirement 4: Scene -> eval -> renderer synchronization

**User Story:** As a DCC artist, I want scene edits to appear automatically in native viewports, so that I do not need manual refresh logic in app code.

### Acceptance Criteria

1. WHEN a scene mesh is modified, THE corresponding evaluated mesh path SHALL be marked dirty
2. WHEN a renderer-visible mesh is dirty, THE bridge layer SHALL evaluate the required viewport payload before the next redraw
3. WHEN evaluation completes, THE GPU bridge SHALL upload the evaluated mesh data into renderer-owned resources
4. WHEN one scene mesh is visible in multiple native viewports, THE update SHALL propagate to all attached renderer instances
5. IF evaluation fails, THEN THE renderer SHALL skip applying invalid data and SHALL preserve the last valid GPU state

## Requirement 5: KSculpt pilot picking

**User Story:** As a KSculpt user, I want accurate brush hit testing in the native viewport, so that sculpting behavior matches the current tool semantics.

### Acceptance Criteria

1. Phase B KSculpt picking SHALL use CPU ray/BVH picking against evaluator-derived mesh data
2. WHEN a hover or stroke query is requested, THE system SHALL return the closest valid hit on the sculpt mesh
3. WHEN no geometry is hit, THE system SHALL return a typed no-hit result
4. GPU selection buffer picking SHALL NOT be required for Phase B acceptance
5. IF CPU picking fails, THEN the stroke SHALL NOT apply using stale or invalid hit data

## Requirement 6: Camera control and navigation

**User Story:** As a DCC artist, I want native viewports to respond to camera input immediately and predictably.

### Acceptance Criteria

1. WHEN camera input updates are submitted, THE renderer SHALL apply the new camera state to the next rendered frame
2. THE system SHALL validate camera state before applying it
3. Invalid camera state SHALL be rejected without corrupting the previous valid camera state
4. Camera state SHALL remain isolated per viewport session
5. View-projection updates SHALL NOT require mesh reattachment or viewport recreation

## Requirement 7: React shell and overlay integration

**User Story:** As a DCC artist, I want React UI, HUD, and overlays to continue working while the viewport becomes native.

### Acceptance Criteria

1. WHEN a native viewport session is active, THE React shell SHALL still render panels, HUD, and tool UI
2. WHEN brush or selection overlays are active, THE React shell SHALL render overlay state aligned to the native viewport session
3. WHEN viewport telemetry is available, THE shell SHALL be able to display it in HUD/debug UI
4. WHEN viewport size or position changes, THE shell SHALL receive enough information to keep overlays aligned
5. The pilot SHALL NOT require true DOM-level in-webview embedding of the renderer surface

## Requirement 8: Hybrid renderer strategy

**User Story:** As a developer, I want to migrate only the apps that need native rendering first, so that the rewrite stays incremental.

### Acceptance Criteria

1. Core DCC viewports SHALL be eligible for native rendering
2. Non-migrated apps SHALL be allowed to continue using Three.js
3. A feature flag or app-level configuration SHALL select native vs Three.js renderer mode
4. Native and Three.js paths SHALL coexist without sharing ownership of the same viewport session
5. The migration SHALL allow side-by-side validation during rollout

## Requirement 9: Pilot shading scope

**User Story:** As a developer, I want the pilot scope constrained, so that the first native renderer milestone is achievable.

### Acceptance Criteria

1. Phase B SHALL support `Solid` shading
2. Phase B SHALL support `Wireframe` shading
3. `Matcap` and `Xray` SHALL be deferred beyond the pilot
4. Full material graph integration SHALL NOT be required for Phase B acceptance
5. Texture-heavy material preview SHALL be deferred until after KSculpt pilot stabilization

## Requirement 10: Buffer pool integration

**User Story:** As a developer, I want the renderer to use the existing GPU bridge and pool infrastructure, so that memory policy stays centralized.

### Acceptance Criteria

1. Renderer mesh buffers SHALL be allocated through `k-os-gpu-pipeline` pool/bridge APIs where supported
2. Buffer reuse policy SHALL remain centralized in the GPU bridge layer
3. If the pool cannot satisfy a request, fallback allocation SHALL be explicit and observable
4. Renderer code SHALL NOT invent parallel ad hoc allocation policy for the same mesh data class
5. Memory/usage telemetry SHALL expose enough information to debug pool and renderer residency behavior

## Requirement 11: Tauri command surface

**User Story:** As a frontend developer, I want a stable command API for native viewport control.

### Acceptance Criteria

1. The API SHALL include `viewport_create`
2. The API SHALL include `viewport_attach_mesh`
3. The API SHALL include `viewport_detach_mesh`
4. The API SHALL include `viewport_set_camera`
5. The API SHALL include `viewport_request_redraw`
6. The API SHALL include `viewport_request_selection`
7. The API SHALL include `viewport_get_stats`
8. The API SHALL NOT require a per-frame `viewport_render_frame` command

## Requirement 12: Error handling and recovery

**User Story:** As a DCC artist, I want renderer failures handled without crashing the suite or corrupting scene state.

### Acceptance Criteria

1. IF viewport creation fails, THEN the frontend SHALL receive a descriptive error
2. IF GPU memory is exhausted, THEN the renderer SHALL return an allocation failure and remain stable
3. IF the device is lost, THEN the renderer SHALL enter a recoverable state and mark resources for recreation
4. IF evaluated mesh data is invalid, THEN the renderer SHALL keep the previous valid render state for that mesh
5. IF a selection request fails, THEN the caller SHALL receive a typed error or a typed no-hit result, not undefined data

## Requirement 13: Benchmark-based performance validation

**User Story:** As a project lead, I want measurable performance targets that can actually be tested and compared.

### Acceptance Criteria

1. Every performance target SHALL name the benchmark scene and shading mode
2. Every performance target SHALL name the hardware tier used for validation
3. KSculpt pilot acceptance SHALL include a recommended-GPU benchmark target of 60 FPS median on a 1M triangle sculpt scene in solid mode
4. Heavy-scene acceptance SHALL include a recommended-GPU benchmark target of 30 FPS median on a 10M triangle scene in solid mode
5. Validation SHALL record frame time, draw calls, upload bytes, and selection latency

## Requirement 14: KSculpt pilot completion

**User Story:** As a DCC artist using KSculpt, I want the native viewport pilot to preserve the core sculpt workflow while improving the rendering boundary.

### Acceptance Criteria

1. KSculpt SHALL be able to attach its scene mesh to a native viewport session
2. Brush hover SHALL resolve hit location through the Phase B CPU picking path
3. Brush strokes SHALL dirty the evaluated mesh path and trigger native viewport redraw
4. The native path SHALL be feature-flagged so the legacy Three.js viewport remains available during rollout
5. KSculpt pilot acceptance SHALL require workflow parity for core orbit/pan/zoom/brush feedback, not full visual parity with every advanced material/view mode

## Requirement 15: Expansion criteria for later viewports

**User Story:** As a project manager, I want clear go/no-go criteria for expanding the native renderer beyond KSculpt.

### Acceptance Criteria

1. Phase A is complete when `k-os-renderer` exists, compiles, and exposes the required viewport command surface
2. Phase B is complete when KSculpt native viewport sessions, redraw flow, and CPU picking work behind a feature flag
3. Phase C is complete when scene/eval dirty updates automatically synchronize renderer-owned resources
4. Phase D is complete when overlays and telemetry work reliably with the native viewport session model
5. Additional viewports SHALL NOT be migrated until KSculpt pilot stability and benchmark targets are demonstrated
