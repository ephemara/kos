# Requirements Document

## Introduction

KGraphos Production Overhaul transforms KGraphos from a glitchy experimental 2D texture painter into a GPU-backed production-grade digital painting and PBR texturing application. This overhaul positions KGraphos to compete with industry leaders like Adobe Photoshop, Clip Studio Paint, and Substance Painter by leveraging K_OS's proven GPU infrastructure:

**Backend Rust Crates:**
- `k-os-engine/src/gpu/` — Full wgpu compute pipeline stack including:
  - `gpu/raycast/bvh.rs` — **Real GPU BVH raycast engine** using LBVH (Morton code spatial sort) with stackless WGSL traversal, Möller–Trumbore intersection, UV interpolation via barycentric coords, `RayHit` struct with hit point/normal/UV/distance/triangle_id. Exposed as Tauri commands `gpu_raycast_init`, `gpu_raycast`, `gpu_raycast_dispose`
  - `gpu/spatial/grid.rs` — **GPU spatial hash grid** (O(1) radius queries) built via 4-pass wgpu compute (clear → count → prefix_sum → scatter); `encode_query()` returns candidate vertex indices for sphere queries; used for brush hit detection
  - `gpu/zero_copy.rs` — `ZeroCopyBuffer` with `STORAGE | VERTEX | COPY_SRC | COPY_DST` for compute-write → render-read without CPU roundtrip; `ZeroCopyMesh` for GPU-resident position/normal buffers
  - `gpu/brush/alpha_pool.rs` — `AlphaTexturePool` — GPU-side alpha texture cache with `wgpu::Texture`/`TextureView`/`Sampler`/`BindGroup` per entry; global `ALPHA_POOL` lazy static; supports file/embedded/procedural sources with 64×64 preview thumbnails
  - `gpu/pipelines/spirv_loader.rs` — SPIR-V sculpt kernel registry (`SPIRV_SHADERS` lazy static); `include_bytes!()` loads `.spv` from `k-os-kain/domains/sculpting/` at compile time; `KernelFamily::Stamp` and `KernelFamily::Physics` families
  - `gpu/pipelines/layer_blend.rs` — wgpu `layer_blend.wgsl` pipeline for GPU layer compositing
  - `gpu/pipelines/pbr.rs` — wgpu PBR rendering pipeline (42KB)
  - `gpu/pipelines/sculpt.rs` — wgpu sculpt compute pipeline (75KB) with dedicated WGSL kernels (stamp, grab, smooth, crystal, pinch, physics)
  - `gpu/pipelines/normals.rs` — GPU normal computation
  - `gpu/svt/` — Sparse Virtual Texture engine with PBR commands
  - `gpu/atlas/` — Texture atlas packing and projection
  - `gpu/device.rs` — `GpuComputeDevice::get_or_init_blocking()` singleton
  - `gpu/buffer_pool.rs` — Buffer pooling for reuse
  - `gpu/staging.rs` — Staging buffer helpers
- `k-os-kain` — KAIN compiler CLI bridge; compiles `.kn` → SPIR-V (`.spv`) for sculpt kernels; `KainCliTarget::Spirv`, `KainCliTarget::Wasm`, etc.
- `k-os-undo` — `UndoManager<State>` with memory-aware limits, action merging, 500MB default cap
- `k-os-baking` — CPU-side SAH-BVH (`bvh.rs`), texture dilation (`dilation.rs`), ray tracing
- `k-os-material` — PBR material library (`library.rs`, `preset.rs`, `texture.rs`)
- `k-os-gpu-pipeline` — `ShaderHotReloader` (file watcher for `.wgsl`), buffer pool, performance monitoring

**Frontend TypeScript:**
- `KGraphosEngine.ts` + `GraphosShaders.ts` — Three.js WebGL simulation pipeline (WGSL fragment shaders) with 14 built-in simulations
- `SimpleCanvas.ts` — Core canvas engine with layers, partial selection tools

The system will provide advanced painting tools (magic masking, lasso selection, GPU shader brushes), a PBR-focused workflow with material channel painting, animation/timeline support, and seamless integration with the K_OS ecosystem.

## Glossary

