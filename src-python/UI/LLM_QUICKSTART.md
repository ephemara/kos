# UI Forge - LLM Quick Start Guide

> **Target Audience**: AI Agents and LLMs generating UI assets for K_OS DCC Suite  
> **Purpose**: Fast, actionable guide to generate icons, brushes, and UI elements through templates

---

## 🎯 What You Can Do

Generate production-ready UI assets by writing JSON/YAML templates:
- **Icons**: Toolbar, menu, status icons with geometric primitives
- **Brushes**: Sculpting/painting brush previews with falloff curves
- **Patterns**: Tileable fill patterns and textures
- **Cursors**: Custom cursor graphics with hotspot metadata
- **Overlays**: Viewport HUD elements with transparency
- **Alpha Masks**: Separate alpha channels for compositing

---

## 🚀 Quick Start: Generate Your First Icon

### Fastest Python Path for LLMs

If you're generating lots of icons directly from Python, use the compact helpers in `llm_api.py` instead of hand-writing large nested `Template(...)` payloads:

```python
from llm_api import animate, circle, linear, rect, render_catalog, solid

results = render_catalog(
    [
        {
            "name": "tool-select",
            "layers": [
                rect(8, 8, 48, 48, rx=10, fill=linear("#60a5fa", "#2563eb", angle=90)),
                rect(20, 20, 24, 24, rx=6, fill=solid("#ffffff")),
            ],
            "category": "toolbar",
            "tags": ["tool", "select"],
            "formats": ["png", "svg"],
            "padding": 4,
        },
        {
            "name": "status-live",
            "layers": [circle(32, 32, 20, fill=solid("#22c55e"))],
            "category": "status",
            "animation": animate("pulse", duration=1.2, fps=16, output="apng"),
            "formats": ["png", "apng"],
        },
    ],
    size=64,
    parallel=True,
)
```

This keeps the LLM-facing format small:
- `icon(...)` builds a valid `Template`
- `circle(...)`, `rect(...)`, `polygon(...)`, `path(...)` build layers
- `solid(...)`, `linear(...)`, `radial(...)`, `stroke(...)` build paint descriptors
- `animate(...)` builds `AnimationConfig` with `svg_smil`, `sprite_sheet`, `apng`, or `all`
- `catalog(...)` / `render_catalog(...)` let an LLM emit large manifest-style batches with shared defaults
- `batch(...)` sends many generated templates through the real engine

Use YAML templates when you want assets on disk and inheritance. Use `llm_api.py` when you want an LLM to emit a lot of UI from one short Python file or one large manifest.

### Step 1: Create a Template File

Create `templates/icons/my_icon.yaml`:

```yaml
name: "My First Icon"
description: "A simple circular icon"
generator_type: "icon"
category: "toolbar"
tags: ["tool", "custom"]

# Output configuration
output_formats: ["png", "svg"]
dimensions:
  width: 64
  height: 64

# Visual properties
colors: ["#3b82f6", "#1e40af"]

# Icon-specific parameters
params:
  padding: 8
  antialias_factor: 2
  layers:
    - type: "circle"
      geometry:
        cx: 32
        cy: 32
        r: 24
      fill:
        type: "solid"
        colors: ["#3b82f6"]
      opacity: 1.0
```

### Step 2: Generate the Asset

```python
from core import UIForgeEngine

engine = UIForgeEngine()
result = engine.generate_asset("templates/icons/my_icon.yaml")

# Output: preview/[timestamp]/my_icon.png
# Output: preview/[timestamp]/my_icon.svg
```

### Step 3: Preview and Approve

```python
from preview_manager import PreviewManager

pm = PreviewManager()
pm.generate_gallery("preview/[timestamp]")
# Opens HTML gallery in browser

# Approve the asset
pm.approve_assets(["my_icon"])
# Moves to library/icons/toolbar/my_icon.png
```

---

## 📋 Template Structure Reference

### Universal Template Fields

