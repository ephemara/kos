# Implementation Plan: DCC Suite Production Readiness

## Overview

This implementation plan transforms the K_OS DCC Suite from 78% average production readiness to 85%+ across all 10+ applications. The plan addresses critical P0 blockers (broken exports, panel flickering), P1 major issues (UI inconsistency, missing features), and architectural violations (hardcoded values). Implementation follows a 6-week phased approach with incremental validation and comprehensive testing.

**Key Focus Areas:**
- Fix broken export systems in KTecton, KQuantum, KCloner
- Replace react-resizable-panels to eliminate viewport flickering
- Unify AppShell and TopBar across all apps
- Implement data-driven Configuration Registry system
- Overhaul KGraphos with fluid painting engine
- Implement 36 correctness properties with property-based tests

**Technology Stack:**
- Frontend: React 18 + TypeScript + Three.js
- Backend: Tauri v2 + Rust
- GPU: wgpu (WebGPU) compute pipelines
- Testing: proptest (Rust), fast-check (TypeScript)

## Tasks

### Phase 1: Critical Blockers (P0) - Week 1

- [x] 1. Fix KTecton export system
  - [x] 1.1 Implement terrain mesh export to GLTF
    - Replace placeholder stub at `src-frontend/features/terrain/KTecton/KTecton.tsx` lines 410-412
    - Implement `export_terrain_mesh()` function that converts terrain to GLTF mesh
    - Add validation to reject empty terrain before export
    - _Requirements: 2.2, 14.1, 14.2_
  
  - [x] 1.2 Implement heightmap export to PNG/EXR
    - Add `export_heightmap()` function for terrain height data
    - Support both PNG (8-bit/16-bit) and EXR (32-bit float) formats
    - Include resolution selection (512px to 8192px)
    - _Requirements: 4.4, 4.10, 14.6_
  
  - [ ]* 1.3 Write property test for terrain export round-trip
    - **Property 7: File Format Round-Trip Preservation**
    - **Validates: Requirements 4.1, 4.3, 4.5, 4.6**
    - Test that exported terrain can be re-imported with data preserved
    - _Requirements: 4.1, 4.6_

- [x] 2. Fix KQuantum export system
  - [x] 2.1 Implement particle system serialization
    - Replace fake delay stub at `src-frontend/features/simulation/KQuantum/KQuantum.tsx` lines 87-98
    - Create custom particle format with position, velocity, lifetime data
    - Add GLTF export option for particle instances as meshes
    - _Requirements: 2.2, 14.1_
  
  - [x] 2.2 Add export validation and error handling
    - Validate particle count and data before export
    - Provide clear error messages for invalid states
    - Add progress indication for large particle systems
    - _Requirements: 4.8, 4.12, 14.8_
  
  - [ ]* 2.3 Write unit tests for particle export
    - Test export with various particle counts (0, 1, 1000, 100000)
    - Test error conditions (empty system, invalid data)
    - _Requirements: 2.2, 14.1_

- [x] 3. Fix KCloner export system
  - [x] 3.1 Implement clone instance array export
    - Replace broken export at `src-frontend/features/modeling/KCloner/KCloner.tsx` lines 692-698
    - Create custom format for clone instance transforms
    - Add GLTF export with instancing extension
    - _Requirements: 2.2, 14.1, 14.2_
  
  - [x] 3.2 Fix memory leaks on mode changes
    - Dispose Three.js geometries properly when switching clone modes
    - Add cleanup in useEffect hooks
    - Track geometries in ref and dispose on unmount
    - _Requirements: 2.3, 2.8_
  
  - [ ]* 3.3 Write integration test for clone export
    - Test export with various clone patterns (linear, radial, grid)
    - Verify instance data preserved in round-trip
    - _Requirements: 4.1, 14.1_

- [x] 4. Replace react-resizable-panels to fix flickering
  - [x] 4.1 Create custom ResizeHandle component
    - Implement in `src-frontend/ui/AppShell/ResizeHandle.tsx`
    - Use pointer events (not mouse events) for better touch support
    - Use CSS transforms for smooth visual feedback
    - _Requirements: 2.4, 5.8_
  
  - [x] 4.2 Implement useResizablePanel hook
    - Use requestAnimationFrame for 60fps resize updates
    - Add debouncing (16ms) to prevent excessive re-renders
    - Save panel sizes to localStorage per app
    - _Requirements: 5.8, 5.9_
  
  - [x] 4.3 Refactor AppShell to use custom resize
    - Update `src-frontend/ui/AppShell/AppShell.tsx` lines 136-145
    - Remove react-resizable-panels dependency
    - Ensure viewport doesn't re-render during resize
    - _Requirements: 2.4, 5.1, 5.8_
  
  - [x] 4.4 Update DockPanel component
    - Refactor `src-frontend/ui/AppShell/DockPanel.tsx` lines 223-237
    - Apply same custom resize implementation
    - Test across all apps (KSculpt, KPainter, KAtlas, etc.)
    - _Requirements: 2.4, 5.8_
  
  - [ ]* 4.5 Write performance test for panel resize
    - Verify sub-16ms frame times during resize
    - Test with complex 3D scenes in viewport
    - _Requirements: 2.10, 5.8_

