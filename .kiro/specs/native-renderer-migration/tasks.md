# Implementation Plan: Native Renderer Migration

## Overview

This implementation plan migrates K_OS core DCC viewport rendering from frontend-owned Three.js/WebGL to a native Rust/WGPU renderer architecture. The migration follows a 5-phase incremental strategy with KSculpt as the first production pilot.

The implementation uses:
- **Rust** for backend (k-os-renderer crate with wgpu, k-os-engine for compute)
- **TypeScript + React** for frontend (shell UI, panels, overlays)
- **Native viewport hosting** (dedicated window/surface, not DOM embedding)
- **Renderer-owned frame loop** (no per-frame frontend command)

Each task references specific requirements for traceability. Tasks marked with `*` are optional and can be skipped for faster MVP delivery. The migration leverages existing `src-bevy/` native viewport work and `k-os-gpu-pipeline` infrastructure.

## Execution Notes

### Named host adapter boundary

For implementation purposes, the native-window/session boundary should be treated as a distinct adapter layer:
- preferred location: `src-tauri/src/viewport_host.rs`
- optional extraction later: `crates/k-os-viewport-host`

Responsibility split:
- `viewport_host`: create/broker native viewport sessions and surface-capable native windows
- `k-os-renderer`: consume host-provided surface/session handles and own rendering resources
- React/Tauri commands: control session lifecycle and submit viewport intent

This naming should be used consistently in code, review, and task ownership to avoid letting `k-os-renderer` absorb host-window concerns.

### Parallelization policy

Tasks are tagged informally below as:
- `Serial`: should be completed before dependent tasks begin
- `Parallel-safe`: can be executed by separate agents with low collision risk once prerequisites exist
- `Collision-risk`: likely to overlap on the same files/modules and should be owned by one agent at a time

### Existing-path-first rule

Before adding a new type, API, or data contract:
- reuse existing `k-os-scene` handles and mutation paths where possible
- reuse existing `k-os-eval` payloads where possible
- reuse existing `k-os-gpu-pipeline` bridge/pool APIs where possible
- prefer existing supported asset formats for benchmarks and fixtures

## Tasks

### Phase A: Renderer Boundary Definition

- [x] 1. Create k-os-renderer crate foundation
  - Execution: `Serial`
  - Likely paths:
    - `Cargo.toml`
    - `crates/k-os-renderer/Cargo.toml`
    - `crates/k-os-renderer/src/lib.rs`
  - Create new crate: `crates/k-os-renderer/`
  - Set up Cargo.toml with dependencies aligned to the existing workspace rendering stack: `wgpu = "26"`, `parking_lot`, `crossbeam-channel`, `serde`, `thiserror`, and existing math types already used by the repo (`glam` preferred over introducing a second math stack)
  - Create module structure: `src/lib.rs`, `src/viewport.rs`, `src/mesh.rs`, `src/camera.rs`, `src/render_graph.rs`
  - Define core types: `ViewportHandle`, `RenderMeshHandle`, `RendererError`
  - _Requirements: 1.1, 1.2, 15.1_

- [x] 2. Implement Renderer core structure
  - Execution: `Serial`
  - Likely paths:
    - `crates/k-os-renderer/src/lib.rs`
    - `crates/k-os-renderer/src/viewport.rs`
    - `crates/k-os-renderer/src/mesh.rs`
    - `crates/k-os-renderer/src/camera.rs`
  - [x] 2.1 Create Renderer struct with GPU device ownership
    - Implement `Renderer::new(device: Arc<wgpu::Device>, queue: Arc<wgpu::Queue>)` constructor
    - Add viewport registry: `HashMap<ViewportHandle, ViewportRuntime>`
    - Add mesh registry: `HashMap<RenderMeshHandle, RenderMeshRuntime>`
    - Add scene-to-render mapping: `HashMap<MeshHandle, Vec<RenderMeshHandle>>`
    - _Requirements: 1.1, 3.1, 3.2_
  
  - [x] 2.2 Implement viewport lifecycle methods
    - Implement `create_viewport(config: ViewportConfig) -> Result<ViewportHandle, RendererError>`
    - Implement `dispose_viewport(viewport: ViewportHandle) -> Result<(), RendererError>`
    - Ensure viewport handle uniqueness using UUID generation
    - Add viewport resource cleanup on disposal
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 2.3 Implement mesh attachment methods
    - Implement `attach_mesh(viewport: ViewportHandle, mesh: MeshHandle) -> Result<RenderMeshHandle, RendererError>`
    - Implement `detach_mesh(viewport: ViewportHandle, render_mesh: RenderMeshHandle) -> Result<(), RendererError>`
    - Support multiple viewports sharing the same scene mesh
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.4 Implement camera control methods
    - Implement `set_camera(viewport: ViewportHandle, camera: CameraState) -> Result<(), RendererError>`
    - Validate camera state (FOV range, near/far planes)
    - Isolate camera state per viewport
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 2.5 Implement redraw request API
    - Implement `request_redraw(viewport: ViewportHandle) -> Result<(), RendererError>`
    - Mark viewport as dirty for next frame
    - Do NOT implement per-frame render command
    - _Requirements: 2.1, 2.2, 2.4_

