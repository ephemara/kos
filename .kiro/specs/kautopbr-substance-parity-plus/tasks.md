# Implementation Plan: KAutoPBR Substance Parity Plus

## Overview

This implementation plan breaks down the KAutoPBR feature into 8 phases following the design's recommended roadmap. The killer feature is the Material Animation System (keyframe, procedural, and physics-based animation), which is prioritized in Phase 2 to deliver unique value early.

The implementation uses:
- **Rust** for backend (k-os-engine crate with wgpu GPU compute)
- **TypeScript + React** for frontend (Three.js for 3D preview)
- **Python** for AI/ML operations (sidecar process with JSON-RPC)

Each task references specific requirements for traceability. Tasks marked with `*` are optional and can be skipped for faster MVP delivery. Property-based tests validate the 29 correctness properties from the design document.

## Tasks

### Phase 1: Core Material System (Foundation)

- [x] 1. Set up project structure and core data models
  - Create directory structure: `crates/k-os-engine/src/material/`, `src-frontend/features/material/kautopbr/`, `src-python/kos/autopbr/`
  - Define Rust data structures: `Material`, `MaterialMetadata`, `MaterialCategory`, `MaterialSystem`
  - Define TypeScript interfaces: `MaterialHandle`, `MaterialMetadata`, `MaterialCategory`
  - Set up JSON schema files in `config/autopbr/schemas/`: `material.schema.json`, `animation.schema.json`, `extension.schema.json`
  - _Requirements: 9.1, 9.2, 9.3, 18.9, 19.1_

- [x] 2. Implement material serialization and parsing
  - [x] 2.1 Create material JSON serializer in Rust
    - Implement `Material::serialize()` method using `serde_json`
    - Support pretty-printed and compact output modes
    - Include all fields: layers, animation, metadata, variants
    - _Requirements: 19.1, 19.2, 19.4, 19.5_
  
  - [x] 2.2 Create material JSON parser in Rust
    - Implement `Material::deserialize()` method
    - Validate JSON against schema before parsing
    - Return descriptive errors with line/column numbers on failure
    - _Requirements: 19.3, 19.7, 19.8_
  
  - [x] 2.3 Write property test for serialization round-trip
    - **Property 1: Material Serialization Round-Trip**
    - **Validates: Requirements 2.10, 2.11, 5.10, 5.11, 9.12, 19.6**
    - Generate arbitrary materials, serialize to JSON, deserialize, verify equivalence
    - Test with 100+ iterations due to randomization

- [ ] 3. Implement Material System Core
  - [x] 3.1 Create MaterialSystem struct with GPU compute integration
    - Implement `MaterialSystem::new()` with `Arc<GpuCompute>` parameter
    - Add material CRUD operations: create, load, save, delete
    - Implement UUID generation and uniqueness validation
    - _Requirements: 9.1, 9.2_
  
  - [-] 3.2 Write property test for UUID uniqueness
    - **Property 11: Material UUID Uniqueness**
    - **Validates: Requirements 9.2**
    - Generate multiple materials, verify all UUIDs are unique and valid format
  
  - [x] 3.3 Implement Asset Manager
    - Create hierarchical folder structure for material library
    - Implement metadata storage: name, description, tags, author, dates, version
    - Add search functionality with fuzzy matching
    - Add filtering by MaterialCategory enum
    - _Requirements: 9.1, 9.3, 9.4, 9.5_
  
  - [x] 3.4 Create Tauri command handlers
    - Implement commands in `src-tauri/src/commands/autopbr.rs`
    - Register commands in `src-tauri/src/main.rs` invoke_handler
    - Commands: create_material, load_material, save_material, delete_material, search_materials
    - _Requirements: 9.1, 9.2, 9.4_
  
  - [x] 3.5 Create TypeScript service client
    - Implement `AutoPBRClient` class in `src-frontend/services/autoPBRClient.ts`
    - Wrap all Tauri IPC calls with typed methods
    - Add error handling with user-friendly messages
    - _Requirements: 9.1, 9.2, 9.4_

- [ ] 4. Implement Layer Stack System
  - [x] 4.1 Create Layer and PBRMaps data structures
    - Define `Layer` struct with id, name, maps, opacity, blend_mode, mask, visible, locked
    - Define `PBRMaps` struct with optional texture handles for all map types
    - Define `BlendMode` enum with 10 blend modes
    - Define `Mask` struct with texture and invert flag
    - _Requirements: 2.1, 2.4, 2.5, 2.7_

  - [x] 4.2 Implement LayerStack with CPU blending
    - Create `LayerStack` struct with layer vector and GPU compute reference
    - Implement add_layer, remove_layer, reorder operations
    - Implement set_opacity, set_blend_mode, set_mask operations
    - Implement CPU-based blend_layers() for all 10 blend modes
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.7, 2.13_
  
  - [x] 4.3 Create GPU layer blending shader
    - Write WGSL shader in `crates/k-os-engine/src/gpu/pipelines/layer_blend.wgsl`
    - Implement all 10 blend mode functions: Normal, Multiply, Screen, Overlay, Add, Subtract, Divide, Difference, Darken, Lighten
    - Ensure 16-byte alignment for uniform buffers (use vec4<f32>)
    - Support mask texture with invert option
    - _Requirements: 2.5, 2.6, 2.7, 2.8_
  
  - [x] 4.4 Implement GPU-accelerated layer blending
    - Create Rust wrapper for layer_blend.wgsl shader
    - Implement `LayerStack::blend_layers_gpu()` method
    - Use buffer pools for efficient memory management
    - Support textures up to 16K resolution with tiling
    - _Requirements: 2.6, 17.1, 17.2, 17.5_
  
  - [ ] 4.5 Write property test for blend determinism
    - **Property 3: Layer Blend Determinism**
    - **Validates: Requirements 2.6**
    - Generate arbitrary layer stacks, blend multiple times, verify identical output
  
  - [ ] 4.6 Write unit tests for layer operations
    - Test layer add/remove/reorder operations
    - Test opacity and blend mode changes
    - Test mask application
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.7, 2.8_

