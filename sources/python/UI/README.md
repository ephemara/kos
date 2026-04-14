# UI Forge

**Procedural UI Asset Generation System for K_OS DCC Suite**

UI Forge is a Python-based system that generates icons, brushes, patterns, cursors, and overlays through data-driven templates and procedural algorithms. Built with a library-first philosophy, it leverages numpy, Pillow, and the Python ecosystem for scalable, high-performance asset generation.

## Features

- **Multi-format output**: PNG, SVG, JPEG, WebP, TIFF, BMP, and ICO with arbitrary dimensions
- **Windows icon bundles**: ICO export can embed multiple icon sizes in one `.ico` for proper desktop/taskbar results
- **Data-driven generation**: All visual properties defined in JSON/YAML templates
- **Alpha channel support**: First-class alpha mask generation and compositing
- **Optional animation**: SMIL-based SVG animations and sprite sheet generation
- **Theme support**: Multi-variant generation for light/dark/high-contrast modes
- **Preview workflow**: Approval system with HTML gallery before production
- **Tauri integration**: JSON-RPC bridge for seamless frontend integration
- **Extensible**: Auto-discovery plugin system for custom generators
- **Performance**: Parallel batch processing with multiprocessing

## Installation

### Prerequisites

- Python 3.10 or higher
- pip package manager
- (Optional) ImageMagick, Inkscape CLI, or GIMP for advanced features

### Setup

1. **Navigate to UI Forge directory**:
```bash
cd M:\K_OS\sources/python\UI
```

2. **Create virtual environment** (recommended for isolation):
```bash
python -m venv venv
```

This creates a `venv/` directory containing an isolated Python environment. Using a virtual environment prevents dependency conflicts with other Python projects and ensures reproducible builds.

3. **Activate virtual environment**:
```bash
# Windows (PowerShell)
venv\Scripts\Activate.ps1

# Windows (CMD)
venv\Scripts\activate.bat

# Linux/Mac
source venv/bin/activate
```

You should see `(venv)` prefix in your terminal prompt indicating the virtual environment is active.

4. **Install dependencies**:
```bash
pip install -r requirements.txt
```

This installs all required Python packages:
- **Pillow**: Image generation and manipulation
- **numpy**: High-performance array operations
- **svgwrite**: SVG generation
- **cairosvg**: SVG to raster conversion
- **pyyaml**: YAML template parsing
- **jsonschema**: Template validation
- **scikit-image**: Advanced image processing
- **noise**: Procedural noise generation

5. **Verify installation**:
```bash
python -c "import UI; print('UI Forge installed successfully')"
```

### Deactivating Virtual Environment

When done working with UI Forge:
```bash
deactivate
```

## Quick Start

### Icon Generator Example

Generate a simple icon with geometric shapes:

```python
from UI.core import UIForgeEngine
from UI.template_manager import TemplateManager

# Initialize engine
engine = UIForgeEngine()
template_manager = TemplateManager()

# Load and generate from template
template = template_manager.load_template("templates/icons/sculpt_tool.json")
result = engine.generate_asset(template)

if result.success:
    print(f"Generated: {result.output_paths}")
    print(f"Validation: {'PASSED' if result.validation.passed else 'FAILED'}")
else:
    print(f"Error: {result.error}")
```

### Brush Generator Example

Generate brush preview thumbnails:

```python
from UI.models import Template, BrushParams

# Create brush template programmatically
template = Template(
    name="soft-round-brush",
    generator_type="brush",
    dimensions={"width": 256, "height": 256},
    output_formats=["png"],
    params=BrushParams(
        shape="circular",
        size=128,
        hardness=0.5,
        spacing=0.25,
        falloff_curve="smooth",
        stroke_preview=True
    )
)

result = engine.generate_asset(template)
```

### Alpha Mask Generation Example

Generate procedural alpha masks:

```python
from UI.models import Template, AlphaParams

template = Template(
    name="vignette-mask",
    generator_type="alpha",
    dimensions={"width": 512, "height": 512},
    output_formats=["png"],
    alpha_mode="separate",
    params=AlphaParams(
        type="gradient",
        gradient_type="radial",
        gradient_center=(0.5, 0.5),
        invert=True
    )
)

result = engine.generate_asset(template)
```

### Batch Generation

Generate multiple assets in parallel:

```python
# Generate all icon templates
templates = template_manager.list_templates(category="icons")
results = engine.batch_generate(templates, parallel=True)

print(f"Generated {len([r for r in results if r.success])} assets")
print(f"Failed {len([r for r in results if not r.success])} assets")

# Show errors
for result in results:
    if not result.success:
        print(f"  {result.template_name}: {result.error}")
```

### Animated Icon Example

Generate animated SVG icons:

```python
from UI.models import Template, AnimationConfig

template = Template(
    name="loading-spinner",
    generator_type="icon",
    dimensions={"width": 64, "height": 64},
    output_formats=["svg"],
    params={
        "layers": [
            {
                "type": "circle",
                "geometry": {"cx": 32, "cy": 32, "r": 24},
                "stroke": {"color": "#2563eb", "width": 4},
                "fill": None
            }
        ]
    },
    animation=AnimationConfig(
        enabled=True,
        motion_types=["orbit"],
        duration=2.0,
        fps=30,
        loop=True,
        output_type="svg_smil"
    )
)

result = engine.generate_asset(template)
```

### Theme Variant Generation

Generate light and dark theme variants:

```python
template = template_manager.load_template("templates/icons/sculpt_tool.json")
# Template specifies: theme_variants: ["light", "dark"]

result = engine.generate_asset(template)

# Outputs both variants:
# - sculpt_tool_light.png
# - sculpt_tool_dark.png
```

### Tauri Integration

UI Forge integrates with the K_OS Tauri frontend via JSON-RPC. All generator functions are exposed through the Python sidecar bridge.

#### TypeScript Service Client

Create a typed service client in `src-frontend/services/uiForgeClient.ts`:

```typescript
import { invoke } from '@tauri-apps/api';

export interface GenerationResult {
  success: boolean;
  asset_id: string;
  template_name: string;
  output_paths: Record<string, string>;
  metadata: AssetMetadata;
  validation: ValidationResult;
  generation_time: number;
  error?: string;
  warnings: string[];
}

export interface AssetMetadata {
  name: string;
  description: string;
  category: string;
  tags: string[];
  dimensions: [number, number];
  format: string;
  has_alpha: boolean;
  theme_variant?: string;
  is_animated: boolean;
}

export interface ValidationResult {
  passed: boolean;
  checks: Record<string, boolean>;
  errors: string[];
  warnings: string[];
}

export const uiForgeClient = {
  // Generate single asset from template data
  async generateAsset(templateData: any): Promise<GenerationResult> {
    return await invoke('ui_forge.generate_asset', { templateData });
  },

  // Batch generate from template paths
  async batchGenerate(templatePaths: string[]): Promise<{ batch_id: string; status: string }> {
    return await invoke('ui_forge.batch_generate', { templatePaths });
  },

  // Get batch generation progress
  async getProgress(batchId: string): Promise<ProgressInfo> {
    return await invoke('ui_forge.get_progress', { batchId });
  },

  // List available templates
  async listTemplates(category?: string): Promise<any[]> {
    return await invoke('ui_forge.list_templates', { category });
  },

  // Approve preview assets
  async approvePreview(assetIds: string[]): Promise<{ approved: number }> {
    return await invoke('ui_forge.approve_preview', { assetIds });
  },

  // Get library index
  async getLibraryIndex(): Promise<LibraryIndex> {
    return await invoke('ui_forge.get_library_index');
  },

  // Hot-reload generator module
  async reloadGenerator(generatorType: string): Promise<{ status: string; generator: string }> {
    return await invoke('ui_forge.reload_generator', { generatorType });
  }
};
```

#### React Component Example

```typescript
import { useState } from 'react';
import { uiForgeClient } from '@/services/uiForgeClient';

export function IconGeneratorPanel() {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  const generateIcon = async () => {
    setGenerating(true);
    try {
      const result = await uiForgeClient.generateAsset({
        name: "custom-icon",
        generator_type: "icon",
        dimensions: { width: 64, height: 64 },
        output_formats: ["png", "svg"],
        theme_variants: ["light", "dark"],
        params: {
          layers: [
            {
              type: "circle",
              geometry: { cx: 32, cy: 32, r: 24 },
              fill: { type: "solid", colors: ["$primary"] }
            }
          ]
        }
      });
      
      setResult(result);
      
      if (result.success) {
        console.log('Generated:', result.output_paths);
      } else {
        console.error('Generation failed:', result.error);
      }
    } catch (error) {
      console.error('RPC error:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <button onClick={generateIcon} disabled={generating}>
        {generating ? 'Generating...' : 'Generate Icon'}
      </button>
      
      {result && result.success && (
        <div>
          <h3>Generated Assets:</h3>
          {Object.entries(result.output_paths).map(([format, path]) => (
            <div key={format}>
              <strong>{format}:</strong> {path}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Batch Generation with Progress

```typescript
import { useState, useEffect } from 'react';
import { uiForgeClient } from '@/services/uiForgeClient';

