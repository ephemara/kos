# Requirements Document: DCC Suite Production Readiness

## Introduction

This document defines the requirements for making the K_OS DCC Suite fully production-ready and shippable. The K_OS DCC Suite is a Tauri v2 desktop application with React + TypeScript frontend, Rust backend with GPU compute (wgpu), and optional Bevy viewport for native 3D rendering. The suite includes multiple specialized applications (KSculpt, KPainter, KAtlas, KGraphos, KAutopbr, KGreeble, KTecton, KQuantum, KInspect) that share a common kernel and GPU compute engine.

This production readiness push addresses critical bugs, missing features, system integration issues, and UI polish across the entire suite to achieve a shippable state.


## Executive Summary

This requirements document is based on comprehensive inspection of all 10+ DCC applications in the K_OS suite. The inspection revealed critical blocking issues, major system gaps, and widespread violations of the data-driven architecture principle.

### Critical Blocking Issues (P0)

1. **KTecton Export Broken** - Placeholder stub at lines 410-412 in KTecton.tsx, no functional export
2. **KQuantum Export Broken** - Fake delay stub at lines 87-98 in KQuantum.tsx, no functional export
3. **KCloner Export Broken** - Admitted broken state at lines 692-698 in KCloner.tsx, no functional export
4. **AppShell Panel Flickering** - react-resizable-panels causing rapid re-renders during resize (AppShell.tsx lines 136-145, DockPanel.tsx lines 223-237)

### Major System Gaps (P1)

5. **Top Bar Inconsistency** - Only KSculpt uses AppTopBar component, others use custom implementations with glitchy spacing
6. **Missing Uplink Buttons** - KQuantum and KInspect lack Uplink buttons for exporting to Kernel/Asset Browser
7. **KTecton Terrain Resolution** - Changes require restart instead of applying immediately
8. **KCloner Memory Leaks** - Mode changes don't properly dispose previous geometries
9. **KSculpt Subdivision** - GPU Catmull-Clark exists but not wired to UI
10. **KSculpt Masking** - Masking system not wired in (paint, clear, invert, extract)
11. **KAtlas UV Editing** - Missing core UV editing tools (move, rotate, scale, unwrap)
12. **KGraphos Overhaul** - Needs complete fluid painting engine with smear, watercolor, oil brushes

### Data-Driven Architecture Violations

13. **Hardcoded View Modes** - KTecton uses 0-3 indices instead of data-driven configuration
14. **Hardcoded Brush Settings** - Brush parameters duplicated across apps instead of centralized registry
15. **Hardcoded Export Formats** - Export logic reimplemented in each app instead of shared registry
16. **Hardcoded Grid/Camera/Lighting** - Viewport parameters hardcoded instead of JSON configuration
17. **Hardcoded Greeble Patterns** - KGreeble patterns hardcoded instead of data-driven library

### Production Readiness Scores

- **KAutopbr: 95%** (best overall - reference implementation)
- **KGreeble: 90%** (solid, needs data-driven config)
- **KPainter: 90%** (SVT system fully working)
- **KGraphos: 85%** (needs overhaul)
- **KSculpt: 85%** (needs subdivision/masking wired)
- **KInspect: 80%** (needs Uplink, export)
- **KAtlas: 75%** (needs UV tools)
- **KQuantum: 70%** (needs export, Uplink)
- **KTecton: 65%** (needs export, resolution fix)
- **KCloner: 55%** (worst - export broken, memory leaks)

### Scope

This production readiness push addresses 19 major requirement areas covering integration testing, critical bug fixes, system integration, file operations, UI polish, data-driven architecture, and app-specific production readiness. The goal is to achieve minimum 85% production readiness across all apps before final release.
## Glossary

- **DCC_Suite**: The complete K_OS Digital Content Creation application suite
- **Kernel**: The central asset registry and state management system shared across all apps
- **GPU_Engine**: The wgpu-based GPU compute engine in crates/k-os-engine
- **Tauri_Backend**: The Rust IPC layer in src-tauri that bridges frontend to GPU_Engine
- **React_Frontend**: The TypeScript/React UI layer in src-frontend
- **Bevy_Viewport**: The optional native 3D rendering viewport in src-bevy
- **SVT_System**: Sparse Virtual Texturing system for high-resolution painting
- **File_Ops**: File import/export operations (GLTF, OBJ, PNG, etc.)
- **AppShell**: The universal UI shell system for consistent app layouts
- **KObjectRegistry**: The universal object identity system for cross-app tracking
- **Leash_IPC**: The UDP-based bidirectional communication channel between Tauri and Bevy
- **Integration_Test**: Automated test that verifies multiple systems working together
- **PBR_Material**: Physically Based Rendering material with albedo/normal/roughness/metallic/AO maps
- **Subdivision_Surface**: Catmull-Clark subdivision for mesh smoothing
- **Instant_Meshes**: External library for automatic quad remeshing
- **Sculpt_Pipeline**: The complete sculpting workflow including brushes, masking, subdivision, and undo

