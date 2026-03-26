# Requirements Document: UI Forge

## Introduction

UI Forge is a Python-based UI generation system for the K_OS DCC Suite that creates custom icons, brushes, and UI elements at scale. The system leverages numpy and Pillow to generate thousands of DCC-specific UI assets through data-driven templates and procedural generation, with a preview-approval workflow before integration into the production library.

This system addresses the need for a scalable, maintainable approach to UI asset creation for a professional 3D DCC application, where thousands of custom icons and UI elements are required across multiple tools (sculpting, painting, animation, etc.).

## Glossary

- **UI_Forge**: The complete Python-based UI generation system
- **Generator**: A Python module that creates specific categories of UI assets (icons, brushes, patterns)
- **Template**: A data-driven configuration (JSON/YAML) that defines UI asset parameters
- **Preview_System**: The approval workflow system that stages generated assets before production
- **Asset_Library**: The organized production storage for approved UI assets
- **Tauri_Bridge**: The JSON-RPC interface between Python and the Tauri/React frontend
- **Generator_Category**: A classification of UI generators (icons, brushes, patterns, cursors, overlays)
- **Asset_Metadata**: JSON descriptor containing asset properties, tags, and usage information
- **Batch_Generator**: A system that processes multiple templates in parallel
- **Hot_Reload**: The ability to regenerate and update assets without restarting the application
- **Animation_System**: The optional post-processing system that adds procedural animations to static icons
- **Motion_Type**: A predefined animation pattern (orbit, float, pulse, shake, elastic, wobble, bounce, etc.)
- **Sprite_Sheet**: A PNG image containing multiple animation frames arranged in a grid with metadata
- **Alpha_Mask**: A grayscale image representing transparency information for compositing operations
- **Output_Format**: The file format specification for generated assets (PNG, SVG, JPEG, WebP, etc.)
- **External_Tool**: A third-party executable or library integrated into the generation pipeline

## Requirements

### Requirement 1: Python Repository Structure

**User Story:** As a developer, I want a properly organized Python repository for UI generation, so that the codebase is maintainable and scalable.

#### Acceptance Criteria

1. THE UI_Forge SHALL be located at `M:\K_OS\src-python\UI` as a proper Python package
2. THE UI_Forge SHALL contain a `generators/` directory for generator modules
3. THE UI_Forge SHALL contain a `templates/` directory for data-driven asset definitions
4. THE UI_Forge SHALL contain a `preview/` directory for staging generated assets before approval
5. THE UI_Forge SHALL contain a `library/` directory for approved production assets
6. THE UI_Forge SHALL contain a `utils/` directory for shared utility functions
7. THE UI_Forge SHALL include a `__init__.py` making it importable as a Python module
8. THE UI_Forge SHALL include a `requirements.txt` for isolated dependency management
9. WHERE a virtual environment is needed, THE UI_Forge SHALL support venv isolation

### Requirement 2: Generator Categories

**User Story:** As a DCC artist, I want different types of UI generators, so that I can create all necessary UI assets for the suite.

#### Acceptance Criteria

1. THE UI_Forge SHALL support an "icons" generator category for toolbar and menu icons
2. THE UI_Forge SHALL support a "brushes" generator category for sculpting and painting brush previews
3. THE UI_Forge SHALL support a "patterns" generator category for fill patterns and textures
4. THE UI_Forge SHALL support a "cursors" generator category for custom cursor graphics
5. THE UI_Forge SHALL support an "overlays" generator category for viewport overlays and HUD elements
6. WHEN a new generator category is added, THE UI_Forge SHALL auto-discover it from the `generators/` directory
1. THE Generator SHALL output SVG files with optimized paths and proper viewBox attributes
2. THE Generator SHALL output PNG files with alpha transparency
3. THE Generator SHALL support arbitrary output resolutions specified in templates
4. THE Generator SHALL NOT contain hardcoded resolution values
5. THE Generator_Category SHALL support subfolder organization within categories (e.g., `icons/toolbar/`, `icons/menu/`, `brushes/sculpt/`)

### Requirement 3: Data-Driven Template System

**User Story:** As a developer, I want to define UI assets through data files, so that I can generate thousands of variations without writing code.

#### Acceptance Criteria