- [x] 3. Create renderer service thread
  - Execution: `Serial` after Task 1, `Collision-risk` with Tasks 2 and 5
  - Likely paths:
    - `crates/k-os-renderer/src/lib.rs`
    - `crates/k-os-renderer/src/service.rs`
    - `crates/k-os-renderer/src/events.rs`
  - [x] 3.1 Implement command channel architecture
    - Define `RendererCommand` enum with all command types
    - Create command channel using `crossbeam-channel`
    - Create event channel for telemetry/stats publishing
    - _Requirements: 2.1, 2.2, 2.4_
  
  - [x] 3.2 Implement renderer event loop
    - Spawn dedicated renderer thread
    - Process commands from channel
    - Execute frame rendering when redraw conditions exist
    - Remain idle when no redraw needed (no busy loop)
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  
  - [x] 3.3 Implement frame telemetry publishing
    - Define `FrameStats` struct with frame_time_ms, fps, vertex_count, face_count, draw_calls, gpu_upload_bytes
    - Publish stats after each frame completion
    - Implement `get_stats(viewport: ViewportHandle) -> Result<FrameStats, String>` query
    - _Requirements: 2.4, 7.3_

- [x] 4. Implement native viewport window hosting
  - Execution: `Serial` for 4.1/4.2, `Collision-risk` with Task 5
  - Likely paths:
    - `src-tauri/src/viewport_host.rs`
    - `src-tauri/src/main.rs`
    - `src-bevy/src/main.rs`
    - `src-bevy/src/leash.rs`
  - [x] 4.1 Create viewport host adapter layer
    - Review existing `src-bevy/` native viewport/window code for reusable patterns
    - Create `src-tauri/src/viewport_host.rs` as the host adapter layer
    - Implement native viewport session/window creation (not DOM embedding)
    - Document responsibility split: host adapter owns window lifecycle, `k-os-renderer` owns rendering resources
    - Preserve architectural decision that `k-os-renderer` is a renderer/resource owner, not the top-level window manager
    - _Requirements: 1.1, 1.2_
  
  - [x] 4.2 Integrate host adapter with k-os-renderer
    - Pass host-provided window/surface handles into `k-os-renderer`
    - Create `wgpu` surface from the host-provided native handle
    - Configure swapchain with proper format and present mode
    - Handle surface resize events through the host adapter -> renderer boundary
    - Ensure renderer does not directly manage window state
    - _Requirements: 1.1, 1.2_
  
  - [x] 4.3 Implement viewport configuration
    - Define `ViewportConfig` struct with width, height, shading_mode, background_color, enable_selection, enable_shadows, msaa_samples, renderer_mode
    - Define `ShadingMode` enum: Solid, Wireframe (Phase B scope only)
    - Define `RendererMode` enum: Native, ThreeFallback
    - Apply config during viewport creation
    - _Requirements: 1.1, 9.1, 9.2_

- [x] 5. Create Tauri viewport API commands
  - Execution: `Serial` after Tasks 3 and 4
  - Likely paths:
    - `src-tauri/src/commands/viewport.rs`
    - `src-tauri/src/main.rs`
    - `src-tauri/Cargo.toml`
  - [x] 5.1 Implement viewport lifecycle commands
    - Create `src-tauri/src/commands/viewport.rs`
    - Implement `viewport_create(config: ViewportConfig) -> Result<ViewportHandle, String>`
    - Implement `viewport_dispose(viewport: ViewportHandle) -> Result<(), String>`
    - Register commands in `src-tauri/src/main.rs` invoke_handler
    - _Requirements: 1.1, 1.3, 11.1, 11.8_
  
  - [x] 5.2 Implement mesh attachment commands
    - Implement `viewport_attach_mesh(viewport: ViewportHandle, mesh: MeshHandle) -> Result<RenderMeshHandle, String>`
    - Implement `viewport_detach_mesh(viewport: ViewportHandle, render_mesh: RenderMeshHandle) -> Result<(), String>`
    - _Requirements: 3.1, 11.2, 11.3_
  
  - [x] 5.3 Implement camera and redraw commands
    - Implement `viewport_set_camera(viewport: ViewportHandle, camera: CameraState) -> Result<(), String>`
    - Implement `viewport_request_redraw(viewport: ViewportHandle) -> Result<(), String>`
    - Implement `viewport_get_stats(viewport: ViewportHandle) -> Result<FrameStats, String>`
    - _Requirements: 6.1, 2.2, 11.4, 11.5, 11.7_
  
  - [x] 5.4 Implement error handling for all commands
    - Return descriptive errors for viewport creation failures
    - Return descriptive errors for GPU memory exhaustion
    - Ensure no resource leaks on error paths
    - _Requirements: 1.5, 3.5, 12.1, 12.2_