- [x] 5. Checkpoint - Verify P0 fixes
  - Ensure all export systems work (KTecton, KQuantum, KCloner)
  - Verify panel resizing is smooth without flickering
  - Run all tests and ensure they pass
  - Ask the user if questions arise

### Phase 2: Major System Gaps (P1) - Week 2

- [x] 6. Unify AppTopBar across all apps
  - [x] 6.1 Refactor KPainter to use AppTopBar
    - Replace custom top bar in `src-frontend/features/painting/KPainter/` with AppTopBar component
    - Fix spacing and alignment issues
    - _Requirements: 5.6, 13.2, 13.3_
  
  - [x] 6.2 Refactor KAtlas to use AppTopBar
    - Replace custom top bar in `src-frontend/features/uv/KAtlas/` with AppTopBar component
    - Add Uplink button for exporting to Kernel
    - _Requirements: 5.6, 13.2, 13.3_
  
  - [x] 6.3 Refactor KGraphos to use AppTopBar
    - Replace custom top bar in `src-frontend/features/painting/KGraphos/` with AppTopBar component
    - Ensure consistent spacing with other apps
    - _Requirements: 5.6, 13.2, 13.3_
  
  - [x] 6.4 Refactor KTecton to use AppTopBar
    - Replace custom top bar in `src-frontend/features/terrain/KTecton/` with AppTopBar component
    - Add proper File/Edit/View menus
    - _Requirements: 5.6, 13.2, 13.3_
  
  - [x] 6.5 Refactor KQuantum to use AppTopBar
    - Replace custom top bar in `src-frontend/features/simulation/KQuantum/` with AppTopBar component
    - Add missing Uplink button for exporting to Kernel
    - _Requirements: 5.6, 13.2, 13.3, 13.4_
  
  - [x] 6.6 Refactor KInspect to use AppTopBar
    - Replace custom top bar in `src-frontend/features/inspection/KInspect/` with AppTopBar component
    - Add missing Uplink button for exporting to Kernel
    - _Requirements: 5.6, 13.2, 13.3, 13.4_
  
  - [x] 6.7 Refactor KCloner to use AppTopBar
    - Replace custom top bar in `src-frontend/features/modeling/KCloner/` with AppTopBar component
    - Fix spacing consistency
    - _Requirements: 5.6, 13.2, 13.3_
  
  - [x] 6.8 Refactor KGreeble to use AppTopBar
    - Replace custom top bar in `src-frontend/features/modeling/KGreeble/` with AppTopBar component
    - Ensure all menus work correctly
    - _Requirements: 5.6, 13.2, 13.3_

- [x] 7. Fix KTecton terrain resolution changes
  - [x] 7.1 Implement immediate terrain resolution update
    - Modify terrain generation to apply resolution changes without restart
    - Update GPU buffers dynamically when resolution changes
    - Add loading indicator during regeneration
    - _Requirements: 2.4, 8.9_
  
  - [ ]* 7.2 Write unit test for resolution changes
    - Test resolution changes from 64x64 to 2048x2048
    - Verify terrain data updates correctly
    - _Requirements: 2.4, 8.9_

- [x] 8. Wire KSculpt subdivision to UI
  - [x] 8.1 Add subdivision button to KSculpt UI
    - Add button in right panel of `src-frontend/features/sculpting/KSculpt/`
    - Connect to existing GPU Catmull-Clark subdivision in `crates/k-os-engine/src/gpu/pipelines/`
    - Add subdivision level selector (1-5 levels)
    - _Requirements: 15.1, 15.2, 15.3_
  
  - [x] 8.2 Implement subdivision progress indication
    - Show progress bar for large meshes (>100K vertices)
    - Display vertex count before and after subdivision
    - _Requirements: 5.5, 15.7_
  
  - [x] 8.3 Add undo support for subdivision
    - Store mesh state before subdivision
    - Allow undo to restore original mesh
    - _Requirements: 2.2, 15.9_
  
  - [x] 8.4 Write property test for subdivision
    - **Property 22: GPU Subdivision Equivalence**
    - **Validates: Requirements 11.2, 15.1**
    - Test that GPU subdivision matches CPU reference implementation
    - _Requirements: 11.2, 15.1, 15.2_

