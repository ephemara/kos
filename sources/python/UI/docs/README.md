# UI Forge Documentation

Complete documentation for the UI Forge procedural UI asset generation system.

## Documentation Index

### Getting Started

- **[Main README](../README.md)** - Installation, quick start, and overview
- **[Example Gallery](EXAMPLE_GALLERY.md)** - Visual showcase of generated assets
- **[External Tools Guide](../EXTERNAL_TOOLS_GUIDE.md)** - ImageMagick, Inkscape, GIMP integration

### Reference Documentation

- **[Template Schema](TEMPLATE_SCHEMA.md)** - Complete template field reference
  - Core template fields
  - Output configuration
  - Visual properties
  - Generator-specific parameters
  - Animation configuration
  - Alpha channel configuration
  - Template inheritance

- **[Library Arsenal](LIBRARY_ARSENAL.md)** - Dependency documentation
  - Core dependencies (Pillow, numpy, svgwrite, cairosvg)
  - Optional libraries (scikit-image, noise)
  - External tools (ImageMagick, Inkscape, GIMP)
  - Library-first philosophy
  - Migration from lucide-react

### Tutorials

- **[Custom Generator Tutorial](CUSTOM_GENERATOR_TUTORIAL.md)** - Create custom generators
  - Step-by-step tutorial
  - Complete examples
  - Best practices
  - Testing strategies

### Examples

- **[Example Templates](../examples/README.md)** - Template examples for all generator types
  - Icons (toolbar, gradient, animated, layered)
  - Brushes (soft, hard, textured)
  - Patterns (noise, grid, checkerboard)
  - Cursors (crosshair, hand)
  - Overlays (grid, vignette)

## Quick Links

### For Users

1. Start with [Main README](../README.md) for installation
2. Review [Example Templates](../examples/README.md) to see what's possible
3. Check [Template Schema](TEMPLATE_SCHEMA.md) for template syntax
4. Generate [Example Gallery](EXAMPLE_GALLERY.md) to see outputs

### For Developers

1. Read [Custom Generator Tutorial](CUSTOM_GENERATOR_TUTORIAL.md) to create generators
2. Review [Library Arsenal](LIBRARY_ARSENAL.md) to understand dependencies
3. Check [External Tools Guide](../EXTERNAL_TOOLS_GUIDE.md) for tool integration
4. Study existing generators in `../generators/`

### For Integrators

1. Review [Main README](../README.md) Tauri integration section
2. Check TypeScript examples for frontend integration
3. Review JSON-RPC API documentation
4. Test with example templates

## Documentation Structure

```
docs/
├── README.md                          # This file
├── TEMPLATE_SCHEMA.md                 # Template field reference
├── CUSTOM_GENERATOR_TUTORIAL.md       # Generator creation guide
├── EXAMPLE_GALLERY.md                 # Visual gallery documentation
└── LIBRARY_ARSENAL.md                 # Dependency documentation

../
├── README.md                          # Main documentation
├── EXTERNAL_TOOLS_GUIDE.md            # External tool integration
├── examples/                          # Example templates
│   ├── README.md                      # Example documentation
│   ├── icons/                         # Icon examples
│   ├── brushes/                       # Brush examples
│   ├── patterns/                      # Pattern examples
│   ├── cursors/                       # Cursor examples
│   └── overlays/                      # Overlay examples
└── generators/                        # Generator implementations
    ├── base.py                        # Base generator interface
    ├── icon_generator.py              # Icon generator
    ├── brush_generator.py             # Brush generator
    ├── pattern_generator.py           # Pattern generator
    ├── cursor_generator.py            # Cursor generator
    ├── overlay_generator.py           # Overlay generator
    └── alpha_generator.py             # Alpha mask generator
```

## Key Concepts

### Data-Driven Generation
All visual properties are defined in JSON/YAML templates. Zero hardcoded values in generators.

### Library-First Philosophy
Leverage battle-tested Python libraries (Pillow, numpy, svgwrite) over custom implementations.

### Auto-Discovery
Generators are automatically discovered from the `generators/` directory.

### Preview Workflow
Assets are staged in `preview/` for approval before moving to production `library/`.

### Theme Support
Generate multiple theme variants (light, dark, high-contrast) from single template.

### Optional Animation
SMIL-based SVG animations and sprite sheet generation as post-processing step.

### External Tool Integration
Optional integration with ImageMagick, Inkscape, GIMP for advanced features.

## Common Workflows

### Generate Single Asset

```python
from UI.core import UIForgeEngine
from UI.template_manager import TemplateManager

engine = UIForgeEngine()
tm = TemplateManager()

template = tm.load_template("templates/icons/my_icon.yaml")
result = engine.generate_asset(template)
```

### Batch Generation

```python
templates = tm.list_templates(category="icons")
results = engine.batch_generate(templates, parallel=True)
```

### Create Custom Generator

1. Create `generators/my_generator.py`
2. Inherit from `BaseGenerator`
3. Implement `generate()` and `supported_params()`
4. Generator is auto-discovered on next run

### Create Template

1. Create YAML file in `templates/{category}/`
2. Define required fields (name, generator_type, dimensions, output_formats, params)
3. Add optional fields (colors, theme_variants, animation)
4. Generate with `engine.generate_asset(template)`

## Troubleshooting

See [Main README](../README.md) troubleshooting section for:
- Virtual environment issues
- Import errors
- SVG rendering issues
- Performance issues
- External tool issues
- Template validation errors

## Contributing

UI Forge is part of the K_OS DCC Suite. To contribute:

1. Create custom generators for new asset types
2. Add example templates showcasing features
3. Improve documentation with examples
4. Report issues and suggest improvements
5. Share your generated assets

## Version History

- **v1.0** - Initial release with all core features
  - Icon, brush, pattern, cursor, overlay generators
  - Template system with inheritance
  - Animation system
  - Alpha mask generation
  - External tool integration
  - Preview workflow
  - Library management
  - Tauri integration

## License

Part of the K_OS DCC Suite project.

## Support

For questions, issues, or feature requests, refer to the main K_OS project documentation.