- **KGraphos**: The 2D texture painting and PBR texturing application within K_OS DCC Suite
- **KAIN**: K_OS's custom shader language (`k-os-kain` crate) that invokes the KAIN CLI to compile `.kn` source to SPIR-V or other targets
- **Shader_Brush**: A programmable brush powered by KAIN/WGSL compute shaders executed via Three.js WebGL on the frontend
- **PBR_Channel**: Physically-based rendering texture channels (albedo, normal, roughness, metallic, AO, emissive, height, opacity)
- **Layer_Stack**: The compositing system managing multiple paint layers with blend modes — built on `SimpleCanvas.ts`
- **Selection_Mask**: A binary or gradient mask defining paintable regions — `selectMarquee`, `selectLasso`, `selectMagicWand` already exist in `SimpleCanvas.ts`
- **GPU_Pipeline**: Three.js WebGL shader pipeline executing painting and simulation operations (frontend); `k-os-gpu-pipeline` crate for backend buffer pooling and shader hot-reload
- **Material_Library**: The `k-os-material` crate providing PBR material management (`library.rs`, `material.rs`, `preset.rs`, `texture.rs`)
- **Brush_Registry**: Data-driven JSON registry defining brush presets and parameters
- **Canvas_Engine**: `SimpleCanvas.ts` — the core rendering and compositing engine managing layers and viewport
- **Undo_System**: The `k-os-undo` crate — `UndoManager<State>` with memory-aware limits, action merging, and undo/redo stacks
- **Alpha_Map**: Grayscale texture defining brush stamp shape
- **Simulation_Layer**: GPU fragment shaders (WGSL) applying real-time effects — already implemented: drip, bleed, wind, magnetic, datamosh, nebula, thermal, sort, life, vortex, liquify, rivulet, growth, pixelSort
- **Timeline**: Animation system for keyframing layer properties over time
- **Dilation**: `k-os-baking::dilation::dilate()` / `dilate_weighted()` — CPU parallel (rayon) neighbor averaging to fill empty UV island pixels
- **UV_Space**: 2D texture coordinate space where painting occurs
- **Kernel_Artifact**: Shared asset in K_OS kernel storage accessible across apps
- **ShaderHotReloader**: `k-os-gpu-pipeline::hot_reload::ShaderHotReloader` — `notify`-crate file watcher for `.wgsl` shader files
- **GpuBvhRaycast**: `k-os-engine::gpu::raycast::bvh::GpuBvhRaycast` — **real GPU BVH** using LBVH Morton-code construction (CPU) + stackless WGSL traversal (GPU), Möller–Trumbore intersection, UV barycentric interpolation. Returns `RayHit{hit, point, normal, uv, distance, triangle_id, mesh_id, time_ms}`. Tauri commands: `gpu_raycast_init`, `gpu_raycast`, `gpu_raycast_dispose`
- **GpuSpatialGrid**: `k-os-engine::gpu::spatial::grid::GpuSpatialGrid` — 4-pass GPU compute hash grid (clear → count → prefix_sum → scatter). `encode_query()` returns vertex candidates for sphere radius queries in O(1) average
- **ZeroCopyMesh**: `k-os-engine::gpu::zero_copy::ZeroCopyMesh` — `STORAGE | VERTEX | COPY_SRC | COPY_DST` buffers; no CPU roundtrip between compute and render
- **AlphaPool**: `k-os-engine::gpu::brush::alpha_pool::ALPHA_POOL` — global GPU alpha texture cache (`wgpu::Texture`/`TextureView`/`Sampler`/`BindGroup`); supports file/embedded/procedural sources; shared across K_OS apps
- **SpirvLoader**: `k-os-engine::gpu::pipelines::spirv_loader::SPIRV_SHADERS` — compile-time `include_bytes!()` registry mapping brush names to KAIN-compiled `.spv` bytecode; `KernelFamily::Stamp` + `KernelFamily::Physics`
- **Universal_Cursor_System**: Context-aware cursor framework — uses `GpuBvhRaycast` (via `gpu_raycast` Tauri command) for GPU-accelerated 3D hit testing, DOM `elementFromPoint` for UI
- **Cursor_Context**: State machine tracking cursor mode (2D canvas, UV space, UI overlay, 3D viewport)
- **Hit_Test**: GPU BVH (`gpu_raycast` Tauri command) for 3D mesh; DOM bounds for UI elements
- **Cursor_Registry**: Data-driven JSON registry defining cursor styles and behaviors

---

## Requirements

### Requirement 1: GPU-Accelerated Brush Engine

**User Story:** As a digital artist, I want GPU-accelerated brush strokes with low latency, so that I can paint naturally without lag even at 4K resolution.

#### Acceptance Criteria

1. WHEN a brush stroke is applied, THE GPU_Pipeline SHALL process the stroke within 16 milliseconds at 4K resolution (one frame at 60 fps — achievable with Three.js WebGL fragment shader stamping; sub-5ms is only realistic on dedicated GPU with no CPU readback)
2. THE Shader_Brush SHALL support standard brush parameters (size, opacity, flow, hardness, spacing, angle, jitter) — `SimpleBrush` in `SimpleCanvas.ts` already carries size, opacity, hardness, spacing, erase, symmetry
3. WHEN brush spacing is set to N, THE GPU_Pipeline SHALL interpolate stroke samples at N percent of brush diameter
4. THE GPU_Pipeline SHALL apply Alpha_Map textures to brush stamps with bilinear filtering
5. WHEN pressure input is detected, THE GPU_Pipeline SHALL modulate brush size and opacity based on pressure curves
6. THE GPU_Pipeline SHALL support symmetry modes (none, horizontal, vertical, radial with N-way count) — symmetry is already wired in `KGraphosEngine.ts` via `SimpleBrush.symmetry`
7. FOR ALL brush strokes, applying then undoing then reapplying SHALL produce identical pixel values (undo round-trip property)

---

### Requirement 2: KAIN Shader Brush System

**User Story:** As a technical artist, I want to create custom shader brushes using KAIN language, so that I can implement procedural painting effects impossible with traditional brushes.

#### Acceptance Criteria