```yaml
# Required fields
name: "Asset Name"
description: "What this asset does"
generator_type: "icon" | "brush" | "pattern" | "cursor" | "overlay"
category: "toolbar" | "menu" | "sculpt" | etc.
tags: ["tag1", "tag2"]

# Output configuration
output_formats: ["png", "svg", "webp"]  # Any combination
dimensions:
  width: 64
  height: 64
aspect_ratio: "fixed" | "free" | "16:9"  # Optional

# Visual properties
colors: ["#hex", "#hex"]  # Or color tokens: ["$primary", "$accent"]
theme_variants: ["light", "dark"]  # Optional multi-theme generation

# Alpha channel configuration
alpha_mode: "embedded" | "separate" | "both" | "none"
alpha_params:  # Optional, see Alpha Generation section
  type: "gradient"
  gradient_type: "radial"

# Optional animation
animation:
  enabled: true
  motion_types: ["pulse", "float"]
  duration: 2.0
  fps: 30
  output_type: "svg_smil" | "sprite_sheet"

# Generator-specific parameters
params:
  # See generator-specific sections below
```

---

## 🎨 Icon Generation

### Geometric Primitives

**Circle:**
```yaml
params:
  layers:
    - type: "circle"
      geometry:
        cx: 32  # Center X
        cy: 32  # Center Y
        r: 20   # Radius
      fill:
        type: "solid"
        colors: ["#3b82f6"]
```

**Rectangle:**
```yaml
params:
  layers:
    - type: "rect"
      geometry:
        x: 10
        y: 10
        width: 44
        height: 44
        rx: 4  # Corner radius (optional)
      fill:
        type: "solid"
        colors: ["#ef4444"]
```

**Polygon:**
```yaml
params:
  layers:
    - type: "polygon"
      geometry:
        points: [[32, 10], [50, 40], [14, 40]]  # Triangle
      fill:
        type: "solid"
        colors: ["#10b981"]
```

**Path (Advanced):**
```yaml
params:
  layers:
    - type: "path"
      geometry:
        d: "M 10 10 L 50 50 L 10 50 Z"  # SVG path syntax
      fill:
        type: "solid"
        colors: ["#8b5cf6"]
```

### Gradient Fills

**Linear Gradient:**
```yaml
fill:
  type: "linear_gradient"
  colors: ["#3b82f6", "#1e40af"]
  stops: [0.0, 1.0]  # Optional, defaults to even distribution
  angle: 45  # Degrees
```

**Radial Gradient:**
```yaml
fill:
  type: "radial_gradient"
  colors: ["#ffffff", "#3b82f6", "#1e40af"]
  stops: [0.0, 0.5, 1.0]
```

**Angular Gradient:**
```yaml
fill:
  type: "angular_gradient"
  colors: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6"]
  angle: 0  # Start angle
```

### Stroke Operations

```yaml
params:
  layers:
    - type: "circle"
      geometry: {cx: 32, cy: 32, r: 20}
      fill: null  # No fill, stroke only
      stroke:
        color: "#3b82f6"
        width: 3
        cap: "round"  # "butt" | "round" | "square"
        join: "round"  # "miter" | "round" | "bevel"
```

### Layer Blending

```yaml
params:
  layers:
    - type: "circle"
      geometry: {cx: 32, cy: 32, r: 24}
      fill: {type: "solid", colors: ["#3b82f6"]}
      blend_mode: "normal"
      opacity: 1.0
    
    - type: "circle"
      geometry: {cx: 40, cy: 40, r: 16}
      fill: {type: "solid", colors: ["#ef4444"]}
      blend_mode: "multiply"  # "normal" | "multiply" | "screen" | "overlay"
      opacity: 0.8
```

### Complete Icon Example

