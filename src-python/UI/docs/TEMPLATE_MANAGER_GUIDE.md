# TemplateManager Guide

## Overview

The `TemplateManager` class handles all template operations for UI Forge, including:
- Loading templates from JSON and YAML files
- Validating templates against JSON schema
- Resolving template inheritance (parent templates)
- Managing color tokens for theme support
- Discovering templates from the templates directory

## Quick Start

```python
from template_manager import TemplateManager

# Initialize manager
manager = TemplateManager()

# Load a template
template = manager.load_template("templates/icons/my_icon.json")

# Validate template data
result = manager.validate_template_data(template_data)
if not result["valid"]:
    print("Errors:", result["errors"])

# Resolve color tokens
colors = ["$primary", "$accent", "#ff0000"]
resolved = manager.resolve_color_tokens(colors, theme="dark")

# List all templates
all_templates = manager.list_templates()
icon_templates = manager.list_templates(category="icons")
```

## Template Format

Templates can be written in JSON or YAML format. Both produce identical results.

### Minimal Template (JSON)

```json
{
  "name": "My Icon",
  "description": "A simple icon",
  "generator_type": "icon",
  "category": "toolbar",
  "dimensions": {
    "width": 64,
    "height": 64
  }
}
```

### Minimal Template (YAML)

```yaml
name: "My Icon"
description: "A simple icon"
generator_type: "icon"
category: "toolbar"
dimensions:
  width: 64
  height: 64
```

### Full Template Example

```json
{
  "name": "Advanced Icon",
  "description": "Icon with all features",
  "generator_type": "icon",
  "category": "toolbar",
  "tags": ["3d", "sculpt", "tool"],
  
  "output_formats": ["png", "svg", "webp"],
  "dimensions": {
    "width": 128,
    "height": 128
  },
  "aspect_ratio": "fixed",
  
  "jpeg_quality": 95,
  "png_compression": 6,
  "webp_lossless": true,
  
  "colors": ["$primary", "$accent", "#ffffff"],
  "theme_variants": ["light", "dark", "high-contrast"],
  
  "alpha_mode": "embedded",
  "params": {
    "padding": 16,
    "antialias_factor": 2,
    "layers": [
      {
        "type": "circle",
        "geometry": {"cx": 64, "cy": 64, "r": 48},
        "fill": {
          "type": "solid",
          "colors": ["$primary"]
        }
      }
    ]
  },
  
  "version": "1.0",
  "author": "Your Name"
}
```

## Template Inheritance

Templates can inherit from parent templates using the `parent_template` field:

**base_icon.yaml:**
```yaml
name: "Base Icon"
description: "Base template for all icons"
generator_type: "icon"
category: "base"
output_formats: ["png", "svg"]
dimensions:
  width: 64
  height: 64
params:
  padding: 8
  antialias_factor: 2
```

**my_icon.json:**
```json
{
  "name": "My Custom Icon",
  "description": "Inherits from base",
  "generator_type": "icon",
  "category": "toolbar",
  "parent_template": "base_icon.yaml",
  "tags": ["custom"],
  "params": {
    "padding": 16
  }
}
```

The child template will inherit all properties from the parent, with child values overriding parent values. In this example:
- `dimensions` inherited from parent: `{width: 64, height: 64}`
- `output_formats` inherited from parent: `["png", "svg"]`
- `params.padding` overridden by child: `16` (instead of `8`)
- `params.antialias_factor` inherited from parent: `2`

## Color Token System

Color tokens allow templates to reference theme-specific colors:

### Available Tokens

**Light Theme:**
- `$primary`: #2563eb
- `$secondary`: #64748b
- `$accent`: #f59e0b
- `$background`: #ffffff
- `$foreground`: #0f172a
- `$success`: #10b981
- `$warning`: #f59e0b
- `$error`: #ef4444
- `$info`: #3b82f6

**Dark Theme:**
- `$primary`: #3b82f6
- `$secondary`: #94a3b8
- `$accent`: #fbbf24
- `$background`: #0f172a
- `$foreground`: #f1f5f9
- `$success`: #34d399
- `$warning`: #fbbf24
- `$error`: #f87171
- `$info`: #60a5fa

**High-Contrast Theme:**
- `$primary`: #ffffff
- `$secondary`: #cccccc
- `$accent`: #ffff00
- `$background`: #000000
- `$foreground`: #ffffff
- `$success`: #00ff00
- `$warning`: #ffff00
- `$error`: #ff0000
- `$info`: #00ffff

### Using Color Tokens