- [x] 6. Create TypeScript viewport service client
  - Execution: `Parallel-safe` once Task 5 API shape is stable
  - Likely paths:
    - `src-frontend/services/viewportClient.ts`
    - `src-frontend/types/viewport.ts`
  - [x] 6.1 Create ViewportClient class
    - Create `src-frontend/services/viewportClient.ts`
    - Wrap all Tauri viewport commands with typed methods
    - Add error handling with user-friendly messages
    - Export singleton instance
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7_
  
  - [x] 6.2 Define TypeScript types
    - Define `ViewportHandle`, `RenderMeshHandle`, `ViewportConfig`, `CameraState`, `FrameStats` types
    - Define `ShadingMode` and `RendererMode` enums
    - Ensure type alignment with Rust definitions
    - _Requirements: 11.1_

- [ ] 7. Implement basic solid shading render pass
  - Execution: `Serial` after Tasks 1 through 4; `Collision-risk` inside `k-os-renderer`
  - **NOTE:** Currently using Bevy/WGPU host for actual rendering. This task deferred until native WGSL shader path is needed.
  - Likely paths:
    - `crates/k-os-renderer/src/render_graph.rs`
    - `crates/k-os-renderer/src/shaders/solid.wgsl`
    - `crates/k-os-renderer/src/shaders/wireframe.wgsl`
  - [ ] 7.1 Create solid shading WGSL shader
    - Create `crates/k-os-renderer/src/shaders/solid.wgsl`
    - Implement vertex shader with MVP transform
    - Implement fragment shader with simple directional lighting
    - Ensure 16-byte alignment for uniform buffers (use vec4<f32>)
    - _Requirements: 9.1, 9.5_
  
  - [ ] 7.2 Create wireframe shading WGSL shader
    - Create `crates/k-os-renderer/src/shaders/wireframe.wgsl`
    - Implement line rendering for mesh edges
    - Support wireframe color configuration
    - _Requirements: 9.2, 9.5_
  
  - [ ] 7.3 Implement render graph execution
    - Create `RenderGraph` struct for managing render passes
    - Implement solid shading render pass
    - Implement wireframe shading render pass
    - Build draw packets from attached meshes
    - Execute render pass and present to swapchain
    - _Requirements: 9.1, 9.2_

  - [ ] 7.4 Gate shader/render-pass work on completed host and service-thread plumbing
    - **STATUS:** Host adapter and service thread are complete. Bevy/WGPU host currently handles actual rendering.
    - Do not treat shader authoring as the first proof of the renderer
    - Verify native viewport session creation, renderer service thread, and surface ownership are already working before optimizing shading paths
    - Keep Phase A focused on proving the boundary and lifecycle before adding visual scope
    - _Requirements: 1.1, 2.1, 9.1, 9.2_

- [x] 8. Checkpoint - Phase A complete
  - Execution: `Serial`
  - Validation focus:
    - crate compiles
    - host adapter/session creation works
    - Tauri commands route into renderer service thread
    - first native surface can present a frame
  - Verify k-os-renderer crate compiles
  - Verify renderer service thread starts and processes commands
  - Verify native viewport window creation works
  - Verify Tauri commands are registered and callable from frontend
  - Verify basic solid/wireframe rendering works
  - Verify the host-layer and renderer-layer responsibilities are still cleanly separated

### Phase B: KSculpt Pilot

- [x] 9. Implement CPU BVH picking for KSculpt
  - Execution: `Parallel-safe` with Tasks 10 and 12 once Task 2 camera types are stable; `Collision-risk` if multiple agents touch the same acceleration cache
  - Likely paths:
    - `crates/k-os-renderer/src/picking.rs`
    - `crates/k-os-renderer/src/acceleration.rs`
    - `crates/k-os-mesh-processing/src/*`
    - `crates/k-os-eval/src/mesh_pipeline.rs`
  - [x] 9.1 Create BVH data structure
    - Add `bvh` crate or implement simple AABB tree
    - Build BVH from evaluator-derived mesh data keyed by `MeshHandle` and evaluated mesh version, not per viewport
    - Store BVH ownership in a shared acceleration/cache layer so multiple viewports can reuse the same evaluated mesh acceleration structure
    - Support invalidation and rebuild when the evaluated mesh version changes
    - _Requirements: 5.1, 5.2_
  
  - [x] 9.2 Implement ray-mesh intersection
    - Implement ray-triangle intersection using Möller-Trumbore algorithm
    - Implement ray-BVH traversal
    - Return closest hit with face index, position, normal, distance
    - _Requirements: 5.1, 5.2_
  
  - [x] 9.3 Implement selection request API
    - Implement `request_selection(viewport: ViewportHandle, ndc: [f32; 2]) -> Result<SelectionResult, RendererError>`
    - Convert NDC coordinates to world-space ray using camera state
    - Query the shared BVH/acceleration structure for the closest hit
    - Return typed `SelectionResult` with hit data or no-hit indicator
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  
  - [x] 9.4 Add Tauri selection command
    - Implement `viewport_request_selection(viewport: ViewportHandle, ndc_x: f32, ndc_y: f32) -> Result<SelectionResult, String>`
    - Register command in invoke_handler
    - Add to ViewportClient TypeScript wrapper
    - _Requirements: 5.1, 11.6_