1. THE Shader_Brush SHALL invoke the `k-os-kain` crate (`KainCompiler::compile()`) to compile KAIN source to SPIR-V — the crate shells out to the KAIN CLI (`kain build -t spirv`) and returns `KainCompileOutput`
2. WHEN KAIN compilation fails, THE Shader_Brush SHALL surface `KainError` descriptions with line numbers from KAIN CLI stderr
3. THE Shader_Brush SHALL expose standard uniforms (brush_position, brush_size, brush_color, time, random_seed)
4. THE Shader_Brush SHALL support custom uniform parameters defined in KAIN source
5. THE Brush_Registry SHALL store KAIN shader source as JSON with metadata (name, description, parameters, preview)
6. WHEN a Shader_Brush is selected, THE Canvas_Engine SHALL load the compiled SPIR-V via `SPIRV_SHADERS` registry (`spirv_loader.rs`); `AlphaPool` SHALL manage the brush alpha textures on GPU; frontend `applyCustomShader()` applies the shader per stroke
7. THE Shader_Brush SHALL access texture samplers for reading existing layer content via `tInput` uniform (pattern already used in all sim shaders)
8. FOR ALL valid KAIN shader sources, compiling then executing then compiling again SHALL produce identical SPIR-V bytecode (compilation idempotence property)

---

### Requirement 3: Advanced Selection Tools

**User Story:** As a digital artist, I want professional selection tools (magic wand, lasso, marquee), so that I can isolate regions for precise painting.

#### Acceptance Criteria

1. WHEN the magic wand tool is used, THE Selection_Mask SHALL select connected pixels within tolerance threshold using flood-fill — `selectMagicWand()` already exists in `SimpleCanvas.ts`
2. THE Selection_Mask SHALL support tolerance range from 0 to 255 with default value of 32 (current default in `KGraphosEngine.ts` is 24; align to 32 for industry standard)
3. WHEN the lasso tool is used, THE Selection_Mask SHALL create a selection from freehand drawn path — `selectLasso()` already exists in `SimpleCanvas.ts`
4. WHEN the marquee tool is used, THE Selection_Mask SHALL create rectangular or elliptical selections — `selectMarquee()` already exists for rectangular; elliptical is **not yet implemented**
5. THE Selection_Mask SHALL support boolean operations (add, subtract, intersect, invert) — `SelectionMode` enum in `SimpleCanvas.ts` supports `replace`; add/subtract/intersect modes need to be implemented
6. THE Selection_Mask SHALL display animated marching ants border at 8 pixels per second
7. WHEN a selection exists, THE GPU_Pipeline SHALL constrain painting to selected regions
8. THE Selection_Mask SHALL support feathering with radius from 0 to 100 pixels
9. THE Selection_Mask SHALL support saving and loading as Alpha_Map assets
10. FOR ALL selection operations, selecting region A then inverting twice SHALL restore original selection A (inversion round-trip property)

---

### Requirement 4: PBR Material Channel Painting

**User Story:** As a texture artist, I want to paint directly on PBR material channels, so that I can author game-ready textures with proper physically-based properties.

#### Acceptance Criteria

1. THE Canvas_Engine SHALL support simultaneous painting on multiple PBR_Channel layers (albedo, normal, roughness, metallic, AO, emissive, height, opacity)
2. WHEN material painting mode is enabled, THE Canvas_Engine SHALL display active PBR_Channel toggles
3. THE Canvas_Engine SHALL apply channel-specific constraints (normal maps use tangent-space encoding, roughness/metallic are grayscale)
4. WHEN painting on normal channel, THE GPU_Pipeline SHALL encode brush strokes as tangent-space normals (RGB = XYZ mapped to 0–1 range) — `FILTER_NORMAL_FRAG` already computes Sobel-based normals in `GraphosShaders.ts`; direct normal painting needs a separate brush mode
5. THE Material_Library SHALL provide material presets loadable as painting references — `k-os-material::preset.rs` already implements `MaterialPreset` with PBR channels
6. THE Canvas_Engine SHALL display real-time PBR preview with active material channels
7. THE Canvas_Engine SHALL export material channel textures in formats: PNG (8-bit) for albedo/emissive/opacity; linear 16-bit PNG or EXR for normal/roughness/metallic/AO — note: EXR export requires adding the `exr` crate to the Rust backend; the `image` crate (already used in `k-os-baking`) supports PNG/JPEG/TGA/BMP natively
8. WHEN a material is loaded, THE Canvas_Engine SHALL populate all PBR_Channel layers from material texture slots via `k-os-material::library`

---

### Requirement 5: Layer Compositing System

**User Story:** As a digital artist, I want a professional layer system with blend modes and opacity, so that I can build complex compositions non-destructively.

#### Acceptance Criteria

1. THE Layer_Stack SHALL support layers with per-layer visibility, opacity, and blend mode — `SimpleLayer` in `SimpleCanvas.ts` carries these; no hard-coded layer count limit (memory-constrained)
2. THE Layer_Stack SHALL support blend modes: normal, multiply, screen, overlay, add, subtract, difference, darken, lighten — these are `GlobalCompositeOperation` values; `setLayerBlendMode()` is already wired in `KGraphosEngine.ts`
3. WHEN layer opacity is changed, THE Canvas_Engine SHALL recomposite within 16 milliseconds at 4K resolution (one frame budget on mid-range GPU via WebGL)
4. THE Layer_Stack SHALL support layer reordering via drag-and-drop
5. THE Layer_Stack SHALL support layer groups with nested hierarchy
6. THE Layer_Stack SHALL support layer masks as grayscale Alpha_Map
7. WHEN a layer is duplicated, THE Canvas_Engine SHALL create an independent copy with identical pixel data
8. THE Layer_Stack SHALL support layer merge operations (merge down, merge visible, flatten)
9. FOR ALL layer operations, the final composited image SHALL be deterministic given the same layer stack configuration (compositing determinism property)