- [ ] 5. Implement basic preview renderer
  - [x] 5.1 Create PreviewViewport React component
    - Set up Three.js scene with @react-three/fiber
    - Add orbit controls for camera manipulation
    - Implement preview shapes: Sphere, Cube, Cylinder, Plane, Torus
    - _Requirements: 8.1, 8.3, 8.8_

  - [x] 5.2 Implement PBR material rendering
    - Create Three.js MeshStandardMaterial with PBR maps
    - Support all map types: albedo, normal, roughness, metallic, AO, height, emissive
    - Implement real-time parameter updates (< 33ms latency)
    - _Requirements: 8.3, 15.1, 18.1_
  
  - [x] 5.3 Add lighting presets
    - Implement lighting presets: Studio, Outdoor, Indoor, Sunset, Night
    - Support HDR environment maps for image-based lighting
    - Update preview within 100ms on lighting change
    - _Requirements: 8.9, 8.10_
  
  - [ ] 5.4 Write property test for preview lighting update latency
    - **Property 10: Preview Lighting Update Latency**
    - **Validates: Requirements 8.10**
    - Measure time from lighting change to preview update, verify < 100ms
  
  - [ ] 5.5 Write property test for parameter update latency
    - **Property 18: Real-Time Parameter Update Latency**
    - **Validates: Requirements 15.1**
    - Measure time from parameter change to preview update, verify < 33ms

- [ ] 6. Create main KAutoPBR UI
  - [x] 6.1 Create KAutoPBR.tsx main component
    - Set up app layout with left panel, center viewport, right panel
    - Integrate PreviewViewport component
    - Set up state management with Zustand or Jotai
    - _Requirements: 15.1_
  
  - [x] 6.2 Create LeftPanel component
    - Add material library browser with thumbnail grid
    - Add preset selector with categories
    - Add generator options (photogrammetry, HDR, procedural)
    - _Requirements: 9.6, 14.3, 14.8_
  
  - [x] 6.3 Create RightPanel component
    - Add parameter controls with sliders and color pickers
    - Add PBR map display with thumbnails
    - Add layer stack UI with drag-and-drop reordering
    - _Requirements: 2.1, 15.2, 15.3_

  - [x] 6.4 Create LayerStack UI component
    - Display layers with thumbnails, names, visibility toggles
    - Support drag-and-drop reordering
    - Add blend mode dropdown and opacity slider per layer
    - Add mask controls
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.13_

- [x] 7. Checkpoint - Core system functional
  - Verify material creation, layer management, and preview rendering work end-to-end
  - Test serialization/deserialization round-trip
  - Ensure all tests pass
  - Ask the user if questions arise

### Phase 2: Animation Engine (Killer Feature)

- [ ] 8. Implement keyframe animation system
  - [x] 8.1 Create animation data structures
    - Define `AnimationData` struct with duration, loop_mode, tracks
    - Define `AnimationTrack` with parameter and animation_type
    - Define `AnimationParameter` enum for all animatable parameters
    - Define `KeyframeAnimation` with keyframes and interpolation type
    - Define `Keyframe` struct with time, value, tangents
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.10_
  
  - [x] 8.2 Implement keyframe interpolation
    - Implement Linear interpolation
    - Implement Ease-In, Ease-Out, Ease-In-Out curves
    - Implement Bezier curve interpolation with tangent control
    - _Requirements: 5.4_
  
  - [x] 8.3 Create AnimationEngine with keyframe evaluation
    - Implement `AnimationEngine::new()` with GPU compute reference
    - Implement `evaluate_keyframe()` method
    - Support all loop modes: Once, Loop, Ping-Pong
    - Return HashMap of parameter values at given time
    - _Requirements: 5.2, 5.4, 5.5, 5.6_
  
  - [ ] 8.4 Write property test for animation frame rate
    - **Property 7: Animation Playback Frame Rate**
    - **Validates: Requirements 5.5**
    - Play animation, measure frame rate, verify ≥ 60 fps

  - [ ] 8.5 Write unit tests for keyframe interpolation
    - Test linear interpolation accuracy
    - Test easing curve shapes
    - Test Bezier curve with tangent control
    - Test loop modes
    - _Requirements: 5.4, 5.6_

- [ ] 9. Implement procedural animation system
  - [x] 9.1 Create expression evaluator
    - Implement `ExpressionEvaluator` with parser for math expressions
    - Support variable: t (time)
    - Support functions: sin, cos, tan, abs, sqrt, pow, min, max, clamp, lerp
    - Support operators: +, -, *, /, ^
    - _Requirements: 6.1, 6.2_
  
  - [x] 9.2 Add noise functions to expression evaluator
    - Implement Perlin noise function
    - Implement Simplex noise function
    - Implement Worley noise function
    - Support noise parameters: frequency, amplitude, octaves, lacunarity, persistence
    - _Requirements: 6.6, 6.7_
  
  - [x] 9.3 Implement procedural animation evaluation
    - Define `ProceduralAnimation` struct with expression and noise_config
    - Implement `evaluate_procedural()` method in AnimationEngine
    - Support UV scrolling with X/Y speed parameters
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.8, 6.9_
  
  - [ ] 9.4 Write property test for expression error reporting
    - **Property 8: Expression Evaluation Error Reporting**
    - **Validates: Requirements 6.11**
    - Generate invalid expressions, verify error messages include expression text
  
  - [ ] 9.5 Write unit tests for procedural animation
    - Test specific expressions: "sin(t * 2.0) * 0.5 + 0.5"
    - Test noise functions with various parameters
    - Test UV scrolling
    - Test expression validation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ] 10. Create animation timeline UI
  - [x] 10.1 Create AnimationTimeline React component
    - Display timeline with time ruler and playhead
    - Support scrubbing timeline with mouse drag
    - Add play/pause/stop controls
    - Display current time and total duration
    - _Requirements: 5.7, 5.12_
  
  - [x] 10.2 Implement keyframe editor UI
    - Display keyframes as markers on timeline
    - Support adding keyframes with click
    - Support dragging keyframes to adjust timing
    - Support selecting and deleting keyframes
    - Add interpolation type selector per keyframe
    - _Requirements: 5.2, 5.4_
  
  - [x] 10.3 Add animation track UI
    - Display animation tracks for each parameter
    - Support adding/removing tracks
    - Add procedural expression editor with syntax highlighting
    - Add expression preset dropdown
    - _Requirements: 5.1, 5.12, 6.1, 6.12_
  
  - [x] 10.4 Integrate animation playback with preview
    - Connect AnimationEngine to PreviewRenderer
    - Update material parameters at 60fps during playback
    - Support real-time scrubbing with preview update
    - _Requirements: 5.5, 5.7_

- [ ] 11. Add animation presets and data-driven config
  - [x] 11.1 Create animation preset JSON schema
    - Define schema in `config/autopbr/schemas/animation.schema.json`
    - Include fields: name, description, tracks, duration, loop_mode
    - _Requirements: 18.2, 18.9_
  
  - [x] 11.2 Create animation preset files
    - Create presets: Flowing Water, Flickering Fire, Pulsing Emissive, Breathing Effect, Wind Sway
    - Store in `config/autopbr/animation_presets/`
    - _Requirements: 6.12_

  - [x] 11.3 Implement preset loading system
    - Load animation presets from JSON files on startup
    - Validate against schema
    - Support hot-reloading of preset files
    - _Requirements: 18.1, 18.2, 18.5, 18.6_