- [x] 10. Create React NativeViewport component
  - Execution: `Parallel-safe` after Tasks 5 and 6
  - Likely paths:
    - `src-frontend/features/viewport/NativeViewport.tsx`
    - `src-frontend/services/viewportClient.ts`
    - `src-frontend/components/*`
  - [x] 10.1 Create NativeViewport.tsx component
    - Create `src-frontend/features/viewport/NativeViewport.tsx`
    - Manage native viewport session lifecycle
    - Handle viewport creation on mount, disposal on unmount
    - Display viewport handle and connection status
    - _Requirements: 7.1, 7.2, 8.1_
  
  - [x] 10.2 Implement camera control integration
    - Forward orbit/pan/zoom input to `viewport_set_camera` command
    - Debounce camera updates to avoid IPC spam
    - Maintain camera state in React component
    - _Requirements: 6.1, 7.2_
  
  - [x] 10.3 Implement redraw request integration
    - Call `viewport_request_redraw` on camera changes
    - Call `viewport_request_redraw` on mesh attachment/detachment
    - Do NOT call per-frame render command
    - _Requirements: 2.2, 7.2_
  
  - [x] 10.4 Implement telemetry display
    - Poll `viewport_get_stats` periodically (e.g., every 500ms)
    - Display FPS, frame time, vertex count in HUD overlay
    - _Requirements: 7.3_

- [x] 11. Integrate NativeViewport with KSculpt
  - Execution: `Collision-risk` with any other active KSculpt work
  - Likely paths:
    - `src-frontend/features/sculpting/*`
    - `src-frontend/ui/viewport/WebViewport.tsx`
    - `src-frontend/engine/TauriEngineProvider.ts`
    - `crates/k-os-engine/src/modules/sculpting/sculpt.rs`
  - [x] 11.1 Add feature flag for native renderer
    - Add `useNativeRenderer` feature flag to KSculpt config
    - Default to false (Three.js fallback) during rollout
    - Allow runtime toggle for side-by-side validation
    - _Requirements: 8.1, 8.3, 8.4, 14.5_
  
  - [x] 11.2 Replace Three.js viewport in KSculpt
    - Conditionally render NativeViewport or legacy Three.js viewport based on feature flag
    - Attach sculpt mesh to native viewport on session creation
    - Detach mesh on session disposal
    - _Requirements: 14.1, 8.1, 8.3_
  
  - [x] 11.3 Integrate CPU picking with brush hover
    - Call `viewport_request_selection` on mouse move in sculpt mode
    - Update brush cursor position based on hit result
    - Handle no-hit case gracefully (hide cursor or show default)
    - _Requirements: 5.1, 5.2, 14.2_
  
  - [x] 11.4 Integrate picking with brush strokes
    - Call `viewport_request_selection` on mouse down for stroke start
    - Use hit data for brush application
    - Do NOT apply stroke if picking fails or returns no-hit
    - _Requirements: 5.1, 5.2, 5.5, 14.3_

- [x] 12. Implement React overlay alignment
  - Execution: `Parallel-safe` after Task 10 basic component exists
  - **STATUS:** Shared overlay coordinate contract, brush cursor overlay, and HUD anchoring are now implemented in `NativeViewport` (2026-03-11). Multi-monitor validation remains in Task 21.
  - Likely paths:
    - `src-frontend/features/viewport/NativeViewport.tsx`
    - `src-frontend/features/notifications/*`
    - `src-frontend/systems/ui-engine/*`
  - [x] 12.1 Create overlay coordinate system
    - Map native viewport window coordinates to React overlay coordinates
    - Handle viewport resize and position changes
    - Provide utility functions for coordinate conversion
    - _Requirements: 7.1, 7.2, 7.4_
  
  - [x] 12.2 Implement brush cursor overlay
    - Render brush cursor in React overlay layer
    - Position cursor based on selection hit position
    - Update cursor on mouse move
    - _Requirements: 7.1, 7.2, 14.2_
  
  - [x] 12.3 Implement HUD overlay
    - Render HUD elements (FPS, vertex count, tool state) in React overlay
    - Position HUD relative to native viewport bounds
    - Update HUD on telemetry changes
    - _Requirements: 7.1, 7.3_

