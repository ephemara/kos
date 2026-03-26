# Implementation Plan: UI Forge

## Overview

UI Forge is a Python-based procedural UI asset generation system that creates icons, brushes, patterns, cursors, and overlays through data-driven templates. Implementation follows a library-first approach, leveraging numpy, Pillow, and the Python ecosystem for scalable, high-performance asset generation with Tauri integration.

## Tasks

- [x] 1. Set up Python package structure and dependencies
  - Create directory structure at `M:\K_OS\src-python\UI\`
  - Create `__init__.py`, `requirements.txt`, and `README.md`
  - Define all subdirectories: `generators/`, `templates/`, `preview/`, `library/`, `utils/`, `animation/`, `external/`
  - Install core dependencies: Pillow, numpy, svgwrite, cairosvg, pyyaml, jsonschema
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

- [x] 2. Implement core data models and template system
  - [x] 2.1 Create template data models
    - Implement `Template`, `AnimationConfig`, `IconParams`, `BrushParams`, `AlphaParams` dataclasses
    - Implement `Layer`, `FillStyle`, `StrokeStyle` dataclasses for icon generation
    - Support arbitrary dimensions and output formats from template data
    - _Requirements: 3.1, 3.2, 3.4, 17.1, 17.2_
  
  - [x] 2.2 Implement TemplateManager class
    - Write `load_template()` for JSON/YAML parsing
    - Write `validate_template()` with jsonschema validation
    - Write `resolve_inheritance()` for parent template support
    - Write `list_templates()` for template discovery
    - Implement color token resolution system
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.9, 14.4_
  
  - [ ]* 2.3 Write unit tests for template parsing
    - Test JSON and YAML parsing equivalence
    - Test template inheritance resolution
    - Test color token resolution
    - Test validation error handling
    - _Requirements: 3.8, 15.3_
  
  - [ ]* 2.4 Write round-trip property test for template serialization
    - **Property 1: Template round-trip consistency**
    - **Validates: Requirements 15.1, 15.2**
    - Test that parse → serialize → parse produces equivalent template
    - _Requirements: 15.1, 15.2, 15.5_

- [x] 3. Implement base generator infrastructure
  - [x] 3.1 Create BaseGenerator abstract class
    - Define `generate()` abstract method returning numpy array
    - Define `supported_params()` for parameter schema
    - Implement `validate_params()` for parameter validation
    - _Requirements: 12.2, 12.3_
  
  - [x] 3.2 Implement GeneratorManager class
    - Write `discover_generators()` for auto-discovery from `generators/` directory
    - Write `get_generator()` for generator routing
    - Write `reload_generator()` for hot-reload support
    - Write `list_generators()` for generator enumeration
    - _Requirements: 2.6, 6.7, 12.1, 12.8_
  
  - [ ]* 3.3 Write unit tests for generator discovery
    - Test auto-discovery of generator modules
    - Test generator registration validation
    - Test hot-reload functionality
    - _Requirements: 12.1, 12.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Icon Generator
  - [x] 5.1 Create icon_generator.py with geometric primitives
    - Implement circle, rectangle, polygon drawing with numpy
    - Implement anti-aliasing via supersampling
    - Implement layering with blend modes (normal, multiply, screen, overlay)
    - Support arbitrary output dimensions from template
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 17.8_
  
  - [x] 5.2 Implement gradient fills for icons
    - Implement linear gradient generation
    - Implement radial gradient generation
    - Implement angular gradient generation
    - _Requirements: 7.4_
  
  - [x] 5.3 Implement SVG output for icons
    - Generate SVG using svgwrite with proper viewBox
    - Optimize SVG paths for minimal file size
    - Ensure pixel-perfect rendering at target resolutions
    - _Requirements: 2.7, 7.13, 7.14, 7.15_
  
  - [x] 5.4 Implement stroke operations and padding
    - Add stroke rendering with configurable width, cap, join
    - Add padding and safe area margin support
    - _Requirements: 7.5, 7.12_
  
  - [ ]* 5.5 Write unit tests for icon generation
    - Test geometric primitive rendering
    - Test gradient generation
    - Test SVG output validation
    - Test layer blending
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 6. Implement Brush Generator
  - [x] 6.1 Create brush_generator.py with brush rendering
    - Implement circular and square brush shapes
    - Implement falloff curve rendering (linear, smooth, sharp)
    - Implement texture overlay application
    - Generate thumbnail (64x64) and detail (256x256) previews
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.8_
  
  - [x] 6.2 Implement brush stroke preview rendering
    - Render representative brush strokes with spacing
    - Support neutral background rendering
    - _Requirements: 8.2, 8.6_
  
  - [ ]* 6.3 Write unit tests for brush generation
    - Test brush shape rendering
    - Test falloff curves
    - Test texture overlay
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 7. Implement Pattern, Cursor, and Overlay Generators
  - [x] 7.1 Create pattern_generator.py for fill patterns
    - Implement tileable pattern generation
    - Support procedural pattern algorithms
    - _Requirements: 2.3_
  
  - [x] 7.2 Create cursor_generator.py for custom cursors
    - Implement cursor shape rendering with hotspot metadata
    - Support multiple cursor sizes
    - _Requirements: 2.4_
  
  - [x] 7.3 Create overlay_generator.py for viewport overlays
    - Implement HUD element generation
    - Support transparency and compositing
    - _Requirements: 2.5_
  
  - [ ]* 7.4 Write unit tests for pattern, cursor, overlay generators
    - Test pattern tileability
    - Test cursor hotspot metadata
    - Test overlay transparency
    - _Requirements: 2.3, 2.4, 2.5_

- [x] 8. Implement Alpha Generator
  - [x] 8.1 Create alpha_generator.py with gradient alpha
    - Implement linear, radial, angular alpha gradients
    - Support gradient center and angle parameters
    - _Requirements: 18.4_
  
  - [x] 8.2 Implement shape-based alpha with feathering
    - Implement circle, rectangle, polygon alpha shapes
    - Add feathering/blur for soft edges
    - _Requirements: 18.5_
  
  - [x] 8.3 Implement procedural alpha patterns
    - Integrate Perlin/simplex noise generation
    - Implement Voronoi and cellular patterns
    - Support noise scale and octave parameters
    - _Requirements: 18.6_
  
  - [x] 8.4 Implement alpha operations and compositing
    - Add alpha invert operation
    - Add alpha blend modes (multiply, screen, overlay)
    - Support alpha from luminance conversion
    - _Requirements: 18.9, 18.10_
  
  - [x] 8.5 Implement separate alpha mask output
    - Generate grayscale alpha mask files alongside color assets
    - Validate alpha mask dimensions match color asset
    - _Requirements: 18.2, 18.3, 18.13_
  
  - [ ]* 8.6 Write unit tests for alpha generation
    - Test gradient alpha generation
    - Test shape-based alpha with feathering
    - Test procedural patterns
    - Test alpha operations
    - _Requirements: 18.4, 18.5, 18.6, 18.9_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement core engine and orchestration
  - [x] 10.1 Create core.py with UIForgeEngine class
    - Implement `generate_asset()` for single asset generation
    - Implement `batch_generate()` with multiprocessing support
    - Implement `regenerate_changed()` for incremental generation
    - Implement `get_progress()` for batch progress tracking
    - Add error recovery and logging
    - _Requirements: 9.1, 9.2, 9.5_
  
  - [x] 10.2 Implement format conversion and output
    - Support PNG, SVG, JPEG, WebP, TIFF, BMP, ICO output formats
    - Implement format-specific quality parameters (JPEG quality, PNG compression)
    - Validate format compatibility with features (transparency requires PNG/WebP/SVG)
    - Support multiple format output from single template
    - _Requirements: 2.7, 2.8, 17.1, 17.3, 17.4, 17.5_
  
  - [x] 10.3 Implement caching and incremental generation
    - Add intermediate result caching
    - Implement template change detection
    - Support incremental regeneration
    - _Requirements: 9.4, 9.5_
  
  - [ ]* 10.4 Write unit tests for core engine
    - Test single asset generation
    - Test batch generation with multiprocessing
    - Test error recovery
    - Test caching behavior
    - _Requirements: 9.1, 9.2, 9.4_

- [x] 11. Implement validation system
  - [x] 11.1 Create validators.py with validation checks
    - Implement alpha channel validation for PNG/WebP
    - Implement SVG validation (viewBox, paths, rendering)
    - Implement dimension validation against template specs
    - Implement file size validation (icons < 100KB, brushes < 500KB, SVG < 50KB)
    - Implement color mode validation (RGBA vs RGB)
    - Implement DPI validation (72 DPI for screen assets)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.8, 10.9_
  
  - [x] 11.2 Implement duplicate detection
    - Add perceptual hashing for duplicate detection
    - Generate validation reports
    - _Requirements: 10.7_
  
  - [x] 11.3 Implement quality metrics
    - Check for artifacts, banding, aliasing
    - Generate quality scores
    - _Requirements: 10.10_
  
  - [ ]* 11.4 Write unit tests for validators
    - Test alpha channel validation
    - Test SVG validation
    - Test dimension validation
    - Test duplicate detection
    - _Requirements: 10.1, 10.2, 10.4, 10.7_

- [x] 12. Implement preview and approval workflow
  - [x] 12.1 Create preview_manager.py with PreviewManager class
    - Implement `stage_asset()` for preview staging with timestamps
    - Implement `generate_gallery()` for HTML preview generation
    - Implement `approve_assets()` for batch approval
    - Implement `reject_assets()` with feedback notes
    - Implement `get_preview_status()` for status queries
    - _Requirements: 4.1, 4.2, 4.7, 4.8_
  
  - [x] 12.2 Implement HTML preview gallery
    - Generate grid layout with thumbnails
    - Add alpha channel visualization with checkerboard backgrounds
    - Display asset metadata (dimensions, file size, generator)
    - Add approve/reject buttons with keyboard shortcuts
    - Add category and validation status filters
    - _Requirements: 4.3, 4.4, 18.14_
  
  - [ ]* 12.3 Write unit tests for preview manager
    - Test asset staging
    - Test gallery generation
    - Test approval workflow
    - _Requirements: 4.1, 4.2, 4.7_

- [x] 13. Implement library management
  - [x] 13.1 Create library_manager.py with LibraryManager class
    - Implement asset organization by category, resolution, theme
    - Implement `add_to_library()` with metadata generation
    - Implement semantic naming conventions
    - Implement library index generation
    - Implement library search and query functions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_
  
  - [x] 13.2 Implement asset metadata generation
    - Generate JSON metadata files with all required fields
    - Include generation info, technical properties, theme info, animation info
    - Track usage statistics
    - _Requirements: 5.5_
  
  - [x] 13.3 Implement library index auto-update
    - Regenerate index on library changes
    - Include category statistics and theme groups
    - _Requirements: 5.8_
  
  - [ ]* 13.4 Write unit tests for library manager
    - Test asset organization
    - Test metadata generation
    - Test index generation
    - Test search functionality
    - _Requirements: 5.1, 5.4, 5.7_

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement Tauri bridge and JSON-RPC handlers
  - [x] 15.1 Create tauri_bridge.py with @register decorator
    - Implement JSON-RPC registration decorator
    - Add error handling and structured error responses
    - _Requirements: 6.1, 6.6_
  
  - [x] 15.2 Implement RPC handler functions
    - Implement `generate_asset_rpc()` for single asset generation
    - Implement `batch_generate_rpc()` for batch operations
    - Implement `get_progress_rpc()` for progress tracking
    - Implement `list_templates_rpc()` for template enumeration
    - Implement `approve_preview_rpc()` for preview approval
    - Implement `get_library_index_rpc()` for library access
    - Implement `reload_generator_rpc()` for hot-reload
    - _Requirements: 6.2, 6.3, 6.5, 6.8_
  
  - [x] 15.3 Implement async support for long-running operations
    - Add async/await support for batch generation
    - Implement progress reporting for long operations
    - _Requirements: 6.4, 6.5_
  
  - [ ]* 15.4 Write integration tests for Tauri bridge
    - Test JSON-RPC registration
    - Test RPC handler invocation
    - Test error handling
    - Test async operations
    - _Requirements: 6.1, 6.2, 6.6_

- [x] 16. Implement theme support
  - [x] 16.1 Create theme system with color tokens
    - Define color token dictionaries for light/dark/high-contrast themes
    - Implement color token resolution in TemplateManager
    - _Requirements: 14.1, 14.4_
  
  - [x] 16.2 Implement multi-variant generation
    - Generate assets in multiple theme variants from single template
    - Validate visual consistency across variants
    - Add theme variant metadata to assets
    - _Requirements: 14.2, 14.5, 14.7_
  
  - [x] 16.3 Implement automatic color inversion for dark mode
    - Add color inversion utility for dark mode variants
    - _Requirements: 14.8_
  
  - [ ]* 16.4 Write unit tests for theme system
    - Test color token resolution
    - Test multi-variant generation
    - Test color inversion
    - _Requirements: 14.1, 14.4, 14.8_

- [x] 17. Implement optional animation system
  - [x] 17.1 Create animation/motion_library.py with motion functions
    - Implement classic motions: orbit, float, pulse, shake, elastic
    - Implement intermediate motions: pendulum, wobble, figure8, heartbeat, glitch
    - Implement physics motions: bounce, tumble, strobe, corkscrew, shiver, sway
    - Implement complex motions: lissajous, flip, tremor, scan, warp, drift
    - _Requirements: 16.5_
  
  - [x] 17.2 Create animation/svg_animator.py for SMIL animations
    - Generate SMIL `<animate>` and `<animateTransform>` elements
    - Support duration, easing, and loop parameters
    - Implement keyframe generation from motion functions
    - _Requirements: 16.7_
  
  - [x] 17.3 Create animation/sprite_sheet.py for sprite sheet generation
    - Render animation frames to numpy arrays
    - Composite frames into grid layout (horizontal, vertical, grid)
    - Generate sprite sheet metadata JSON
    - _Requirements: 16.8_
  
  - [x] 17.4 Integrate animation system with core engine
    - Add animation as optional post-processing step after static generation
    - Support animation composition (combining multiple motions)
    - Preserve static icon on animation failure
    - _Requirements: 16.2, 16.10, 16.12_
  
  - [ ]* 17.5 Write unit tests for animation system
    - Test motion function generation
    - Test SMIL animation generation
    - Test sprite sheet generation
    - Test animation composition
    - _Requirements: 16.5, 16.7, 16.8, 16.10_

- [x] 18. Implement external tool integration
  - [x] 18.1 Create external/base.py with ExternalTool abstract class
    - Define `is_available()` for tool detection
    - Define `get_version()` for version checking
    - Define `execute()` for command execution
    - _Requirements: 19.3, 19.7_
  
  - [x] 18.2 Create external/imagemagick.py wrapper
    - Implement ImageMagick CLI wrapper
    - Add `convert()` for format conversion
    - Add `composite()` for image compositing
    - _Requirements: 19.4_
  
  - [x] 18.3 Create external/inkscape.py wrapper
    - Implement Inkscape CLI wrapper
    - Add `optimize_svg()` for SVG optimization
    - Add `svg_to_png()` for SVG rendering
    - _Requirements: 19.4_
  
  - [x] 18.4 Create external/gimp.py wrapper
    - Implement GIMP batch mode wrapper
    - Support complex batch operations
    - _Requirements: 19.4_
  
  - [x] 18.5 Implement graceful degradation for missing tools
    - Check tool availability at startup
    - Provide clear error messages for missing tools
    - Support optional dependencies with fallbacks
    - _Requirements: 19.7, 19.8, 19.15_
  
  - [ ]* 18.6 Write unit tests for external tool integration
    - Test tool detection
    - Test command execution
    - Test graceful degradation
    - _Requirements: 19.7, 19.8_

- [x] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Create documentation and examples
  - [x] 20.1 Write comprehensive README.md
    - Add setup instructions with venv creation
    - Add usage examples for each generator
    - Document Tauri integration API
    - Add troubleshooting section
    - Document external tool installation
    - _Requirements: 11.1, 11.7, 11.8, 19.9_
  
  - [x] 20.2 Create example templates
    - Create example templates for icons, brushes, patterns, cursors, overlays
    - Include template inheritance examples
    - Include animation examples
    - Include theme variant examples
    - _Requirements: 11.2_
  
  - [x] 20.3 Write template schema reference
    - Document all template fields and types
    - Document generator-specific parameters
    - Document animation configuration
    - _Requirements: 11.3_
  
  - [x] 20.4 Create tutorial for custom generators
    - Write step-by-step guide for creating custom generators
    - Include example custom generator implementation
    - _Requirements: 11.5_
  
  - [x] 20.5 Generate example output gallery
    - Generate sample assets from example templates
    - Create visual gallery showcasing capabilities
    - _Requirements: 11.6_
  
  - [x] 20.6 Document library-first philosophy
    - Create "Library Arsenal" section listing all integrated tools
    - Document dependency audit and rationale
    - Document migration strategy from lucide-react
    - _Requirements: 19.11, 13.5_

- [x] 21. Create utility functions and shared code
  - [x] 21.1 Create utils.py with shared utilities
    - Implement color conversion functions (RGB, HSV, HSL)
    - Implement blend mode functions (multiply, screen, overlay, add)
    - Implement anti-aliasing utilities
    - Implement file I/O helpers
    - _Requirements: 12.6_
  
  - [ ]* 21.2 Write unit tests for utilities
    - Test color conversions
    - Test blend modes
    - Test anti-aliasing
    - _Requirements: 12.6_

- [x] 22. Implement TypeScript integration layer
  - [x] 22.1 Generate TypeScript type definitions
    - Generate types for custom icon names
    - Generate types for asset metadata
    - Generate types for RPC function signatures
    - _Requirements: 13.8_
  
  - [x] 22.2 Create TypeScript service client
    - Create `uiForgeClient.ts` wrapping RPC calls
    - Add type-safe function signatures
    - Add error handling
    - _Requirements: 6.2, 6.3_

- [x] 23. Final integration and testing
  - [x] 23.1 Wire all components together
    - Integrate all managers into core engine
    - Ensure proper initialization order
    - Add comprehensive logging
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ]* 23.2 Write end-to-end integration tests
    - Test complete generation pipeline (template → preview → library)
    - Test batch generation with all generator types
    - Test theme variant generation
    - Test animation generation
    - Test Tauri bridge integration
    - _Requirements: 4.1, 4.2, 4.7, 5.8, 6.2_
  
  - [ ]* 23.3 Write performance benchmarks
    - Benchmark 1000 icon generation (target < 60s)
    - Benchmark memory usage (target < 2GB)
    - Benchmark parallel processing efficiency
    - _Requirements: 9.6, 9.8_

- [x] 24. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Implementation follows library-first philosophy: use existing Python packages (Pillow, numpy, svgwrite, cairosvg) over custom code
- All visual properties are data-driven from templates with zero hardcoded values
- System supports arbitrary output formats and dimensions without code changes
- Alpha channel generation is a first-class feature with dedicated generator
- Animation system is optional and executes as post-processing step
- External tool integration supports graceful degradation for missing dependencies