- [x] 9. Wire KSculpt masking system to UI
  - [x] 9.1 Add mask painting mode to KSculpt
    - Add mask brush tool in left panel
    - Implement mask painting with GPU shader
    - Show mask as red overlay on mesh
    - _Requirements: 17.1, 17.2_
  
  - [x] 9.2 Add mask clear and invert operations
    - Add "Clear Mask" button to remove all masking
    - Add "Invert Mask" button to flip masked/unmasked regions
    - _Requirements: 17.5, 17.6_
  
  - [x] 9.3 Add mask extraction feature
    - Add "Extract Masked" button to create new mesh from masked region
    - Implement extraction logic in Rust backend
    - _Requirements: 17.4_
  
  - [ ]* 9.4 Write property test for masking
    - **Property 32: Mask Prevents Sculpting**
    - **Validates: Requirements 17.2, 17.3**
    - Test that masked regions are not modified by sculpting
    - _Requirements: 17.2, 17.3_
  
  - [ ]* 9.5 Write property test for mask extraction
    - **Property 33: Mask Extraction Correctness**
    - **Validates: Requirements 17.4**
    - Test that extracted mesh contains exactly masked vertices
    - _Requirements: 17.4_

- [x] 10. Implement KAtlas UV editing tools
  - [x] 10.1 Add UV move tool
    - Implement UV island selection and translation
    - Add visual feedback during move operation
    - Support multi-select with Ctrl+click
    - _Requirements: 18.1, 18.2_
  
  - [x] 10.2 Add UV rotate tool
    - Implement UV island rotation around center
    - Show rotation angle indicator
    - Support snap to 15-degree increments
    - _Requirements: 18.3_
  
  - [x] 10.3 Add UV scale tool
    - Implement UV island scaling from center
    - Support uniform and non-uniform scaling
    - Show scale factor indicator
    - _Requirements: 18.4_
  
  - [x] 10.4 Add UV unwrap functionality
    - Integrate automatic UV unwrapping algorithm
    - Provide unwrap options (angle-based, conformal)
    - Add preview before applying
    - _Requirements: 18.5, 18.6_
  
  - [ ]* 10.5 Write integration test for UV operations
    - Test UV move, rotate, scale operations
    - Verify UV coordinates update correctly
    - Test undo/redo for UV operations
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [x] 11. Checkpoint - Verify P1 fixes
  - Ensure all apps use AppTopBar consistently
  - Verify KTecton resolution changes work immediately
  - Test KSculpt subdivision and masking features
  - Test KAtlas UV editing tools
  - Run all tests and ensure they pass
  - Ask the user if questions arise

### Phase 3: Data-Driven Architecture - Week 3

- [x] 12. Implement Configuration Registry system (Rust)
  - [x] 12.1 Create ConfigRegistry struct and traits
    - Implement in `crates/k-os-engine/src/config/registry.rs`
    - Define BrushRegistry, ToolRegistry, ExportFormatRegistry, ViewportPresetRegistry
    - Add JSON Schema validation with schemars crate
    - _Requirements: 19.1, 19.2, 19.3_
  
  - [x] 12.2 Create configuration data structures
    - Define BrushConfig, ToolConfig, ExportFormatConfig, ViewportPresetConfig in `crates/k-os-engine/src/config/types.rs`
    - Add serde Serialize/Deserialize derives
    - Add JsonSchema derives for validation
    - _Requirements: 19.4, 19.5_
  
  - [x] 12.3 Implement configuration loading with inheritance
    - Load embedded defaults from binary
    - Load user preferences from `~/.kos/config/`
    - Load project config from `project/.kos/config/`
    - Merge with proper precedence (project > user > defaults)
    - _Requirements: 19.6, 19.7, 19.8_
  
  - [x] 12.4 Add hot-reload support
    - Use notify crate for file watching
    - Emit Tauri event on config file changes
    - Reload and validate config on change
    - _Requirements: 19.10_
  
  - [ ]* 12.5 Write property test for configuration validation
    - **Property 35: Configuration Validation**
    - **Validates: Requirements 19.11, 19.12**
    - Test that invalid configs are rejected with detailed errors
    - _Requirements: 19.11, 19.12_
  
  - [ ]* 12.6 Write property test for configuration fallback
    - **Property 36: Configuration Default Fallback**
    - **Validates: Requirements 19.13**
    - Test that missing configs use embedded defaults
    - _Requirements: 19.13_

- [x] 13. Create JSON configuration schemas
  - [x] 13.1 Create brushes.json schema and default data
    - Define schema in `crates/k-os-engine/src/config/schemas/brushes.schema.json`
    - Create default brushes config with sculpt, paint, mask, smooth categories
    - Include GPU shader references for each brush type
    - _Requirements: 19.4, 19.5_
  
  - [x] 13.2 Create export_formats.json schema and default data
    - Define schema in `crates/k-os-engine/src/config/schemas/export_formats.schema.json`
    - Create configs for GLTF, GLB, OBJ, PNG, JPG, EXR, heightmap formats
    - Include format-specific options (embed textures, compression, etc.)
    - _Requirements: 19.4, 19.5_
  
  - [x] 13.3 Create viewport_presets.json schema and default data
    - Define schema in `crates/k-os-engine/src/config/schemas/viewport_presets.schema.json`
    - Create presets for different use cases (modeling, sculpting, painting)
    - Include grid size, camera distance, FOV, lighting parameters
    - _Requirements: 19.4, 19.5_
  
  - [x] 13.4 Create greeble_patterns.json schema and default data
    - Define schema in `crates/k-os-engine/src/config/schemas/greeble_patterns.schema.json`
    - Create pattern library with sci-fi, industrial, organic categories
    - Include primitive types, probabilities, scale ranges
    - _Requirements: 19.4, 19.5_