1. THE UI_Forge SHALL accept JSON template files defining asset parameters
2. THE UI_Forge SHALL accept YAML template files defining asset parameters
3. WHEN a template is processed, THE UI_Forge SHALL validate required fields before generation
4. THE Template SHALL specify generator type, output resolution, color palette, and geometric parameters
5. THE Template SHALL support parameterization for batch generation (e.g., color variations, size variations)
6. THE Template SHALL include metadata fields (name, description, tags, category)
7. WHERE animation is desired, THE Template SHALL specify animation type and parameters
8. IF a template is invalid, THEN THE UI_Forge SHALL return a descriptive validation error
9. THE UI_Forge SHALL support template inheritance for shared base configurations

### Requirement 4: Preview and Approval Workflow

**User Story:** As a designer, I want to preview generated assets before they go into production, so that I can ensure quality and consistency.

#### Acceptance Criteria

1. WHEN assets are generated, THE UI_Forge SHALL output them to the `preview/` directory
2. THE Preview_System SHALL organize previews by generation timestamp and template name
3. THE Preview_System SHALL generate an HTML preview gallery for visual inspection
4. THE Preview_System SHALL include asset metadata in the preview gallery
5. WHEN an asset is approved, THE UI_Forge SHALL move it from `preview/` to `library/` with proper organization
6. THE UI_Forge SHALL preserve original template references in approved asset metadata
7. THE Preview_System SHALL support batch approval of multiple assets
8. THE Preview_System SHALL support rejection with optional feedback notes

### Requirement 5: Asset Library Organization

**User Story:** As a developer, I want generated assets organized systematically, so that they are easy to locate and integrate into the application.

#### Acceptance Criteria

1. THE Asset_Library SHALL organize assets by category (icons, brushes, patterns, cursors, overlays)
2. THE Asset_Library SHALL organize assets by resolution within each category
3. THE Asset_Library SHALL organize assets by theme or style variant
4. WHEN an asset is added to the library, THE UI_Forge SHALL generate a JSON metadata file alongside it
5. THE Asset_Metadata SHALL include: name, description, tags, generator used, template source, generation timestamp, resolution, color mode
6. THE Asset_Library SHALL support semantic naming conventions (e.g., `sculpt-brush-clay-64.png`)
7. THE UI_Forge SHALL generate a library index JSON file listing all available assets
8. WHEN the library is updated, THE UI_Forge SHALL regenerate the index automatically

### Requirement 6: Tauri Integration

**User Story:** As a frontend developer, I want to call UI generation functions from TypeScript, so that I can integrate asset generation into the K_OS application.

#### Acceptance Criteria

1. THE UI_Forge SHALL register all generator functions with the Tauri_Bridge using the `@register` decorator
2. WHEN called via JSON-RPC, THE UI_Forge SHALL accept template data as parameters
3. WHEN generation completes, THE UI_Forge SHALL return file paths and metadata to the caller
4. THE UI_Forge SHALL support asynchronous generation for large batches
5. THE UI_Forge SHALL report generation progress for long-running operations
6. IF generation fails, THEN THE UI_Forge SHALL return structured error information with traceback
7. THE UI_Forge SHALL support hot-reload of generator modules without restarting the Python sidecar
8. THE Tauri_Bridge SHALL expose functions: `generate_asset`, `batch_generate`, `list_templates`, `approve_preview`, `get_library_index`

### Requirement 7: Icon Generator Specifics

**User Story:** As a UI designer, I want to generate DCC-specific icons, so that the application has a consistent visual language.

#### Acceptance Criteria

1. THE Icon_Generator SHALL support geometric primitives (circles, squares, triangles, polygons)
2. THE Icon_Generator SHALL support path-based vector-like shapes using numpy arrays
3. THE Icon_Generator SHALL support layering with blend modes (normal, multiply, screen, overlay)
4. THE Icon_Generator SHALL support gradients (linear, radial, angular)
5. THE Icon_Generator SHALL support stroke and fill operations
6. THE Icon_Generator SHALL support anti-aliasing for smooth edges
7. THE Icon_Generator SHALL support color palettes from templates
8. WHERE color is specified in templates, THE Icon_Generator SHALL apply the color palette
9. WHERE color is not specified, THE Icon_Generator SHALL generate monochrome icons
10. THE Icon_Generator SHALL support icon families (related icons with consistent style)
11. THE Icon_Generator SHALL output icons with transparent backgrounds
12. THE Icon_Generator SHALL support padding and safe area margins
13. THE Icon_Generator SHALL output SVG files with optimized paths and minimal file size
14. THE Icon_Generator SHALL ensure SVG output is pixel-perfect at target resolutions
15. THE Icon_Generator SHALL validate SVG output for proper alignment and no rendering glitches
16. THE Icon_Generator SHALL NOT contain hardcoded dimensions, formats, or style parameters
17. THE Icon_Generator SHALL derive all visual properties from template data