## Requirements

### Requirement 1: Integration Testing Framework

**User Story:** As a developer, I want comprehensive integration tests across the suite, so that I can verify all systems work together correctly and catch regressions early.

#### Acceptance Criteria

1. THE DCC_Suite SHALL provide an integration test framework that can test React_Frontend, Tauri_Backend, and GPU_Engine interactions
2. WHEN integration tests are executed, THE Test_Framework SHALL verify IPC communication between React_Frontend and Tauri_Backend
3. WHEN integration tests are executed, THE Test_Framework SHALL verify GPU compute operations produce correct results
4. THE Test_Framework SHALL include tests for mesh import/export workflows
5. THE Test_Framework SHALL include tests for sculpting operations with undo/redo
6. THE Test_Framework SHALL include tests for painting operations with SVT_System
7. THE Test_Framework SHALL include tests for Kernel artifact storage and retrieval
8. THE Test_Framework SHALL include tests for KObjectRegistry cross-app identity tracking
9. WHEN any integration test fails, THE Test_Framework SHALL provide detailed error messages with context
10. THE DCC_Suite SHALL execute all integration tests in under 60 seconds

### Requirement 2: Critical Bug Fixes

**User Story:** As a user, I want all critical bugs fixed, so that I can use the application reliably without crashes or data loss.

#### Acceptance Criteria

1. WHEN a user performs any operation, THE DCC_Suite SHALL NOT crash or freeze
2. WHEN a user performs undo/redo operations, THE DCC_Suite SHALL correctly restore previous states
3. WHEN a user switches between apps, THE DCC_Suite SHALL maintain correct state for each app
4. WHEN a user imports large meshes (>1M vertices), THE DCC_Suite SHALL handle them without performance degradation beyond O(N) complexity
5. WHEN a user paints with SVT_System, THE DCC_Suite SHALL NOT produce texture artifacts or seams
6. WHEN a user sculpts with GPU brushes, THE DCC_Suite SHALL update normals correctly for proper shading
7. WHEN a user uses symmetry operations, THE DCC_Suite SHALL apply modifications symmetrically without offset errors
8. WHEN GPU operations are in progress, THE Tauri_Backend SHALL NOT deadlock with Bevy_Viewport
9. WHEN a user closes the application, THE DCC_Suite SHALL save all unsaved work or prompt the user
10. WHEN a user performs rapid input (fast brush strokes), THE DCC_Suite SHALL maintain sub-16ms frame times

### Requirement 3: System Integration and Wiring

**User Story:** As a user, I want all systems properly connected and integrated, so that features work seamlessly across the entire suite.

#### Acceptance Criteria

1. THE Kernel SHALL provide unified asset storage accessible from all apps
2. WHEN a user creates an asset in one app, THE Kernel SHALL make it available to other apps via KObjectRegistry
3. THE AppShell SHALL provide consistent UI layout and behavior across all apps
4. WHEN a user switches viewport modes, THE DCC_Suite SHALL properly initialize Bevy_Viewport or React_Frontend viewport
5. THE Leash_IPC SHALL provide bidirectional communication between Tauri_Backend and Bevy_Viewport
6. WHEN Bevy_Viewport is active, THE Leash_IPC SHALL synchronize camera, cursor, and selection state
7. THE GPU_Engine SHALL be accessible from both Tauri_Backend and Bevy_Viewport without conflicts
8. WHEN a user triggers keyboard shortcuts, THE DCC_Suite SHALL route them to the correct active system
9. THE DCC_Suite SHALL maintain consistent material and texture references across app boundaries
10. WHEN a user performs cross-app workflows, THE DCC_Suite SHALL preserve object metadata and relationships

### Requirement 4: File Operations System

**User Story:** As a user, I want reliable file import and export, so that I can bring assets into K_OS and export my work to other applications.

#### Acceptance Criteria