```yaml
name: "Sculpt Tool Icon"
generator_type: "icon"
category: "toolbar"
output_formats: ["png", "svg"]
dimensions: {width: 64, height: 64}
colors: ["#3b82f6", "#1e40af", "#ffffff"]

params:
  padding: 8
  antialias_factor: 2
  layers:
    # Background circle
    - type: "circle"
      geometry: {cx: 32, cy: 32, r: 28}
      fill:
        type: "radial_gradient"
        colors: ["#3b82f6", "#1e40af"]
      opacity: 1.0
    
    # Inner detail
    - type: "circle"
      geometry: {cx: 32, cy: 32, r: 16}
      fill: {type: "solid", colors: ["#ffffff"]}
      opacity: 0.3
      blend_mode: "overlay"
    
    # Border
    - type: "circle"
      geometry: {cx: 32, cy: 32, r: 28}
      fill: null
      stroke:
        color: "#1e40af"
        width: 2
```

---

## 🖌️ Brush Generation

### Basic Brush Template

```yaml
name: "Soft Round Brush"
generator_type: "brush"
category: "sculpt"
output_formats: ["png"]
dimensions: {width: 256, height: 256}

params:
  shape: "circular"  # "circular" | "square" | "custom"
  size: 128
  hardness: 0.5  # 0.0 (soft) to 1.0 (hard)
  spacing: 0.25
  falloff_curve: "smooth"  # "linear" | "smooth" | "sharp" | "custom"
  stroke_preview: true  # Render full stroke vs single stamp
```

### Textured Brush

```yaml
name: "Textured Brush"
generator_type: "brush"
category: "paint"
output_formats: ["png"]
dimensions: {width: 256, height: 256}

params:
  shape: "circular"
  size: 128
  hardness: 0.7
  texture: "path/to/texture.png"  # Overlay texture
  falloff_curve: "smooth"
  stroke_preview: true
```

### Custom Falloff Curve

```yaml
params:
  shape: "circular"
  size: 128
  falloff_curve: "custom"
  custom_curve: [1.0, 0.9, 0.7, 0.4, 0.1, 0.0]  # From center to edge
```

---

## 🔲 Pattern Generation

```yaml
name: "Grid Pattern"
generator_type: "pattern"
category: "fill"
output_formats: ["png"]
dimensions: {width: 128, height: 128}

params:
  pattern_type: "grid"  # "grid" | "dots" | "stripes" | "checkerboard"
  cell_size: 16
  line_width: 2
  colors: ["#3b82f6", "#ffffff"]
```

---

## 🖱️ Cursor Generation

```yaml
name: "Custom Cursor"
generator_type: "cursor"
category: "tool"
output_formats: ["png"]
dimensions: {width: 32, height: 32}

params:
  hotspot: [8, 8]  # Click point coordinates
  shape: "crosshair"  # "arrow" | "crosshair" | "hand" | "custom"
  colors: ["#ffffff", "#000000"]
```

---

## 🎭 Alpha Mask Generation

### Gradient Alpha

```yaml
name: "Radial Fade Alpha"
generator_type: "icon"  # Or any generator
alpha_mode: "separate"  # Generates separate grayscale mask
alpha_params:
  type: "gradient"
  gradient_type: "radial"  # "linear" | "radial" | "angular"
  gradient_center: [0.5, 0.5]  # Normalized coordinates
```

### Shape-Based Alpha

```yaml
alpha_params:
  type: "shape"
  shape: "circle"  # "circle" | "rect" | "polygon"
  feather: 10  # Blur radius for soft edges
```

### Procedural Alpha (Noise)

```yaml
alpha_params:
  type: "procedural"
  noise_type: "perlin"  # "perlin" | "simplex" | "voronoi" | "cellular"
  noise_scale: 0.1
  noise_octaves: 4
  invert: false
```

---

## 🎨 Theme System

### Using Color Tokens

```yaml
colors: ["$primary", "$accent", "$background"]
theme_variants: ["light", "dark", "high-contrast"]
```

**Available Tokens:**
- `$primary`, `$secondary`, `$accent`
- `$background`, `$foreground`
- `$success`, `$warning`, `$error`

### Multi-Variant Generation

