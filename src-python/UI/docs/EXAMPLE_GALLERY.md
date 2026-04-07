# UI Forge Example Gallery

Visual showcase of UI Forge capabilities with generated examples from all generator types.

## Generating the Gallery

To generate all example assets and create the visual gallery:

```bash
cd src-python/UI
python generate_gallery.py
```

This will:
1. Generate all example templates from `examples/` directory
2. Create output assets in `gallery/output/`
3. Generate HTML gallery at `gallery/index.html`
4. Open gallery in default browser

## Gallery Structure

```
gallery/
├── index.html              # Main gallery page
├── output/                 # Generated assets
│   ├── icons/
│   ├── brushes/
│   ├── patterns/
│   ├── cursors/
│   └── overlays/
└── thumbnails/             # Auto-generated thumbnails
```

## Manual Generation

Generate specific examples:

```python
from UI.core import UIForgeEngine
from UI.template_manager import TemplateManager

engine = UIForgeEngine()
tm = TemplateManager()

# Generate all icon examples
icon_templates = [
    "examples/icons/toolbar_icon_set.yaml",
    "examples/icons/gradient_circle.yaml",
    "examples/icons/animated_spinner.yaml",
    "examples/icons/layered_icon.yaml"
]

for template_path in icon_templates:
    template = tm.load_template(template_path)
    result = engine.generate_asset(template)
    print(f"Generated: {result.output_paths}")
```

## Example Categories

### Icons

**Toolbar Icon Set** (`toolbar_icon_set.yaml`)
- Demonstrates template inheritance
- Theme variants (light/dark)
- Color token usage
- Output: PNG, SVG

**Gradient Circle** (`gradient_circle.yaml`)
- Simple circular icon
- Linear gradient fill
- Theme-aware colors
- Output: PNG, SVG

**Animated Spinner** (`animated_spinner.yaml`)
- Rotating loading animation
- SMIL-based SVG animation
- 2-second loop
- Output: Animated SVG

**Layered Icon** (`layered_icon.yaml`)
- Multiple overlapping shapes
- Blend modes (multiply, normal)
- Complex composition
- Output: PNG, SVG

### Brushes

**Soft Round Brush** (`soft_round.yaml`)
- Circular shape
- Smooth falloff
- 30% hardness
- Stroke preview
- Output: 256x256 PNG

**Hard Square Brush** (`hard_square.yaml`)
- Square shape
- Sharp falloff
- 90% hardness
- Precise edges
- Output: 256x256 PNG

**Textured Brush** (`textured_brush.yaml`)
- Circular base
- Texture overlay support
- Medium hardness
- Artistic style
- Output: 256x256 PNG

### Patterns

**Perlin Noise Pattern** (`noise_pattern.yaml`)
- Procedural Perlin noise
- 4 octaves
- Tileable output
- Seamless repetition
- Output: 256x256 PNG

**Grid Pattern** (`grid_pattern.yaml`)
- 32px grid spacing
- Customizable colors
- Tileable
- Guide overlay
- Output: 256x256 PNG

**Checkerboard** (`checkerboard.yaml`)
- 16px cells
- Two-color pattern
- Perfect tiling
- Background testing
- Output: 128x128 PNG

### Cursors

**Crosshair Cursor** (`crosshair.yaml`)
- Precision targeting
- Center dot
- Hotspot at (16, 16)
- High visibility
- Output: 32x32 PNG

**Hand Cursor** (`hand_cursor.yaml`)
- Pan/grab operations
- Custom hotspot
- Outlined for contrast
- Standard size
- Output: 32x32 PNG

### Overlays

**Grid Overlay** (`grid_overlay.yaml`)
- Viewport grid
- Semi-transparent
- Major/minor lines
- Full HD resolution
- Output: 1920x1080 PNG

**Vignette Overlay** (`vignette.yaml`)
- Radial gradient
- Edge darkening
- Configurable intensity
- Focus enhancement
- Output: 1920x1080 PNG

## Gallery Script

Create `generate_gallery.py` in the UI directory:

```python
#!/usr/bin/env python3
"""
Generate example gallery for UI Forge.
Creates all example assets and HTML gallery.
"""

import os
from pathlib import Path
from UI.core import UIForgeEngine
from UI.template_manager import TemplateManager
from UI.preview_manager import PreviewManager

def generate_gallery():
    """Generate complete example gallery."""
    print("UI Forge Example Gallery Generator")
    print("=" * 50)
    
    # Initialize
    engine = UIForgeEngine()
    tm = TemplateManager()
    pm = PreviewManager()
    
    # Create gallery directory
    gallery_dir = Path("gallery")
    gallery_dir.mkdir(exist_ok=True)
    (gallery_dir / "output").mkdir(exist_ok=True)
    
    # Find all example templates
    examples_dir = Path("examples")
    templates = []
    
    for category in ["icons", "brushes", "patterns", "cursors", "overlays"]:
        category_dir = examples_dir / category
        if category_dir.exists():
            templates.extend(category_dir.glob("*.yaml"))
            templates.extend(category_dir.glob("*.json"))
    
    print(f"\nFound {len(templates)} example templates")
    
    # Generate all examples
    results = []
    for i, template_path in enumerate(templates, 1):
        print(f"\n[{i}/{len(templates)}] Generating {template_path.name}...")
        
        try:
            template = tm.load_template(str(template_path))
            result = engine.generate_asset(template)
            
            if result.success:
                print(f"  ✓ Success: {list(result.output_paths.keys())}")
                results.append((template, result))
            else:
                print(f"  ✗ Failed: {result.error}")
        except Exception as e:
            print(f"  ✗ Error: {e}")
    
    print(f"\n{'=' * 50}")
    print(f"Generated {len(results)} / {len(templates)} examples")
    
    # Generate HTML gallery
    print("\nGenerating HTML gallery...")
    gallery_html = generate_gallery_html(results)
    
    gallery_path = gallery_dir / "index.html"
    gallery_path.write_text(gallery_html)
    
    print(f"✓ Gallery created: {gallery_path}")
    print(f"\nOpen gallery: file://{gallery_path.absolute()}")
    
    # Open in browser
    import webbrowser
    webbrowser.open(f"file://{gallery_path.absolute()}")

def generate_gallery_html(results):
    """Generate HTML gallery page."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI Forge Example Gallery</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            padding: 2rem;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            color: #94a3b8;
            font-size: 1.1rem;
        }
        .category {
            margin-bottom: 3rem;
        }
        .category-title {
            font-size: 1.8rem;
            margin-bottom: 1.5rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #334155;
        }
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 2rem;
        }
        .asset-card {
            background: #1e293b;
            border-radius: 12px;
            padding: 1.5rem;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .asset-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
        }
        .asset-preview {
            background: repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%) 
                        50% / 20px 20px;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 200px;
        }
        .asset-preview img {
            max-width: 100%;
            max-height: 200px;
            image-rendering: pixelated;
        }
        .asset-name {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }
        .asset-description {
            color: #94a3b8;
            font-size: 0.9rem;
            margin-bottom: 1rem;
        }
        .asset-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .meta-tag {
            background: #334155;
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.85rem;
            color: #cbd5e1;
        }
        .validation-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        .validation-passed {
            background: #10b981;
            color: white;
        }
        .validation-failed {
            background: #ef4444;
            color: white;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>UI Forge Example Gallery</h1>
        <p class="subtitle">Procedural UI Asset Generation System</p>
    </div>
"""
    
    # Group by category
    categories = {}
    for template, result in results:
        category = template.category or "uncategorized"
        if category not in categories:
            categories[category] = []
        categories[category].append((template, result))
    
    # Generate category sections
    for category, items in sorted(categories.items()):
        html += f"""
    <div class="category">
        <h2 class="category-title">{category.title()}</h2>
        <div class="gallery-grid">
"""
        
        for template, result in items:
            # Get first output path for preview
            preview_path = list(result.output_paths.values())[0] if result.output_paths else ""
            
            # Validation badge
            validation_class = "validation-passed" if result.validation.passed else "validation-failed"
            validation_text = "✓ Validated" if result.validation.passed else "✗ Failed"
            
            html += f"""
            <div class="asset-card">
                <div class="asset-preview">
                    <img src="{preview_path}" alt="{template.name}">
                </div>
                <div class="asset-name">{template.name}</div>
                <div class="asset-description">{template.description}</div>
                <div class="asset-meta">
                    <span class="validation-badge {validation_class}">{validation_text}</span>
                    <span class="meta-tag">{template.dimensions['width']}x{template.dimensions['height']}</span>
                    <span class="meta-tag">{', '.join(template.output_formats)}</span>
                </div>
            </div>
"""
        
        html += """
        </div>
    </div>
"""
    
    html += """
</body>
</html>
"""
    
    return html

if __name__ == "__main__":
    generate_gallery()
```

## Viewing the Gallery

After generation, open `gallery/index.html` in your browser to see:

- **Visual previews** of all generated assets
- **Metadata** including dimensions, formats, validation status
- **Organized by category** (icons, brushes, patterns, etc.)
- **Interactive cards** with hover effects
- **Checkerboard backgrounds** for transparency visualization

## Gallery Features

- **Responsive grid layout** adapts to screen size
- **Dark theme** matching K_OS aesthetic
- **Validation badges** show which assets passed quality checks
- **Format indicators** show output formats (PNG, SVG, etc.)
- **Dimension tags** display asset resolution
- **Hover effects** for better interactivity

## Customization

Modify `generate_gallery_html()` to customize:
- Color scheme
- Grid layout
- Card styling
- Metadata display
- Sorting/filtering

## Next Steps

1. Generate the gallery: `python generate_gallery.py`
2. Review generated assets
3. Modify example templates
4. Regenerate to see changes
5. Use examples as templates for your own assets

## See Also

- `../examples/README.md` - Example template documentation
- `TEMPLATE_SCHEMA.md` - Template field reference
- `../README.md` - Main documentation