### Requirement 8: Brush Preview Generator Specifics

**User Story:** As a digital sculptor, I want brush preview thumbnails generated from brush parameters, so that I can visually identify brushes in the UI.

#### Acceptance Criteria

1. THE Brush_Generator SHALL accept brush parameters (size, hardness, spacing, texture)
2. THE Brush_Generator SHALL render a representative brush stroke preview
3. THE Brush_Generator SHALL support circular, square, and custom brush shapes
4. THE Brush_Generator SHALL support texture overlays for textured brushes
5. THE Brush_Generator SHALL support falloff curves (linear, smooth, sharp)
6. THE Brush_Generator SHALL render previews on neutral backgrounds
7. THE Brush_Generator SHALL support batch generation of brush families
8. THE Brush_Generator SHALL generate both thumbnail (64x64) and detail (256x256) previews

### Requirement 9: Performance and Scalability

**User Story:** As a developer, I want the UI generation system to handle thousands of assets efficiently, so that build times remain reasonable.

#### Acceptance Criteria

1. THE Batch_Generator SHALL process templates in parallel using multiprocessing
2. THE Batch_Generator SHALL utilize all available CPU cores for generation
3. WHEN generating large batches, THE UI_Forge SHALL report progress every 10% completion
4. THE UI_Forge SHALL cache intermediate results to avoid redundant computation
5. THE UI_Forge SHALL support incremental generation (only regenerate changed templates)
6. THE UI_Forge SHALL complete generation of 1000 simple icons in under 60 seconds on modern hardware
7. THE UI_Forge SHALL support GPU acceleration via numpy operations where applicable
8. IF memory usage exceeds 2GB during generation, THEN THE UI_Forge SHALL process in smaller batches

### Requirement 10: Quality and Validation

**User Story:** As a quality assurance engineer, I want generated assets to meet quality standards, so that they integrate seamlessly into the application.

#### Acceptance Criteria

1. THE UI_Forge SHALL validate that all generated PNGs have valid alpha channels
2. THE UI_Forge SHALL validate that all generated SVGs have proper viewBox and path definitions
3. THE UI_Forge SHALL validate that SVG output renders correctly without glitches or misalignment
4. THE UI_Forge SHALL validate that output resolutions match template specifications
5. THE UI_Forge SHALL validate that file sizes are reasonable (< 100KB for icons, < 500KB for brushes, < 50KB for SVGs)
6. IF an asset fails validation, THEN THE UI_Forge SHALL log the failure and skip that asset
7. THE UI_Forge SHALL detect and report duplicate assets based on perceptual hashing
8. THE UI_Forge SHALL validate color modes (RGBA for transparency, RGB for opaque)
9. THE UI_Forge SHALL ensure consistent DPI metadata (72 DPI for screen assets)
10. THE UI_Forge SHALL generate a validation report after each batch generation

### Requirement 11: Documentation and Examples

**User Story:** As a new developer, I want clear documentation and examples, so that I can create custom generators and templates.

#### Acceptance Criteria

1. THE UI_Forge SHALL include a README.md with setup instructions and usage examples
2. THE UI_Forge SHALL include example templates for each generator category
3. THE UI_Forge SHALL include a template schema reference document
4. THE UI_Forge SHALL include inline code documentation for all generator functions
5. THE UI_Forge SHALL include a tutorial for creating a custom generator
6. THE UI_Forge SHALL include a gallery of example outputs
7. THE UI_Forge SHALL document the Tauri integration API
8. THE UI_Forge SHALL include troubleshooting guidance for common issues

### Requirement 12: Extensibility

**User Story:** As a developer, I want to add custom generators easily, so that the system can grow with project needs.

#### Acceptance Criteria

