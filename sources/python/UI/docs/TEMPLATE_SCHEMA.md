# UI Forge Template Schema Reference

Complete reference for all template fields, types, and generator-specific parameters.

## Table of Contents

1. [Core Template Fields](#core-template-fields)
2. [Output Configuration](#output-configuration)
3. [Visual Properties](#visual-properties)
4. [Generator-Specific Parameters](#generator-specific-parameters)
5. [Animation Configuration](#animation-configuration)
6. [Alpha Channel Configuration](#alpha-channel-configuration)
7. [Metadata Fields](#metadata-fields)
8. [Template Inheritance](#template-inheritance)

---

## Core Template Fields

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Asset name (used for output filename) | `"Sculpt Tool Icon"` |
| `generator_type` | string | Generator to use: `icon`, `brush`, `pattern`, `cursor`, `overlay` | `"icon"` |
| `dimensions` | object | Width and height in pixels | `{width: 64, height: 64}` |
| `output_formats` | array[string] | Output formats: `png`, `svg`, `jpeg`, `webp`, `tiff`, `bmp`, `ico` | `["png", "svg"]` |
| `ico_sizes` | array[int] | Optional embedded sizes for Windows `.ico` bundles (1-256) | `[16, 32, 48, 256]` |
| `params` | object | Generator-specific parameters | `{layers: [...]}` |

### Optional Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `description` | string | Human-readable description | `""` |
| `category` | string | Asset category for organization | `"uncategorized"` |
| `tags` | array[string] | Searchable tags | `[]` |
| `version` | string | Template version | `"1.0"` |
| `author` | string | Template author | `null` |

---

## Output Configuration

### Dimensions

```yaml
dimensions:
  width: 64      # Width in pixels (required)
  height: 64     # Height in pixels (required)
```

**Constraints**:
- Width and height must be positive integers
- No maximum limit (system will handle memory constraints)
- Recommended: 16-4096 for icons, 64-512 for brushes

### Output Formats

```yaml
output_formats:
  - "png"   # PNG with alpha channel
  - "svg"   # Scalable vector graphics
  - "webp"  # Modern web format with alpha
  - "jpeg"  # No alpha channel
  - "tiff"  # High-quality raster
  - "bmp"   # Bitmap
  - "ico"   # Windows icon bundle
```

```yaml
# Optional: explicit embedded sizes for ICO output
ico_sizes: [16, 24, 32, 48, 64, 128, 256]
```

**Format-Specific Options**:

```yaml
# PNG compression (0-9, higher = smaller file)
png_compression: 6

# JPEG quality (1-100, higher = better quality)
jpeg_quality: 95

# WebP lossless mode
webp_lossless: false

# WebP quality (1-100)
webp_quality: 90
```

### Aspect Ratio

```yaml
aspect_ratio: "fixed"  # Options: "fixed", "free", "16:9", "4:3", "1:1"
```

---

## Visual Properties

### Colors

```yaml
colors:
  - "$primary"      # Color token (resolves to theme color)
  - "#2563eb"       # Hex color
  - "rgb(37,99,235)" # RGB color
  - "hsl(217,91%,60%)" # HSL color
```

**Available Color Tokens**:
- `$primary` - Primary brand color
- `$secondary` - Secondary color
- `$accent` - Accent color
- `$background` - Background color
- `$foreground` - Foreground/text color
- `$success` - Success state color
- `$warning` - Warning state color
- `$error` - Error state color

### Theme Variants

```yaml
theme_variants:
  - "light"
  - "dark"
  - "high-contrast"
```

When specified, generates separate assets for each theme with color tokens resolved to theme-specific values.

---

## Generator-Specific Parameters

### Icon Generator Parameters

```yaml
params:
  padding: 8              # Safe area margin in pixels
  antialias_factor: 2     # Supersampling multiplier (1-4)
  background: null        # Background color or null for transparent
  
  layers:                 # Array of layer objects
    - type: "circle"      # Layer type
      geometry: {...}     # Type-specific geometry
      fill: {...}         # Fill style
      stroke: {...}       # Stroke style
      blend_mode: "normal" # Blend mode
      opacity: 1.0        # Layer opacity (0.0-1.0)
```

#### Layer Types

**Circle**:
```yaml
type: "circle"
geometry:
  cx: 32        # Center X
  cy: 32        # Center Y
  r: 24         # Radius
```

**Rectangle**:
```yaml
type: "rect"
geometry:
  x: 16         # Top-left X
  y: 16         # Top-left Y
  width: 32     # Width
  height: 32    # Height
  rx: 4         # Corner radius X (optional)
  ry: 4         # Corner radius Y (optional)
```

**Polygon**:
```yaml
type: "polygon"
geometry:
  points:       # Array of [x, y] coordinates
    - [32, 8]
    - [56, 56]
    - [8, 56]
```

**Path**:
```yaml
type: "path"
geometry:
  d: "M 10,30 A 20,20 0,0,1 50,30"  # SVG path data
```

#### Fill Styles

**Solid Fill**:
```yaml
fill:
  type: "solid"
  colors: ["#2563eb"]
```

**Linear Gradient**:
```yaml
fill:
  type: "linear_gradient"
  colors: ["#2563eb", "#1e40af"]
  stops: [0.0, 1.0]      # Optional gradient stops
  angle: 45              # Gradient angle in degrees
```

**Radial Gradient**:
```yaml
fill:
  type: "radial_gradient"
  colors: ["#ffffff", "#e0e0e0"]
  stops: [0.0, 1.0]
  center: [0.5, 0.5]     # Center point (0.0-1.0)
  radius: 0.5            # Radius (0.0-1.0)
```

**Angular Gradient**:
```yaml
fill:
  type: "angular_gradient"
  colors: ["#ff0000", "#00ff00", "#0000ff", "#ff0000"]
  stops: [0.0, 0.33, 0.67, 1.0]
  center: [0.5, 0.5]
```

#### Stroke Styles

```yaml
stroke:
  color: "#ffffff"       # Stroke color
  width: 2               # Stroke width in pixels
  cap: "round"           # Line cap: "butt", "round", "square"
  join: "round"          # Line join: "miter", "round", "bevel"
  dash: [5, 3]           # Dash pattern (optional)
```

#### Blend Modes

- `normal` - Standard alpha blending
- `multiply` - Darkens by multiplying colors
- `screen` - Lightens by inverting and multiplying
- `overlay` - Combines multiply and screen
- `add` - Additive blending
- `subtract` - Subtractive blending

### Brush Generator Parameters

```yaml
params:
  shape: "circular"          # "circular", "square", "custom"
  size: 128                  # Brush size in pixels
  hardness: 0.5              # Edge hardness (0.0-1.0)
  spacing: 0.25              # Stamp spacing (0.0-1.0)
  falloff_curve: "smooth"    # "linear", "smooth", "sharp", "custom"
  custom_curve: [...]        # Custom falloff points (if falloff_curve="custom")
  texture: null              # Path to texture image (optional)
  stroke_preview: true       # Render full stroke vs single stamp
```

**Falloff Curves**:
- `linear` - Linear falloff from center to edge
- `smooth` - Smooth S-curve falloff
- `sharp` - Sharp falloff (hard edge)
- `custom` - Custom curve defined by points

**Custom Curve Example**:
```yaml
falloff_curve: "custom"
custom_curve:
  - [0.0, 1.0]    # Center: full opacity
  - [0.5, 0.8]    # Midpoint: 80% opacity
  - [1.0, 0.0]    # Edge: transparent
```

### Pattern Generator Parameters

```yaml
params:
  pattern_type: "noise"      # "noise", "grid", "checkerboard", "custom"
  tileable: true             # Ensure seamless tiling
  
  # Noise-specific
  noise_type: "perlin"       # "perlin", "simplex", "voronoi", "cellular"
  scale: 0.05                # Noise scale
  octaves: 4                 # Noise octaves (detail levels)
  persistence: 0.5           # Amplitude decay per octave
  lacunarity: 2.0            # Frequency increase per octave
  
  # Grid-specific
  grid_size: 32              # Grid cell size
  line_width: 2              # Grid line width
  line_color: "#64748b"      # Grid line color
  
  # Checkerboard-specific
  cell_size: 16              # Checkerboard cell size
  colors: ["#fff", "#ccc"]   # Alternating colors
```

### Cursor Generator Parameters

```yaml
params:
  cursor_type: "crosshair"   # "crosshair", "hand", "arrow", "custom"
  hotspot_x: 16              # Hotspot X coordinate
  hotspot_y: 16              # Hotspot Y coordinate
  
  # Crosshair-specific
  line_width: 2              # Crosshair line width
  line_color: "#ffffff"      # Line color
  outline_color: "#000000"   # Outline for visibility
  outline_width: 1           # Outline width
  center_dot: true           # Show center dot
  dot_size: 2                # Center dot size
```

### Overlay Generator Parameters

```yaml
params:
  overlay_type: "grid"       # "grid", "vignette", "custom"
  
  # Grid overlay
  grid_size: 100             # Grid spacing
  line_width: 1              # Line width
  line_color: "#ffffff"      # Line color
  line_opacity: 0.3          # Line opacity
  major_grid_interval: 5     # Major grid line interval
  major_line_width: 2        # Major line width
  major_line_opacity: 0.5    # Major line opacity
  
  # Vignette overlay
  intensity: 0.5             # Vignette intensity (0.0-1.0)
  radius: 0.8                # Vignette radius (0.0-1.0)
  softness: 0.3              # Edge softness (0.0-1.0)
  color: "#000000"           # Vignette color
```

---

## Animation Configuration

```yaml
animation:
  enabled: true              # Enable animation
  motion_types:              # Array of motion types to combine
    - "orbit"
  duration: 2.0              # Animation duration in seconds
  fps: 30                    # Frames per second
  loop: true                 # Loop animation
  easing: "linear"           # Easing function
  output_type: "svg_smil"    # "svg_smil", "sprite_sheet", "both"
  
  # Sprite sheet configuration (if output_type includes sprite_sheet)
  sprite_sheet_layout: "horizontal"  # "horizontal", "vertical", "grid"
  
  # Motion-specific parameters
  motion_params:
    orbit:
      radius: 0              # Orbit radius (0 = rotate in place)
      speed: 1.0             # Speed multiplier
      axis: "z"              # Rotation axis: "x", "y", "z"
```

### Available Motion Types

**Classics**:
- `orbit` - Circular rotation
- `float` - Gentle up/down motion
- `pulse` - Scale pulsing
- `shake` - Random jitter
- `elastic` - Elastic bounce

**Intermediate**:
- `pendulum` - Swinging motion
- `wobble` - Rotation wobble
- `figure8` - Figure-8 path
- `heartbeat` - Heartbeat pulse
- `glitch` - Glitch effect

**Physics**:
- `bounce` - Bouncing motion
- `tumble` - 3D tumbling
- `strobe` - Strobe effect
- `corkscrew` - Spiral motion
- `shiver` - Subtle vibration
- `sway` - Gentle swaying

**Complex**:
- `lissajous` - Lissajous curve
- `flip` - Flipping motion
- `tremor` - Trembling effect
- `scan` - Scanning motion
- `warp` - Warping effect
- `drift` - Drifting motion

### Easing Functions

- `linear` - Constant speed
- `ease-in` - Slow start, fast end
- `ease-out` - Fast start, slow end
- `ease-in-out` - Slow start and end

---

## Alpha Channel Configuration

```yaml
alpha_mode: "embedded"       # "embedded", "separate", "both", "none"

# Alpha generation parameters (optional)
alpha_params:
  type: "gradient"           # "gradient", "shape", "procedural", "luminance", "edge"
  
  # Gradient alpha
  gradient_type: "radial"    # "linear", "radial", "angular"
  gradient_angle: 0          # Angle for linear gradient
  gradient_center: [0.5, 0.5] # Center for radial/angular
  
  # Shape alpha
  shape: "circle"            # "circle", "rect", "polygon"
  feather: 10                # Feathering radius in pixels
  
  # Procedural alpha
  noise_type: "perlin"       # "perlin", "simplex", "voronoi"
  noise_scale: 0.1           # Noise scale
  noise_octaves: 3           # Noise octaves
  
  # Operations
  invert: false              # Invert alpha channel
  blend_mode: "multiply"     # Blend mode for compositing
```

---

## Metadata Fields

```yaml
# Template metadata
version: "1.0"               # Template version
author: "UI Forge"           # Template author
created: "2024-01-15"        # Creation date
modified: "2024-01-20"       # Last modified date

# Asset metadata (auto-generated, but can be specified)
category: "toolbar"          # Asset category
tags:                        # Searchable tags
  - "sculpt"
  - "tool"
  - "3d"

# Usage metadata
usage_notes: "Use for sculpting tools in toolbar"
license: "MIT"               # Asset license
```

---

## Template Inheritance

Templates can inherit from parent templates to share common configuration:

```yaml
# Parent template (base_icon.yaml)
name: "Base Icon Template"
generator_type: "icon"
dimensions:
  width: 64
  height: 64
output_formats: ["png", "svg"]
params:
  padding: 8
  antialias_factor: 2

---

# Child template
parent_template: "base_icon.yaml"  # Relative or absolute path
name: "My Custom Icon"             # Override name
colors: ["$primary"]               # Add colors
params:
  layers: [...]                    # Add custom layers
  # Inherits padding and antialias_factor from parent
```

**Inheritance Rules**:
1. Child template inherits all fields from parent
2. Child can override any field
3. Objects are merged (child fields override parent fields)
4. Arrays are replaced (not merged)
5. Multiple levels of inheritance supported

**Path Resolution**:
- Relative paths: `"../base/base_icon.yaml"`
- Absolute paths: `"M:/K_OS/sources/python/UI/templates/base_icon.yaml"`
- Same directory: `"base_icon.yaml"`

---

## Validation

Templates are validated against JSON Schema before generation:

**Common Validation Errors**:
- Missing required fields (`name`, `generator_type`, `dimensions`, `output_formats`, `params`)
- Invalid generator_type (must be: `icon`, `brush`, `pattern`, `cursor`, `overlay`)
- Invalid dimensions (must be positive integers)
- Invalid output_format (must be supported format)
- Invalid color token (token not defined in themes)
- Invalid parent_template path (file not found)

**Validation Example**:
```python
from UI.template_manager import TemplateManager

tm = TemplateManager()
validation = tm.validate_template(template)

if not validation.passed:
    for error in validation.errors:
        print(f"Error: {error}")
```

---

## Complete Example

```yaml
# Complete template with all features
name: "Advanced Icon Example"
description: "Demonstrates all template features"
generator_type: "icon"
category: "examples"
tags: ["advanced", "demo", "complete"]

# Inheritance
parent_template: "base_icon.yaml"

# Output configuration
output_formats: ["png", "svg", "webp"]
dimensions:
  width: 128
  height: 128
aspect_ratio: "fixed"
png_compression: 6
webp_quality: 90

# Visual properties
colors: ["$primary", "$accent"]
theme_variants: ["light", "dark"]

# Alpha configuration
alpha_mode: "embedded"
alpha_params:
  type: "gradient"
  gradient_type: "radial"
  gradient_center: [0.5, 0.5]

# Generator parameters
params:
  padding: 16
  antialias_factor: 2
  background: null
  layers:
    - type: "circle"
      geometry: {cx: 64, cy: 64, r: 48}
      fill:
        type: "linear_gradient"
        colors: ["$primary", "$accent"]
        angle: 45
      stroke:
        color: "#ffffff"
        width: 2
        cap: "round"
      blend_mode: "normal"
      opacity: 1.0

# Animation
animation:
  enabled: true
  motion_types: ["orbit", "pulse"]
  duration: 3.0
  fps: 30
  loop: true
  easing: "ease-in-out"
  output_type: "both"
  sprite_sheet_layout: "horizontal"
  motion_params:
    orbit:
      radius: 0
      speed: 1.0
      axis: "z"
    pulse:
      intensity: 0.1
      frequency: 2.0

# Metadata
version: "1.0"
author: "UI Forge"
created: "2024-01-15"
license: "MIT"
usage_notes: "Example template demonstrating all features"
```

---

## See Also

- `../examples/README.md` - Example templates
- `../README.md` - Main documentation
- `CUSTOM_GENERATOR_TUTORIAL.md` - Create custom generators
- `../models.py` - Python data models
