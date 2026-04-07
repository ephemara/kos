# UI Forge Example Templates

This directory contains comprehensive example templates demonstrating all features of the UI Forge system.

## Directory Structure

```
examples/
├── icons/          # Icon generation examples
├── brushes/        # Brush preview examples
├── patterns/       # Pattern generation examples
├── cursors/        # Cursor generation examples
└── overlays/       # Overlay generation examples
```

## Icon Examples

### `toolbar_icon_set.yaml`
**Demonstrates**: Template inheritance, color tokens, theme variants
- Inherits from base template
- Uses color tokens ($primary, $foreground)
- Generates light and dark theme variants

### `gradient_circle.yaml`
**Demonstrates**: Linear gradient fills, simple geometry
- Single circular layer
- Linear gradient at 45° angle
- Theme-aware colors

### `animated_spinner.yaml`
**Demonstrates**: Animation system, orbit motion, SMIL output
- Rotating loading spinner
- 2-second loop animation
- SVG SMIL output format

### `layered_icon.yaml`
**Demonstrates**: Multiple layers, blend modes, complex composition
- Three overlapping shapes
- Different blend modes (normal, multiply)
- Stroke and fill combinations

## Brush Examples

### `soft_round.yaml`
**Demonstrates**: Standard soft brush with smooth falloff
- Circular shape
- 30% hardness for soft edges
- Smooth falloff curve
- Stroke preview enabled

### `hard_square.yaml`
**Demonstrates**: Hard-edged square brush
- Square shape
- 90% hardness for crisp edges
- Sharp falloff curve
- Precise painting tool

### `textured_brush.yaml`
**Demonstrates**: Brush with texture overlay
- Circular base shape
- Texture overlay support (requires texture file)
- Medium hardness
- Artistic brush style

## Pattern Examples

### `noise_pattern.yaml`
**Demonstrates**: Procedural Perlin noise generation
- Perlin noise algorithm
- 4 octaves for detail
- Tileable output
- Configurable scale and persistence

### `grid_pattern.yaml`
**Demonstrates**: Simple geometric grid
- 32px grid spacing
- Customizable line width and color
- Tileable for seamless repetition
- Useful for guides and overlays

### `checkerboard.yaml`
**Demonstrates**: Classic tileable pattern
- 16px cell size
- Two-color alternating pattern
- Perfect tiling
- Background and transparency testing

## Cursor Examples

### `crosshair.yaml`
**Demonstrates**: Precision cursor with hotspot
- Crosshair design for accuracy
- Center dot for exact positioning
- Hotspot at center (16, 16)
- Outline for visibility on any background

### `hand_cursor.yaml`
**Demonstrates**: Custom cursor shape
- Hand icon for pan/grab operations
- Custom hotspot position
- Outline for contrast
- Standard 32x32 cursor size

## Overlay Examples

### `grid_overlay.yaml`
**Demonstrates**: Viewport grid overlay with transparency
- Full HD resolution (1920x1080)
- Semi-transparent grid lines
- Major/minor grid distinction
- Alpha channel for compositing

### `vignette.yaml`
**Demonstrates**: Radial gradient overlay effect
- Subtle darkening at edges
- Configurable intensity and radius
- Soft falloff
- Focus enhancement

## Usage

### Generate Single Example

```python
from UI.core import UIForgeEngine
from UI.template_manager import TemplateManager

engine = UIForgeEngine()
tm = TemplateManager()

# Load and generate
template = tm.load_template("examples/icons/gradient_circle.yaml")
result = engine.generate_asset(template)

print(f"Generated: {result.output_paths}")
```

### Generate All Examples

```python
# Generate all icon examples
icon_templates = tm.list_templates(category="examples")
results = engine.batch_generate(icon_templates, parallel=True)

print(f"Generated {len([r for r in results if r.success])} examples")
```

### Test Animation Examples

```python
# Generate animated spinner
template = tm.load_template("examples/icons/animated_spinner.yaml")
result = engine.generate_asset(template)

# Output will be SVG with SMIL animation
print(f"Animated SVG: {result.output_paths['svg']}")
```

### Test Theme Variants

```python
# Generate with theme variants
template = tm.load_template("examples/icons/toolbar_icon_set.yaml")
result = engine.generate_asset(template)

# Outputs both light and dark variants
# - toolbar_icon_set_light.png
# - toolbar_icon_set_dark.png
```

## Template Inheritance Example

The `toolbar_icon_set.yaml` demonstrates template inheritance:

```yaml
# Child template
parent_template: "../../templates/icons/base_icon.yaml"

# Inherits from base:
# - output_formats: ["png", "svg"]
# - dimensions: {width: 64, height: 64}
# - params.padding: 8
# - params.antialias_factor: 2

# Overrides:
theme_variants: ["light", "dark"]
params:
  layers: [...]  # Custom layers
```

## Animation Examples

The `animated_spinner.yaml` shows animation configuration:

```yaml
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
      axis: "z"
```

Available motion types:
- **Classics**: orbit, float, pulse, shake, elastic
- **Intermediate**: pendulum, wobble, figure8, heartbeat, glitch
- **Physics**: bounce, tumble, strobe, corkscrew, shiver, sway
- **Complex**: lissajous, flip, tremor, scan, warp, drift

## Color Token Usage

Examples use color tokens that resolve to theme-specific values:

```yaml
colors:
  - "$primary"    # Resolves to #2563eb (light) or #3b82f6 (dark)
  - "$accent"     # Resolves to #f59e0b (light) or #fbbf24 (dark)
  - "$foreground" # Resolves to #0f172a (light) or #f1f5f9 (dark)
```

See `themes.py` for all available color tokens.

## Blend Modes

The `layered_icon.yaml` demonstrates blend modes:

- `normal`: Standard alpha blending
- `multiply`: Darkens by multiplying colors
- `screen`: Lightens by inverting and multiplying
- `overlay`: Combines multiply and screen
- `add`: Additive blending

## Output Formats

Examples demonstrate various output formats:

- **PNG**: Raster with alpha channel, multiple resolutions
- **SVG**: Vector graphics, resolution-independent
- **JPEG**: Raster without alpha (not shown, use for photos)
- **WebP**: Modern format with alpha support

## Validation

All examples include validation checks:

```python
result = engine.generate_asset(template)

if result.validation.passed:
    print("✓ All validation checks passed")
else:
    print("✗ Validation failed:")
    for error in result.validation.errors:
        print(f"  - {error}")
```

## Customization

Copy any example and modify to create your own assets:

```bash
# Copy example
cp examples/icons/gradient_circle.yaml templates/icons/my_icon.yaml

# Edit parameters
# Change colors, dimensions, layers, etc.

# Generate
python -c "from UI.core import UIForgeEngine; from UI.template_manager import TemplateManager; engine = UIForgeEngine(); tm = TemplateManager(); result = engine.generate_asset(tm.load_template('templates/icons/my_icon.yaml')); print(result.output_paths)"
```

## Next Steps

1. **Explore templates**: Review each example to understand features
2. **Generate examples**: Run batch generation to see outputs
3. **Modify templates**: Experiment with parameters
4. **Create custom**: Use examples as starting point for your assets
5. **Read docs**: See `docs/TEMPLATE_SCHEMA.md` for complete reference

## See Also

- `../docs/TEMPLATE_SCHEMA.md` - Complete template field reference
- `../docs/CUSTOM_GENERATOR_TUTORIAL.md` - Create custom generators
- `../README.md` - Main UI Forge documentation
- `../EXTERNAL_TOOLS_GUIDE.md` - External tool integration