---

### Requirement 6: Animation and Timeline System

**User Story:** As an animator, I want to keyframe layer properties over time, so that I can create animated textures and effects.

#### Acceptance Criteria

1. THE Timeline SHALL support frame-based animation with configurable FPS (1–120 fps)
2. THE Timeline SHALL support keyframing layer properties (visibility, opacity, blend mode, transform offset)
3. WHEN a keyframe is added, THE Timeline SHALL store layer state at current frame — `animationUtils.ts` exists in `src-frontend/features/graphos/` (1.1KB); a test file also exists; this is the starting scaffold
4. THE Timeline SHALL interpolate layer opacity between keyframes using linear interpolation; blend mode interpolation snaps at midpoint (no cross-fade between discrete enum values)
5. THE Timeline SHALL support playback with play/pause/stop controls
6. THE Timeline SHALL display keyframe markers on a timeline scrubber
7. WHEN timeline is scrubbed, THE Canvas_Engine SHALL update layer states to match frame
8. THE Timeline SHALL support frame range from 1 to 9999 frames
9. FOR ALL keyframe sequences, playing forward then backward SHALL restore original layer states (playback reversibility property)

---

### Requirement 7: GPU Simulation Layers

**User Story:** As a digital artist, I want real-time GPU simulations (drip, bleed, liquify), so that I can create organic and dynamic painting effects.

#### Acceptance Criteria

1. THE Simulation_Layer SHALL execute GPU fragment shaders (WGSL via Three.js) on layer pixel data each frame
2. THE Simulation_Layer SHALL support simulation types: drip, bleed, liquify, rivulet, growth, wind, magnetic, datamosh, nebula, thermal, sort, life, vortex, pixelSort — **all 14 are already implemented** in `KGraphosEngine.ts` and `GraphosShaders.ts`. Note: `erosion` listed in earlier drafts does NOT exist yet and must be added as new work
3. WHEN a simulation is enabled, THE GPU_Pipeline SHALL apply simulation kernel to active layer at up to 60 fps (frame rate depends on canvas resolution and GPU; 4K at 60 fps is achievable on mid-range or better GPU)
4. THE Simulation_Layer SHALL expose parameters (speed, chaos, decay, scale) with real-time adjustment — already implemented per-sim via uniform updates in `runSim()`
5. THE Simulation_Layer SHALL support multiple simultaneous simulations via sequential `applySimulation()` calls per frame
6. WHEN a simulation is disabled, THE Simulation_Layer SHALL preserve current layer state without reverting
7. THE Simulation_Layer SHALL support simulation reset to restore pre-simulation layer state via the Undo_System
8. To add new simulation types, authors SHALL write a WGSL fragment shader and register it in the `simMaterials` map — KAIN-compiled SPIR-V is only available for Rust backend paths; frontend simulations use Three.js WGSL directly

---

### Requirement 8: Brush Preset Registry

**User Story:** As a digital artist, I want to save and load brush presets, so that I can quickly switch between my favorite brush configurations.

#### Acceptance Criteria

1. THE Brush_Registry SHALL store brush presets as JSON files in data-driven format
2. THE Brush_Registry SHALL include default presets (INK, SOFT, CHISEL, SKETCH, WASH, ERASE, SCATTER, FILL) — `BrushPresetSelector.tsx` exists; expand with these named presets
3. WHEN a brush preset is saved, THE Brush_Registry SHALL serialize all brush parameters (size, opacity, flow, hardness, spacing, angle, jitter, alpha map reference, KAIN shader source path)
4. WHEN a brush preset is loaded, THE Brush_Registry SHALL restore all brush parameters
5. THE Brush_Registry SHALL support user-created custom presets stored in user data directory (Tauri `appLocalDataDir`)
6. THE Brush_Registry SHALL support brush preset import/export as `.kbrush` JSON files
7. THE Brush_Registry SHALL validate brush preset JSON against schema before loading
8. THE Brush_Registry SHALL support brush preset thumbnails as 128×128 PNG images
9. FOR ALL brush presets, saving then loading SHALL restore identical brush behavior (preset round-trip property)

---

### Requirement 9: Undo/Redo System

**User Story:** As a digital artist, I want undo/redo with deep history, so that I can experiment freely without fear of losing work.

#### Acceptance Criteria

1. THE Undo_System SHALL track all paint operations, layer changes, and selection modifications
2. THE Undo_System SHALL support undo history bounded by a **500 MB memory budget** (not a fixed count limit) — `UndoManagerConfig.max_memory_bytes` defaults to 500MB; actions are trimmed from oldest when limit is exceeded
3. WHEN undo is triggered, THE Undo_System SHALL restore previous state within 50 milliseconds for typical pixel-level operations
4. WHEN redo is triggered, THE Undo_System SHALL restore next state within 50 milliseconds
5. THE Undo_System SHALL use the `k-os-undo` crate (`UndoManager<State>`) for history management — already implemented with `execute()`, `undo()`, `redo()`, action merging, and memory tracking
6. WHEN new operations occur after undo, THE Undo_System SHALL clear the redo stack (existing behavior in `UndoManager::execute()`)
7. THE Undo_System SHALL merge continuous same-type operations (e.g., brush stroke samples) using `UndoableAction::can_merge()` / `merge()` — already implemented in `k-os-undo`
8. FOR ALL operation sequences, undoing N operations then redoing N operations SHALL restore original state (undo/redo round-trip property)