- [ ] 13. Create benchmark scenes for performance validation
  - Execution: `Parallel-safe`
  - Likely paths:
    - `assets/benchmarks/*`
    - `src-tauri/resources/*`
    - benchmark docs/manifests under `docs/` or `.kiro/specs/`
  - [ ] 13.1 Create 1M triangle sculpt benchmark scene
    - Generate or import 1M triangle mesh for KSculpt
    - Prefer an existing supported asset format already understood by the suite instead of inventing a new benchmark-only mesh format unless a stable benchmark format already exists
    - Save the benchmark asset in a dedicated benchmark location under existing asset conventions
    - Document scene characteristics (triangle count, vertex count, topology, material mode, intended camera framing)
    - _Requirements: 13.1, 13.3_
  
  - [ ] 13.2 Create 10M triangle heavy benchmark scene
    - Generate or import 10M triangle mesh
    - Prefer an existing supported asset format already understood by the suite instead of inventing a new benchmark-only mesh format unless a stable benchmark format already exists
    - Save the benchmark asset in a dedicated benchmark location under existing asset conventions
    - Document scene characteristics, camera framing, and shading assumptions
    - _Requirements: 13.1, 13.4_
  
  - [ ] 13.3 Define hardware tiers for benchmarking
    - Document minimum supported GPU (e.g., GTX 1060 / RX 580)
    - Document recommended development GPU (e.g., RTX 3070 / RX 6800)
    - Create benchmark configuration file with hardware specs
    - _Requirements: 13.1, 13.2_

- [ ] 14. Implement performance measurement and validation
  - Execution: `Serial` after Task 7 for rendering and after Task 13 for fixtures
  - Likely paths:
    - `crates/k-os-renderer/benches/*`
    - `crates/k-os-renderer/tests/*`
    - `src-frontend/features/notifications/*`
  - [ ] 14.1 Create benchmark runner
    - Create `crates/k-os-renderer/benches/viewport_benchmark.rs`
    - Load benchmark scenes
    - Measure frame time, FPS, draw calls, upload bytes
    - Record results to JSON file
    - _Requirements: 13.1, 13.5_
  
  - [ ] 14.2 Run KSculpt pilot benchmarks
    - Run 1M triangle scene on recommended GPU in solid mode
    - Verify 60 FPS median target
    - Run 10M triangle scene on recommended GPU in solid mode
    - Verify 30 FPS median target
    - _Requirements: 13.3, 13.4, 13.5_
  
  - [ ]* 14.3 Create benchmark report
    - Generate markdown report with benchmark results
    - Include hardware specs, scene details, measurements
    - Compare against targets
    - _Requirements: 13.5_

- [ ] 15. Checkpoint - Phase B complete (KSculpt pilot)
  - Execution: `Serial`
  - Validation focus:
    - native viewport session works behind feature flag
    - CPU picking and brush flow are correct
    - fallback path still works
    - benchmark matrix is documented, not just performance anecdotes
  - Verify KSculpt can create native viewport session behind feature flag
  - Verify brush hover resolves hit location through CPU picking
  - Verify brush strokes dirty mesh and trigger redraw
  - Verify overlay alignment (brush cursor, HUD)
  - Verify benchmark targets met on recommended GPU
  - Verify Three.js fallback still works when feature flag disabled
  - Verify CPU picking is using shared evaluated acceleration data rather than per-viewport rebuilds

### Phase C: Scene/Eval/Renderer Auto-Sync

- [ ] 16. Integrate renderer sync with existing scene/eval invalidation
  - Execution: `Collision-risk` across `k-os-scene`, `k-os-eval`, and renderer bridge work
  - Likely paths:
    - `crates/k-os-scene/src/scene_world.rs`
    - `crates/k-os-eval/src/lib.rs`
    - `crates/k-os-eval/src/mesh_pipeline.rs`
    - `crates/k-os-engine/src/modules/core/mesh_state.rs`
  - [ ] 16.1 Reuse authored-state mutation hooks from k-os-scene
    - Identify the existing migrated mesh mutation paths that already update canonical state
    - Add only the missing authored-state invalidation hooks needed for renderer synchronization
    - Do not introduce a second parallel scene dirty system if the current migrated path already emits the necessary invalidation
    - _Requirements: 4.1_
  
  - [ ] 16.2 Reuse evaluator invalidation in k-os-eval
    - Use existing evaluator dirty marking and lazy re-evaluation behavior as the authoritative derived-state invalidation path
    - Add missing invalidation hooks only where the renderer path needs them
    - Clear dirty state through existing successful evaluation flow instead of inventing a second cache invalidation mechanism
    - _Requirements: 4.1, 4.2_