1. WHEN a new Python file is added to `generators/`, THE UI_Forge SHALL auto-discover it
2. THE Generator SHALL implement a standard interface (base class or protocol)
3. THE Generator SHALL declare supported template parameters via type hints or schema
4. THE UI_Forge SHALL validate that custom generators implement required methods
5. THE UI_Forge SHALL support generator plugins from external Python packages
6. THE UI_Forge SHALL provide utility functions for common operations (drawing, blending, color conversion)
7. THE UI_Forge SHALL support generator composition (combining multiple generators)
8. THE UI_Forge SHALL log generator registration at startup for debugging

### Requirement 13: Lucide-React Coexistence

**User Story:** As a frontend developer, I want UI Forge to coexist with lucide-react, so that we can gradually migrate to custom icons without breaking existing UI.

#### Acceptance Criteria

1. THE UI_Forge SHALL NOT replace or remove lucide-react dependencies
2. THE UI_Forge SHALL generate assets in a separate namespace from lucide icons
3. THE UI_Forge SHALL support generating lucide-compatible icon sets as a migration path
4. THE Asset_Library SHALL be accessible via a separate import path from lucide-react
5. THE UI_Forge SHALL document the migration strategy from lucide to custom icons
6. THE UI_Forge SHALL support generating icons that match lucide's visual style for consistency
7. THE UI_Forge SHALL provide a comparison tool for visual parity checking
8. THE UI_Forge SHALL generate TypeScript type definitions for custom icon names

### Requirement 14: Color and Theme Support

**User Story:** As a UI designer, I want generated assets to support the K_OS theme system, so that icons adapt to light/dark modes.

#### Acceptance Criteria

1. THE UI_Forge SHALL support color palette templates for theme variants
2. THE UI_Forge SHALL generate assets in multiple theme variants (light, dark, high-contrast)
3. THE Template SHALL specify whether an asset is theme-aware or theme-neutral
4. THE UI_Forge SHALL support color token references (e.g., `$primary`, `$accent`)
5. THE UI_Forge SHALL validate that theme variants maintain visual consistency
6. THE UI_Forge SHALL generate CSS/SCSS variables for theme integration
7. THE Asset_Metadata SHALL include theme variant information
8. THE UI_Forge SHALL support automatic color inversion for dark mode variants

### Requirement 15: Round-Trip Testing for Serialization

**User Story:** As a quality engineer, I want to ensure template serialization is reliable, so that asset generation is reproducible.

#### Acceptance Criteria

1. FOR ALL valid templates, parsing then serializing then parsing SHALL produce an equivalent template object
2. THE UI_Forge SHALL include a round-trip test suite for template serialization
3. THE UI_Forge SHALL validate that JSON and YAML templates produce identical results
4. THE UI_Forge SHALL detect and report serialization inconsistencies
5. THE UI_Forge SHALL preserve all template metadata through round-trip operations
6. THE UI_Forge SHALL validate that generated assets can be reproduced from stored templates
7. THE UI_Forge SHALL include a template validation CLI tool
8. THE UI_Forge SHALL log template parsing errors with line numbers and context

### Requirement 16: Animated Icon Support (Optional Feature)

**User Story:** As a UI designer, I want to generate animated icons for interactive UI elements, so that the application feels responsive and polished.

#### Acceptance Criteria

1. WHERE animation is requested, THE UI_Forge SHALL generate animated icons as an optional post-processing step
2. THE Animation_System SHALL execute AFTER static icon generation completes
3. THE Animation_System SHALL support data-driven animation definitions via templates
4. THE Template SHALL specify animation type, parameters, duration, and easing
5. THE Animation_System SHALL support motion types: orbit, float, pulse, shake, elastic, wobble, bounce, pendulum, heartbeat, strobe
6. THE Animation_System SHALL support parameterized animations (speed, intensity, axis, amplitude, frequency)
7. THE Animation_System SHALL generate animated SVG output with SMIL animations
8. WHERE sprite sheet output is requested, THE Animation_System SHALL generate PNG sprite sheets with frame metadata
9. THE Animation_System SHALL validate that animations maintain visual quality and alignment
10. THE Animation_System SHALL support animation composition (combining multiple motion types)
11. THE Animation_System SHALL include animation preview generation for approval workflow
12. IF animation generation fails, THEN THE UI_Forge SHALL preserve the static icon and log the error

### Requirement 17: Arbitrary Output Formats and Sizes