> **Note:** "Branching history" (keeping redo branches after new actions) is NOT implemented in `k-os-undo` and would require significant new architecture. Removed from requirements as aspirational scope.

---

### Requirement 10: Canvas Transform and Navigation

**User Story:** As a digital artist, I want smooth pan, zoom, and rotate controls, so that I can navigate large canvases efficiently.

#### Acceptance Criteria

1. THE Canvas_Engine SHALL support zoom range from 1 percent to 6400 percent
2. WHEN zoom is changed, THE Canvas_Engine SHALL update smoothly (CSS transform or shader-based zoom; "interpolate over 150ms" is a UI animation target, not a hard timing requirement)
3. THE Canvas_Engine SHALL support pan with middle mouse button or spacebar drag — `SimpleCanvas.ts` already handles pan
4. THE Canvas_Engine SHALL support zoom to cursor position maintaining world-space point under cursor
5. THE Canvas_Engine SHALL support canvas rotation from -180 to 180 degrees
6. THE Canvas_Engine SHALL support fit-to-screen command that frames entire canvas in viewport — `fitToScreen()` already exists in `KGraphosEngine.ts`
7. THE Canvas_Engine SHALL support 1:1 pixel zoom command
8. THE Canvas_Engine SHALL display current zoom percentage in UI
9. FOR ALL transform operations, the canvas SHALL maintain sub-pixel rendering precision during display (CSS/WebGL transform precision; no pixel rounding at default zoom)

---

### Requirement 11: Texture Dilation and Seam Prevention

**User Story:** As a texture artist, I want automatic texture dilation, so that UV seams don't show artifacts in 3D rendering.

#### Acceptance Criteria

1. THE Canvas_Engine SHALL support texture Dilation with iteration count from 0 to 32
2. WHEN exporting textures, THE Canvas_Engine SHALL apply Dilation to fill empty pixels around UV islands — `k-os-baking::dilation::dilate()` is implemented and uses 8-connected neighbor averaging with rayon parallelism
3. THE Dilation SHALL use weighted average of neighboring valid pixel colors — `dilate_weighted()` in `k-os-baking::dilation` implements distance-based weighting
4. THE Canvas_Engine SHALL display dilation preview overlay showing affected pixels
5. THE Canvas_Engine SHALL invoke `k-os-baking::dilation` via Tauri command for export-time dilation
6. WHEN dilation iterations is 0, THE Canvas_Engine SHALL export textures without dilation

---

### Requirement 12: Multi-Resolution Canvas Support

**User Story:** As a texture artist, I want to work at multiple resolutions (1K, 2K, 4K, 8K), so that I can balance performance and quality.

#### Acceptance Criteria

1. THE Canvas_Engine SHALL support canvas resolutions: 512, 1024, 2048, 4096, 8192 pixels square
2. WHEN canvas resolution is changed, THE Canvas_Engine SHALL resample all layers using bilinear filtering
3. THE Canvas_Engine SHALL display current canvas resolution in UI
4. THE Canvas_Engine SHALL warn when canvas resolution exceeds 4K on systems with less than 8GB VRAM — note: VRAM detection is via `navigator.gpu.requestAdapter()` on WebGPU or heuristic; WebGL has no direct VRAM query, so this is an approximation warning
5. THE Canvas_Engine SHALL support non-square canvas dimensions with independent width and height

---

### Requirement 13: Brush Dynamics and Tablet Support

**User Story:** As a digital artist using a pen tablet, I want pressure-sensitive brush dynamics, so that I can achieve natural painting strokes.

#### Acceptance Criteria

1. THE GPU_Pipeline SHALL detect pen tablet pressure input from 0.0 to 1.0 via `PointerEvent.pressure` (Web standard, supported by Wacom/XP-Pen drivers in browser/Tauri WebView)
2. THE GPU_Pipeline SHALL support pressure curves (linear, ease-in, ease-out, custom bezier)
3. THE GPU_Pipeline SHALL map pressure to brush parameters (size, opacity, flow, hardness)
4. THE GPU_Pipeline SHALL support tilt input (`PointerEvent.tiltX`, `PointerEvent.tiltY`) for brush angle modulation
5. THE GPU_Pipeline SHALL support rotation input (`PointerEvent.twist`) for brush angle — note: twist support varies by tablet driver/OS
6. THE GPU_Pipeline SHALL process input on every `pointermove` event without artificial throttling; effective input rate depends on OS/driver (typically 120–240 Hz on Wacom tablets via Tauri WebView)
7. WHEN no tablet is detected (`PointerEvent.pointerType === 'mouse'`), THE GPU_Pipeline SHALL fall back to mouse input with fixed pressure 1.0

---

### Requirement 14: Color Management and Picker

**User Story:** As a digital artist, I want professional color picking tools, so that I can select and manage colors efficiently.

#### Acceptance Criteria