- [x] 12. Checkpoint - Animation system complete (KILLER FEATURE)
  - Verify keyframe animation works with all interpolation types
  - Verify procedural animation with expressions and noise
  - Test animation presets
  - Ensure 60fps playback performance
  - Ask the user if questions arise

### Phase 3: Photogrammetry & HDR

- [x] 13. Implement photogrammetry pipeline
  - [x] 13.1 Set up feature detection
    - Add `akaze` or `opencv-rust` crate for feature detection
    - Implement SIFT or AKAZE feature extraction
    - Extract features from all input images
    - _Requirements: 1.1, 1.2_
  
  - [x] 13.2 Implement feature matching
    - Match features between image pairs
    - Use RANSAC for robust matching
    - Estimate camera poses from matches
    - _Requirements: 1.2_
  
  - [x] 13.3 Implement 3D reconstruction
    - Triangulate 3D points from matched features
    - Generate point cloud with positions, colors, normals
    - Support 2-500 input images
    - _Requirements: 1.1, 1.3, 1.6_
  
  - [x] 13.4 Implement mesh generation
    - Use Poisson surface reconstruction or similar algorithm
    - Generate triangle mesh from point cloud
    - Compute UV coordinates for texture projection
    - _Requirements: 1.3, 1.4_
  
  - [x] 13.5 Implement texture projection
    - Project source images onto mesh surface
    - Blend multiple projections for best quality
    - Generate texture atlas
    - _Requirements: 1.4_

  - [x] 13.6 Implement PBR map extraction
    - Extract albedo map from textured mesh
    - Generate normal map from mesh geometry
    - Estimate roughness, metallic, AO, height maps
    - _Requirements: 1.5, 1.10_
  
  - [ ] 13.7 Write property test for PBR map completeness
    - **Property 2: PBR Map Generation Completeness**
    - **Validates: Requirements 1.10**
    - Generate reconstructions, verify all 6 map types are non-null with valid dimensions
  
  - [ ] 13.8 Write unit tests for photogrammetry
    - Test feature extraction with sample images
    - Test feature matching with known correspondences
    - Test error handling for insufficient features
    - _Requirements: 1.1, 1.2, 1.7_
  
  - [x] 13.9 Add GPU acceleration for photogrammetry
    - Use GPU for feature extraction where possible
    - Use GPU for texture projection
    - _Requirements: 1.8_
  
  - [x] 13.10 Integrate with Asset Manager
    - Save reconstructed mesh and textures to material library
    - Generate material from PBR maps
    - _Requirements: 1.9_

- [x] 14. Implement HDR capture system
  - [x] 14.1 Create HDR data structures
    - Define `HDRImage` struct with float RGB data
    - Define `HDRFormat` enum: RadianceRGBE, OpenEXR
    - Define `Light` struct with type, position, direction, intensity, color_temperature
    - _Requirements: 3.1, 3.2, 3.5_
  
  - [x] 14.2 Implement multi-exposure HDR merging
    - Add `exr` and `image-hdr` crates for HDR format support
    - Implement exposure merging algorithm
    - Support exposure values -10 EV to +10 EV
    - _Requirements: 3.2, 3.3_

  - [x] 14.3 Implement tone mapping
    - Implement tone mapping methods: Reinhard, Filmic, ACES, Uncharted2
    - Convert HDR to LDR for preview display
    - _Requirements: 3.4_
  
  - [x] 14.4 Implement light authoring
    - Support adding point lights, directional lights, area lights
    - Render light contribution into HDR image using path tracing
    - Support intensity 0.0-1000000.0 lumens
    - Support color temperature 1000K-40000K
    - _Requirements: 3.5, 3.6, 3.7, 3.8_
  
  - [x] 14.5 Implement HDR file I/O
    - Save HDR images in .hdr (Radiance RGBE) format
    - Save HDR images in .exr (OpenEXR) format
    - Load HDR images from both formats
    - _Requirements: 3.9_
  
  - [x] 14.6 Integrate HDR with preview renderer
    - Use HDR environments for image-based lighting
    - Update lighting presets to use HDR environments
    - _Requirements: 3.10_
  
  - [x] 14.7 Write property test for HDR merge performance
    - **Property 4: HDR Merge Performance**
    - **Validates: Requirements 3.11**
    - Merge 8K HDR images, verify completion within 5 seconds
  
  - [x] 14.8 Write unit tests for HDR capture
    - Test exposure merging with known inputs
    - Test tone mapping algorithms
    - Test light addition
    - Test file I/O round-trip
    - _Requirements: 3.2, 3.4, 3.5, 3.9_

- [ ] 15. Checkpoint - Photogrammetry and HDR complete
  - Verify photogrammetry reconstruction from sample images
  - Verify HDR merging and tone mapping
  - Test light authoring
  - Ensure all tests pass
  - Ask the user if questions arise


### Phase 4: AI Integration

- [-] 16. Set up Python sidecar for AI/ML
  - [x] 16.1 Create Python project structure
    - Create directory: `src-python/kos/autopbr/`
    - Set up `__init__.py` and module structure
    - Add requirements.txt with dependencies: torch, diffusers, transformers, Pillow, opencv-python
    - _Requirements: 11.11_
  
  - [x] 16.2 Implement JSON-RPC bridge
    - Verify python_bridge.rs exists in src-tauri
    - Create Python RPC server with @register decorators
    - Test communication between Rust and Python
    - _Requirements: 11.11, 11.12_
  
  - [ ] 16.3 Write unit tests for Python bridge
    - Test JSON-RPC communication
    - Test error handling
    - Test data serialization/deserialization
    - _Requirements: 11.12_

- [ ] 17. Implement AI upscaling
  - [x] 17.1 Create upscaler Python module
    - Implement `upscaler.py` with neural network model
    - Support scale factors: 2x, 4x, 8x
    - Use Real-ESRGAN or similar model
    - _Requirements: 11.1, 11.2_
  
  - [x] 17.2 Register upscaling RPC function
    - Create @register("upscale_texture") function
    - Accept image bytes and scale factor
    - Return upscaled image bytes
    - _Requirements: 11.1, 11.2_
  
  - [x] 17.3 Integrate upscaling with Rust backend
    - Add upscale command to MaterialSystem
    - Call Python RPC from Rust
    - Handle errors and timeouts
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [ ] 17.4 Write unit tests for upscaling
    - Test 2x, 4x, 8x upscaling
    - Verify detail preservation
    - Test error handling
    - _Requirements: 11.1, 11.2, 11.3_