- [x] 17. Implement eval-to-renderer bridge
  - Execution: `Collision-risk` with Tasks 16 and 18
  - Likely paths:
    - `crates/k-os-renderer/src/bridge.rs`
    - `crates/k-os-gpu-pipeline/src/mesh_bridge.rs`
    - `crates/k-os-engine/src/modules/core/mesh_state.rs`
  - [x] 17.1 Define EvaluatedMeshSource trait
    - Create `crates/k-os-renderer/src/bridge.rs`
    - Define `EvaluatedMeshSource` trait with `viewport_payload(mesh: MeshHandle) -> Result<ViewportBufferPayload, BridgeError>`
    - Reuse the existing evaluated viewport payload shape where possible instead of forking a second renderer-only payload contract
    - Define `ViewportBufferPayload` with vertex/index buffer data only if the existing shape cannot be consumed directly
    - **STATUS (2026-03-11):** `crates/k-os-renderer/src/bridge.rs` now defines `EvaluatedMeshSource` and an explicit bridge error contract; `src-tauri/src/commands/viewport.rs` wires a scene-runtime payload source into renderer service startup.
    - _Requirements: 4.2, 4.3, 10.1_
  
  - [x] 17.2 Implement RendererUploadBridge trait
    - Define `RendererUploadBridge` trait with `sync_mesh(mesh: MeshHandle, render_mesh: RenderMeshHandle) -> Result<(), BridgeError>`
    - Define `mark_mesh_dirty(mesh: MeshHandle)` method
    - Implement bridge using k-os-gpu-pipeline buffer pool
    - **STATUS (2026-03-11):** `PipelineRendererUploadBridge` now uses `k-os-gpu-pipeline` (`GpuMeshBridge` + `GPUPipelineManager`) to allocate/reuse/upload mesh buffers keyed by `RenderMeshHandle`, and writes upload-byte telemetry back to renderer mesh runtime.
    - _Requirements: 4.3, 10.1, 10.2_
  
  - [x] 17.3 Integrate bridge with renderer service thread
    - Add bridge instance to renderer service thread
    - Check for dirty meshes before each frame
    - Call `sync_mesh` for dirty renderer meshes
    - Update GPU buffers through k-os-gpu-pipeline
    - **STATUS (2026-03-11):** renderer service now boots with optional bridge injection and auto-provisions a GPU-backed bridge when both `EvaluatedMeshSource` and renderer GPU handles are available. Dirty meshes are synchronized through bridge sync before redraw; source-only sync remains as a headless fallback.
    - _Requirements: 4.2, 4.3, 10.1_

- [ ] 18. Implement GPU buffer updates for dirty meshes
  - Execution: `Collision-risk` with Task 17
  - Likely paths:
    - `crates/k-os-gpu-pipeline/src/mesh_bridge.rs`
    - `crates/k-os-gpu-pipeline/src/buffer_pool.rs`
    - `crates/k-os-renderer/src/mesh.rs`
  - [x] 18.1 Integrate with k-os-gpu-pipeline buffer pool
    - Use existing buffer pool APIs for allocation
    - Reuse buffers where possible for mesh updates
    - Handle buffer reallocation when mesh size changes
    - **STATUS (2026-03-11):** `PipelineRendererUploadBridge` now uses explicit `GpuMeshBufferSizing` requests via `k-os-gpu-pipeline` and applies a growth-with-headroom capacity policy; buffers are reused when capacity is sufficient and reallocated only on undersized growth.
    - _Requirements: 3.2, 3.3, 10.1, 10.2, 10.3_
  
  - [x] 18.2 Implement partial buffer updates
    - Support partial vertex/index buffer updates for small changes
    - Use staging buffers for efficient uploads
    - Minimize GPU upload bytes per frame
    - **STATUS (2026-03-11):** `k-os-gpu-pipeline::GpuMeshBridge` now computes byte-range deltas against prior mesh payloads and uploads only changed ranges through explicit staging-buffer copy commands (`upload_bytes_with_staging`). `PipelineRendererUploadBridge` caches per-render-mesh upload plans and reports actual uploaded bytes after partial updates.
    - _Requirements: 4.3, 10.2_
  
  - [x] 18.3 Handle evaluation failures gracefully
    - Preserve last valid GPU state if evaluation fails
    - Skip applying invalid mesh data
    - Log evaluation errors without crashing renderer
    - **STATUS (2026-03-11):** `k-os-renderer` service redraw sync now treats evaluated-source sync failures as soft failures: it logs structured mesh/viewport errors, keeps dirty meshes queued for retry, and continues rendering the last valid state instead of failing redraw. Explicit `SyncMeshFromSource` commands remain hard-fail for callers while still logging sync context.
    - _Requirements: 4.5, 12.4_

- [x] 19. Implement multi-viewport mesh sharing
  - Execution: `Parallel-safe` after Task 17 contract is stable; `Collision-risk` if done alongside renderer registry refactors
  - Likely paths:
    - `crates/k-os-renderer/src/mesh.rs`
    - `crates/k-os-renderer/src/lib.rs`
    - `crates/k-os-renderer/src/service.rs`
  - [x] 19.1 Create shared render mesh registry
    - Map `MeshHandle` to list of `RenderMeshHandle` instances
    - Allow multiple viewports to reference the same scene mesh
    - Share GPU buffers across render mesh instances where feasible
    - **STATUS (2026-03-11):** `Renderer` now fully treats `scene_to_render` as the authoritative shared mesh registry, including lifecycle cleanup on detach/dispose, and applies scene payload metadata fan-out across every associated `RenderMeshHandle` so shared mesh state stays coherent across viewport attachments.
    - _Requirements: 3.4, 4.4_
  
  - [x] 19.2 Propagate updates to all viewports
    - When scene mesh is dirty, mark all associated render meshes dirty
    - Update GPU resources once, apply to all viewports
    - Request redraw for all viewports showing the dirty mesh
    - **STATUS (2026-03-11):** redraw requests now execute all currently dirty/redraw-requested viewports in one service pass. Dirty shared meshes are synchronized once per mesh key, payload/version state is fanned out to all associated render meshes, and all viewports displaying that mesh are redrawn without requiring per-viewport manual redraw sequencing.
    - _Requirements: 4.4_