1. THE Canvas_Engine SHALL support RGB, HSV, and HSL color models — `FILTER_HSL_FRAG` in `GraphosShaders.ts` already implements HSL↔RGB conversion
2. THE Canvas_Engine SHALL provide color picker UI with hue wheel, saturation/value square, and sliders
3. THE Canvas_Engine SHALL support eyedropper tool to sample colors from canvas via `getImageData()` on the composited canvas
4. THE Canvas_Engine SHALL maintain color history of last 16 used colors in localStorage
5. THE Canvas_Engine SHALL support color palette import/export as `.ase` (Adobe Swatch Exchange) files — note: `.ase` is a binary format; a parser must be written (no existing `.ase` code found in codebase)
6. THE Canvas_Engine SHALL support alpha channel in color picker for transparent painting
7. WHEN eyedropper samples a color, THE Canvas_Engine SHALL set brush color to sampled RGBA value

---

### Requirement 15: Export and Integration

**User Story:** As a texture artist, I want to export textures in multiple formats, so that I can use them in game engines and 3D applications.

#### Acceptance Criteria

1. THE Canvas_Engine SHALL export textures in formats: PNG (via canvas `toBlob()`), JPEG (via canvas `toBlob()`), TGA (Rust backend via `image` crate), EXR (Rust backend — requires `exr` crate, not currently in dependencies)
2. WHEN exporting PNG, THE Canvas_Engine SHALL support 8-bit color depth; 16-bit requires Rust backend via `image` crate
3. WHEN exporting EXR (HDR), THE Canvas_Engine SHALL use 16-bit float precision — this requires the `exr` crate added to `k-os-baking` or a new `k-os-export` crate
4. THE Canvas_Engine SHALL support batch export of all PBR_Channel layers with standard naming conventions (`{name}_albedo.png`, `{name}_normal.png`, etc.)
5. THE Canvas_Engine SHALL commit exported textures to Kernel_Artifact storage for cross-app access
6. THE Canvas_Engine SHALL support export to KAutopbr (K-Sample) for AI PBR generation — KAutopbr module exists in `src-frontend/features/autopbr/`
7. THE Canvas_Engine SHALL support export as Alpha_Map to kernel alpha library
8. FOR ALL export operations, exporting then importing SHALL preserve pixel data within acceptable precision (lossless for PNG, within 1% for JPEG lossy)

---

### Requirement 16: Performance Optimization

**User Story:** As a digital artist, I want consistent 60 fps viewport performance, so that I can work smoothly even with complex layer stacks.

#### Acceptance Criteria

1. THE Canvas_Engine SHALL maintain 60 fps viewport refresh rate with up to 20 layers at 2K resolution on mid-range GPU; 4K at 60 fps with 50 layers is a high-end GPU target only
2. THE GPU_Pipeline SHALL leverage `k-os-gpu-pipeline::buffer_pool` for buffer reuse (backend); frontend uses Three.js `WebGLRenderTarget` reuse
3. THE Canvas_Engine SHALL implement dirty region tracking to recomposite only changed areas
4. THE GPU_Pipeline SHALL minimize GPU↔CPU data transfer (keep pixel data on GPU; only download on export or eyedropper)
5. THE Canvas_Engine SHALL implement level-of-detail rendering showing lower resolution during pan/zoom (preview canvas at lower resolution while dragging)
6. THE Canvas_Engine SHALL display frame time statistics in debug mode via `k-os-gpu-pipeline::performance`
7. WHEN GPU memory pressure is detected, THE Canvas_Engine SHALL warn and suggest resolution reduction — detection is heuristic (canvas size × layer count × bytes/pixel vs estimated VRAM)

---

### Requirement 17: Stabilization and Bug Fixes

**User Story:** As a user of current KGraphos, I want all glitchy features fixed, so that I can rely on the application for production work.

#### Acceptance Criteria

1. THE Canvas_Engine SHALL eliminate all known crash conditions from current KGraphos (canvas initialization failures, Three.js context loss, etc.)
2. THE GPU_Pipeline SHALL validate all shader uniform inputs before submission to prevent WebGL errors
3. THE Layer_Stack SHALL use React state updates inside `requestAnimationFrame` to prevent compositing race conditions
4. THE Canvas_Engine SHALL handle edge cases (empty layers, zero-size brushes, out-of-bounds stroke coordinates) gracefully
5. THE Undo_System SHALL not leak memory — `k-os-undo` tracks `current_memory` and trims oldest actions when `max_memory_bytes` is exceeded
6. THE Canvas_Engine SHALL validate all user inputs and display toast-style error messages for invalid operations
7. THE Canvas_Engine SHALL emit structured console logs with `[KGraphos]` prefix for debugging

---

### Requirement 18: Data-Driven Architecture

**User Story:** As a developer, I want KGraphos to use data-driven configuration, so that adding new features doesn't require code changes.

#### Acceptance Criteria

1. THE Brush_Registry SHALL load brush definitions from JSON files at startup
2. THE Simulation_Layer SHALL load simulation type definitions from a JSON manifest (maps type name → shader source path)
3. THE Canvas_Engine SHALL load UI layout configuration from JSON (panel visibility, toolbar order)
4. THE Brush_Registry SHALL support hot-reload of brush definitions without restart — file changes detected via `ShaderHotReloader` (backend) or `localStorage`-based versioning (frontend)
5. THE Canvas_Engine SHALL validate all JSON configurations against JSON Schema before use
6. THE Brush_Registry SHALL provide a documented JSON schema for custom brush creation
7. WHEN JSON configuration is invalid, THE Canvas_Engine SHALL log errors and fall back to built-in defaults