- [ ] 14. Replace hardcoded values with configuration
  - [x] 14.1 Replace hardcoded view modes in KTecton
    - Remove hardcoded 0-3 indices for view modes
    - Load view mode configs from viewport_presets.json
    - Update UI to use data-driven view mode list
    - _Requirements: 19.14_
  
  - [x] 14.2 Replace hardcoded brush settings across apps
    - Remove duplicated brush parameter code in KSculpt, KPainter, KGraphos
    - Load brush configs from brushes.json
    - Create centralized brush registry accessible from all apps
    - _Requirements: 19.15_
  
  - [x] 14.3 Replace hardcoded export formats
    - Remove reimplemented export logic in each app
    - Use ExportRegistry with configs from export_formats.json
    - Update export UI to show available formats from registry
    - _Requirements: 19.16_
  
  - [ ] 14.4 Replace hardcoded viewport parameters
    - Remove hardcoded grid sizes, camera distances, lighting in all apps
    - Load from viewport_presets.json
    - Add preset selector in View menu
    - _Requirements: 19.17_
  
  - [ ] 14.5 Replace hardcoded greeble patterns in KGreeble
    - Remove hardcoded pattern definitions
    - Load patterns from greeble_patterns.json
    - Add pattern browser UI with categories
    - _Requirements: 19.18_

- [-] 15. Implement configuration UI
  - [ ] 15.1 Create configuration editor component
    - Build in `src-frontend/ui/ConfigEditor/`
    - Support editing brushes, export formats, viewport presets
    - Add JSON validation with error highlighting
    - _Requirements: 19.11, 19.12_
  
  - [ ] 15.2 Add preset import/export functionality
    - Allow users to export custom configs as .json files
    - Support importing configs from other users
    - Validate imported configs before applying
    - _Requirements: 19.9_
  
  - [ ] 15.3 Write property test for hot-reload
    - **Property 34: Configuration Hot-Reload**
    - **Validates: Requirements 19.10**
    - Test that config changes apply without restart
    - _Requirements: 19.10_

- [ ] 16. Checkpoint - Verify data-driven architecture
  - Ensure all hardcoded values replaced with JSON configs
  - Test configuration loading and inheritance
  - Verify hot-reload works in development
  - Test configuration validation catches errors
  - Run all tests and ensure they pass
  - Ask the user if questions arise

### Phase 4: KGraphos Overhaul - Week 4

- [ ] 17. Implement fluid painting engine (GPU)
  - [ ] 17.1 Create fluid simulation compute shader
    - Implement in `crates/k-os-engine/src/gpu/pipelines/fluid_paint.wgsl`
    - Use Navier-Stokes equations for fluid dynamics
    - Ensure 16-byte alignment for uniform buffers
    - _Requirements: 10.1, 10.2_
  
  - [ ] 17.2 Create Rust wrapper for fluid painting
    - Implement in `crates/k-os-engine/src/gpu/pipelines/fluid_paint.rs`
    - Manage GPU buffers for velocity field and paint density
    - Add Tauri command for fluid painting operations
    - _Requirements: 10.1, 10.2_
  
  - [ ] 17.3 Integrate fluid engine into KGraphos
    - Update `src-frontend/features/painting/KGraphos/` to use fluid painting
    - Add fluid simulation toggle in UI
    - Provide viscosity and flow rate controls
    - _Requirements: 10.1, 10.2_

- [ ] 18. Implement advanced brush types
  - [ ] 18.1 Implement smear brush
    - Sample existing paint and drag it realistically
    - Use GPU texture sampling for performance
    - Add smear strength and distance controls
    - _Requirements: 10.2, 10.3_
  
  - [ ] 18.2 Implement watercolor brush
    - Simulate color mixing and wetness
    - Add pigment concentration and water amount parameters
    - Implement edge darkening effect (watercolor characteristic)
    - _Requirements: 10.2, 10.11_
  
  - [ ] 18.3 Implement oil brush
    - Simulate thick paint with impasto effect
    - Add paint thickness and blending parameters
    - Use height map for 3D paint texture
    - _Requirements: 10.2_
  
  - [ ] 18.4 Add brush presets
    - Create preset library for Ink, Watercolor, Oil, Smear, Blend
    - Store presets in brushes.json configuration
    - Add preset selector in UI
    - _Requirements: 10.2_