1. THE File_Ops SHALL support GLTF/GLB import with full scene hierarchy preservation
1. THE DCC_Suite SHALL provide an integration test framework that can test React_Frontend, Tauri_Backend, and GPU_Engine interactions
2. THE Test_Framework SHALL verify export functionality works in all apps (KTecton, KQuantum, KCloner currently have broken placeholder stubs)
3. WHEN integration tests are executed, THE Test_Framework SHALL verify IPC communication between React_Frontend and Tauri_Backend
4. WHEN integration tests are executed, THE Test_Framework SHALL verify GPU compute operations produce correct results
5. THE Test_Framework SHALL include tests for mesh import/export workflows
6. THE Test_Framework SHALL include tests for sculpting operations with undo/redo
7. THE Test_Framework SHALL include tests for painting operations with SVT_System
8. THE Test_Framework SHALL include tests for Kernel artifact storage and retrieval
9. THE Test_Framework SHALL include tests for KObjectRegistry cross-app identity tracking
10. WHEN any integration test fails, THE Test_Framework SHALL provide detailed error messages with context
11. THE DCC_Suite SHALL execute all integration tests in under 60 seconds
3. THE File_Ops SHALL support OBJ import and export for mesh-only workflows
4. THE File_Ops SHALL support PNG/JPG/EXR texture import and export
5. WHEN a user imports a GLTF file, THE File_Ops SHALL preserve mesh names, materials, and hierarchy
6. WHEN a user exports a GLTF file, THE File_Ops SHALL embed KObjectRegistry IDs in GLTF extras for round-trip identity
7. THE File_Ops SHALL support drag-and-drop file import from the operating system
8. WHEN a user exports large files (>100MB), THE File_Ops SHALL show progress indication
9. THE File_Ops SHALL validate file formats before import and provide clear error messages for invalid files
10. WHEN a user exports textures, THE File_Ops SHALL support resolution selection (512px to 8192px)
11. THE File_Ops SHALL support batch export of multiple assets
12. WHEN file operations fail, THE File_Ops SHALL provide actionable error messages with recovery options

### Requirement 5: UI Polish and Consistency

**User Story:** As a user, I want polished and consistent UI across all apps, so that I can learn the interface once and apply that knowledge everywhere.

#### Acceptance Criteria

1. WHEN a user performs any operation, THE DCC_Suite SHALL NOT crash or freeze
2. THE KTecton export system SHALL be fixed from placeholder stub (lines 410-412 in KTecton.tsx) to functional GLTF export
3. THE KQuantum export system SHALL be fixed from fake delay stub (lines 87-98 in KQuantum.tsx) to functional export
4. THE KCloner export system SHALL be fixed from admitted broken state (lines 692-698 in KCloner.tsx) to functional export
5. THE AppShell panel system SHALL be fixed to prevent viewport flickering during resize (react-resizable-panels issue in AppShell.tsx lines 136-145 and DockPanel.tsx lines 223-237)
6. WHEN a user performs undo/redo operations, THE DCC_Suite SHALL correctly restore previous states
7. WHEN a user switches between apps, THE DCC_Suite SHALL maintain correct state for each app
8. WHEN a user imports large meshes (>1M vertices), THE DCC_Suite SHALL handle them without performance degradation beyond O(N) complexity
9. WHEN a user paints with SVT_System, THE DCC_Suite SHALL NOT produce texture artifacts or seams
10. WHEN a user sculpts with GPU brushes, THE DCC_Suite SHALL update normals correctly for proper shading
11. WHEN a user uses symmetry operations, THE DCC_Suite SHALL apply modifications symmetrically without offset errors
12. WHEN GPU operations are in progress, THE Tauri_Backend SHALL NOT deadlock with Bevy_Viewport
13. WHEN a user closes the application, THE DCC_Suite SHALL save all unsaved work or prompt the user
14. WHEN a user performs rapid input (fast brush strokes), THE DCC_Suite SHALL maintain sub-16ms frame times
15. THE KTecton terrain resolution changes SHALL apply immediately without requiring restart
16. THE KCloner mode changes SHALL properly dispose of previous geometries to prevent memory leaks
2. THE DCC_Suite SHALL use consistent typography and spacing across all UI components
3. WHEN a user hovers over interactive elements, THE DCC_Suite SHALL provide visual feedback
4. THE DCC_Suite SHALL provide tooltips for all non-obvious UI elements
5. WHEN a user performs long-running operations, THE DCC_Suite SHALL show progress indicators
6. THE AppShell SHALL provide consistent panel layouts (TopBar, LeftPanel, RightPanel) across apps (THE top bar is currently broken , and has glitchy spacing/ non consistent)
7. THE DCC_Suite SHALL use consistent icon styles and sizes throughout
8. WHEN a user resizes panels, THE DCC_Suite SHALL maintain minimum readable sizes and save preferences. THEpanels should also not FLICKER the 3D viewport while resizing or moving
9. THE DCC_Suite SHALL provide keyboard shortcut hints in context menus and tooltips
10. WHEN validation errors occur, THE DCC_Suite SHALL highlight problematic fields with clear error messages