Generates 3 versions automatically:
- `my_icon_light.png`
- `my_icon_dark.png`
- `my_icon_high_contrast.png`

---

## 🎬 Animation System

### Available Motion Types

**Classics**: `orbit`, `float`, `pulse`, `shake`, `elastic`  
**Intermediate**: `pendulum`, `wobble`, `figure8`, `heartbeat`, `glitch`  
**Physics**: `bounce`, `tumble`, `strobe`, `corkscrew`, `shiver`, `sway`  
**Complex**: `lissajous`, `flip`, `tremor`, `scan`, `warp`, `drift`

### Animated Icon Example

```yaml
name: "Loading Spinner"
generator_type: "icon"
output_formats: ["svg"]
dimensions: {width: 64, height: 64}

params:
  layers:
    - type: "circle"
      geometry: {cx: 32, cy: 32, r: 24}
      fill: null
      stroke: {color: "#3b82f6", width: 4}

animation:
  enabled: true
  motion_types: ["orbit"]
  duration: 2.0
  fps: 30
  loop: true
  easing: "linear"
  output_type: "svg_smil"
  motion_params:
    orbit:
      radius: 0
      speed: 1.0
```

### Sprite Sheet Output

```yaml
animation:
  enabled: true
  motion_types: ["pulse"]
  duration: 1.0
  fps: 24
  output_type: "sprite_sheet"
  sprite_sheet_layout: "horizontal"  # "horizontal" | "vertical" | "grid"
```

---

## 📦 Template Inheritance

### Base Template

`templates/base_icon.yaml`:
```yaml
name: "Base Icon Template"
generator_type: "icon"
dimensions: {width: 64, height: 64}
output_formats: ["png", "svg"]
params:
  padding: 8
  antialias_factor: 2
```

### Child Template

`templates/icons/my_icon.yaml`:
```yaml
parent_template: "../base_icon.yaml"
name: "My Custom Icon"
category: "toolbar"
colors: ["#3b82f6"]
params:
  layers:
    - type: "circle"
      geometry: {cx: 32, cy: 32, r: 24}
      fill: {type: "solid", colors: ["#3b82f6"]}
```

---

## 🔧 Python API Usage

### Single Asset Generation

```python
from core import UIForgeEngine

# Default mode - NO VALIDATION (perfect for UI/icon generation!)
engine = UIForgeEngine()

# If you really want strict validation (rarely needed)
engine = UIForgeEngine(skip_validation=False)

# From template file
result = engine.generate_asset("templates/icons/my_icon.yaml")

# From template dict
template_data = {
    "name": "Quick Icon",
    "generator_type": "icon",
    "dimensions": {"width": 64, "height": 64},
    "output_formats": ["png"],
    "params": {
        "layers": [{
            "type": "circle",
            "geometry": {"cx": 32, "cy": 32, "r": 24},
            "fill": {"type": "solid", "colors": ["#3b82f6"]}
        }]
    }
}
result = engine.generate_asset(template_data)

print(f"Generated: {result.output_paths}")
```

**💡 NOTE**: Validation is OFF by default - perfect for rapid UI generation and LLM-created templates!

### Batch Generation

```python
# Generate multiple assets in parallel
template_paths = [
    "templates/icons/icon1.yaml",
    "templates/icons/icon2.yaml",
    "templates/icons/icon3.yaml"
]

results = engine.batch_generate(template_paths, parallel=True)

for result in results:
    if result.success:
        print(f"✓ {result.template_name}")
    else:
        print(f"✗ {result.template_name}: {result.error}")
```

### Progress Tracking

```python
import time

batch_id = engine.start_batch(template_paths)

while True:
    progress = engine.get_progress(batch_id)
    print(f"Progress: {progress.percent_complete}%")
    
    if progress.completed + progress.failed >= progress.total:
        break
    
    time.sleep(0.5)
```

---

## 🎯 Common Patterns

### Icon Family (Consistent Style)