- [ ] 19. Implement layer system with blend modes
  - [ ] 19.1 Create layer management system
    - Implement layer stack in `src-frontend/features/painting/KGraphos/engine/`
    - Support layer creation, deletion, reordering
    - Add layer visibility toggles
    - _Requirements: 10.5, 10.6_
  
  - [ ] 19.2 Implement blend modes
    - Add GPU shaders for Normal, Multiply, Overlay, Screen, Add blend modes
    - Implement in `crates/k-os-engine/src/gpu/pipelines/blend_modes.wgsl`
    - Create Rust wrapper for blend mode compositing
    - _Requirements: 10.5_
  
  - [ ] 19.3 Add alpha mask support
    - Implement layer masks for non-destructive editing
    - Allow painting on mask to control layer visibility
    - Add mask invert and clear operations
    - _Requirements: 10.6_
  
  - [ ] 19.4 Create layer UI panel
    - Build layer panel in `src-frontend/features/painting/KGraphos/ui/LayerPanel.tsx`
    - Show layer thumbnails and blend mode selectors
    - Support drag-and-drop layer reordering
    - _Requirements: 10.5, 10.6_

- [ ] 20. Add KGraphos polish features
  - [ ] 20.1 Implement real-time brush cursor preview
    - Show brush size and shape at cursor position
    - Update preview based on pressure input (tablet support)
    - Add cursor preview for all brush types
    - _Requirements: 10.7_
  
  - [ ] 20.2 Add symmetry modes
    - Implement X-axis, Y-axis, and radial symmetry
    - Add symmetry toggle buttons in UI
    - Support multiple symmetry axes simultaneously
    - _Requirements: 10.8_
  
  - [ ] 20.3 Implement color picker
    - Create color picker with HSV and RGB modes
    - Add color history/palette
    - Support eyedropper tool for sampling colors
    - _Requirements: 10.9_
  
  - [ ] 20.4 Add pressure-sensitive input support
    - Integrate tablet input via pointer events
    - Map pressure to size, opacity, and hardness
    - Add pressure curve editor for customization
    - _Requirements: 10.4_
  
  - [ ]* 20.5 Write integration test for KGraphos painting
    - Test painting with various brush types
    - Test layer compositing with blend modes
    - Test undo/redo for painting operations
    - _Requirements: 10.1, 10.5, 10.12_

- [ ] 21. Checkpoint - Verify KGraphos overhaul
  - Test fluid painting engine with all brush types
  - Verify layer system works with blend modes
  - Test symmetry modes and color picker
  - Ensure performance is acceptable for 4K textures
  - Run all tests and ensure they pass
  - Ask the user if questions arise

### Phase 5: Testing Infrastructure - Week 5

- [x] 22. Set up property-based testing framework
  - [x] 22.1 Configure proptest for Rust
    - Add proptest dependency to `crates/k-os-engine/Cargo.toml`
    - Set PROPTEST_CASES=100 for local, 1000 for CI
    - Create test utilities in `crates/k-os-engine/tests/proptest_utils.rs`
    - _Requirements: 1.1, 1.9_
  
  - [x] 22.2 Configure fast-check for TypeScript
    - Add fast-check dependency to `src-frontend/package.json`
    - Configure with numRuns=100 for all property tests
    - Create test utilities in `src-frontend/tests/utils/`
    - _Requirements: 1.1, 1.9_
  
  - [x] 22.3 Create arbitrary generators for test data
    - Implement arbitrary_mesh(), arbitrary_scene(), arbitrary_material() generators
    - Create generators for brush strokes, paint operations, UV coordinates
    - Add generators for configuration objects
    - _Requirements: 1.1, 1.4, 1.5, 1.6_

- [ ] 23. Implement correctness properties (Part 1: State Management)
  - [ ]* 23.1 Property 1: Undo/Redo Round-Trip
    - Test that undo followed by redo returns to original state
    - Test with various operation sequences (sculpting, painting, UV editing)
    - _Requirements: 2.2_
  
  - [ ]* 23.2 Property 2: App State Isolation
    - Test that app switching preserves individual app states
    - Generate random app switch sequences
    - _Requirements: 2.3_
  
  - [ ]* 23.3 Property 19: SVT Undo/Redo
    - Test that SVT painting undo/redo works correctly
    - Verify texture state restoration
    - _Requirements: 7.8_

- [ ] 24. Implement correctness properties (Part 2: GPU Operations)
  - [ ]* 24.1 Property 4: GPU Normal Calculation Correctness
    - Test that GPU normals match CPU normals within epsilon
    - Test with various mesh topologies
    - _Requirements: 2.6, 11.4_
  
  - [ ]* 24.2 Property 5: Symmetry Preservation
    - Test that symmetric operations produce symmetric results
    - Test X, Y, Z, and radial symmetry
    - _Requirements: 2.7_
  
  - [ ]* 24.3 Property 22: GPU Subdivision Equivalence
    - Test that GPU subdivision matches CPU reference
    - Test with various mesh types (quads, triangles, mixed)
    - _Requirements: 11.2, 15.1_
  
  - [ ]* 24.4 Property 23: GPU Sculpting Equivalence
    - Test that GPU sculpting matches CPU sculpting
    - Test with various brush types and strengths
    - _Requirements: 11.3_
  
  - [ ]* 24.5 Property 24: GPU Normal Recalculation Equivalence
    - Test that GPU normal recalc matches CPU
    - Test with degenerate cases
    - _Requirements: 11.4_
  
  - [ ]* 24.6 Property 25: GPU Degenerate Mesh Handling
    - Test that GPU operations handle degenerate triangles gracefully
    - Verify no crashes with zero-area faces
    - _Requirements: 11.5_
  
  - [ ]* 24.7 Property 26: GPU Buffer Validation
    - Test that invalid buffer sizes are rejected before GPU dispatch
    - Test with too large, too small, and misaligned buffers
    - _Requirements: 11.7_