### Requirement 6: File Storage System

**User Story:** As a user, I want robust file storage for my projects and assets, so that my work is organized and never lost.

#### Acceptance Criteria

1. THE DCC_Suite SHALL provide a project-based file storage system with automatic saving
2. WHEN a user creates a new project, THE Storage_System SHALL create a project directory with proper structure
3. THE Storage_System SHALL store mesh artifacts in a dedicated meshes/ subdirectory (it already does this, it goes in the content browser)
4. THE Storage_System SHALL store texture assets in a dedicated textures/ subdirectoryit already does this, it goes in the content browser)
5. THE Storage_System SHALL store material definitions in a dedicated materials/ subdirectoryit already does this, it goes in the content browser)
6. THE Storage_System SHALL store project metadata in a JSON manifest file
7. WHEN a user saves a project, THE Storage_System SHALL create incremental backups
8. THE Storage_System SHALL support auto-save with configurable intervals (default 5 minutes)
9. WHEN storage operations fail, THE Storage_System SHALL retry with exponential backoff
10. THE Storage_System SHALL provide storage usage statistics and cleanup tools for old backups
11. WHEN a user opens a project, THE Storage_System SHALL validate file integrity before loading
12. THE Storage_System SHALL support project export as a single archive file (.kos format)

### Requirement 7: KPainter SVT System

**User Story:** As a user, I want fully functional Sparse Virtual Texture painting in KPainter, so that I can paint on high-resolution textures (16K+) without memory constraints.

#### Acceptance Criteria

1. THE SVT_System SHALL support texture resolutions up to 16384x16384 pixels
2. WHEN a user paints on a mesh, THE SVT_System SHALL allocate texture tiles on-demand
3. THE SVT_System SHALL maintain a page table for virtual-to-physical texture coordinate mapping
4. THE SVT_System SHALL use an LRU cache for physical texture tiles
5. WHEN the tile cache is full, THE SVT_System SHALL evict least-recently-used tiles
6. THE SVT_System SHALL support all PBR channels (albedo, normal, roughness, metallic, AO, height)
7. WHEN a user switches PBR channels, THE SVT_System SHALL maintain separate page tables per channel
8. THE SVT_System SHALL support undo/redo by storing tile snapshots
9. WHEN a user exports painted textures, THE SVT_System SHALL composite virtual tiles into standard texture files
10. THE SVT_System SHALL provide memory usage statistics and tile cache visualization
11. WHEN painting near tile boundaries, THE SVT_System SHALL blend seamlessly across tiles
12. THE SVT_System SHALL support brush sizes from 1px to 512px with proper filtering

### Requirement 8: KTecton Control System

**User Story:** As a user, I want responsive and intuitive controls in KTecton, so that I can sculpt terrain and generate environments efficiently.

#### Acceptance Criteria

1. THE KTecton SHALL provide camera controls that match industry-standard DCC applications
2. WHEN a user drags with middle mouse button, THE KTecton SHALL pan the camera
3. WHEN a user drags with right mouse button, THE KTecton SHALL rotate the camera
4. WHEN a user scrolls the mouse wheel, THE KTecton SHALL zoom the camera
5. THE KTecton SHALL provide brush controls for terrain sculpting with size, strength, and falloff parameters
6. WHEN a user paints on terrain, THE KTecton SHALL apply height modifications in real-time
7. THE KTecton SHALL support terrain erosion simulation with hydraulic and thermal erosion
8. THE KTecton SHALL provide layer-based terrain editing with blend modes
9. WHEN a user generates procedural terrain, THE KTecton SHALL provide seed control for reproducibility
10. THE KTecton SHALL support terrain export as heightmap (PNG/EXR) and mesh (GLTF/OBJ)

### Requirement 9: Application Logic Consistency

**User Story:** As a user, I want logical and predictable behavior across all applications, so that I can work efficiently without confusion.