- [ ] 18. Implement AI denoising
  - [x] 18.1 Create denoiser Python module
    - Implement `denoiser.py` with denoising model
    - Use NAFNet or similar state-of-the-art denoiser
    - Preserve texture detail while reducing noise
    - _Requirements: 11.4, 11.5_
  
  - [x] 18.2 Register denoising RPC function
    - Create @register("denoise_texture") function
    - Accept image bytes and strength parameter
    - Return denoised image bytes
    - _Requirements: 11.4_
  
  - [ ] 18.3 Write property test for denoising effectiveness
    - **Property 13: Denoising Effectiveness**
    - **Validates: Requirements 11.5**
    - Add noise to clean texture, denoise, verify 80%+ noise reduction with edge preservation
  
  - [ ] 18.4 Write unit tests for denoising
    - Test denoising with various noise levels
    - Verify detail preservation
    - _Requirements: 11.4, 11.5_

- [ ] 19. Implement seamless tiling with AI inpainting
  - [ ] 19.1 Create tiling engine structure
    - Create `TilingEngine` struct with GPU compute and Python bridge
    - Define `TilingParams` with seamless_strength, perspective_correction, smart_crop, remove_folds
    - _Requirements: 4.1, 4.2_
  
  - [ ] 19.2 Implement edge analysis
    - Analyze texture edges for discontinuities
    - Generate edge mask for inpainting
    - _Requirements: 4.1_
  
  - [x] 19.3 Create inpainting Python module
    - Implement `inpainting.py` with Stable Diffusion inpainting
    - Use runwayml/stable-diffusion-inpainting model
    - Accept image, mask, and strength parameters
    - _Requirements: 4.2_

  - [ ] 19.4 Implement seamless tiling pipeline
    - Call edge analysis to detect discontinuities
    - Call Python inpainting to blend edges
    - Validate seamlessness by checking edge pixel similarity
    - Retry up to 3 times if validation fails
    - _Requirements: 4.2, 4.3, 4.7, 4.9_
  
  - [ ] 19.5 Implement perspective correction
    - Detect perspective distortion in texture
    - Apply automatic perspective correction
    - _Requirements: 4.5_
  
  - [ ] 19.6 Implement fold removal
    - Detect fold artifacts in fabric textures
    - Use AI inpainting to remove folds
    - _Requirements: 4.4_
  
  - [ ] 19.7 Write property test for seamless tiling validation
    - **Property 5: Seamless Tiling Validation**
    - **Validates: Requirements 4.7**
    - Process textures, verify edge pixel similarity within 5% tolerance
  
  - [ ] 19.8 Write property test for tiling retry limit
    - **Property 6: Tiling Retry Limit**
    - **Validates: Requirements 4.9**
    - Force tiling failures, verify exactly 3 retries before returning failure
  
  - [ ] 19.9 Write unit tests for tiling engine
    - Test edge analysis
    - Test perspective correction
    - Test fold removal
    - Test validation logic
    - _Requirements: 4.1, 4.4, 4.5, 4.7_

- [ ] 20. Implement material identification
  - [x] 20.1 Create material classifier Python module
    - Implement `material_classifier.py` with classification model
    - Use CLIP or custom trained model
    - Support categories: Metal, Wood, Stone, Fabric, Plastic, Leather, Concrete, Brick, Tile, Organic
    - Return category and confidence score
    - _Requirements: 11.6, 11.7, 11.8_

  - [x] 20.2 Register material identification RPC function
    - Create @register("identify_material") function
    - Accept image bytes
    - Return category and confidence score
    - _Requirements: 11.6, 11.7_
  
  - [ ] 20.3 Write unit tests for material identification
    - Test with known material samples
    - Verify correct category classification
    - Test confidence score ranges
    - _Requirements: 11.6, 11.7, 11.8_

- [ ] 21. Checkpoint - AI integration complete
  - Verify AI upscaling works at 2x, 4x, 8x
  - Verify denoising preserves detail
  - Verify seamless tiling with edge validation
  - Test material identification accuracy
  - Ensure all tests pass
  - Ask the user if questions arise

### Phase 5: Export Pipeline

- [ ] 22. Implement export system foundation
  - [x] 22.1 Create export data structures
    - Define `ExportFormat` enum: SBSAR, glTF, USD, Unreal, Unity, Godot, CustomJSON
    - Define `ExportOptions` with texture resolution, format, animation support
    - Define `MaterialExporter` trait
    - _Requirements: 10.1, 10.10, 10.11_
  
  - [x] 22.2 Create ExportPipeline struct
    - Implement `ExportPipeline` with HashMap of exporters
    - Add exporter registration system
    - Implement validation before export
    - _Requirements: 10.1, 10.12_
  
  - [ ] 22.3 Write property test for export validation
    - **Property 12: Export Validation**
    - **Validates: Requirements 10.12**
    - Export materials, verify validation runs and reports errors


- [ ] 23. Implement glTF exporter
  - [x] 23.1 Create glTF exporter implementation
    - Add `gltf` crate for glTF 2.0 support
    - Implement `GltfExporter` struct implementing `MaterialExporter` trait
    - Embed PBR maps following glTF 2.0 PBR specification
    - Support texture resolution and format options
    - _Requirements: 10.1, 10.3, 10.10, 10.11_
  
  - [x] 23.2 Add animation support to glTF export
    - Export keyframe animation data if present
    - Convert animation tracks to glTF animation format
    - _Requirements: 10.8_
  
  - [x] 23.3 Write unit tests for glTF export
    - Test material export with all map types
    - Test animation export
    - Validate glTF output structure
    - _Requirements: 10.3, 10.8_

- [x] 24. Implement USD exporter
  - [x] 24.1 Create USD exporter via Python
    - Add `pxr` (Pixar USD) to Python requirements
    - Implement USD export in Python module
    - Create UsdPreviewSurface material with texture nodes
    - _Requirements: 10.1, 10.4_
  
  - [x] 24.2 Register USD export RPC function
    - Create @register("export_usd") function
    - Accept material data and export options
    - Return USD file bytes
    - _Requirements: 10.4_
  
  - [x] 24.3 Write unit tests for USD export
    - Test material export with all map types
    - Validate USD file structure
    - _Requirements: 10.4_