- [ ] 25. Implement correctness properties (Part 3: File Operations)
  - [ ]* 25.1 Property 7: File Format Round-Trip Preservation
    - Test GLTF/GLB/OBJ export and re-import preserves data
    - Test with various scene complexities
    - _Requirements: 4.1, 4.3, 4.5, 4.6_
  
  - [ ]* 25.2 Property 8: Texture Round-Trip Preservation
    - Test PNG/JPG/EXR export and re-import preserves image data
    - Account for lossy compression in JPG
    - _Requirements: 4.4_
  
  - [ ]* 25.3 Property 9: Invalid File Rejection
    - Test that corrupted files are rejected with errors
    - Test with malformed GLTF, invalid images, etc.
    - _Requirements: 4.9_
  
  - [ ]* 25.4 Property 10: Export Resolution Support
    - Test that all resolutions [512, 8192] export correctly
    - Test with various texture formats
    - _Requirements: 4.10_
  
  - [ ]* 25.5 Property 11: Batch Export Equivalence
    - Test that batch export matches individual exports
    - Test with various asset combinations
    - _Requirements: 4.11_
  
  - [ ]* 25.6 Property 27: GLTF Export Completeness
    - Test that exported GLTF contains all scene data
    - Verify meshes, materials, textures are present
    - _Requirements: 14.1_
  
  - [ ]* 25.7 Property 28: GLTF Export Validity
    - Test that exported GLTF passes schema validation
    - Use GLTF validator library
    - _Requirements: 14.2_
  
  - [ ]* 25.8 Property 29: 3D Print Mesh Validation
    - Test that 3D print exports are manifold and watertight
    - Use mesh validation algorithms
    - _Requirements: 14.11_

- [ ] 26. Implement correctness properties (Part 4: Project Management)
  - [ ]* 26.1 Property 6: Cross-App Asset Availability
    - Test that assets created in one app are accessible in others
    - Test with KObjectRegistry IDs
    - _Requirements: 3.2_
  
  - [ ]* 26.2 Property 12: Project Directory Structure
    - Test that new projects have correct directory structure
    - Verify meshes/, textures/, materials/, .kos/ subdirectories
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 26.3 Property 13: Project Manifest Validity
    - Test that saved projects have valid manifest.json
    - Validate against JSON schema
    - _Requirements: 6.6_
  
  - [ ]* 26.4 Property 14: Backup Creation
    - Test that save operations create backups
    - Verify backup files in .kos/backups/ with timestamps
    - _Requirements: 6.7_
  
  - [ ]* 26.5 Property 15: Project Integrity Validation
    - Test that corrupted projects are rejected on open
    - Test with various corruption scenarios
    - _Requirements: 6.11_
  
  - [ ]* 26.6 Property 16: Project Archive Round-Trip
    - Test that .kos archive export and re-import preserves all data
    - Test with complex projects
    - _Requirements: 6.12_

- [ ] 27. Implement correctness properties (Part 5: SVT System)
  - [ ]* 27.1 Property 3: SVT Painting Seamlessness
    - Test that painting across tile boundaries has no visible seams
    - Test with various brush sizes and tile configurations
    - _Requirements: 2.5, 7.11_
  
  - [ ]* 27.2 Property 17: SVT Tile Allocation
    - Test that tiles are allocated on-demand for unpainted regions
    - Verify tiles are available for subsequent operations
    - _Requirements: 7.2_
  
  - [ ]* 27.3 Property 18: SVT Channel Independence
    - Test that painting on one PBR channel doesn't affect others
    - Test all channels: albedo, normal, roughness, metallic, AO, height
    - _Requirements: 7.6, 7.7_
  
  - [ ]* 27.4 Property 20: SVT Export Compositing
    - Test that exported SVT textures composite correctly
    - Verify virtual tiles merge into standard texture files
    - _Requirements: 7.9_
  
  - [ ]* 27.5 Property 21: SVT Brush Size Support
    - Test that all brush sizes [1, 512] pixels work correctly
    - Verify no artifacts at extreme sizes
    - _Requirements: 7.12_

- [ ] 28. Implement correctness properties (Part 6: Subdivision & Masking)
  - [ ]* 28.1 Property 30: Subdivision UV Preservation
    - Test that subdivision preserves UV topology
    - Verify no new UV seams are introduced
    - _Requirements: 15.5_
  
  - [ ]* 28.2 Property 31: Subdivision Vertex Color Preservation
    - Test that subdivision interpolates vertex colors smoothly
    - Verify no color discontinuities
    - _Requirements: 15.6_
  
  - [ ]* 28.3 Property 32: Mask Prevents Sculpting (already in task 9.4)
    - Duplicate reference for completeness
    - _Requirements: 17.2, 17.3_
  
  - [ ]* 28.4 Property 33: Mask Extraction Correctness (already in task 9.5)
    - Duplicate reference for completeness
    - _Requirements: 17.4_