---

### Requirement 19: Seamless K_OS Integration

**User Story:** As a K_OS user, I want KGraphos to integrate seamlessly with other K_OS apps, so that I can use painted textures across the suite.

#### Acceptance Criteria

1. THE Canvas_Engine SHALL commit painted textures to Kernel_Artifact storage via Tauri IPC
2. THE Canvas_Engine SHALL load 3D meshes from Kernel_Artifact for texture painting preview — `k-os-baking::bvh` provides CPU-side ray-mesh intersection for hit testing
3. THE Canvas_Engine SHALL support uplink to KPainter for 3D texture painting workflow — KPainter exists at `src-frontend/features/paint/`
4. THE Canvas_Engine SHALL support receiving baked textures from KBake for editing — KBake exists at `src-frontend/features/bake/`
5. THE Canvas_Engine SHALL use `k-os-material` for shared PBR material definitions
6. THE Canvas_Engine SHALL be discoverable by KContentBrowser for asset management
7. THE Canvas_Engine SHALL use the K_OS `kId` asset identity system from KObjectRegistry

---

### Requirement 20: Accessibility and Usability

**User Story:** As a digital artist, I want intuitive UI and keyboard shortcuts, so that I can work efficiently.

#### Acceptance Criteria

1. THE Canvas_Engine SHALL provide keyboard shortcuts for all common operations (B=brush, E=eraser, V=move, L=lasso, M=marquee, W=wand, [/]=brush size decrease/increase)
2. THE Canvas_Engine SHALL display keyboard shortcut hints in tool tooltips
3. THE Canvas_Engine SHALL support customizable keyboard shortcuts via JSON configuration
4. THE Canvas_Engine SHALL provide radial menus for quick tool access (hold Q for space menu, Shift+B for brush menu)
5. THE Canvas_Engine SHALL support command palette (Ctrl+K) for text-based command search
6. THE Canvas_Engine SHALL support light and dark UI themes

---

### Requirement 21: Universal Cursor System

**User Story:** As a digital artist working across 2D and 3D workflows, I want a context-aware cursor system that works seamlessly in 2D canvas, UV space, and 3D mesh preview modes.

> **Architecture note:** `k-os-engine/src/gpu/raycast/bvh.rs` implements a **real, working GPU BVH raycast pipeline** using wgpu compute shaders. It builds LBVH via Morton codes on CPU, uploads to GPU (`STORAGE` buffers), then traverses via stackless WGSL (32-level stack, slab AABB test, Möller–Trumbore triangle test, UV barycentric interpolation). The result is read back via staging buffer. Tauri commands `gpu_raycast_init` / `gpu_raycast` / `gpu_raycast_dispose` are already defined and ready to call from the frontend. The `GpuSpatialGrid` (`gpu/spatial/grid.rs`) supports O(1) sphere queries for vertex proximity. The cursor system will use these existing Tauri commands — no new raycast infrastructure needed.

#### Acceptance Criteria

1. THE Universal_Cursor_System SHALL support cursor rendering in: 2D screenspace (canvas), UV texture space, and UI overlay space
2. WHEN in 3D preview mode, THE Universal_Cursor_System SHALL call the `gpu_raycast` Tauri command (wraps `GpuBvhRaycast` in `k-os-engine`) to project cursor onto mesh surface — BVH is LBVH Morton-code on CPU, traversal is stackless WGSL on GPU; time returned in `RayHit.time_ms`, typically <0.5ms at 100K triangles
3. WHEN cursor enters UI elements, THE Cursor_State_Machine SHALL transition to UI mode
4. WHEN cursor enters canvas, THE Cursor_State_Machine SHALL transition to painting mode and display brush cursor
5. WHEN cursor enters 3D viewport, THE Cursor_State_Machine SHALL transition to 3D mode and project cursor onto mesh surface via BVH
6. THE Hit_Test SHALL perform spatial queries at pointer event rate (not a fixed Hz — driven by `pointermove` events)
7. THE Cursor_Registry SHALL load cursor definitions from JSON manifest with hot-reload support
8. THE Cursor_Plugin SHALL support user-created behaviors via JSON configuration and WGSL/KAIN shader code
9. WHEN a Cursor_Plugin is loaded, THE Universal_Cursor_System SHALL validate plugin schema and register cursor behaviors
10. THE Universal_Cursor_System SHALL support cursor shape morphing based on context (brush circle, crosshair, lasso, wand, move arrows)
11. THE Universal_Cursor_System SHALL render brush cursor with sub-pixel precision using a WebGL overlay (existing `KGraphosCursor.tsx` is the starting point)
12. THE Universal_Cursor_System SHALL expose a `useCursor()` React hook for use across K_OS apps
13. THE Cursor_State_Machine SHALL support state transitions defined in JSON configuration
14. WHEN cursor is over canvas, THE Hit_Test SHALL detect canvas bounds with pixel-perfect accuracy
15. WHEN cursor is over 3D mesh, THE BVH hit test SHALL return hit point, surface normal, UV coordinates, and triangle index
16. THE Universal_Cursor_System SHALL implement cursor smoothing with configurable interpolation (linear, ease-out, spring)
17. THE Cursor_Registry SHALL include default cursor presets (standard, precision, large, colorblind-friendly)
18. THE Universal_Cursor_System SHALL support cursor scaling based on zoom level maintaining visual size
19. THE Universal_Cursor_System SHALL render overlays (size indicator, angle guide, pressure visualization) as separate canvas layers
20. WHEN tablet pressure changes, THE Universal_Cursor_System SHALL update cursor size in real-time without frame drops
21. THE Universal_Cursor_System SHALL support cursor snapping to grid, guides, or selection edges
22. THE Universal_Cursor_System SHALL implement cursor prediction for lower input latency (predict next position based on velocity)
23. THE Cursor_Plugin SHALL support custom cursor rendering via WGSL fragment shaders for procedural cursor effects
24. THE Universal_Cursor_System SHALL expose cursor events (enter, exit, move, click, drag) to plugin system
25. THE Hit_Test SHALL detect layered UI elements and return topmost interactive element (DOM `elementFromPoint()` or custom bounds tree)
26. THE Universal_Cursor_System SHALL support cursor locking (constrain to axis, lock to surface)
27. THE Universal_Cursor_System SHALL implement cursor feedback for invalid operations (red flash, shake animation)
28. FOR ALL cursor operations, the system SHALL maintain input-to-render latency under 16ms (one frame at 60fps)
29. FOR ALL cursor state transitions, transitioning from state A to B then back to A SHALL restore original cursor configuration (state round-trip property)