- [x] 25. Implement game engine exporters
  - [x] 25.1 Create Unreal Engine exporter
    - Generate .uasset material file
    - Set up correct texture references for Unreal
    - Support Unreal's PBR workflow
    - _Requirements: 10.1, 10.5_

  - [x] 25.2 Create Unity exporter
    - Generate .mat material file
    - Configure for Unity Standard Shader
    - Set up texture references
    - _Requirements: 10.1, 10.6_
  
  - [x] 25.3 Create Godot exporter
    - Generate .tres material resource file
    - Configure for Godot's StandardMaterial3D
    - Set up texture paths
    - _Requirements: 10.1, 10.7_
  
  - [x] 25.4 Write unit tests for game engine exporters
    - Test Unreal export format
    - Test Unity export format
    - Test Godot export format
    - _Requirements: 10.5, 10.6, 10.7_

- [x] 26. Implement SBSAR exporter
  - [x] 26.1 Create SBSAR exporter
    - Add `zip` crate for archive creation
    - Package all maps and parameters into Substance Archive
    - Follow SBSAR format specification
    - _Requirements: 10.1, 10.2_
  
  - [x] 26.2 Write unit tests for SBSAR export
    - Test archive structure
    - Verify all maps are included
    - Test parameter preservation
    - _Requirements: 10.2_

- [ ] 27. Add animation baking for export
  - [ ] 27.1 Implement animation baking
    - Implement `AnimationEngine::bake_animation()` method
    - Generate texture sequences at specified FPS
    - Support baking to image files or video textures
    - _Requirements: 7.11, 7.12, 10.9_
  
  - [ ] 27.2 Integrate baking with export pipeline
    - Offer baking option when exporting animated materials to formats without animation support
    - Save baked sequences alongside material files
    - _Requirements: 10.9_

  - [ ] 27.3 Write unit tests for animation baking
    - Test baking at various FPS rates
    - Verify texture sequence generation
    - Test integration with export formats
    - _Requirements: 7.11, 7.12, 10.9_

- [ ] 28. Add batch export and data-driven export configs
  - [ ] 28.1 Implement batch export
    - Support exporting multiple materials simultaneously
    - Process exports in parallel using Rayon
    - Display progress for each item
    - _Requirements: 10.13_
  
  - [ ] 28.2 Create export format configuration files
    - Define export configs in `config/autopbr/export_formats/`
    - Include texture resolution, format, compression settings per format
    - Load configs on startup with schema validation
    - _Requirements: 18.3, 18.6_
  
  - [ ] 28.3 Write unit tests for batch export
    - Test batch processing of multiple materials
    - Verify parallel execution
    - Test progress reporting
    - _Requirements: 10.13_

- [ ] 29. Checkpoint - Export pipeline complete
  - Verify export to all formats: glTF, USD, SBSAR, Unreal, Unity, Godot
  - Test animation export and baking
  - Test batch export
  - Ensure all tests pass
  - Ask the user if questions arise

### Phase 6: Plugin System Integration

- [ ] 30. Integrate with Hyperdrive plugin system
  - [ ] 30.1 Set up plugin registry integration
    - Integrate with existing kosRegistry
    - Define extension manifest schema for KAutoPBR extensions
    - Store schema in `config/autopbr/schemas/extension.schema.json`
    - _Requirements: 21.1, 21.4_

  - [ ] 30.2 Define extension types and capabilities
    - Define extension types: Filter, Generator, MaterialProcessor, ExportFormat, ImportFormat, AnimationEffect, Theme, Shader, Command
    - Define capability-based access control via PluginContext
    - Define capabilities: MaterialAccess, LayerAccess, GpuCompute, FileIO, Network, AppApi
    - _Requirements: 21.1, 21.2_
  
  - [ ] 30.3 Write property test for extension manifest validation
    - **Property 26: Extension Manifest Validation**
    - **Validates: Requirements 21.4**
    - Generate extension manifests, verify validation against schema before activation
  
  - [ ] 30.4 Write property test for invalid extension error handling
    - **Property 27: Invalid Extension Error Handling**
    - **Validates: Requirements 21.6**
    - Load extensions with invalid manifests, verify error logging and 'error' status in Plugin Matrix

- [ ] 31. Implement hook system for material processing
  - [ ] 31.1 Define material processing hooks
    - Define hooks: pre_layer_blend, post_layer_blend, pre_export, post_export, pre_animation_eval, post_animation_eval
    - Integrate with existing hookBus
    - _Requirements: 21.7_
  
  - [ ] 31.2 Implement hook execution with error handling
    - Execute hooks at appropriate points in material pipeline
    - Catch and isolate extension crashes
    - Log errors and update extension status
    - _Requirements: 21.8, 21.19_
  
  - [ ] 31.3 Write property test for extension crash isolation
    - **Property 29: Extension Crash Isolation**
    - **Validates: Requirements 21.19**
    - Trigger extension crashes, verify isolation, status update, and continued operation

- [ ] 32. Implement resource monitoring for extensions
  - [ ] 32.1 Create ResourceMonitor
    - Track memory usage per extension (512MB limit)
    - Track execution time per operation (5s limit)
    - Track file handles per extension (100 limit)
    - _Requirements: 21.9, 21.10_

  - [ ] 32.2 Implement automatic termination on limit exceeded
    - Terminate extension operations exceeding limits
    - Log warnings with details
    - Update Plugin Matrix health indicator
    - _Requirements: 21.10, 21.11_
  
  - [ ] 32.3 Write property test for resource limit enforcement
    - **Property 28: Extension Resource Limit Enforcement**
    - **Validates: Requirements 21.10**
    - Create extensions exceeding limits, verify termination, logging, and health indicator update
  
  - [ ] 32.4 Write unit tests for resource monitoring
    - Test memory tracking
    - Test execution time tracking
    - Test file handle tracking
    - Test limit enforcement
    - _Requirements: 21.9, 21.10, 21.11_

- [ ] 33. Create Plugin Matrix UI
  - [ ] 33.1 Create PluginMatrix React component
    - Display all loaded extensions with status indicators
    - Show extension metadata: name, version, author, description
    - Display health indicators: memory usage, execution time, error count
    - Support enable/disable toggle per extension
    - _Requirements: 21.12, 21.13, 21.14_
  
  - [ ] 33.2 Add extension management controls
    - Add install/uninstall buttons
    - Add reload button for development
    - Display extension capabilities and permissions
    - Show error messages for failed extensions
    - _Requirements: 21.6, 21.15, 21.16_
  
  - [ ] 33.3 Write unit tests for Plugin Matrix UI
    - Test extension list rendering
    - Test status indicator updates
    - Test enable/disable functionality
    - _Requirements: 21.12, 21.13, 21.14_