export function BatchGeneratorPanel() {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);

  const startBatch = async () => {
    const result = await uiForgeClient.batchGenerate([
      'templates/icons/toolbar/*.yaml',
      'templates/icons/menu/*.yaml'
    ]);
    setBatchId(result.batch_id);
  };

  useEffect(() => {
    if (!batchId) return;

    const interval = setInterval(async () => {
      const prog = await uiForgeClient.getProgress(batchId);
      setProgress(prog);
      
      if (prog.percent_complete >= 100) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [batchId]);

  return (
    <div>
      <button onClick={startBatch}>Start Batch Generation</button>
      
      {progress && (
        <div>
          <progress value={progress.percent_complete} max={100} />
          <p>{progress.completed} / {progress.total} assets</p>
          <p>Current: {progress.current_asset}</p>
          {progress.estimated_time_remaining && (
            <p>ETA: {progress.estimated_time_remaining.toFixed(1)}s</p>
          )}
        </div>
      )}
    </div>
  );
}
```

## Directory Structure

```
M:\K_OS\sources/python\UI\
├── __init__.py                 # Package initialization
├── requirements.txt            # Python dependencies
├── README.md                   # This documentation
├── core.py                     # Core engine and orchestration
├── template_manager.py         # Template parsing and validation
├── generator_manager.py        # Generator discovery and execution
├── preview_manager.py          # Preview workflow and HTML generation
├── library_manager.py          # Asset library organization and indexing
├── tauri_bridge.py            # JSON-RPC decorators and handlers
├── validators.py              # Asset validation and quality checks
├── utils.py                   # Shared utilities
├── models.py                  # Data models and schemas
├── themes.py                  # Theme system and color tokens
│
├── generators/                # Generator modules (auto-discovered)
│   ├── __init__.py
│   ├── base.py               # Base generator interface
│   ├── icon_generator.py     # Icon generation (IMPLEMENTED)
│   ├── brush_generator.py    # Brush preview generation (IMPLEMENTED)
│   ├── pattern_generator.py  # Pattern generation (IMPLEMENTED)
│   ├── cursor_generator.py   # Cursor generation (IMPLEMENTED)
│   ├── overlay_generator.py  # Overlay generation (IMPLEMENTED)
│   └── alpha_generator.py    # Alpha mask generation (IMPLEMENTED)
│
├── animation/                 # Optional animation system (IMPLEMENTED)
│   ├── __init__.py
│   ├── motion_library.py     # Motion type implementations
│   ├── svg_animator.py       # SMIL animation generation
│   └── sprite_sheet.py       # Sprite sheet generation
│
├── external/                  # External tool wrappers (IMPLEMENTED)
│   ├── __init__.py
│   ├── base.py               # ExternalTool abstract class
│   ├── imagemagick.py        # ImageMagick CLI wrapper
│   ├── inkscape.py           # Inkscape CLI wrapper
│   └── gimp.py               # GIMP batch mode wrapper
│
├── templates/                 # Template storage
│   ├── icons/                # Icon templates
│   │   ├── base_icon.yaml   # Base template for inheritance
│   │   └── sculpt_tool.json # Example icon template
│   ├── brushes/              # Brush templates
│   ├── patterns/             # Pattern templates
│   ├── cursors/              # Cursor templates
│   └── overlays/             # Overlay templates
│
├── examples/                  # Example templates (see examples/ directory)
│   ├── icons/
│   ├── brushes/
│   ├── patterns/
│   ├── cursors/
│   └── overlays/
│
├── docs/                      # Additional documentation
│   ├── TEMPLATE_SCHEMA.md    # Template field reference
│   ├── CUSTOM_GENERATOR_TUTORIAL.md  # Generator creation guide
│   └── LIBRARY_ARSENAL.md    # Dependency documentation
│
├── preview/                   # Preview staging area
│   └── [timestamp]/          # Timestamped preview sessions
│       ├── assets/           # Generated preview assets
│       └── index.html        # Preview gallery
│
├── library/                   # Production asset library
│   ├── icons/                # Approved icon assets
│   ├── brushes/              # Approved brush assets
│   ├── patterns/             # Approved pattern assets
│   ├── cursors/              # Approved cursor assets
│   ├── overlays/             # Approved overlay assets
│   ├── metadata/             # Asset metadata JSON files
│   └── index.json            # Library index (auto-generated)
│
├── tests/                     # Test suite
│   ├── test_template_manager.py
│   ├── test_generator_manager.py
│   ├── test_icon_generator.py
│   ├── test_brush_generator.py
│   ├── test_alpha_generator.py
│   ├── test_animation.py
│   ├── test_external_tools.py
│   └── test_caching.py
│
└── test_output/               # Test output directory
    └── [test artifacts]
```

## Template Format

Templates are JSON or YAML files defining asset parameters:

```yaml
# Example: templates/icons/sculpt_tool.yaml
name: "Sculpt Tool Icon"
description: "Icon for sculpting tool in toolbar"
generator_type: "icon"
category: "toolbar"
tags: ["sculpt", "tool", "3d"]

# Output configuration
output_formats: ["png", "svg", "ico"]
ico_sizes: [16, 24, 32, 48, 64, 128, 256]
dimensions:
  width: 64
  height: 64

# Visual properties
colors: ["$primary", "#64748b"]
theme_variants: ["light", "dark"]

# Generator-specific parameters
params:
  padding: 8
  antialias_factor: 2
  layers:
    - type: "circle"
      geometry: { cx: 32, cy: 32, r: 24 }
      fill:
        type: "linear_gradient"
        colors: ["$primary", "#1e40af"]
        angle: 45
      stroke:
        color: "#ffffff"
        width: 2

# Optional animation
animation:
  enabled: false
```

### Windows ICO Export

For Windows app icons, request `ico` in `output_formats`. UI Forge now writes multi-resolution `.ico` bundles instead of a single raster dump.

```yaml
name: "K_OS App Icon"
description: "Windows app icon bundle"
generator_type: "icon"
category: "branding"
output_formats: ["png", "ico"]
ico_sizes: [16, 24, 32, 48, 64, 128, 256]
dimensions:
  width: 512
  height: 512
params:
  padding: 24
  antialias_factor: 4
  layers:
    - type: "circle"
      geometry: { cx: 256, cy: 256, r: 220 }
      fill:
        type: "solid"
        colors: ["#0f172a"]
```

If `ico_sizes` is omitted, the exporter derives a Windows-friendly set automatically from the source image size.

## Generator Categories

UI Forge supports five generator categories:

1. **Icons**: Toolbar and menu icons with geometric primitives, gradients, layering
2. **Brushes**: Sculpting and painting brush preview thumbnails
3. **Patterns**: Fill patterns and textures with tiling support
4. **Cursors**: Custom cursor graphics with hotspot metadata
5. **Overlays**: Viewport overlays and HUD elements

## Creating Custom Generators

1. Create a new file in `generators/` directory
2. Inherit from `BaseGenerator` abstract class
3. Implement required methods:

```python
from generators.base import BaseGenerator
import numpy as np

class MyCustomGenerator(BaseGenerator):
    def generate(self, template) -> np.ndarray:
        """Generate asset as numpy array (H, W, C) with RGBA channels"""
        width = template.dimensions['width']
        height = template.dimensions['height']
        
        # Create RGBA image
        image = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Your generation logic here
        # ...
        
        return image
    
    def supported_params(self) -> dict:
        """Return supported parameter schema"""
        return {
            'my_param': float,
            'another_param': str
        }
```

4. The generator will be auto-discovered on next startup

## External Tool Integration

UI Forge can leverage external tools for advanced features:

### ImageMagick
```bash
# Windows (via Chocolatey)
choco install imagemagick

# Linux
sudo apt-get install imagemagick

# Mac
brew install imagemagick
```

### Inkscape CLI
```bash
# Windows
choco install inkscape

# Linux
sudo apt-get install inkscape

# Mac
brew install inkscape
```

### GIMP (Batch Mode)
```bash
# Windows
choco install gimp

# Linux
sudo apt-get install gimp

# Mac
brew install gimp
```

External tools are optional - UI Forge will gracefully degrade if they're not available.

## Performance

- **Target**: Generate 1000 simple icons in under 60 seconds
- **Parallel processing**: Utilizes all available CPU cores
- **Memory efficient**: Processes large batches in chunks (< 2GB memory usage)
- **Caching**: Intermediate results cached to avoid redundant computation
- **Incremental**: Only regenerate changed templates

## Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_template_manager.py

# Run with coverage
pytest --cov=UI --cov-report=html
```

## Troubleshooting

### Virtual Environment Issues

**Problem**: `pip install` fails or installs to wrong location
```bash
# Solution: Ensure venv is activated
# You should see (venv) in your prompt
# If not, activate it:
venv\Scripts\Activate.ps1  # Windows PowerShell
source venv/bin/activate    # Linux/Mac
```

**Problem**: `ModuleNotFoundError: No module named 'UI'`
```bash
# Solution: Install in editable mode
pip install -e .
# Or ensure you're running from the correct directory
cd M:\K_OS\sources/python\UI
```

### Import Errors

**Problem**: `ImportError: cannot import name 'UIForgeEngine'`
```python
# Solution: Check your import path
# Correct:
from UI.core import UIForgeEngine

# Incorrect:
from core import UIForgeEngine  # Missing UI prefix
```

**Problem**: Dependencies not found after installation
```bash
# Solution: Reinstall requirements
pip install --upgrade --force-reinstall -r requirements.txt
```

### SVG Rendering Issues

**Problem**: `OSError: cannot load library 'libcairo-2'`

**Windows Solution**:
1. Download GTK+ runtime from https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer
2. Install with default options
3. Restart terminal and reactivate venv

**Linux Solution**:
```bash
sudo apt-get update
sudo apt-get install libcairo2-dev libpango1.0-dev
pip install --upgrade cairosvg
```

**Mac Solution**:
```bash
brew install cairo pango gdk-pixbuf libffi
pip install --upgrade cairosvg
```

### Performance Issues

**Problem**: Batch generation is slow

**Solutions**:
1. **Enable parallel processing** (should be default):
```python
results = engine.batch_generate(templates, parallel=True)
```

2. **Reduce anti-aliasing** in templates:
```yaml
params:
  antialias_factor: 1  # Default is 2, lower = faster
```

3. **Use incremental generation**:
```python
# Only regenerate changed templates
results = engine.regenerate_changed(since=last_run_timestamp)
```

4. **Check CPU usage**:
```python
import multiprocessing
print(f"Using {multiprocessing.cpu_count()} CPU cores")
```

**Problem**: Memory usage exceeds 2GB

**Solution**: Process in smaller batches:
```python
# Split templates into chunks
chunk_size = 100
for i in range(0, len(templates), chunk_size):
    chunk = templates[i:i+chunk_size]
    results = engine.batch_generate(chunk, parallel=True)
```

### External Tool Issues

**Problem**: External tool not detected

**Check availability**:
```python
from UI.external import get_tool_manager

manager = get_tool_manager()
print(manager.get_tool_info())

# Check specific tool
if not manager.is_tool_available('imagemagick'):
    print("ImageMagick not found in PATH")
    print("Install from: https://imagemagick.org/script/download.php")
```

**Problem**: ImageMagick command fails

**Solution**: Verify installation and PATH:
```bash
# Windows
magick --version

# Linux/Mac
convert --version
```

If not found, add to PATH or reinstall.

**Problem**: Inkscape CLI not working

**Solution**: Inkscape must be in PATH:
```bash
# Windows: Add to PATH
C:\Program Files\Inkscape\bin

# Test
inkscape --version
```

### Template Validation Errors

**Problem**: `ValidationError: Required field 'generator_type' missing`

**Solution**: Ensure all required fields are present:
```yaml
name: "My Asset"
generator_type: "icon"  # Required: icon, brush, pattern, cursor, overlay
dimensions:             # Required
  width: 64
  height: 64
output_formats: ["png"] # Required
params: {}              # Required (can be empty)
```

**Problem**: `ValidationError: Invalid color token '$unknown'`

**Solution**: Use defined color tokens or hex colors:
```yaml
# Valid:
colors: ["$primary", "$accent", "#2563eb"]

# Invalid:
colors: ["$unknown"]  # Token not defined in themes.py
```

**Problem**: Template inheritance not working

**Solution**: Ensure parent template exists and path is correct:
```yaml
parent_template: "base_icon.yaml"  # Must exist in same directory
# Or use relative path:
parent_template: "../base/base_icon.yaml"
```

### Generation Failures

**Problem**: Asset generation fails silently

**Solution**: Check validation results:
```python
result = engine.generate_asset(template)
if not result.success:
    print(f"Error: {result.error}")
    print(f"Warnings: {result.warnings}")
    
if not result.validation.passed:
    print(f"Validation errors: {result.validation.errors}")
    print(f"Failed checks: {[k for k, v in result.validation.checks.items() if not v]}")
```

**Problem**: SVG output has rendering glitches

**Solution**: Validate SVG structure:
```python
from UI.validators import validate_svg

validation = validate_svg(svg_path)
if not validation.passed:
    print(f"SVG issues: {validation.errors}")
```

**Problem**: Alpha channel not working

**Solution**: Ensure correct format and mode:
```yaml
output_formats: ["png"]  # PNG supports alpha, JPEG does not
alpha_mode: "embedded"   # or "separate" or "both"
```

### Tauri Integration Issues

**Problem**: RPC call fails with timeout

**Solution**: Increase timeout for long operations:
```typescript
// In Tauri config (tauri.conf.json)
{
  "tauri": {
    "cli": {
      "timeout": 300  // 5 minutes for batch operations
    }
  }
}
```

**Problem**: Python sidecar not starting

**Solution**: Check Python sidecar logs:
```bash
# Check if Python is in PATH
python --version

# Check if UI module can be imported
python -c "import UI; print('OK')"

# Check Tauri logs for Python errors
```

**Problem**: Type errors in TypeScript

**Solution**: Generate TypeScript definitions:
```bash
# Run type generation script (if available)
python generate_types.py

# Or manually create types based on Python models
```

### Testing Issues

**Problem**: Tests fail with import errors

**Solution**: Install test dependencies:
```bash
pip install pytest pytest-cov
```

**Problem**: Tests pass locally but fail in CI

**Solution**: Ensure external tools are mocked:
```python
# In test file
from unittest.mock import patch

@patch('UI.external.imagemagick.ImageMagickTool.is_available', return_value=False)
def test_without_imagemagick(mock_available):
    # Test should use fallback
    pass
```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `FileNotFoundError: template not found` | Template path incorrect | Use absolute path or path relative to templates/ |
| `ValueError: Invalid dimensions` | Width or height <= 0 | Ensure dimensions are positive integers |
| `RuntimeError: Generator not found` | Generator type typo | Check generator_type matches available generators |
| `MemoryError: Cannot allocate array` | Image too large | Reduce dimensions or use tiling |
| `OSError: [Errno 28] No space left` | Disk full | Clear preview/ directory or free disk space |

### Getting Help

1. **Check logs**: UI Forge logs to `logs/ui_forge.log`
2. **Enable debug mode**:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```
3. **Run validation**:
```bash
python -m UI.validators --check-all
```
4. **Check system info**:
```python
from UI.utils import get_system_info
print(get_system_info())
```

## Library Arsenal

UI Forge leverages battle-tested Python libraries:

- **Pillow**: Industry-standard image processing
- **numpy**: High-performance array operations, GPU-friendly
- **svgwrite**: Clean SVG generation with proper structure
- **cairosvg**: Reliable SVG to raster conversion
- **pyyaml**: Robust YAML parsing
- **jsonschema**: Template validation
- **scikit-image**: Advanced image processing algorithms
- **noise**: Perlin/simplex noise for procedural generation

## Migration from lucide-react

UI Forge coexists with lucide-react - no breaking changes:

1. Generated assets use separate namespace: `@/ui-forge/icons`
2. Lucide icons remain available: `lucide-react`
3. Gradual migration path: Generate lucide-compatible icon sets
4. Visual parity checking: Compare custom icons with lucide style

## Contributing

This is a solo developer project by Kipp (Scavenger King) for the K_OS DCC Suite. The system is designed to be extensible and welcomes custom generators and templates.

## License

Part of the K_OS DCC Suite project.

## Support

For issues, questions, or feature requests, refer to the main K_OS project documentation.
