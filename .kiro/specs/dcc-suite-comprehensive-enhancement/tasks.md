# Implementation Plan: K_OS DCC Suite Comprehensive Enhancement

## Overview

This implementation plan transforms K_OS into a professional-grade DCC suite through systematic enhancement of backend infrastructure, frontend capabilities, and addition of 8 new DCC applications. The plan follows a phased approach to ensure stability and incremental validation.

**Implementation Language:** Rust (backend), TypeScript (frontend)

**Key Principles:**
- Create NEW focused crates instead of adding to existing ones
- Comprehensive testing at every level (unit, property-based, integration)
- GPU-first approach for performance
- Data-driven architecture throughout

## Tasks

- [ ] 1. Phase 1: Backend Infrastructure - New Crate Structure
  - [x] 1.1 Create k-os-gpu-pipeline crate for GPU pipeline management
    - Create `crates/k-os-gpu-pipeline/` directory structure
    - Implement `GPUPipelineManager` with pipeline caching
    - Implement `BufferPool` for GPU buffer reuse
    - Implement `PerformanceMonitor` for GPU metrics
    - Add WGSL shader hot-reloading for development
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 1.2 Write unit tests for k-os-gpu-pipeline
    - Test pipeline caching and retrieval
    - Test buffer pool allocation and reuse
    - Test performance monitoring
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 1.3 Write property tests for k-os-gpu-pipeline
    - **Property 1: Pipeline Caching Consistency**
    - **Validates: Requirements 1.1, 1.2**
    - **Property 2: Buffer Pool Size Guarantee**
    - **Validates: Requirement 1.3**
    - **Property 3: Buffer Pool Reuse**
    - **Validates: Requirement 1.4**

  - [x] 1.4 Create k-os-undo crate for universal undo/redo system
    - Create `crates/k-os-undo/` directory structure
    - Implement `UndoManager` with memory-aware history
    - Implement `UndoableAction` trait
    - Implement action merging for continuous operations
    - Add compression for large state changes
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.5 Write unit tests for k-os-undo
    - Test execute/undo/redo cycles
    - Test memory limit enforcement
    - Test action merging
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  
  - [x] 1.6 Write property tests for k-os-undo
    - **Property 4: Undo/Redo Round-Trip Identity**
    - **Validates: Requirements 2.2, 2.3, 2.7**
    - **Property 5: Undo Stack Memory Invariant**
    - **Validates: Requirements 2.4, 2.6**
    - **Property 6: Action Merging Reduces History**
    - **Validates: Requirement 2.5**

  - [x] 1.7 Create k-os-asset-pipeline crate for asset import/export
    - Create `crates/k-os-asset-pipeline/` directory structure
    - Implement `AssetPipeline` with format detection
    - Implement `AssetImporter` trait and GLTF/FBX/OBJ importers
    - Implement `AssetExporter` trait and exporters
    - Implement `AssetProcessor` trait for processing pipeline
    - Add thumbnail generation and metadata extraction
    - Add caching with file hash validation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 1.8 Write unit tests for k-os-asset-pipeline
    - Test format detection
    - Test import/export for each format
    - Test processing pipeline
    - Test caching behavior
    - _Requirements: 3.1, 3.2, 3.4, 3.6_
  
  - [x] 1.9 Write property tests for k-os-asset-pipeline
    - **Property 7: Asset Import Format Detection**
    - **Validates: Requirements 3.1, 3.2**
    - **Property 8: Asset Import/Export Round-Trip**
    - **Validates: Requirements 3.7, 3.9**
    - **Property 9: Asset Import Caching**
    - **Validates: Requirement 3.6**
    - **Property 10: Asset Processing Pipeline**
    - **Validates: Requirement 3.4**

  - [x] 1.10 Create k-os-plugin crate for dynamic plugin system
    - Create `crates/k-os-plugin/` directory structure
    - Implement `PluginManager` with dynamic library loading
    - Implement `Plugin` trait for plugin interface
    - Implement `PluginContext` for plugin API access
    - Add API versioning and compatibility checks
    - Add plugin sandboxing and resource limits
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [x] 1.11 Write unit tests for k-os-plugin
    - Test plugin loading and unloading
    - Test API version validation
    - Test plugin lifecycle management
    - Test resource isolation
    - _Requirements: 4.1, 4.2, 4.4_
  
  - [x] 1.12 Write property tests for k-os-plugin
    - **Property 11: Plugin API Version Validation**
    - **Validates: Requirement 4.1**
    - **Property 12: Plugin Lifecycle Management**
    - **Validates: Requirement 4.4**

  - [x] 1.13 Create k-os-material crate for material system
    - Create `crates/k-os-material/` directory structure
    - Implement `MaterialSystem` with shader graph support
    - Implement `ShaderGraph` with node-based editing
    - Implement WGSL code generation from shader graphs
    - Implement GPU material evaluation
    - Add material baking to textures
    - Add circular dependency detection
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  
  - [x] 1.14 Write unit tests for k-os-material
    - Test material creation and initialization
    - Test shader graph node connections
    - Test shader compilation
    - Test circular dependency detection
    - _Requirements: 5.1, 5.2, 5.3, 5.8_

  - [x] 1.15 Write property tests for k-os-material
    - **Property 13: Material Default Initialization**
    - **Validates: Requirement 5.1**
    - **Property 14: Shader Graph Type Safety**
    - **Validates: Requirement 5.3**
    - **Property 15: Shader Graph Acyclicity**
    - **Validates: Requirements 5.8, 22.2**
    - **Property 16: Shader Compilation Validity**
    - **Validates: Requirement 5.4**
    - **Property 17: Material Baking Resolution**
    - **Validates: Requirement 5.7**

  - [x] 1.16 Create k-os-mesh-processing crate for enhanced mesh operations
    - Create `crates/k-os-mesh-processing/` directory structure
    - Implement auto-retopology with InstantMeshes integration
    - Implement quad remeshing algorithms
    - Implement mesh topology analysis (non-manifold, self-intersections)
    - Implement mesh repair functions (fix non-manifold, fill holes, remove duplicates)
    - Implement mesh deformation (lattice, cage)
    - Implement GPU-accelerated boolean operations
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 1.17 Write unit tests for k-os-mesh-processing
    - Test auto-retopology with various target counts
    - Test mesh topology analysis
    - Test mesh repair functions
    - Test boolean operations
    - _Requirements: 6.1, 6.3, 6.4, 6.7_
  
  - [x] 1.18 Write property tests for k-os-mesh-processing
    - **Property 18: Auto-Retopo Polygon Count**
    - **Validates: Requirements 6.1, 11.7**
    - **Property 19: Auto-Retopo Manifold Output**
    - **Validates: Requirements 6.1, 11.8**
    - **Property 20: Mesh Repair Manifold Guarantee**
    - **Validates: Requirement 6.4**
    - **Property 21: Boolean Operation Commutativity**
    - **Validates: Requirement 6.8**
    - **Property 22: Boolean Operation Manifold Preservation**
    - **Validates: Requirement 6.7**

  - [x] 1.19 Create k-os-baking crate for texture baking system
    - Create `crates/k-os-baking/` directory structure
    - Implement `BakingSystem` with GPU ray tracing
    - Implement BVH construction for high-poly meshes
    - Implement normal map baking (tangent/object/world space)
    - Implement AO, curvature, thickness, position, ID map baking
    - Implement cage-based baking
    - Implement texture dilation for seam prevention
    - Add multi-sampling for anti-aliasing
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  
  - [x] 1.20 Write unit tests for k-os-baking
    - Test BVH construction and ray tracing
    - Test normal map baking in different spaces
    - Test each map type (AO, curvature, etc.)
    - Test cage-based baking
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 1.21 Write property tests for k-os-baking
    - **Property 23: Texture Baking Resolution Match**
    - **Validates: Requirement 7.1**
    - **Property 24: Normal Map Tangent Space Encoding**
    - **Validates: Requirement 7.1**
    - **Property 25: Texture Dilation Completeness**
    - **Validates: Requirement 7.5**

  - [x] 1.22 Checkpoint - Backend Infrastructure Complete
    - Run `cargo test` on all new crates
    - Verify all crates compile without warnings
    - Check performance benchmarks meet targets
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 2. Phase 2: Frontend Infrastructure
  - [x] 2.1 Create Universal Viewport Manager
    - Create `src-frontend/engine/viewportManager.ts`
    - Implement camera management (state, fit-to-view)
    - Implement gizmo system (translate, rotate, scale)
    - Implement grid and visual helpers
    - Implement rendering modes (solid, wireframe, xray, matcap)
    - Implement selection highlighting
    - Add frustum culling and LOD support
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 2.2 Write unit tests for viewport manager
    - Test camera state save/restore
    - Test fit-to-view calculations
    - Test gizmo transformations
    - Test selection management
    - _Requirements: 8.2, 8.5, 8.8_
  
  - [x] 2.3 Write property tests for viewport manager
    - **Property 26: Viewport Fit-to-View Completeness**
    - **Validates: Requirement 8.2**
    - **Property 27: Camera State Round-Trip**
    - **Validates: Requirement 8.8**

  - [x] 2.4 Create Enhanced UI Component Library
    - Create `src-frontend/ui/dcc/` directory for DCC-specific components
    - Implement `NumericInput` with drag-to-change
    - Implement `VectorInput` for Vec2/Vec3/Vec4
    - Implement `ColorPicker` with swatches
    - Implement `CurveEditor` component
    - Implement `GradientEditor` component
    - Implement `NodeGraph` component using @xyflow/react
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  
  - [x] 2.5 Write component tests for UI library
    - Test numeric input drag behavior
    - Test vector input component synchronization
    - Test color picker interactions
    - Test curve editor control points
    - Test node graph connections
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.7_

  - [x] 2.6 Create Performance Optimization System
    - Create `src-frontend/engine/performanceMonitor.ts`
    - Implement FPS and frame time tracking
    - Implement memory usage monitoring
    - Implement render stats tracking
    - Create `VirtualizedList` component for large datasets
    - Create performance hooks (useDebouncedValue, useThrottledCallback)
    - Add performance warning system
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 2.7 Write performance tests
    - Test FPS tracking accuracy ✅
    - Test memory monitoring ✅
    - Test debounce and throttle behavior ✅
    - Test usePerformance hook ✅
    - _Requirements: 10.1, 10.2, 10.4, 10.5_
    - _Files: src-frontend/engine/__tests__/performanceMonitor.test.ts, src-frontend/hooks/__tests__/usePerformance.test.tsx, src-frontend/hooks/__tests__/useDebounce.test.tsx, src-frontend/hooks/__tests__/useThrottle.test.tsx_

  - [x] 2.8 Improve State Management
    - Create typed Zustand store factory in `src-frontend/state/` ✅
    - Implement persistent store with IndexedDB ✅
    - Create undo/redo store wrapper ✅
    - Implement cross-app state synchronization ✅
    - Add store devtools integration ✅
    - Create built-in stores (app, viewport, preferences) ✅
    - _Requirements: 19.1, 19.2, 19.3, 19.5_
    - _Files: src-frontend/state/createStore.ts, src-frontend/state/undoRedoStore.ts, src-frontend/state/syncStore.ts, src-frontend/state/stores/*_
  
  - [x] 2.9 Write state management tests
    - Test store persistence ✅
    - Test undo/redo wrapper ✅
    - Test cross-app synchronization ✅
    - Test deep equality ✅
    - Test custom events ✅
    - _Requirements: 19.2, 19.3, 19.5_
    - _Files: src-frontend/state/__tests__/createStore.test.ts, src-frontend/state/__tests__/undoRedoStore.test.ts, src-frontend/state/__tests__/syncStore.test.ts_

  - [x] 2.10 Checkpoint - Frontend Infrastructure Complete ✅
    - Test viewport manager in existing apps ✅
    - Verify UI components work with Radix UI + Tailwind ✅
    - Check performance monitoring shows accurate metrics ✅
    - Ensure all tests pass ✅
    - _Summary: Phase 2 complete! Delivered viewport manager, 6 DCC UI components, performance monitoring, and state management with undo/redo + cross-app sync. All systems fully tested._

- [ ] 3. Phase 3: New DCC Apps - Part 1 (Retopo, Bake, Weight)
  - [ ] 3.1 Implement KRetopo - Retopology Tool
    - [x] 3.1.1 Create KRetopo app structure
      - Create `src-frontend/features/retopo/` directory
      - Create `KRetopo.tsx` main component
      - Create `engine/retopoEngine.ts` for core logic
      - Create `engine/drawingTools.ts` for drawing modes
      - Create `engine/topologyTools.ts` for topology operations
      - Create `engine/snapping.ts` for surface snapping
      - _Requirements: 11.1, 11.2, 11.3_
    
    - [x] 3.1.2 Implement retopo drawing tools
      - Implement quad drawing mode
      - Implement quad strip drawing mode
      - Implement hole filling
      - Implement surface snapping with raycasting
      - _Requirements: 11.2, 11.3, 11.4_

    - [x] 3.1.3 Implement retopo topology tools
      - Implement edge loop insertion
      - Implement edge dissolve and collapse
      - Implement quad subdivision
      - Implement symmetry mirroring
      - _Requirements: 11.5, 11.6_
    
    - [x] 3.1.4 Integrate auto-retopo from k-os-mesh-processing
      - Create Tauri command for auto-retopo
      - Implement frontend client for auto-retopo
      - Add progress reporting for long operations
      - _Requirements: 11.7_
    
    - [x] 3.1.5 Create KRetopo UI panels
      - Create `ui/TopBar.tsx` for mode selector and tools
      - Create `ui/LeftPanel.tsx` for tool settings
      - Create `ui/RightPanel.tsx` for topology stats
      - Integrate Universal Viewport Manager
      - _Requirements: 11.1, 11.2_
    
    - [x] 3.1.6 Write unit tests for KRetopo
      - Test drawing tools create valid quads
      - Test topology tools maintain manifold mesh
      - Test symmetry mirroring
      - Test mesh export validation
      - _Requirements: 11.2, 11.3, 11.6, 11.8_
    
    - [x] 3.1.7 Write property tests for KRetopo
      - **Property 28: Retopo Surface Snapping**
      - **Validates: Requirement 11.4**
      - **Property 29: Retopo Symmetry Mirroring**
      - **Validates: Requirement 11.5**
    
    - [x] 3.1.8 Register KRetopo in app config
      - Add KRetopo to `src-frontend/config/appConfig.ts`
      - Create retopo service client in `src-frontend/services/`
      - Update DIRECTORY.md with new files
      - _Requirements: 11.1_

  - [ ] 3.2 Implement KBake - Texture Baking Tool
    - [x] 3.2.1 Create KBake app structure
      - Create `src-frontend/features/bake/` directory
      - Create `KBake.tsx` main component
      - Create `engine/bakeEngine.ts` for core logic
      - Create `engine/rayTracer.ts` for GPU ray tracing wrapper
      - Create `engine/cageGenerator.ts` for auto cage generation
      - _Requirements: 12.1, 12.2_

    - [x] 3.2.2 Implement baking operations
      - Create Tauri commands for all bake types (normal, AO, curvature, etc.)
      - Implement frontend baking workflow
      - Add real-time preview of baked maps
      - Implement batch baking for multiple maps
      - _Requirements: 12.4, 12.5, 12.6, 12.7_
    
    - [x] 3.2.3 Implement cage generation and management
      - Implement auto cage generation with extrusion
      - Add manual cage editing tools
      - Visualize cage in viewport
      - _Requirements: 12.2_
    
    - [x] 3.2.4 Create KBake UI panels
      - Create `ui/TopBar.tsx` for bake controls
      - Create `ui/LeftPanel.tsx` for map type selector
      - Create `ui/RightPanel.tsx` for settings and preview
      - Add progress bar for baking operations
      - _Requirements: 12.3, 12.7_
    
    - [x] 3.2.5 Implement map export
      - Add export functionality for PNG, EXR, TGA formats
      - Implement batch export for all maps
      - Add export settings (bit depth, compression)
      - _Requirements: 12.8_
    
    - [x] 3.2.6 Write unit tests for KBake
      - Test baking settings validation
      - Test cage generation
      - Test map export in different formats
      - _Requirements: 12.2, 12.3, 12.8_
    
    - [x] 3.2.7 Write performance tests for KBake
      - Verify 4K normal map baking completes in <5 seconds
      - Test GPU memory usage during baking
      - _Requirements: 12.9, 20.3_
    
    - [x] 3.2.8 Register KBake in app config
      - Add KBake to `src-frontend/config/appConfig.ts`
      - Create bake service client in `src-frontend/services/`
      - Update DIRECTORY.md with new files
      - _Requirements: 12.1_

  - [-] 3.3 Implement KWeight - Weight Painting Tool
    - [x] 3.3.1 Create KWeight app structure
      - Create `src-frontend/features/weight/` directory
      - Create `KWeight.tsx` main component
      - Create `engine/weightEngine.ts` for core logic
      - Create `engine/brushSystem.ts` for weight painting brushes
      - Create `engine/visualization.ts` for weight visualization
      - Create `engine/transfer.ts` for weight transfer
      - _Requirements: 18.1, 18.2_
    
    - [x] 3.3.2 Implement weight painting system
      - Implement brush-based weight painting
      - Implement weight smoothing algorithm
      - Implement weight normalization
      - Add symmetry support for weight painting
      - _Requirements: 18.3, 18.4, 18.5, 18.6_
    
    - [x] 3.3.3 Implement vertex group management
      - Create vertex group creation/deletion
      - Implement group assignment and removal
      - Add selection by weight threshold
      - Add selection by group
      - _Requirements: 18.2_
    
    - [x] 3.3.4 Implement weight visualization
      - Create gradient visualization shader
      - Add customizable gradient colors
      - Implement visualization modes (gradient, solid, wireframe)
      - _Requirements: 18.7_
    
    - [x] 3.3.5 Implement weight transfer
      - Create weight transfer algorithm between meshes
      - Add transfer settings (nearest surface, nearest vertex)
      - _Requirements: 18.8_
    
    - [x] 3.3.6 Create KWeight UI panels
      - Create `ui/TopBar.tsx` for brush controls
      - Create `ui/LeftPanel.tsx` for brush settings
      - Create `ui/RightPanel.tsx` for vertex groups
      - Add weight value display on hover
      - _Requirements: 18.1, 18.2_

    - [x] 3.3.7 Write unit tests for KWeight
      - Test weight painting operations
      - Test weight smoothing
      - Test weight normalization
      - Test vertex group management
      - _Requirements: 18.3, 18.4, 18.5, 18.2_
    
    - [x] 3.3.8 Write property tests for KWeight
      - **Property 31: Weight Normalization Invariant**
      - **Validates: Requirement 18.5**
      - **Property 32: Weight Smoothing Convergence**
      - **Validates: Requirement 18.4**
    
    - [x] 3.3.9 Register KWeight in app config
      - Add KWeight to `src-frontend/config/appConfig.ts`
      - Create weight service client in `src-frontend/services/`
      - Update DIRECTORY.md with new files
      - _Requirements: 18.1_

  - [x] 3.4 Checkpoint - Part 1 Apps Complete
    - Test KRetopo, KBake, KWeight in isolation
    - Verify integration with Universal Viewport Manager
    - Test undo/redo works in all three apps
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Phase 4: New DCC Apps - Part 2 (Compose, Shade, Curve)
  - [ ] 4.1 Implement KCompose - Compositing Tool
    - [x] 4.1.1 Create KCompose app structure
      - Create `src-frontend/features/compose/` directory
      - Create `KCompose.tsx` main component
      - Create `engine/composeEngine.ts` for core logic
      - Create `engine/nodeGraph.ts` for node graph system
      - Create `engine/effects.ts` for effect implementations
      - Create `engine/blendModes.ts` for blend mode shaders
      - _Requirements: 13.1, 13.2_
    
    - [x] 4.1.2 Implement node graph system
      - Implement node addition and removal
      - Implement node connection system with type checking
      - Implement node evaluation in dependency order
      - Add node types (input, output, mix, blur, color grade, etc.)
      - _Requirements: 13.2, 13.3, 13.4_

    - [x] 4.1.3 Implement compositing effects
      - Implement blur, sharpen, color grade effects
      - Implement levels, curves, HSL adjustments
      - Implement glow, vignette, chromatic aberration
      - Implement distortion, transform effects
      - Add GPU shader implementations for real-time preview
      - _Requirements: 13.6_
    
    - [x] 4.1.4 Implement layer system
      - Create layer stack management
      - Implement blend modes (normal, multiply, screen, overlay, etc.)
      - Implement layer opacity control
      - _Requirements: 13.5_
    
    - [x] 4.1.5 Create KCompose UI panels
      - Create `ui/TopBar.tsx` for file and render controls
      - Create `ui/NodeEditor.tsx` using @xyflow/react
      - Create `ui/LayerPanel.tsx` for layer stack
      - Create `ui/PropertiesPanel.tsx` for node properties
      - Add real-time preview viewport
      - _Requirements: 13.1, 13.6_
    
    - [x] 4.1.6 Implement HDR and export
      - Add HDR workflow support with EXR format
      - Implement export in PNG, EXR, TIFF formats
      - Add export settings (bit depth, compression)
      - _Requirements: 13.7, 13.8_
    
    - [ ] 4.1.7 Write unit tests for KCompose
      - Test node graph evaluation order
      - Test blend modes
      - Test effect implementations
      - _Requirements: 13.4, 13.5, 13.6_
    
    - [ ] 4.1.8 Write property tests for KCompose
      - **Property 30: Compositing Node Evaluation Order**
      - **Validates: Requirement 13.4**
    
    - [ ] 4.1.9 Write performance tests for KCompose
      - Verify 30 FPS preview with 4K images
      - Test GPU memory usage with multiple layers
      - _Requirements: 13.9, 20.1_

    - [ ] 4.1.10 Register KCompose in app config
      - Add KCompose to `src-frontend/config/appConfig.ts`
      - Create compose service client in `src-frontend/services/`
      - Update DIRECTORY.md with new files
      - _Requirements: 13.1_

  - [ ] 4.2 Implement KShade - Shader Editor
    - [ ] 4.2.1 Create KShade app structure
      - Create `src-frontend/features/shade/` directory
      - Create `KShade.tsx` main component
      - Create `engine/shadeEngine.ts` for core logic
      - Create `engine/nodeGraph.ts` for shader node graph
      - Create `engine/compiler.ts` for shader compilation
      - Create `engine/codeGen.ts` for WGSL/GLSL/HLSL generation
      - _Requirements: 16.1, 16.2_
    
    - [ ] 4.2.2 Implement shader node system
      - Add input nodes (position, normal, UV, tangent, color, time)
      - Add texture nodes (texture, normal map, cube map)
      - Add math nodes (add, subtract, multiply, divide, power, trig, etc.)
      - Add vector nodes (dot, cross, normalize, reflect, refract, fresnel)
      - Add color nodes (RGB, HSV, color ramp, invert, brightness)
      - Add noise nodes (perlin, simplex, voronoi, cellular)
      - Add utility nodes (split, combine, remap, switch)
      - Add output node
      - _Requirements: 16.2, 16.3_
    
    - [ ] 4.2.3 Implement shader compilation
      - Implement WGSL code generation from node graph
      - Implement GLSL code generation
      - Implement HLSL code generation
      - Add shader validation and error reporting
      - Add hot-reload for development
      - _Requirements: 16.4, 16.5, 16.6, 16.8_
    
    - [ ] 4.2.4 Create KShade UI panels
      - Create `ui/TopBar.tsx` for file and compile controls
      - Create `ui/NodeEditor.tsx` using @xyflow/react
      - Create `ui/PreviewPanel.tsx` for real-time material preview
      - Create `ui/CodePanel.tsx` for generated code view
      - Create `ui/LibraryPanel.tsx` for shader library
      - _Requirements: 16.1, 16.5, 16.7_

    - [ ] 4.2.5 Implement preview system
      - Add PBR lighting for preview
      - Add HDRI environment support
      - Add preview mesh selection (sphere, cube, torus, custom)
      - Integrate with k-os-material crate
      - _Requirements: 16.5, 16.7_
    
    - [ ] 4.2.6 Write unit tests for KShade
      - Test node graph construction
      - Test shader compilation
      - Test code generation for each target
      - Test error handling
      - _Requirements: 16.2, 16.4, 16.6, 16.8_
    
    - [ ] 4.2.7 Write performance tests for KShade
      - Verify shader compilation completes in <100ms
      - Test with complex shader graphs (100+ nodes)
      - _Requirements: 16.9, 20.6_
    
    - [ ] 4.2.8 Register KShade in app config
      - Add KShade to `src-frontend/config/appConfig.ts`
      - Create shade service client in `src-frontend/services/`
      - Update DIRECTORY.md with new files
      - _Requirements: 16.1_

  - [ ] 4.3 Implement KCurve - Curve Modeling Tool
    - [ ] 4.3.1 Create KCurve app structure
      - Create `src-frontend/features/curve/` directory
      - Create `KCurve.tsx` main component
      - Create `engine/curveEngine.ts` for core logic
      - Create `engine/bezier.ts` for Bezier curve implementation
      - Create `engine/nurbs.ts` for NURBS curve implementation
      - Create `engine/surfaceGen.ts` for surface generation
      - Create `engine/modifiers.ts` for curve modifiers
      - _Requirements: 17.1, 17.2_
    
    - [ ] 4.3.2 Implement curve creation and editing
      - Implement Bezier curve creation
      - Implement NURBS curve creation
      - Implement circle, spiral generators
      - Add control point manipulation
      - Add handle type controls (auto, vector, aligned, free)
      - _Requirements: 17.1, 17.2, 17.3, 17.4_

    - [ ] 4.3.3 Implement curve operations
      - Implement curve subdivision
      - Implement curve joining
      - Implement curve trimming
      - Implement curve offsetting
      - _Requirements: 17.5_
    
    - [ ] 4.3.4 Implement surface generation
      - Implement curve extrusion
      - Implement curve revolution
      - Implement curve lofting
      - Implement curve sweeping
      - _Requirements: 17.6, 17.7, 17.8_
    
    - [ ] 4.3.5 Implement curve modifiers
      - Add array modifier
      - Add taper modifier
      - Add noise modifier
      - _Requirements: 17.6_
    
    - [ ] 4.3.6 Create KCurve UI panels
      - Create `ui/TopBar.tsx` for tool selector
      - Create `ui/LeftPanel.tsx` for curve settings
      - Create `ui/RightPanel.tsx` for modifiers and operations
      - Add curve analysis display (length, curvature)
      - _Requirements: 17.1_
    
    - [ ] 4.3.7 Implement curve export
      - Add SVG export
      - Add DXF export
      - Add IGES export
      - _Requirements: 17.9_
    
    - [ ] 4.3.8 Write unit tests for KCurve
      - Test Bezier curve evaluation
      - Test NURBS curve evaluation
      - Test surface generation algorithms
      - Test curve operations
      - _Requirements: 17.1, 17.2, 17.5, 17.6_
    
    - [ ] 4.3.9 Register KCurve in app config
      - Add KCurve to `src-frontend/config/appConfig.ts`
      - Create curve service client in `src-frontend/services/`
      - Update DIRECTORY.md with new files
      - _Requirements: 17.1_

  - [ ] 4.4 Checkpoint - Part 2 Apps Complete
    - Test KCompose, KShade, KCurve in isolation
    - Verify node graph system works consistently
    - Test material preview in KShade
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 5: New DCC Apps - Part 3 (Motion, FX)
  - [ ] 5.1 Implement KMotion - Motion Graphics Tool
    - [ ] 5.1.1 Create KMotion app structure
      - Create `src-frontend/features/motion/` directory
      - Create `KMotion.tsx` main component
      - Create `engine/motionEngine.ts` for core logic
      - Create `engine/cloner.ts` for cloner system
      - Create `engine/effectors.ts` for effector implementations
      - Create `engine/fields.ts` for field system
      - Create `engine/timeline.ts` for animation timeline
      - _Requirements: 14.1, 14.2_
    
    - [ ] 5.1.2 Implement cloner system
      - Implement linear cloner mode
      - Implement grid cloner mode
      - Implement radial cloner mode
      - Implement object surface cloner mode
      - Add cloner distribution controls
      - _Requirements: 14.1, 14.2_
    
    - [ ] 5.1.3 Implement effector system
      - Implement random effector
      - Implement step effector
      - Implement delay effector
      - Implement shader effector
      - Implement sound reactive effector
      - Implement spline effector
      - Implement target effector
      - Implement time effector
      - Implement formula effector
      - Add effector strength and falloff controls
      - _Requirements: 14.3, 14.4_
    
    - [ ] 5.1.4 Implement field system
      - Create sphere, box, cylinder, torus fields
      - Implement field strength controls
      - Add field visualization
      - _Requirements: 14.5_

    - [ ] 5.1.5 Implement animation system
      - Create keyframe animation system
      - Implement animation curves (linear, bezier, ease in/out)
      - Add timeline UI with playback controls
      - Integrate with existing animation support
      - _Requirements: 14.4_
    
    - [ ] 5.1.6 Create KMotion UI panels
      - Create `ui/TopBar.tsx` for playback controls
      - Create `ui/LeftPanel.tsx` for cloner/effector settings
      - Create `ui/RightPanel.tsx` for object hierarchy
      - Create `ui/Timeline.tsx` for animation timeline
      - _Requirements: 14.1_
    
    - [ ] 5.1.7 Implement animation export
      - Add GLTF animation export
      - Add FBX animation export
      - Add Alembic cache export
      - _Requirements: 14.7_
    
    - [ ] 5.1.8 Write unit tests for KMotion
      - Test cloner distribution algorithms
      - Test effector calculations
      - Test field influence
      - Test animation keyframe interpolation
      - _Requirements: 14.1, 14.3, 14.5, 14.4_
    
    - [ ] 5.1.9 Register KMotion in app config
      - Add KMotion to `src-frontend/config/appConfig.ts`
      - Create motion service client in `src-frontend/services/`
      - Update DIRECTORY.md with new files
      - _Requirements: 14.1_

  - [ ] 5.2 Implement KFX - VFX and Particle System
    - [ ] 5.2.1 Create KFX app structure
      - Create `src-frontend/features/fx/` directory
      - Create `KFX.tsx` main component
      - Create `engine/fxEngine.ts` for core logic
      - Create `engine/particleSystem.ts` for GPU particle system
      - Create `engine/forces.ts` for force field implementations
      - Create `engine/collision.ts` for collision detection
      - Create `engine/presets.ts` for effect presets
      - _Requirements: 15.1, 15.2_

    - [ ] 5.2.2 Implement GPU particle system
      - Create WGSL compute shader for particle simulation
      - Implement particle emission (point, sphere, box, mesh, curve)
      - Implement particle lifetime and size curves
      - Implement particle color gradients
      - Add GPU buffer management for 1M+ particles
      - _Requirements: 15.1, 15.2, 15.3, 15.7_
    
    - [ ] 5.2.3 Implement force system
      - Implement gravity force
      - Implement wind force
      - Implement vortex force
      - Implement turbulence force
      - Implement drag force
      - Implement attractor force
      - Add force strength and radius controls
      - _Requirements: 15.4, 15.5_
    
    - [ ] 5.2.4 Implement collision system
      - Add collision detection with mesh objects
      - Implement particle bounciness
      - Add collision response
      - _Requirements: 15.6_
    
    - [ ] 5.2.5 Implement rendering modes
      - Implement billboard rendering
      - Implement mesh particle rendering
      - Implement particle trails
      - Add blend modes (additive, alpha, etc.)
      - _Requirements: 15.7_
    
    - [ ] 5.2.6 Create effect presets
      - Create fire preset
      - Create smoke preset
      - Create explosion preset
      - Create sparks preset
      - Create rain preset
      - Create snow preset
      - _Requirements: 15.8_
    
    - [ ] 5.2.7 Create KFX UI panels
      - Create `ui/TopBar.tsx` for playback and simulation controls
      - Create `ui/LeftPanel.tsx` for emitter settings
      - Create `ui/RightPanel.tsx` for forces and collision
      - Create `ui/CurveEditor.tsx` for size/color curves
      - _Requirements: 15.1_

    - [ ] 5.2.8 Implement cache export
      - Add Alembic cache export
      - Add VDB volume export
      - _Requirements: 15.10_
    
    - [ ] 5.2.9 Write unit tests for KFX
      - Test particle emission
      - Test force calculations
      - Test collision detection
      - _Requirements: 15.1, 15.4, 15.6_
    
    - [ ] 5.2.10 Write performance tests for KFX
      - Verify 1M+ particles at 60 FPS
      - Test GPU memory usage with large particle counts
      - _Requirements: 15.7, 20.7_
    
    - [ ] 5.2.11 Register KFX in app config
      - Add KFX to `src-frontend/config/appConfig.ts`
      - Create fx service client in `src-frontend/services/`
      - Update DIRECTORY.md with new files
      - _Requirements: 15.1_

  - [ ] 5.3 Checkpoint - Part 3 Apps Complete
    - Test KMotion and KFX in isolation
    - Verify GPU particle system performance
    - Test animation export from KMotion
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Phase 6: Integration & Comprehensive Testing
  - [ ] 6.1 Cross-application integration
    - [ ] 6.1.1 Implement unified asset database
      - Create asset registry accessible to all apps
      - Implement asset change notifications
      - Add asset dependency tracking
      - _Requirements: 19.1, 19.4, 19.5_
    
    - [ ] 6.1.2 Implement cross-app selection preservation
      - Store selection state in shared store
      - Synchronize selection across app switches
      - _Requirements: 19.2_
    
    - [ ] 6.1.3 Integrate undo/redo across all apps
      - Connect k-os-undo crate to all DCC apps
      - Test undo/redo works when switching apps
      - _Requirements: 19.3_

    - [ ] 6.1.4 Implement unified viewport settings
      - Share viewport settings across all apps
      - Synchronize camera, grid, and render mode
      - _Requirements: 19.6_
    
    - [ ] 6.1.5 Implement material sharing
      - Make materials from KShade available to all apps
      - Integrate k-os-material crate with existing apps
      - _Requirements: 19.7_
    
    - [ ] 6.1.6 Write integration tests for cross-app features
      - Test asset visibility across apps
      - Test selection preservation
      - Test undo/redo across apps
      - Test material sharing
      - _Requirements: 19.1, 19.2, 19.3, 19.7_
    
    - [ ] 6.1.7 Write property tests for cross-app integration
      - **Property 33: Cross-App Asset Visibility**
      - **Validates: Requirements 19.4, 19.5**
      - **Property 35: Undo State Consistency**
      - **Validates: Requirement 22.7**

  - [ ] 6.2 Performance validation
    - [ ] 6.2.1 Run viewport performance tests
      - Verify 60 FPS with 10M triangles
      - Test with complex scenes in each app
      - _Requirements: 8.7, 20.1_
    
    - [ ] 6.2.2 Run sculpting performance tests
      - Verify <16ms latency for brush strokes
      - Test with high-resolution meshes
      - _Requirements: 20.2_
    
    - [ ] 6.2.3 Run baking performance tests
      - Verify 4K normal map in <5 seconds
      - Test with complex high-poly meshes
      - _Requirements: 7.8, 20.3_
    
    - [ ] 6.2.4 Run asset pipeline performance tests
      - Verify typical GLTF import in <2 seconds
      - Test with various file formats
      - _Requirements: 20.4_
    
    - [ ] 6.2.5 Run memory usage tests
      - Verify <4GB memory for typical workflows
      - Test memory limits and cleanup
      - _Requirements: 20.5_

    - [ ] 6.2.6 Run shader compilation performance tests
      - Verify complex shader graphs compile in <100ms
      - Test with KShade
      - _Requirements: 20.6_
    
    - [ ] 6.2.7 Run particle system performance tests
      - Verify 1M+ particles at 60 FPS
      - Test with KFX
      - _Requirements: 20.7_
    
    - [ ] 6.2.8 Run application launch performance test
      - Verify app launches in <3 seconds
      - _Requirements: 20.8_
    
    - [ ] 6.2.9 Run UI responsiveness tests
      - Verify all interactions respond in <100ms
      - Test across all apps
      - _Requirements: 20.9_

  - [ ] 6.3 Error handling and recovery validation
    - [ ] 6.3.1 Test GPU memory allocation failures
      - Simulate out-of-memory conditions
      - Verify graceful degradation
      - _Requirements: 21.1_
    
    - [ ] 6.3.2 Test shader compilation errors
      - Test with invalid shader code
      - Verify descriptive error messages
      - _Requirements: 21.2_
    
    - [ ] 6.3.3 Test asset import failures
      - Test with corrupted files
      - Verify error reporting
      - _Requirements: 21.3_
    
    - [ ] 6.3.4 Test operation timeouts
      - Test long-running operations
      - Verify cancellation and cleanup
      - _Requirements: 21.4_
    
    - [ ] 6.3.5 Test plugin crash isolation
      - Simulate plugin crashes
      - Verify main app continues running
      - _Requirements: 21.6_

  - [ ] 6.4 Data validation tests
    - [ ] 6.4.1 Test mesh topology validation
      - Test with invalid meshes
      - Verify validation catches issues
      - _Requirements: 22.1_
    
    - [ ] 6.4.2 Test shader graph validation
      - Test circular dependency detection
      - Verify type checking
      - _Requirements: 22.2_
    
    - [ ] 6.4.3 Test numeric input validation
      - Test boundary conditions
      - Verify range clamping
      - _Requirements: 22.3_
    
    - [ ] 6.4.4 Test file path sanitization
      - Test directory traversal attempts
      - Verify path validation
      - _Requirements: 22.4_
    
    - [ ] 6.4.5 Test resource limits
      - Test texture resolution limits
      - Test mesh size limits
      - _Requirements: 22.8, 22.9_

  - [ ] 6.5 DCC Suite Regression Test
    - [ ] 6.5.1 Test complete sculpting workflow
      - Sculpt → Paint → Bake → Export
      - Verify all steps work together
      - _Requirements: All_
    
    - [ ] 6.5.2 Test complete retopology workflow
      - Import high-poly → Retopo → Bake normals → Export
      - Verify workflow integration
      - _Requirements: 11.*, 12.*_
    
    - [ ] 6.5.3 Test complete material workflow
      - Create shader in KShade → Apply to mesh → Bake → Export
      - Verify material pipeline
      - _Requirements: 16.*, 5.*, 12.*_
    
    - [ ] 6.5.4 Test complete animation workflow
      - Create motion graphics → Animate → Export
      - Verify animation pipeline
      - _Requirements: 14.*_

    - [ ] 6.5.5 Test complete VFX workflow
      - Create particles → Apply forces → Export cache
      - Verify VFX pipeline
      - _Requirements: 15.*_
    
    - [ ] 6.5.6 Test undo/redo across all apps
      - Perform operations in multiple apps
      - Verify undo/redo works correctly
      - _Requirements: 2.*, 19.3_

  - [ ] 6.6 DCC Suite Wide Coverage Test
    - [ ] 6.6.1 Measure test coverage for backend crates
      - Run `cargo tarpaulin` or `cargo llvm-cov`
      - Verify >80% coverage for critical paths
      - _Requirements: 25.1_
    
    - [ ] 6.6.2 Measure test coverage for frontend
      - Run coverage tools for TypeScript/React
      - Verify adequate coverage
      - _Requirements: 25.1_
    
    - [ ] 6.6.3 Run all property-based tests
      - Execute all 35 property tests
      - Verify all properties hold
      - _Requirements: 25.2_
    
    - [ ] 6.6.4 Run all integration tests
      - Execute complete workflow tests
      - Verify end-to-end functionality
      - _Requirements: 25.3_
    
    - [ ] 6.6.5 Run benchmark suite
      - Execute performance benchmarks
      - Verify no regressions
      - _Requirements: 25.5_

  - [ ] 6.7 Checkpoint - Integration & Testing Complete
    - All apps work together seamlessly
    - All performance targets met
    - Test coverage exceeds 80%
    - All property tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Phase 7: Documentation & Polish
  - [ ] 7.1 Update documentation
    - [ ] 7.1.1 Update DIRECTORY.md
      - Document all new crates
      - Document all new frontend features
      - Document new service clients
      - _Requirements: All_

    - [ ] 7.1.2 Update CARGO_ARSENAL.md
      - Document k-os-gpu-pipeline crate
      - Document k-os-undo crate
      - Document k-os-asset-pipeline crate
      - Document k-os-plugin crate
      - Document k-os-material crate
      - Document k-os-mesh-processing crate
      - Document k-os-baking crate
      - Add usage examples for each crate
      - _Requirements: All backend_
    
    - [ ] 7.1.3 Update NPM_ARSENAL.md
      - Document new NPM packages (@xyflow/react, etc.)
      - Add import examples
      - _Requirements: All frontend_
    
    - [ ] 7.1.4 Update RECENT_CHANGES.md
      - Add comprehensive entry for DCC Suite enhancement
      - Document all new features
      - Document breaking changes (if any)
      - _Requirements: All_
    
    - [ ] 7.1.5 Create API documentation
      - Generate Rust docs with `cargo doc`
      - Generate TypeScript docs with TSDoc
      - Document all public APIs
      - _Requirements: 24.8_
    
    - [ ] 7.1.6 Create user documentation
      - Write user guide for each new app
      - Document workflows and best practices
      - Create troubleshooting guide
      - _Requirements: 23.1, 23.2, 23.3_

  - [ ] 7.2 Create tutorial content
    - [ ] 7.2.1 Create KRetopo tutorial
      - Document retopology workflow
      - Show auto-retopo vs manual retopo
      - _Requirements: 11.*_
    
    - [ ] 7.2.2 Create KBake tutorial
      - Document texture baking workflow
      - Show different map types
      - Explain cage usage
      - _Requirements: 12.*_
    
    - [ ] 7.2.3 Create KWeight tutorial
      - Document weight painting workflow
      - Show weight transfer
      - _Requirements: 18.*_

    - [ ] 7.2.4 Create KCompose tutorial
      - Document compositing workflow
      - Show node-based compositing
      - _Requirements: 13.*_
    
    - [ ] 7.2.5 Create KShade tutorial
      - Document shader creation workflow
      - Show material preview and export
      - _Requirements: 16.*_
    
    - [ ] 7.2.6 Create KCurve tutorial
      - Document curve modeling workflow
      - Show surface generation
      - _Requirements: 17.*_
    
    - [ ] 7.2.7 Create KMotion tutorial
      - Document motion graphics workflow
      - Show cloner and effector system
      - _Requirements: 14.*_
    
    - [ ] 7.2.8 Create KFX tutorial
      - Document VFX creation workflow
      - Show particle system and forces
      - _Requirements: 15.*_

  - [ ] 7.3 Polish and refinement
    - [ ] 7.3.1 UI/UX polish pass
      - Review all app UIs for consistency
      - Improve tooltips and help text
      - Add keyboard shortcut documentation
      - _Requirements: 23.1, 23.2, 23.5, 23.6_
    
    - [ ] 7.3.2 Error message improvements
      - Review all error messages
      - Make them user-friendly with solutions
      - _Requirements: 23.3_
    
    - [ ] 7.3.3 Performance profiling
      - Profile each app with real workloads
      - Identify and fix bottlenecks
      - Verify all performance targets met
      - _Requirements: 20.*_
    
    - [ ] 7.3.4 Memory leak detection
      - Run long-duration tests
      - Check for memory leaks
      - Fix any issues found
      - _Requirements: 21.5_

    - [ ] 7.3.5 Accessibility improvements
      - Ensure keyboard navigation works
      - Add ARIA labels where needed
      - Test with screen readers
      - _Requirements: 23.6_
    
    - [ ] 7.3.6 Settings and preferences
      - Implement settings export/import
      - Add keyboard shortcut remapping
      - Add theme customization
      - _Requirements: 24.5, 24.6, 24.7_

  - [ ] 7.4 Final validation
    - [ ] 7.4.1 Run complete test suite
      - Execute all unit tests
      - Execute all property tests
      - Execute all integration tests
      - Verify 100% pass rate
      - _Requirements: 25.*_
    
    - [ ] 7.4.2 Performance benchmark validation
      - Run all performance benchmarks
      - Verify all targets met
      - Document results
      - _Requirements: 20.*_
    
    - [ ] 7.4.3 Cross-platform testing
      - Test on Windows 10+
      - Test on macOS 11+
      - Test on Linux (Ubuntu 20.04+)
      - _Requirements: Compatibility_
    
    - [ ] 7.4.4 File format compatibility testing
      - Test import/export for all formats
      - Verify round-trip preservation
      - _Requirements: 3.8, 3.9, 25.8_
    
    - [ ] 7.4.5 User acceptance testing preparation
      - Create test scenarios
      - Prepare feedback collection
      - _Requirements: Success Criteria_

  - [ ] 7.5 Final Checkpoint - Production Ready
    - All documentation complete
    - All tutorials created
    - All tests passing
    - Performance targets met
    - Ready for release
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at phase boundaries
- Property tests validate universal correctness properties
- Integration tests validate complete workflows
- New crates follow K_OS naming convention: `k-os-{feature}`
- All GPU operations use wgpu for cross-platform compatibility
- Frontend apps follow consistent structure: `features/{category}/{app}/`