#### Acceptance Criteria
1. THE DCC_Suite SHALL ENHANCE ITS CURRENT THEMEING SYSTEM AND ALLOW for much more UI flexibility, along with a better tab system and dockable window. Think UE5 and VSCODE
2. THE DCC_Suite SHALL use consistent typography and spacing across all UI components
3. THE TopBar SHALL use AppTopBar component consistently across all apps (currently KSculpt uses AppTopBar while others use custom implementations)
4. WHEN a user hovers over interactive elements, THE DCC_Suite SHALL provide visual feedback
5. THE DCC_Suite SHALL provide tooltips for all non-obvious UI elements
6. WHEN a user performs long-running operations, THE DCC_Suite SHALL show progress indicators
7. THE AppShell SHALL provide consistent panel layouts (TopBar, LeftPanel, RightPanel) across apps (THE top bar is currently broken, and has glitchy spacing/non consistent)
8. THE DCC_Suite SHALL use consistent icon styles and sizes throughout
9. WHEN a user resizes panels, THE DCC_Suite SHALL maintain minimum readable sizes and save preferences. THE panels should also not FLICKER the 3D viewport while resizing or moving
10. THE DCC_Suite SHALL provide keyboard shortcut hints in context menus and tooltips
11. WHEN validation errors occur, THE DCC_Suite SHALL highlight problematic fields with clear error messages
12. THE DCC_Suite SHALL fix hardcoded view modes in KTecton (currently uses 0-3 indices) to use data-driven configuration
13. THE DCC_Suite SHALL fix hardcoded brush/tool settings across apps to use centralized data-driven configuration
14. THE DCC_Suite SHALL fix hardcoded export formats to use data-driven registry system
15. THE DCC_Suite SHALL fix hardcoded grid sizes, camera distances, and lighting parameters to use data-driven configuration
1. THE DCC_Suite SHALL use consistent selection behavior across all apps (click to select, Ctrl+click for multi-select)
2. THE DCC_Suite SHALL use consistent undo/redo shortcuts (Ctrl+Z, Ctrl+Shift+Z) across all apps
3. THE DCC_Suite SHALL use consistent save shortcuts (Ctrl+S) across all apps
4. WHEN a user deletes an object, THE DCC_Suite SHALL prompt for confirmation if the object has unsaved changes
5. THE DCC_Suite SHALL use consistent layer management behavior across all apps
6. WHEN a user creates a new layer, THE DCC_Suite SHALL make it the active layer automatically
7. THE DCC_Suite SHALL use consistent material assignment behavior across all apps
8. WHEN a user applies a material, THE DCC_Suite SHALL update the viewport immediately
9. THE DCC_Suite SHALL use consistent transform gizmo behavior across all apps
10. WHEN a user switches tools, THE DCC_Suite SHALL provide clear visual indication of the active tool

### Requirement 10: KGraphos System Overhaul

**User Story:** As a user, I want a completely overhauled KGraphos 2D texture painter, so that I can create high-quality textures with fluid painting and advanced brushes.

#### Acceptance Criteria

1. THE KGraphos SHALL provide a GPU-accelerated 2D painting engine with fluid simulation
2. THE KGraphos SHALL support brush presets including Ink, Watercolor, Oil, Smear, and Blend
3. WHEN a user paints with smear brush, THE KGraphos SHALL sample existing paint and drag it realistically
4. THE KGraphos SHALL support pressure-sensitive input from tablets with size, opacity, and hardness dynamics
5. THE KGraphos SHALL provide layer-based compositing with blend modes (Normal, Multiply, Overlay, etc.)
6. THE KGraphos SHALL support alpha masks for non-destructive editing
7. WHEN a user paints, THE KGraphos SHALL provide real-time brush cursor preview
8. THE KGraphos SHALL support symmetry modes (X, Y, radial) for pattern creation
9. THE KGraphos SHALL provide color picker with HSV and RGB modes
10. THE KGraphos SHALL support texture export in multiple formats (PNG, JPG, TGA, EXR)
11. WHEN a user uses watercolor brush, THE KGraphos SHALL simulate color mixing and wetness
12. THE KGraphos SHALL provide undo/redo with configurable history depth (default 50 steps)

### Requirement 11: GPU Logic Verification

**User Story:** As a developer, I want all GPU compute logic verified and tested, so that GPU operations produce correct results reliably.

#### Acceptance Criteria

1. THE GPU_Engine SHALL provide unit tests for all compute shaders
2. WHEN GPU subdivision is executed, THE GPU_Engine SHALL produce meshes identical to CPU Catmull-Clark subdivision
3. WHEN GPU sculpting is executed, THE GPU_Engine SHALL update vertex positions and normals correctly
4. WHEN GPU normal recalculation is executed, THE GPU_Engine SHALL produce normals identical to CPU calculation
5. THE GPU_Engine SHALL handle edge cases (degenerate triangles, zero-area faces) without crashes
6. WHEN GPU buffers are full, THE GPU_Engine SHALL provide clear error messages
7. THE GPU_Engine SHALL validate all buffer sizes before GPU dispatch
8. WHEN GPU operations fail, THE GPU_Engine SHALL fall back to CPU implementations automatically
9. THE GPU_Engine SHALL provide performance benchmarks for all GPU operations
10. THE GPU_Engine SHALL detect GPU device loss and reinitialize gracefully

### Requirement 12: KSamples PBR Upload System