- [ ] 34. Implement slot system for UI extensions
  - [ ] 34.1 Define UI extension slots
    - Define slots: left_panel_generator, right_panel_parameter, preview_overlay, timeline_track, export_option
    - Integrate with existing slotRegistry
    - _Requirements: 21.17_

  - [ ] 34.2 Implement slot rendering in UI
    - Render extension components in defined slots
    - Pass material context to extension components
    - Handle extension component errors gracefully
    - _Requirements: 21.17, 21.18_
  
  - [ ] 34.3 Write unit tests for slot system
    - Test slot registration
    - Test component rendering
    - Test context passing
    - Test error handling
    - _Requirements: 21.17, 21.18_

- [ ] 35. Checkpoint - Plugin system complete
  - Verify extension loading and validation
  - Test hook execution with sample extensions
  - Verify resource monitoring and limit enforcement
  - Test Plugin Matrix UI
  - Test crash isolation
  - Ensure all tests pass
  - Ask the user if questions arise

### Phase 7: Physics-Based Animation

- [ ] 36. Implement physics simulation foundation
  - [ ] 36.1 Create PhysicsSimulator struct
    - Define `PhysicsSimulator` with GPU compute reference
    - Define `SimulationType` enum: RustSpreading, MossGrowth, Erosion, Weathering, Cracking, Melting
    - Define parameter structs: RustParams, MossParams, ErosionParams
    - Implement simulation state management
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [ ] 36.2 Create physics animation data structures
    - Define `PhysicsAnimation` struct with simulation_type and parameters
    - Add PhysicsAnimation to AnimationType enum
    - Integrate with AnimationEngine
    - _Requirements: 7.1_

- [ ] 37. Implement rust spreading simulation
  - [ ] 37.1 Create rust spreading GPU shader
    - Write WGSL shader in `crates/k-os-engine/src/gpu/pipelines/physics_sim.wgsl`
    - Implement rust spreading algorithm with neighbor sampling
    - Support parameters: spread_rate, color_variation, roughness_increase, metallic_decrease
    - Ensure 16-byte alignment for uniform buffers
    - _Requirements: 7.2, 7.3_

  - [ ] 37.2 Implement rust spreading in PhysicsSimulator
    - Implement `initialize_rust_spreading()` method
    - Implement `step_simulation()` for rust spreading
    - Update all 5 map types: albedo, roughness, metallic, height, normal
    - _Requirements: 7.2, 7.3, 7.10_
  
  - [ ] 37.3 Write property test for physics simulation map updates
    - **Property 9: Physics Simulation Map Updates**
    - **Validates: Requirements 7.10**
    - Run physics simulation frame, verify all 5 map types are updated
  
  - [ ] 37.4 Write unit tests for rust spreading
    - Test spreading from seed points
    - Test parameter effects on spread rate and appearance
    - Test map updates
    - _Requirements: 7.2, 7.3, 7.10_

- [ ] 38. Implement moss growth simulation
  - [ ] 38.1 Create moss growth GPU shader
    - Implement reaction-diffusion algorithm for organic growth
    - Support parameters: growth_rate, coverage_density, color_variation, height_displacement
    - _Requirements: 7.4, 7.5_
  
  - [ ] 38.2 Implement moss growth in PhysicsSimulator
    - Implement `initialize_moss_growth()` method
    - Implement simulation step for moss growth
    - Update all map types with moss effects
    - _Requirements: 7.4, 7.5, 7.10_
  
  - [ ] 38.3 Write unit tests for moss growth
    - Test growth patterns
    - Test parameter effects
    - Test map updates
    - _Requirements: 7.4, 7.5, 7.10_

- [ ] 39. Implement erosion simulation
  - [ ] 39.1 Create erosion GPU shader
    - Implement surface wear algorithm based on exposure maps
    - Support parameters: erosion_rate, depth, edge_sharpness, dirt_accumulation
    - _Requirements: 7.6, 7.7_

  - [ ] 39.2 Implement erosion in PhysicsSimulator
    - Implement `initialize_erosion()` method
    - Implement simulation step for erosion
    - Update all map types with erosion effects
    - _Requirements: 7.6, 7.7, 7.10_
  
  - [ ] 39.3 Write unit tests for erosion
    - Test erosion patterns
    - Test parameter effects
    - Test map updates
    - _Requirements: 7.6, 7.7, 7.10_

- [ ] 40. Integrate physics animation with AnimationEngine
  - [ ] 40.1 Implement physics animation evaluation
    - Add `evaluate_physics()` method to AnimationEngine
    - Call PhysicsSimulator for each simulation step
    - Update material state with simulated maps
    - Support configurable update intervals (1-60 fps)
    - _Requirements: 7.8, 7.9_
  
  - [ ] 40.2 Add physics animation UI controls
    - Add physics simulation type selector
    - Add parameter controls for each simulation type
    - Add seed point editor for rust spreading
    - Add simulation reset button
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [ ] 40.3 Write unit tests for physics animation integration
    - Test animation evaluation with physics
    - Test simulation state management
    - Test parameter updates
    - _Requirements: 7.8, 7.9_

- [ ] 41. Checkpoint - Physics animation complete
  - Verify rust spreading simulation works
  - Verify moss growth simulation works
  - Verify erosion simulation works
  - Test all 5 map types update correctly
  - Ensure GPU acceleration works
  - Ask the user if questions arise

### Phase 8: Polish, Optimization & Advanced Features

- [ ] 42. Implement material variants system
  - [ ] 42.1 Create variant data structures
    - Add variant support to Material struct
    - Track base material UUID and overrides
    - _Requirements: 16.1, 16.2_

  - [ ] 42.2 Implement variant creation and management
    - Implement `create_variant()` method in MaterialSystem
    - Support parameter overrides without modifying base material
    - Implement variant propagation when base material changes
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  
  - [ ] 42.3 Write property test for variant propagation
    - **Property 19: Variant Propagation**
    - **Validates: Requirements 16.4**
    - Change base material properties, verify variants reflect changes unless overridden
  
  - [ ] 42.4 Add variant UI
    - Display variants in Asset Manager with visual indicators
    - Add variant creation dialog
    - Support variant comparison in preview
    - Add convert-to-independent-material option
    - _Requirements: 16.5, 16.6, 16.9, 16.10_
  
  - [ ] 42.5 Implement variant export optimization
    - Export variants as separate materials or variant set
    - Optimize storage by sharing common textures
    - _Requirements: 16.7, 16.8_