- [ ] 29. Implement integration tests
  - [ ]* 29.1 IPC communication tests
    - Test Tauri commands work correctly from TypeScript
    - Test error propagation from Rust to TypeScript
    - Test serialization/deserialization of complex types
    - _Requirements: 1.2_
  
  - [ ]* 29.2 GPU compute correctness tests
    - Test GPU operations produce correct results
    - Test GPU/CPU equivalence for all pipelines
    - Test buffer management and memory safety
    - _Requirements: 1.3_
  
  - [ ]* 29.3 File operations round-trip tests
    - Test import/export workflows for all formats
    - Test with various file sizes and complexities
    - _Requirements: 1.4_
  
  - [ ]* 29.4 Sculpting workflow integration test
    - Test complete sculpting workflow: import, sculpt, subdivide, export
    - Test undo/redo throughout workflow
    - _Requirements: 1.5_
  
  - [ ]* 29.5 Painting workflow integration test
    - Test complete painting workflow: create texture, paint, export
    - Test SVT system with multiple channels
    - _Requirements: 1.6_
  
  - [ ]* 29.6 Kernel artifact storage test
    - Test storing and retrieving artifacts from Kernel
    - Test with various asset types
    - _Requirements: 1.7_
  
  - [ ]* 29.7 KObjectRegistry cross-app test
    - Test creating asset in one app and accessing in another
    - Test identity tracking across app boundaries
    - _Requirements: 1.8_

- [ ] 30. Implement unit tests for edge cases
  - [ ]* 30.1 Empty mesh handling tests
    - Test all operations with empty meshes
    - Verify proper error messages
    - _Requirements: 2.1, 2.4_
  
  - [ ]* 30.2 Single vertex/face tests
    - Test operations with minimal geometry
    - Test degenerate cases
    - _Requirements: 2.4_
  
  - [ ]* 30.3 Large mesh performance tests
    - Test with meshes >1M vertices
    - Verify O(N) complexity maintained
    - _Requirements: 2.4_
  
  - [ ]* 30.4 Rapid input handling tests
    - Test fast brush strokes maintain sub-16ms frame times
    - Test input buffering and throttling
    - _Requirements: 2.10_
  
  - [ ]* 30.5 Error recovery tests
    - Test recovery from GPU device loss
    - Test fallback to CPU when GPU unavailable
    - Test disk full scenarios
    - _Requirements: 2.1, 2.8, 2.9_

- [ ] 31. Set up CI pipeline for testing
  - [ ] 31.1 Configure GitHub Actions workflow
    - Create `.github/workflows/test.yml`
    - Run cargo test with all features
    - Run PROPTEST_CASES=1000 for property tests
    - Run npm test for TypeScript tests
    - _Requirements: 1.10, 1.11_
  
  - [ ] 31.2 Add test coverage reporting
    - Use cargo-tarpaulin for Rust coverage
    - Use c8 for TypeScript coverage
    - Set coverage target to 80%
    - _Requirements: 1.1, 1.9_
  
  - [ ] 31.3 Add performance benchmarking
    - Run cargo bench in CI
    - Track performance regressions
    - Store benchmark results for comparison
    - _Requirements: 2.10_

- [ ] 32. Checkpoint - Verify testing infrastructure
  - Ensure all 36 correctness properties are implemented
  - Verify 80%+ unit test coverage
  - Run all integration tests and ensure they pass
  - Check CI pipeline runs successfully
  - Ask the user if questions arise


### Phase 6: Polish and Production Readiness - Week 6

- [ ] 33. UI polish across all apps
  - [ ] 33.1 Add tooltips to all UI elements
    - Audit all apps for missing tooltips
    - Add descriptive tooltips to buttons, sliders, and controls
    - Include keyboard shortcuts in tooltips where applicable
    - _Requirements: 5.4, 5.9_
  
  - [ ] 33.2 Add progress indicators for long operations
    - Add progress bars for export operations
    - Add spinners for GPU compute operations
    - Show estimated time remaining for long tasks
    - _Requirements: 5.5, 4.8_
  
  - [ ] 33.3 Improve error message clarity
    - Review all error messages for clarity
    - Add recovery suggestions to error dialogs
    - Include relevant context (file paths, operation details)
    - _Requirements: 4.12, 5.10_
  
  - [ ] 33.4 Add keyboard shortcut hints
    - Display shortcuts in context menus
    - Add shortcut overlay (press ? to show)
    - Document all shortcuts in help menu
    - _Requirements: 5.9_
  
  - [ ] 33.5 Improve visual feedback for interactions
    - Add hover states to all interactive elements
    - Add active/pressed states for buttons
    - Add selection highlights for selected objects
    - _Requirements: 5.3_