#### Technical Architecture

**Rust Backend (extend `k-os-engine` — no new crate needed):**
- `GpuBvhRaycast` in `gpu/raycast/bvh.rs` — **already implemented**, Tauri commands ready
- `GpuSpatialGrid` in `gpu/spatial/grid.rs` — **already implemented**, O(1) sphere vertex queries
- `CursorManager` — new module in `k-os-engine/src/cursor/` for state machine and cursor registry
- `CursorRegistry` — JSON-based cursor definition loader

**TypeScript Frontend (`src-frontend/features/cursor/` — new):**
- `useCursor()`: React hook calling `gpu_raycast` Tauri command for 3D mode
- `CursorProvider`: Context provider
- `CursorOverlay`: WebGL canvas rendering cursor shapes via Three.js ShaderMaterial
- Refactor `KGraphosCursor.tsx` → integrate as 2D canvas cursor mode

**Data-Driven Configuration:**
- `config/cursor/cursor_registry.json`: Cursor shape definitions
- `config/cursor/cursor_state_machine.json`: State transition rules  
- `config/cursor/schemas/cursor.schema.json`: JSON Schema validation

**GPU Shaders (WGSL — frontend):**
- `cursor_render.wgsl`: Cursor circle/crosshair/shape rendering
- `cursor_trail.wgsl`: Motion blur and trail effects

#### Integration Points

1. **3D Hit Testing**: Call `gpu_raycast` Tauri command (wraps `GpuBvhRaycast`) — **already exists**, returns `RayHit{hit, point, normal, uv, distance, triangle_id}` in <1ms for scenes up to ~500K triangles
2. **Vertex Proximity**: Use `GpuSpatialGrid::encode_query()` for "snap to vertex" features
3. **Mesh Upload**: Use `ZeroCopyMesh::from_xyz_arrays()` to upload mesh once; `gpu_raycast_init` takes positions + indices
4. **Existing Cursor**: Refactor `KGraphosCursor.tsx` into Universal_Cursor_System 2D mode
5. **UI Hit Testing**: DOM `document.elementFromPoint()` for UI element detection
6. **Alpha Brushes**: `AlphaPool` (global GPU alpha texture cache) feeds brush cursor rendering
7. **Cross-App API**: Export `useCursor()` hook to KSculpt, KPainter, KWeight

#### Performance Targets

- Cursor position update: driven by `pointermove` (no fixed Hz)
- **GPU BVH hit test (`gpu_raycast` Tauri)**: typically <0.5ms for 100K triangles; includes GPU dispatch + staging buffer readback via `device.poll(PollType::Wait)`. Time is measured and returned in `RayHit.time_ms`
- **GPU Spatial Grid sphere query**: <0.1ms for 1M vertices after grid is built
- UI hit test: <0.5ms (`elementFromPoint` + bounds check)
- Cursor render: <1ms (WebGL fullscreen quad Three.js ShaderMaterial)
- State transition: <0.1ms (JS object lookup)
- Total effective latency: <16ms (within one 60fps frame)

> **Note on GPU readback latency**: The current `GpuBvhRaycast::raycast()` uses synchronous `device.poll(PollType::Wait)` which blocks the Tauri command thread until GPU finishes. For cursor use, this is called per `pointermove` event from a separate Tauri async command — acceptable for interactive rates. Future optimization: double-buffer the staging readback to overlap with next frame's dispatch.

#### Plugin System Example

```json
{
  "name": "glow-brush-cursor",
  "version": "1.0.0",
  "description": "Cursor with glow ring sized to brush radius",
  "cursor_shape": "circle",
  "shader": "cursor_glow.wgsl",
  "parameters": {
    "glow_radius": 1.2,
    "glow_color": [0.0, 1.0, 0.8, 0.6],
    "pulse_rate": 1.5
  },
  "contexts": ["2d_canvas", "uv_space"],
  "events": {
    "on_pressure_change": "update_size",
    "on_move": "update_position"
  }
}
```