```yaml
# Base template for family
name: "Tool Icon Base"
generator_type: "icon"
dimensions: {width: 64, height: 64}
output_formats: ["png", "svg"]
colors: ["$primary", "$accent"]
params:
  padding: 8
  antialias_factor: 2
  layers:
    - type: "circle"
      geometry: {cx: 32, cy: 32, r: 28}
      fill:
        type: "radial_gradient"
        colors: ["$primary", "$accent"]
```

Then create variations:
- `sculpt_tool.yaml` (inherits base, adds sculpt icon)
- `paint_tool.yaml` (inherits base, adds paint icon)
- `model_tool.yaml` (inherits base, adds model icon)

### Multi-Resolution Export

```yaml
# Generate same icon at multiple sizes
name: "Multi-Res Icon"
generator_type: "icon"
output_formats: ["png"]

# Generate at 16, 32, 64, 128, 256
dimensions: {width: 64, height: 64}  # Base size

params:
  # Use relative coordinates (0-1) for resolution independence
  layers:
    - type: "circle"
      geometry:
        cx: 0.5  # 50% of width
        cy: 0.5  # 50% of height
        r: 0.4   # 40% of min(width, height)
      fill: {type: "solid", colors: ["#3b82f6"]}
```

### Transparent Overlay

```yaml
name: "HUD Overlay"
generator_type: "overlay"
output_formats: ["png"]
dimensions: {width: 1920, height: 1080}

params:
  background: null  # Transparent
  layers:
    - type: "rect"
      geometry: {x: 10, y: 10, width: 200, height: 100}
      fill: {type: "solid", colors: ["#000000"]}
      opacity: 0.5
```

---

## ⚡ Performance Tips

1. **Use SVG for scalability**: Generate once, scale infinitely
2. **Batch generation**: Process multiple assets in parallel
3. **Template inheritance**: Reuse common configurations
4. **Cache results**: UI Forge caches intermediate results automatically
5. **Incremental regeneration**: Only regenerate changed templates

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: "Template validation failed"
```python
# Check validation errors
from template_manager import TemplateManager

tm = TemplateManager()
result = tm.validate_template("templates/my_icon.yaml")
print(result.errors)
```

**Issue**: "Generator not found"
```python
# List available generators
from generator_manager import GeneratorManager

gm = GeneratorManager()
generators = gm.list_generators()
print([g.name for g in generators])
```

**Issue**: "Output file too large"
```python
# Reduce file size
# 1. Lower PNG compression
# 2. Simplify geometry
# 3. Reduce dimensions
# 4. Use SVG instead
```

---

## 📚 Next Steps

1. **Explore Examples**: Check `examples/` directory for complete templates
2. **Read Full Docs**: See `docs/TEMPLATE_SCHEMA.md` for complete reference
3. **Custom Generators**: See `docs/CUSTOM_GENERATOR_TUTORIAL.md`
4. **External Tools**: See `docs/EXTERNAL_TOOLS_GUIDE.md` for ImageMagick/Inkscape integration

---

## 🎉 Quick Win: Generate 100 Icons in 30 Seconds

```python
from core import UIForgeEngine
import json

engine = UIForgeEngine()

# Generate icon variations programmatically
templates = []
colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"]

for i, color in enumerate(colors):
    for size in [16, 32, 64]:
        template = {
            "name": f"icon_{i}_{size}",
            "generator_type": "icon",
            "dimensions": {"width": size, "height": size},
            "output_formats": ["png"],
            "params": {
                "layers": [{
                    "type": "circle",
                    "geometry": {"cx": size/2, "cy": size/2, "r": size/2 - 4},
                    "fill": {"type": "solid", "colors": [color]}
                }]
            }
        }
        templates.append(template)

# Generate all in parallel
results = engine.batch_generate(templates, parallel=True)
print(f"Generated {len([r for r in results if r.success])} icons!")
```

---

**You're ready to generate! Start with the simple circle example and build from there.** 🚀