**User Story:** As a user, I want to upload custom textures to KAutopbr (KSamples), so that I can generate PBR material sets from my own images.

#### Acceptance Criteria

1. THE KAutopbr SHALL provide a file upload interface for base texture images
2. THE KAutopbr SHALL support PNG, JPG, and TGA image formats for upload
3. WHEN a user uploads an image, THE KAutopbr SHALL validate the image format and dimensions
4. THE KAutopbr SHALL support images from 512x512 to 8192x8192 pixels
5. WHEN a user uploads a texture, THE KAutopbr SHALL generate all PBR maps (normal, roughness, metallic, AO, height, curvature)
6. THE KAutopbr SHALL provide preview of generated PBR maps before applying
7. THE KAutopbr SHALL allow adjustment of generation parameters (normal strength, roughness bias, etc.)
8. WHEN PBR generation completes, THE KAutopbr SHALL display the material on a preview sphere
9. THE KAutopbr SHALL support batch processing of multiple textures
10. THE KAutopbr SHALL save generated PBR materials to the Kernel material library

### Requirement 13: Top Bar and App Shell Improvements

**User Story:** As a user, I want a clean and functional top bar UI, so that I can access common functions quickly without clutter.

#### Acceptance Criteria

1. THE AppShell SHALL provide a consistent top bar across all apps with app-specific controls
2. THE TopBar SHALL include File menu with New, Open, Save, Export options
2.5- WE ALSO NEED TO ENSURE THE UPLINK BUTTON IS IN EVERY APPLICABLE TOP BAR THAT CAN EXPORT TO THE KERNEL /ASSET BROWSER
3. THE TopBar SHALL include Edit menu with Undo, Redo, Preferences options
4. THE TopBar SHALL include View menu with viewport and panel visibility toggles
5. THE TopBar SHALL display the current project name and save status
6. WHEN a user has unsaved changes, THE TopBar SHALL display a visual indicator
7. THE TopBar SHALL provide quick access to viewport shading modes
8. THE TopBar SHALL include a search/command palette trigger (Ctrl+K)
9. THE TopBar SHALL adapt to available screen width by collapsing less-used items into overflow menu
10. THE TopBar SHALL provide consistent spacing and alignment across all apps

### Requirement 14: File Export System Repair

**User Story:** As a user, I want reliable file export that actually works, so that I can use my creations in other applications.

#### Acceptance Criteria

1. THE File_Ops SHALL export GLTF files with all meshes, materials, and textures embedded
2. WHEN a user exports a GLTF file, THE File_Ops SHALL validate the output before saving
3. THE File_Ops SHALL provide export options for GLTF (embedded textures) vs GLB (binary)
4. THE File_Ops SHALL export OBJ files with MTL material definitions
5. WHEN a user exports OBJ, THE File_Ops SHALL save textures as separate files in the same directory
6. THE File_Ops SHALL export textures with user-specified resolution and format
7. THE File_Ops SHALL support export of selected objects only or entire scene
8. WHEN export fails, THE File_Ops SHALL provide detailed error messages with file path and reason
9. THE File_Ops SHALL verify write permissions before attempting export
10. THE File_Ops SHALL support export presets (Game Engine, Rendering, 3D Printing) with optimized settings
11. WHEN a user exports for 3D printing, THE File_Ops SHALL validate mesh is manifold and watertight
12. THE File_Ops SHALL provide export progress indication for large files

### Requirement 15: KSculpt Subdivision Surface

**User Story:** As a user, I want working subdivision surface in KSculpt, so that I can smooth my sculpts and add detail levels.

#### Acceptance Criteria

1. THE KSculpt SHALL provide GPU Catmull-Clark subdivision (already exist, just need to fix)
2. WHEN a user subdivides a mesh, THE KSculpt SHALL preserve the overall shape while adding smoothness
3. THE KSculpt SHALL support GPU-accelerated subdivision for meshes up to 1M faces
4. WHEN GPU subdivision is unavailable, THE KSculpt SHALL fall back to rust based CPU subdivision
5. THE KSculpt SHALL preserve UV coordinates during subdivision
6. THE KSculpt SHALL preserve vertex colors during subdivision
7. WHEN a user subdivides, THE KSculpt SHALL update the vertex count display
8. THE KSculpt SHALL support subdivision of selected faces only
9. THE KSculpt SHALL provide undo for subdivision operations
10. THE KSculpt SHALL support adaptive subdivision based on screen-space edge length

### Requirement 16: Instant Meshes Integration

**User Story:** As a user, I want automatic quad remeshing via Instant Meshes, so that I can convert sculpted meshes to clean quad topology for animation.