**User Story:** As a developer, I want to generate assets in any format and size, so that the system adapts to all project needs without code changes.

#### Acceptance Criteria

1. THE Template SHALL specify output format (PNG, SVG, JPEG, WebP, TIFF, BMP, ICO)
2. THE Template SHALL specify arbitrary custom dimensions (width, height) without predefined constraints
3. THE UI_Forge SHALL support format-specific quality parameters (JPEG quality, PNG compression level, WebP lossless mode)
4. THE UI_Forge SHALL validate format compatibility with requested features (e.g., transparency requires PNG/WebP/SVG)
5. WHEN multiple formats are requested, THE UI_Forge SHALL generate all specified formats from a single template
6. THE UI_Forge SHALL support aspect ratio constraints (fixed, free, locked to ratio)
7. THE UI_Forge SHALL support resolution-independent generation (vector-first approach)
8. THE Generator SHALL NOT contain hardcoded size or format values
9. THE UI_Forge SHALL support batch generation with format/size variations from a single base template
10. IF an unsupported format is requested, THEN THE UI_Forge SHALL return a descriptive error listing supported formats
11. THE Asset_Metadata SHALL include output format and dimensions information
12. THE UI_Forge SHALL support format conversion pipelines (e.g., SVG → PNG → WebP)

### Requirement 18: Alpha Channel and Mask Generation

**User Story:** As a compositor, I want to generate alpha masks and alpha channel assets, so that I can create sophisticated UI compositing effects.

#### Acceptance Criteria

1. THE UI_Forge SHALL support dedicated alpha mask generation as a first-class feature
2. THE Template SHALL specify alpha generation mode (embedded, separate, both)
3. WHEN separate alpha is requested, THE UI_Forge SHALL generate a grayscale alpha mask file alongside the color asset
4. THE Alpha_Generator SHALL support gradient alpha (linear, radial, angular falloffs)
5. THE Alpha_Generator SHALL support shape-based alpha (geometric primitives with feathering)
6. THE Alpha_Generator SHALL support procedural alpha patterns (noise, perlin, voronoi)
7. THE Alpha_Generator SHALL integrate existing alpha generator code from the user's codebase
8. THE UI_Forge SHALL validate that embedded alpha channels are properly encoded
9. THE UI_Forge SHALL support alpha channel operations (invert, multiply, screen, overlay)
10. THE Alpha_Generator SHALL support alpha from luminance conversion
11. THE Alpha_Generator SHALL support alpha from edge detection
12. THE Asset_Metadata SHALL indicate alpha channel presence and type
13. THE UI_Forge SHALL validate alpha mask dimensions match color asset dimensions
14. THE Preview_System SHALL display alpha channels with checkerboard backgrounds for visual inspection

### Requirement 19: Library-First External Integration

**User Story:** As a developer, I want to leverage all available external tools and libraries, so that I avoid reinventing solved problems and maximize functionality.

#### Acceptance Criteria

1. THE UI_Forge SHALL prioritize using existing Python packages over custom implementations
2. THE UI_Forge SHALL document all external dependencies in `requirements.txt` with version constraints
3. THE UI_Forge SHALL support integration of external executables (ImageMagick, Inkscape CLI, GIMP batch mode)
4. WHERE an external tool provides superior functionality, THE UI_Forge SHALL use it via subprocess or API
5. THE UI_Forge SHALL support cloning and integrating external repositories as submodules or dependencies
6. THE UI_Forge SHALL include a dependency audit document listing all external tools and their purposes
7. THE UI_Forge SHALL validate external tool availability at startup and provide clear error messages if missing
8. THE UI_Forge SHALL support optional dependencies with graceful degradation (e.g., GPU acceleration if available)
9. THE UI_Forge SHALL document installation procedures for all external tools in README.md
10. THE UI_Forge SHALL prefer battle-tested libraries (Pillow, numpy, cairosvg, svgwrite, scikit-image) over custom code
11. THE UI_Forge SHALL include a "Library Arsenal" section in documentation listing all integrated tools
12. WHEN evaluating a new feature, THE UI_Forge SHALL check for existing library solutions before implementing
13. THE UI_Forge SHALL support plugin architecture for external generator modules
14. THE UI_Forge SHALL validate that external tool versions meet minimum requirements
15. IF an external tool fails, THEN THE UI_Forge SHALL log the failure and attempt fallback implementations where possible