- [ ] 43. Implement preset system
  - [ ] 43.1 Create preset data structures and schema
    - Define preset JSON schema in `config/autopbr/schemas/preset.schema.json`
    - Include layer configurations, animation settings, processing parameters
    - _Requirements: 14.1, 14.2_
  
  - [ ] 43.2 Create built-in presets
    - Create 20+ presets covering common material types
    - Categories: Quick Start, Metal, Wood, Stone, Fabric, Organic, Custom
    - Store in `config/autopbr/presets/`
    - _Requirements: 14.3, 14.5_
  
  - [ ] 43.3 Implement preset loading and application
    - Load presets from JSON files on startup
    - Implement `apply_preset()` method in MaterialSystem
    - Validate presets against schema
    - _Requirements: 14.2, 14.4, 14.7_

  - [ ] 43.4 Write property test for preset serialization round-trip
    - **Property 16: Preset Serialization Round-Trip**
    - **Validates: Requirements 14.2**
    - Serialize presets to JSON, deserialize, verify equivalence
  
  - [ ] 43.5 Write property test for preset validation
    - **Property 17: Preset Validation**
    - **Validates: Requirements 14.7**
    - Import preset files, verify validation against schema and error reporting
  
  - [ ] 43.6 Add preset UI
    - Display preset browser with thumbnails and descriptions
    - Add preset search by name or category
    - Support preset import/export for sharing
    - _Requirements: 14.8, 14.9, 14.6_

- [ ] 44. Implement batch processing and automation
  - [ ] 44.1 Create batch processing system
    - Support batch operations: Generate PBR maps, Apply tiling, Upscale, Denoise, Export
    - Process items in parallel using Rayon
    - Display progress for each item and overall completion
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [ ] 44.2 Implement automation scripts
    - Support JSON configuration files for automation
    - Define automation actions: Load image, Apply preset, Adjust parameters, Export material, Save to library
    - Support conditional logic: if material type is Metal, then increase metallic to 1.0
    - _Requirements: 13.5, 13.6, 13.7, 13.8_
  
  - [ ] 44.3 Add error handling for batch processing
    - Log errors and continue processing remaining items
    - Generate batch processing report showing successful and failed operations
    - _Requirements: 13.9, 13.10_
  
  - [ ] 44.4 Write property test for batch processing error isolation
    - **Property 15: Batch Processing Error Isolation**
    - **Validates: Requirements 13.9**
    - Trigger failures in batch, verify error logging and continued processing

  - [ ] 44.5 Write unit tests for automation scripts
    - Test script loading and execution
    - Test conditional logic
    - Test action sequencing
    - _Requirements: 13.5, 13.6, 13.7, 13.8_

- [ ] 45. Implement workflow integration with K_OS apps
  - [ ] 45.1 Create WorkflowBridge service
    - Implement `WorkflowBridge` class in TypeScript
    - Add methods: sendToKPainter, sendToKBake, sendToKSculpt, importFromKGraphos
    - Use Tauri IPC for inter-app communication
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.9_
  
  - [ ] 45.2 Implement material UUID preservation
    - Preserve UUIDs across app transfers
    - Track material provenance (source app, creation time)
    - _Requirements: 12.8_
  
  - [ ] 45.3 Write property test for material transfer UUID preservation
    - **Property 14: Material Transfer UUID Preservation**
    - **Validates: Requirements 12.8**
    - Transfer materials between apps, verify UUID remains unchanged
  
  - [ ] 45.4 Add workflow UI controls
    - Add "Send to..." buttons in material context menu
    - Add import from K-Graphos option
    - Display transfer status and errors
    - _Requirements: 12.1, 12.3, 12.5, 12.7, 12.10_
  
  - [ ] 45.5 Write unit tests for workflow integration
    - Test material transfer to each app
    - Test import from K-Graphos
    - Test error handling
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.10_

- [ ] 46. Implement advanced preview features
  - [ ] 46.1 Add custom mesh support
    - Support importing .obj, .fbx, .gltf, .usd mesh files
    - Add custom mesh selector in preview UI
    - _Requirements: 8.2_

  - [ ] 46.2 Add ray tracing support
    - Detect GPU ray tracing capability
    - Implement path tracing preview mode
    - Support configurable samples per pixel (1-256)
    - _Requirements: 8.4, 8.5_
  
  - [ ] 46.3 Add comparison modes
    - Implement comparison modes: Single View, Side-by-Side, Before/After Slider, Quad View
    - Display multiple material variants simultaneously
    - _Requirements: 8.6, 8.7_
  
  - [ ] 46.4 Add screenshot capture
    - Support screenshot capture at resolutions up to 8K
    - Add screenshot button to preview UI
    - _Requirements: 8.12_
  
  - [ ] 46.5 Add material statistics display
    - Display triangle count, texture resolution, memory usage
    - Update statistics in real-time
    - _Requirements: 8.11_

- [ ] 47. Implement GPU fallback and monitoring
  - [ ] 47.1 Implement GPU fallback system
    - Detect GPU availability on startup
    - Fall back to CPU processing when GPU unavailable
    - Display warning to user when using CPU fallback
    - Ensure equivalent results between GPU and CPU
    - _Requirements: 17.4_
  
  - [ ] 47.2 Write property test for GPU fallback continuity
    - **Property 20: GPU Fallback Continuity**
    - **Validates: Requirements 17.4**
    - Process materials with GPU disabled, verify CPU fallback produces equivalent results
  
  - [ ] 47.3 Implement GPU memory monitoring
    - Track GPU memory usage for all operations
    - Report current and available GPU memory to user
    - Display in performance metrics panel
    - _Requirements: 17.10_
  
  - [ ] 47.4 Write property test for GPU memory reporting
    - **Property 21: GPU Memory Reporting**
    - **Validates: Requirements 17.10**
    - Run GPU operations, verify memory usage and available memory are reported


- [ ] 48. Implement configuration hot-reloading
  - [ ] 48.1 Add file watcher for configuration files
    - Watch all JSON config files in `config/autopbr/`
    - Detect file modifications
    - _Requirements: 18.5_
  
  - [ ] 48.2 Implement configuration reload
    - Reload modified configuration files
    - Validate against schemas
    - Apply changes without application restart
    - _Requirements: 18.5, 18.6_
  
  - [ ] 48.3 Write property test for configuration hot-reload
    - **Property 22: Configuration Hot-Reload**
    - **Validates: Requirements 18.5**
    - Modify config files, verify reload and application without restart
  
  - [ ] 48.4 Write property test for configuration schema validation
    - **Property 23: Configuration Schema Validation**
    - **Validates: Requirements 18.6**
    - Load JSON configs, verify validation against schemas
  
  - [ ] 48.5 Add configuration error reporting
    - Display detailed error messages with file path and line number
    - Log validation failures
    - _Requirements: 18.7_
  
  - [ ] 48.6 Write property test for parse error reporting
    - **Property 24: Parse Error Reporting**
    - **Validates: Requirements 19.7**
    - Parse invalid material JSON, verify error messages contain line and column numbers