#### Acceptance Criteria

1. THE DCC_Suite SHALL integrate the Instant Meshes library for automatic remeshing( already exist just need to wireback in)
2. THE KSculpt SHALL provide a "Remesh to Quads" button that invokes Instant_Meshes
3. WHEN a user triggers remeshing, THE Instant_Meshes SHALL generate a quad-dominant mesh
4. THE Instant_Meshes SHALL provide target face count control (1K to 100K faces)
5. THE Instant_Meshes SHALL preserve sharp features and creases during remeshing
6. WHEN remeshing completes, THE KSculpt SHALL replace the original mesh with the remeshed version
7. THE Instant_Meshes SHALL provide progress indication during processing
8. THE Instant_Meshes SHALL support boundary preservation for open meshes
9. THE Instant_Meshes SHALL generate clean edge flow suitable for subdivision
10. WHEN remeshing fails, THE DCC_Suite SHALL provide error messages and keep the original mesh

### Requirement 17: Robust Sculpting Pipeline

**User Story:** As a user, I want a complete and robust sculpting pipeline, so that I can create professional-quality sculpts with all necessary tools.

#### Acceptance Criteria
1. THE AppShell SHALL provide a consistent top bar across all apps with app-specific controls
2. THE TopBar SHALL include File menu with New, Open, Save, Export options
3. THE TopBar SHALL include Uplink button in every applicable app that can export to the Kernel/Asset Browser (currently missing in KQuantum and KInspect)
4. THE TopBar SHALL use AppTopBar component consistently (currently only KSculpt uses it, others have custom implementations)
5. THE TopBar SHALL include Edit menu with Undo, Redo, Preferences options
6. THE TopBar SHALL include View menu with viewport and panel visibility toggles
7. THE TopBar SHALL display the current project name and save status
8. WHEN a user has unsaved changes, THE TopBar SHALL display a visual indicator
9. THE TopBar SHALL provide quick access to viewport shading modes
10. THE TopBar SHALL include a search/command palette trigger (Ctrl+K)
11. THE TopBar SHALL adapt to available screen width by collapsing less-used items into overflow menu
12. THE TopBar SHALL provide consistent spacing and alignment across all apps (currently has glitchy spacing)
1. THE Sculpt_Pipeline SHALL provide at least 30 brush types covering all common sculpting needs (already have gpu params system setup, its a data driven kbrush system, if anything we need to ensure the pipeline is robust)
2. THE Sculpt_Pipeline SHALL support vertex masking with paint, clear, invert, and extract operations
3. WHEN a user paints a mask, THE Sculpt_Pipeline SHALL prevent brush modifications in masked areas
4. THE Sculpt_Pipeline SHALL support mask extraction to create new mesh from masked region
5. THE Sculpt_Pipeline SHALL provide dynamic topology (DynTopo) for automatic mesh refinement during sculpting
6. WHEN DynTopo is enabled, THE Sculpt_Pipeline SHALL split edges longer than detail size within brush radius
7. THE Sculpt_Pipeline SHALL support symmetry modes (X, Y, Z, radial) with visual symmetry plane
8. THE Sculpt_Pipeline SHALL provide layer-based sculpting with blend modes
9. THE Sculpt_Pipeline SHALL support alpha textures for custom brush stamps
10. THE Sculpt_Pipeline SHALL provide stroke stabilization (lazy mouse) for smooth strokes
11. THE Sculpt_Pipeline SHALL support pressure-sensitive tablets with size, strength, and hardness dynamics
12. THE Sculpt_Pipeline SHALL provide undo/redo with configurable history depth (default 50 steps)
13. WHEN a user sculpts, THE Sculpt_Pipeline SHALL update normals in real-time for correct shading
14. THE Sculpt_Pipeline SHALL provide MatCap shading for clay-like sculpting preview
15. THE Sculpt_Pipeline SHALL support mesh decimation for reducing polygon count while preserving detail

### Requirement 18: App-Specific Production Readiness

**User Story:** As a user, I want each DCC app to meet production quality standards, so that I can rely on them for professional work.

#### Production Readiness Scores (from comprehensive inspection)

- KAutopbr: 95% (best overall - SVT system fully working, minor UI polish needed)
- KGreeble: 90% (solid implementation, needs data-driven configuration)
- KPainter: 90% (SVT system fully working, needs UI consistency)
- KGraphos: 85% (needs overhaul for fluid painting)
- KSculpt: 85% (needs subdivision and masking wired in)
- KInspect: 80% (needs Uplink button, export functionality)
- KAtlas: 75% (needs UV editing tools, better UX)
- KQuantum: 70% (needs export fixed, Uplink button)
- KTecton: 65% (needs export fixed, terrain resolution fix)
- KCloner: 55% (worst - export completely broken, memory leaks)