- [ ] 20. Checkpoint - Phase C complete
  - Execution: `Serial`
  - Validation focus:
    - one canonical mutation path updates all native consumers
    - bridge contract stays stable
    - renderer does not reach into scene/eval internals ad hoc
  - Verify scene edits automatically propagate to native viewports
  - Verify existing scene/eval invalidation drives renderer sync without a second parallel dirty system
  - Verify GPU buffer updates use k-os-gpu-pipeline pool
  - Verify multi-viewport mesh sharing works
  - Verify evaluation failures don't corrupt renderer state
  - Verify the bridge still depends on stable interfaces instead of reaching directly into scene/eval internals

### Phase D: Overlay and Tool Polish

- [ ] 21. Improve overlay alignment and input routing
  - Execution: `Parallel-safe` after Task 10, `Collision-risk` with live KSculpt UI work
  - Likely paths:
    - `src-frontend/features/viewport/NativeViewport.tsx`
    - `src-frontend/features/sculpting/*`
    - `src-frontend/systems/ui-engine/*`
  - [ ] 21.1 Implement precise overlay coordinate mapping
    - Handle DPI scaling and window position offsets
    - Update overlay coordinates on viewport resize
    - Test on multiple monitor configurations
    - _Requirements: 7.2, 7.4_
  
  - [ ] 21.2 Implement input event routing
    - Route mouse events to native viewport for camera control
    - Route mouse events to React overlay for UI interaction
    - Implement proper event capture and bubbling
    - _Requirements: 7.2_
  
  - [ ] 21.3 Add viewport focus management
    - Track which viewport has input focus
    - Highlight focused viewport border
    - Route keyboard shortcuts to focused viewport
    - _Requirements: 7.2_

- [ ] 22. Add telemetry and debug instrumentation
  - Execution: `Parallel-safe`
  - Likely paths:
    - `crates/k-os-renderer/src/service.rs`
    - `crates/k-os-renderer/src/telemetry.rs`
    - `src-frontend/features/notifications/*`
  - [x] 22.1 Expand FrameStats telemetry
    - Add mesh sync time measurement
    - Add selection latency measurement
    - Add GPU memory usage tracking
    - **STATUS (2026-03-12):** `FrameStats` now includes `mesh_sync_time_ms`, `selection_latency_ms`, and `gpu_memory_bytes`. Renderer service records per-redraw mesh sync timing (including bridge/source sync), smooths per-viewport selection latency from `RequestSelection`, and reports resident GPU memory estimates from attached mesh geometry totals. Native viewport diagnostics HUD now displays the expanded telemetry fields.
    - _Requirements: 10.5, 13.5_
  
  - [ ] 22.2 Create debug overlay UI
    - Display detailed frame stats in debug overlay
    - Show buffer pool usage and allocation stats
    - Show dirty mesh tracking status
    - Toggle debug overlay with keyboard shortcut
    - _Requirements: 10.5_
  
  - [ ] 22.3 Add performance profiling hooks
    - Add tracing spans for key operations (frame render, mesh sync, picking)
    - Export trace data for analysis with tools like Tracy or Chrome tracing
    - _Requirements: 13.5_

- [ ] 23. Polish KSculpt native viewport UX
  - Execution: `Collision-risk` with other KSculpt frontend work
  - Likely paths:
    - `src-frontend/features/sculpting/*`
    - `src-frontend/features/viewport/NativeViewport.tsx`
    - `src-frontend/ui/viewport/*`
  - [ ] 23.1 Improve brush cursor rendering
    - Add brush size visualization
    - Add brush strength indicator
    - Smooth cursor updates with interpolation
    - _Requirements: 14.2_
  
  - [ ] 23.2 Add viewport navigation hints
    - Display orbit/pan/zoom hints on first use
    - Add viewport reset button
    - Add camera preset buttons (front, side, top views)
    - _Requirements: 6.1_
  
  - [ ] 23.3 Add error recovery UI
    - Display user-friendly error messages for viewport failures
    - Offer fallback to Three.js renderer on native renderer failure
    - Add "Report Issue" button for error cases
    - _Requirements: 12.1, 12.2, 12.3_