- [ ] 49. Implement performance monitoring and optimization
  - [ ] 49.1 Add performance metrics display
    - Display FPS, frame time, GPU memory usage, CPU usage
    - Update metrics in real-time
    - Add performance metrics panel to UI
    - _Requirements: 20.1, 20.2_
  
  - [ ] 49.2 Implement performance budget warnings
    - Define performance budgets: frame time < 33ms, lighting update < 100ms, HDR merge < 5s
    - Display warnings when budgets exceeded
    - Log performance violations
    - _Requirements: 20.8_

  - [ ] 49.3 Write property test for performance budget warnings
    - **Property 25: Performance Budget Warnings**
    - **Validates: Requirements 20.8**
    - Trigger operations exceeding budgets, verify warnings are displayed
  
  - [ ] 49.4 Add performance profiling
    - Measure processing time for all operations
    - Generate performance reports
    - Identify bottlenecks
    - _Requirements: 20.1_
  
  - [ ] 49.5 Optimize critical paths
    - Profile layer blending performance
    - Profile animation evaluation performance
    - Profile GPU compute shader performance
    - Optimize identified bottlenecks
    - _Requirements: 20.1, 20.2_

- [ ] 50. Implement material library enhancements
  - [ ] 50.1 Add thumbnail generation
    - Generate 512x512 thumbnails for all materials
    - Use preview renderer for thumbnail generation
    - Cache thumbnails for fast loading
    - _Requirements: 9.6_
  
  - [ ] 50.2 Implement version control
    - Increment version number on material modification
    - Preserve previous versions
    - Add version comparison showing differences
    - _Requirements: 9.7, 9.8_
  
  - [ ] 50.3 Add material collections
    - Support grouping related materials into collections
    - Add collection management UI
    - _Requirements: 9.9_
  
  - [ ] 50.4 Implement batch operations
    - Support batch tagging of multiple materials
    - Support batch export of multiple materials
    - Support batch deletion of multiple materials
    - _Requirements: 9.11_

- [ ] 51. Add real-time parameter controls
  - [ ] 51.1 Implement parameter UI components
    - Add sliders for numeric parameters with ranges
    - Add color pickers with RGB, HSV, and Hex input modes
    - Display parameter tooltips with descriptions and valid ranges
    - _Requirements: 15.2, 15.3, 15.10_

  - [ ] 51.2 Add parameter linking
    - Support linking multiple parameters for simultaneous adjustment
    - Add link/unlink UI controls
    - _Requirements: 15.5_
  
  - [ ] 51.3 Add parameter randomization
    - Generate random values within specified ranges
    - Add randomize button per parameter
    - Support full material randomization
    - _Requirements: 15.6, 15.7_
  
  - [ ] 51.4 Implement parameter history
    - Support undo/redo with at least 50 history states
    - Add undo/redo buttons
    - Support parameter reset to default values
    - _Requirements: 15.8, 15.9_

- [ ] 52. Create comprehensive test suite
  - [ ] 52.1 Set up property-based testing framework
    - Add `proptest` crate for Rust property tests
    - Add `fast-check` package for TypeScript property tests
    - Configure minimum 100 iterations per property test
    - _Requirements: All property tests_
  
  - [ ] 52.2 Implement test data generators
    - Create arbitrary material generators
    - Create arbitrary layer stack generators
    - Create arbitrary animation data generators
    - Create arbitrary preset generators
    - _Requirements: Property tests 1, 3, 7, 16_
  
  - [ ] 52.3 Run all property-based tests
    - Execute all 29 property tests
    - Verify all properties hold across 100+ iterations
    - Fix any failures discovered
    - _Requirements: All 29 correctness properties_
  
  - [ ] 52.4 Create integration test suite
    - Test material creation → layer addition → animation → export workflow
    - Test photogrammetry → PBR generation → tiling → export workflow
    - Test extension loading → hook registration → material processing → cleanup
    - Test cross-app material transfer workflows
    - _Requirements: 1.1-1.10, 2.1-2.13, 5.1-5.12, 10.1-10.13, 12.1-12.10, 21.1-21.19_

  - [ ] 52.5 Create performance benchmark suite
    - Benchmark layer blending at 4K resolution
    - Benchmark animation evaluation at 60fps
    - Benchmark HDR merge at 8K resolution
    - Benchmark GPU compute shader performance
    - Benchmark export to all formats
    - _Requirements: 3.11, 5.5, 15.1, 17.2, 20.1_

- [ ] 53. Documentation and polish
  - [ ] 53.1 Create user documentation
    - Write getting started guide
    - Document all features with screenshots
    - Create tutorial videos for key workflows
    - Document keyboard shortcuts and hotkeys
    - _Requirements: All user-facing features_
  
  - [ ] 53.2 Create developer documentation
    - Document plugin API with examples
    - Document extension development workflow
    - Document data-driven configuration system
    - Document GPU compute shader development
    - _Requirements: 18.1-18.10, 21.1-21.19_
  
  - [ ] 53.3 Add tooltips and help text
    - Add tooltips to all UI controls
    - Add contextual help for complex features
    - Add error message improvements
    - _Requirements: 15.10_
  
  - [ ] 53.4 Polish UI/UX
    - Refine layout and spacing
    - Add loading indicators for long operations
    - Add progress bars for batch processing
    - Improve error message clarity
    - Add keyboard shortcuts
    - _Requirements: All UI requirements_

- [ ] 54. Final checkpoint and release preparation
  - Verify all 8 phases are complete
  - Run full test suite (unit + property + integration + performance)
  - Verify all 29 correctness properties pass
  - Test all workflows end-to-end
  - Profile performance and optimize bottlenecks
  - Fix any remaining bugs
  - Update RECENT_CHANGES.md with all changes
  - Update DIRECTORY.md with new file structure
  - Update CARGO_ARSENAL.md, NPM_ARSENAL.md, PYTHON_ARSENAL.md with new libraries
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property-based tests validate the 29 correctness properties from the design document
- Checkpoints ensure incremental validation at the end of each phase
- GPU-first approach: all compute-heavy operations use wgpu compute shaders
- Data-driven approach: all presets, configs, and pipelines use JSON with schema validation
- Library-first approach: leverage existing crates/packages (akaze, opencv-rust, gltf, exr, diffusers, etc.)
- The killer feature (Material Animation System) is prioritized in Phase 2 for early value delivery