#### Acceptance Criteria

1. THE KTecton SHALL fix export system from placeholder stub (lines 410-412) to functional GLTF export with terrain mesh and heightmap
2. THE KTecton SHALL fix terrain resolution changes to apply immediately without requiring restart
3. THE KTecton SHALL implement data-driven view mode configuration instead of hardcoded 0-3 indices
4. THE KQuantum SHALL fix export system from fake delay stub (lines 87-98) to functional particle system export
5. THE KQuantum SHALL add Uplink button to top bar for exporting to Kernel/Asset Browser
6. THE KQuantum SHALL implement proper particle system serialization for export
7. THE KCloner SHALL fix export system from broken state (lines 692-698) to functional clone array export
8. THE KCloner SHALL fix memory leaks on mode changes by properly disposing previous geometries
9. THE KCloner SHALL implement proper clone instance management for large arrays (100K+ instances)
10. THE KInspect SHALL add Uplink button to top bar for exporting inspection data
11. THE KInspect SHALL implement export functionality for mesh analysis reports
12. THE KAtlas SHALL implement UV editing tools (move, rotate, scale, unwrap)
13. THE KAtlas SHALL improve UX with better visual feedback during UV operations
13.5 The KATLAS target instant UV with lcsm solving even at 1M+ polygons
14. THE KSculpt SHALL wire in subdivision surface system (GPU Catmull-Clark already exists)
15. THE KSculpt SHALL wire in masking system with paint, clear, invert, extract operations
16. THE KSculpt SHALL ensure all 30+ GPU brushes are properly wired to UI
17. THE KGraphos SHALL implement fluid painting engine with smear, watercolor, and oil brushes
18. THE KGraphos SHALL implement layer-based compositing with blend modes
19. THE KPainter SHALL maintain current 90% production readiness with continued SVT system support
20. THE KAutopbr SHALL maintain current 95% production readiness as reference implementation
21. THE KGreeble SHALL implement data-driven greeble pattern configuration instead of hardcoded patterns
22. ALL apps SHALL use AppTopBar component consistently (currently only KSculpt uses it)
23. ALL apps SHALL implement Uplink button where applicable (currently missing in KQuantum and KInspect)
24. ALL apps SHALL use data-driven configuration for tools, brushes, and settings (currently many hardcoded values)
25. ALL apps SHALL achieve minimum 85% production readiness score before final release

### Requirement 19: Data-Driven Architecture

**User Story:** As a developer, I want all configuration and settings to be data-driven, so that the system is scalable, maintainable, and easy to extend without code changes.

#### Acceptance Criteria

1. THE DCC_Suite SHALL provide a centralized configuration registry for all app settings
2. THE DCC_Suite SHALL replace hardcoded view modes in KTecton with JSON configuration defining mode names, indices, and rendering parameters
3. THE DCC_Suite SHALL replace hardcoded brush settings with JSON brush registry defining all brush parameters
4. THE DCC_Suite SHALL replace hardcoded export formats with JSON export format registry defining supported formats, extensions, and options
5. THE DCC_Suite SHALL replace hardcoded grid sizes with JSON viewport configuration defining grid parameters
6. THE DCC_Suite SHALL replace hardcoded camera distances with JSON camera preset configuration
7. THE DCC_Suite SHALL replace hardcoded lighting parameters with JSON lighting preset configuration
8. THE DCC_Suite SHALL replace hardcoded greeble patterns in KGreeble with JSON pattern library
9. THE DCC_Suite SHALL replace hardcoded tool settings with JSON tool registry defining all tool parameters
10. THE DCC_Suite SHALL provide hot-reload capability for all JSON configuration files during development
11. WHEN configuration files are invalid, THE DCC_Suite SHALL provide detailed validation errors with line numbers
12. THE DCC_Suite SHALL provide schema validation for all JSON configuration files
13. THE DCC_Suite SHALL provide default fallback values when configuration files are missing
14. THE DCC_Suite SHALL document all configuration schemas in docs/CONFIG_SCHEMAS.md
15. THE DCC_Suite SHALL provide UI for editing common configuration values without manual JSON editing
16. WHEN configuration changes are made, THE DCC_Suite SHALL save them to user preferences directory
17. THE DCC_Suite SHALL support configuration inheritance (global defaults < user preferences < project overrides)
18. THE DCC_Suite SHALL provide configuration export/import for sharing presets between users
19. THE DCC_Suite SHALL validate all configuration values at load time with type checking
20. THE DCC_Suite SHALL provide migration system for configuration format changes across versions