```python
# In template
colors = ["$primary", "$accent", "#custom"]

# Resolve for specific theme
resolved = manager.resolve_color_tokens(colors, theme="dark")
# Result: ["#3b82f6", "#fbbf24", "#custom"]
```

### Adding Custom Tokens

```python
manager.add_color_token("brand", "#123456", theme="light")
manager.add_color_token("brand", "#654321", theme="dark")
```

## Validation

The TemplateManager validates templates against a JSON schema and performs additional checks:

### Schema Validation
- Required fields: `name`, `description`, `generator_type`, `category`
- Valid generator types: `icon`, `brush`, `pattern`, `cursor`, `overlay`, `alpha`
- Valid output formats: `png`, `svg`, `jpeg`, `webp`, `tiff`, `bmp`, `ico`
- Dimensions must be positive integers

### Custom Validation
- Alpha mode compatibility with output formats
- Aspect ratio requirements
- Color token existence (warnings for unknown tokens)

### Example

```python
result = manager.validate_template_data(template_data)

if result["valid"]:
    print("✓ Template is valid")
else:
    print("✗ Validation errors:")
    for error in result["errors"]:
        print(f"  - {error}")

if result["warnings"]:
    print("⚠ Warnings:")
    for warning in result["warnings"]:
        print(f"  - {warning}")
```

## Template Discovery

The TemplateManager can discover all templates in the templates directory:

```python
# List all templates
all_templates = manager.list_templates()

# List templates by category
icon_templates = manager.list_templates(category="icons")
brush_templates = manager.list_templates(category="brushes")

# Iterate through templates
for template in all_templates:
    print(f"{template.name} - {template.category}")
```

Discovery features:
- Recursively searches subdirectories
- Supports both `.json` and `.yaml`/`.yml` files
- Skips hidden files (starting with `.`)
- Handles invalid templates gracefully (logs warning, continues)

## Caching

Templates are cached after loading to improve performance:

```python
# First load - reads from disk
template1 = manager.load_template("templates/icons/my_icon.json")

# Second load - returns cached version
template2 = manager.load_template("templates/icons/my_icon.json")

# Clear cache if needed
manager.clear_cache()
```

## Error Handling

The TemplateManager provides clear error messages:

```python
try:
    template = manager.load_template("nonexistent.json")
except FileNotFoundError as e:
    print(f"Template not found: {e}")

try:
    template = manager.load_template("invalid.json")
except ValidationError as e:
    print(f"Validation failed: {e}")

try:
    colors = manager.resolve_color_tokens(["$primary"], theme="invalid")
except ValueError as e:
    print(f"Invalid theme: {e}")
```

## API Reference

### TemplateManager

#### `__init__(templates_dir: Optional[Path] = None)`
Initialize TemplateManager with optional custom templates directory.

#### `load_template(path: Union[str, Path]) -> Template`
Load and parse template from JSON or YAML file. Automatically resolves inheritance.

#### `validate_template(template: Template) -> Dict[str, Any]`
Validate a Template object. Returns dict with `valid`, `errors`, `warnings`.

#### `validate_template_data(data: Dict[str, Any]) -> Dict[str, Any]`
Validate template data dictionary against schema.

#### `resolve_inheritance(template: Template) -> Template`
Manually resolve template inheritance (usually automatic during load).

#### `list_templates(category: Optional[str] = None) -> List[Template]`
Discover and list all templates, optionally filtered by category.

#### `resolve_color_tokens(colors: List[str], theme: str = "light") -> List[str]`
Resolve color tokens to hex codes for specified theme.

#### `get_color_tokens(theme: str = "light") -> Dict[str, str]`
Get all color tokens for a theme.

#### `add_color_token(token: str, color: str, theme: str = "light") -> None`
Add or update a custom color token.

#### `clear_cache() -> None`
Clear the template cache.

## Best Practices

1. **Use YAML for human-edited templates** - More readable, supports comments
2. **Use JSON for generated templates** - Easier to generate programmatically
3. **Create base templates** - Define common properties once, inherit everywhere
4. **Use color tokens** - Makes theme support automatic
5. **Validate early** - Check templates during development, not at runtime
6. **Cache wisely** - Clear cache when templates change during development
7. **Organize by category** - Use subdirectories: `icons/`, `brushes/`, etc.

## Examples

See the `templates/` directory for example templates:
- `templates/icons/base_icon.yaml` - Base template with common defaults
- `templates/icons/sculpt_tool.json` - Icon with inheritance and color tokens

Run `python test_example_templates.py` to see the TemplateManager in action.