- [ ] 34. Performance optimization
  - [ ] 34.1 Profile and optimize hot paths
    - Use cargo flamegraph to identify bottlenecks
    - Use browser DevTools to profile React rendering
    - Optimize identified hot paths
    - _Requirements: 2.10_
  
  - [ ] 34.2 Implement GPU operation batching
    - Batch multiple GPU operations into single dispatch
    - Reduce CPU-GPU synchronization overhead
    - Test performance improvement with benchmarks
    - _Requirements: 2.10_
  
  - [ ] 34.3 Optimize SVT tile cache
    - Tune LRU cache size based on available memory
    - Implement tile compression for inactive tiles
    - Add cache statistics and monitoring
    - _Requirements: 7.4, 7.5, 7.10_
  
  - [ ] 34.4 Reduce memory allocations
    - Use object pools for frequently allocated objects
    - Reuse buffers where possible
    - Profile memory usage and identify leaks
    - _Requirements: 2.3, 2.8_
  
  - [ ] 34.5 Optimize mesh operations
    - Use spatial data structures (octree, BVH) for large meshes
    - Implement level-of-detail for viewport rendering
    - Optimize normal recalculation with parallel processing
    - _Requirements: 2.4_

- [ ] 35. Documentation updates
  - [ ] 35.1 Update DIRECTORY.md
    - Document all new files and modules
    - Update architecture diagrams
    - Document configuration system structure
    - _Requirements: All_
  
  - [ ] 35.2 Update RECENT_CHANGES.md
    - Add entries for all major changes
    - Increment change IDs properly
    - Include migration notes for breaking changes
    - _Requirements: All_
  
  - [ ] 35.3 Document configuration schemas
    - Create documentation for all JSON schemas
    - Provide examples for each configuration type
    - Document inheritance and override behavior
    - _Requirements: 19.1-19.18_
  
  - [ ] 35.4 Create user guide for each app
    - Write getting started guide for each DCC app
    - Document key features and workflows
    - Include screenshots and examples
    - _Requirements: 5.1-5.10_
  
  - [ ] 35.5 Document keyboard shortcuts
    - Create comprehensive keyboard shortcut reference
    - Organize by app and category
    - Include in help menu and documentation
    - _Requirements: 5.9, 9.2_
  
  - [ ] 35.6 Update arsenal documentation
    - Update CARGO_ARSENAL.md with new crates (proptest, notify, schemars)
    - Update NPM_ARSENAL.md with new packages (fast-check)
    - Document usage examples for new libraries
    - _Requirements: All_

- [ ] 36. Final testing and validation
  - [ ] 36.1 Manual testing of all workflows
    - Test complete workflows in each app
    - Test cross-app workflows (create in KSculpt, paint in KPainter)
    - Test error scenarios and recovery
    - _Requirements: All_
  
  - [ ] 36.2 Performance testing on target hardware
    - Test on various GPU configurations (NVIDIA, AMD, Intel)
    - Verify acceptable performance on minimum spec hardware
    - Test with large files (>100MB meshes, 8K textures)
    - _Requirements: 2.4, 2.10_
  
  - [ ] 36.3 Stress testing with large files
    - Test with 1M+ vertex meshes
    - Test with 16K SVT textures
    - Test with complex scenes (100+ objects)
    - _Requirements: 2.4, 7.1_
  
  - [ ] 36.4 Verify production readiness scores
    - Calculate production readiness score for each app
    - Ensure all apps achieve 85%+ score
    - Document remaining issues for future releases
    - _Requirements: All_
  
  - [ ]* 36.5 Run full test suite
    - Run all unit tests (cargo test, npm test)
    - Run all property tests with 1000 iterations
    - Run all integration tests
    - Verify 80%+ test coverage
    - _Requirements: 1.1-1.11_

- [ ] 37. Production release preparation
  - [ ] 37.1 Create release build
    - Run cargo build --release
    - Optimize binary size with strip and LTO
    - Test release build thoroughly
    - _Requirements: All_
  
  - [ ] 37.2 Create release notes
    - Document all new features
    - Document all bug fixes
    - Include upgrade instructions
    - _Requirements: All_
  
  - [ ] 37.3 Prepare distribution packages
    - Create installers for Windows, macOS, Linux
    - Test installation on clean systems
    - Verify all dependencies are bundled
    - _Requirements: All_
  
  - [ ] 37.4 Final validation checkpoint
    - Review all acceptance criteria
    - Verify all P0 and P1 issues resolved
    - Confirm zero known crash bugs
    - Get user sign-off for release
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at the end of each phase
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Integration tests validate multi-system workflows
- The 6-week phased approach allows for iterative progress with validation at each milestone
- GPU-first approach leverages wgpu compute shaders for maximum performance
- Data-driven architecture eliminates hardcoded values for better maintainability
- All apps will achieve 85%+ production readiness by the end of Phase 6