- [ ] 24. Checkpoint - Phase D complete
  - Execution: `Serial`
  - Validation focus:
    - overlay/input/focus behavior is acceptable on real multi-monitor setups
    - telemetry is actionable for debugging, not decorative
  - Verify overlay alignment works correctly on multiple monitors
  - Verify input routing works for camera and UI interactions
  - Verify telemetry and debug overlay display useful information
  - Verify KSculpt UX polish improvements
  - Verify native viewport session behavior still matches the chosen host-window model

### Phase E: Expand to Other Viewports

- [ ] 25. Migrate KRetopo to native renderer
  - Execution: `Serial` after Phase B and C are proven; `Collision-risk` with any retopo feature work
  - Likely paths:
    - `src-frontend/features/retopo/*`
    - `src-frontend/features/viewport/NativeViewport.tsx`
    - retopo backend bindings under `src-tauri` or `crates/*`
  - [ ] 25.1 Add native viewport to KRetopo
    - Replace Three.js viewport with NativeViewport component
    - Attach retopo mesh to native viewport
    - Implement feature flag for gradual rollout
    - _Requirements: 15.1, 15.5_
  
  - [ ] 25.2 Implement retopo-specific picking
    - Adapt CPU picking for retopo edge/vertex selection
    - Support edge loop and face selection modes
    - _Requirements: 15.1_
  
  - [ ] 25.3 Add retopo overlay rendering
    - Render retopo guides and snapping indicators in overlay
    - Render selected edges/vertices with highlighting
    - _Requirements: 15.1_

- [ ] 26. Migrate KInspect to native renderer
  - Execution: `Serial` after KRetopo or in parallel with 25 only if separate agents own separate features cleanly
  - Likely paths:
    - `src-frontend/features/inspect/*`
    - `src-frontend/features/viewport/NativeViewport.tsx`
  - [ ] 26.1 Add native viewport to KInspect
    - Replace Three.js viewport with NativeViewport component
    - Attach inspected mesh to native viewport
    - Implement feature flag for gradual rollout
    - _Requirements: 15.2, 15.5_
  
  - [ ] 26.2 Add inspection-specific rendering modes
    - Support UV layout visualization
    - Support normal map visualization
    - Support vertex color visualization
    - _Requirements: 15.2_

- [ ] 27. Migrate bake/material preview to native renderer
  - Execution: `Serial` and later-phase only; depends on broader material scope work
  - Likely paths:
    - `src-frontend/features/*bake*`
    - `crates/k-os-material/*`
    - `crates/k-os-baking/*`
    - `crates/k-os-renderer/src/material*`
  - [ ] 27.1 Add native viewport to bake preview
    - Replace Three.js viewport with NativeViewport component
    - Attach bake target mesh to native viewport
    - Implement feature flag for gradual rollout
    - _Requirements: 15.3, 15.5_
  
  - [ ] 27.2 Implement material preview rendering
    - Support PBR material rendering with texture maps
    - Support lighting environment changes
    - Update preview in real-time as bake progresses
    - _Requirements: 15.3_

- [ ] 28. Validate expansion criteria
  - Execution: `Serial`
  - Validation focus:
    - only migrate another viewport when prior-phase acceptance is actually met
  - [ ] 28.1 Verify Phase A completion criteria
    - k-os-renderer crate exists and compiles
    - Viewport command surface is exposed and functional
    - _Requirements: 15.1_
  
  - [ ] 28.2 Verify Phase B completion criteria
    - KSculpt native viewport sessions work behind feature flag
    - Redraw flow works without per-frame frontend command
    - CPU picking works for brush hover and strokes
    - _Requirements: 15.2_
  
  - [ ] 28.3 Verify Phase C completion criteria
    - Scene/eval dirty updates automatically sync renderer resources
    - Multi-viewport mesh sharing works correctly
    - _Requirements: 15.3_
  
  - [ ] 28.4 Verify Phase D completion criteria
    - Overlays and telemetry work reliably with native viewport
    - Input routing and focus management work correctly
    - _Requirements: 15.4_
  
  - [ ] 28.5 Verify KSculpt stability and benchmarks
    - KSculpt pilot is stable in production use
    - Benchmark targets are met on recommended GPU
    - No critical bugs or performance regressions
    - _Requirements: 15.5_

- [ ] 29. Final checkpoint - Migration complete
  - Execution: `Serial`
  - Validation focus:
    - ownership boundaries remained intact
    - fallback paths remain available
    - renderer project did not regress the current suite ergonomics
  - Verify all core DCC viewports migrated: KSculpt, KRetopo, KInspect, Bake preview
  - Verify Three.js fallback still works for non-migrated apps
  - Verify benchmark targets met across all migrated viewports
  - Verify no resource leaks or stability issues
  - Verify renderer/resource ownership boundaries remained intact throughout migration

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at phase boundaries
- The migration is designed to be incremental and safe, with feature flags for gradual rollout
- Existing `src-bevy/` native viewport work is leveraged to accelerate Phase A
- GPU buffer management uses existing `k-os-gpu-pipeline` infrastructure
- Three.js remains available as fallback during and after migration
