# External Tool Integration Guide

## Overview

UI Forge integrates with external tools (ImageMagick, Inkscape, GIMP) to provide advanced image processing capabilities. **All external tools are optional** - the system will function without them using Pillow/numpy fallbacks.

## Supported Tools

### ImageMagick
- **Purpose**: Advanced format conversion, compositing, effects
- **Install**:
  - Windows: Download from https://imagemagick.org/script/download.php
  - macOS: `brew install imagemagick`
  - Linux: `sudo apt-get install imagemagick`
- **Fallback**: Pillow for basic operations

### Inkscape
- **Purpose**: SVG optimization and rendering
- **Install**:
  - Windows: Download from https://inkscape.org/release/
  - macOS: `brew install inkscape`
  - Linux: `sudo apt-get install inkscape`
- **Fallback**: cairosvg for basic SVG rendering

### GIMP
- **Purpose**: Complex batch processing and filter chains
- **Install**:
  - Windows: Download from https://www.gimp.org/downloads/
  - macOS: `brew install gimp`
  - Linux: `sudo apt-get install gimp`
- **Fallback**: Pillow/numpy for basic operations

## Usage

### Basic Usage

```python
from external import get_tool_manager

# Get the tool manager
manager = get_tool_manager()

# Check if a tool is available
if manager.is_tool_available('imagemagick'):
    imagemagick = manager.get_tool('imagemagick')
    imagemagick.convert('input.png', 'output.jpg', {'quality': 90})
else:
    print("ImageMagick not available, using fallback")
    # Use Pillow fallback
```

### ImageMagick Examples

```python
imagemagick = manager.get_tool('imagemagick')

# Format conversion
imagemagick.convert('input.png', 'output.jpg', {
    'quality': 90,
    'resize': (800, 600),
    'strip': True  # Remove metadata
})

# Image compositing
imagemagick.composite(
    base_path='background.png',
    overlay_path='foreground.png',
    output_path='result.png',
    mode='over',
    opacity=0.8
)

# Apply effects
imagemagick.apply_effect(
    'input.png',
    'output.png',
    effect='blur',
    radius=5,
    sigma=3
)

# Batch conversion
results = imagemagick.batch_convert(
    input_paths=['img1.png', 'img2.png', 'img3.png'],
    output_dir='output/',
    options={'format': 'jpg', 'quality': 85}
)
```

### Inkscape Examples

```python
inkscape = manager.get_tool('inkscape')

# Optimize SVG
inkscape.optimize_svg(
    'input.svg',
    'output.svg',
    options={
        'vacuum_defs': True,
        'remove_metadata': True
    }
)

# SVG to PNG
inkscape.svg_to_png(
    'icon.svg',
    'icon.png',
    width=256,
    height=256,
    dpi=96
)

# Batch SVG to PNG
results = inkscape.batch_svg_to_png(
    svg_paths=['icon1.svg', 'icon2.svg'],
    output_dir='output/',
    width=64,
    height=64
)
```

### GIMP Examples

```python
gimp = manager.get_tool('gimp')

# Batch processing
results = gimp.batch_process(
    input_paths=['img1.png', 'img2.png'],
    output_dir='output/',
    operation='blur',
    params={'radius': 5}
)

# Apply filter chain
gimp.apply_filter_chain(
    'input.png',
    'output.png',
    filters=[
        {'operation': 'blur', 'params': {'radius': 3}},
        {'operation': 'sharpen', 'params': {'sharpness': 50}},
        {'operation': 'normalize', 'params': {}}
    ]
)
```

### Graceful Degradation

```python
# Check requirements before operation
required_tools = ['imagemagick', 'inkscape']
all_available, missing = manager.check_requirements(required_tools)

if not all_available:
    for tool in missing:
        print(manager.get_fallback_message(tool, 'advanced workflow'))
    # Use fallback implementation
else:
    # Use external tools
    pass
```

### Tool Information

```python
# Get all tool information
tool_info = manager.get_tool_info()
for tool_name, info in tool_info.items():
    print(f"{tool_name}: {info['available']}, v{info['version']}")

# Get available tools only
available_tools = manager.get_available_tools()
print(f"Available: {list(available_tools.keys())}")
```

## Architecture

### Base Class: ExternalTool

All tool wrappers inherit from `ExternalTool` abstract base class:

```python
class ExternalTool(ABC):
    @abstractmethod
    def is_available(self) -> bool:
        """Check if tool is installed"""
        pass
    
    @abstractmethod
    def get_version(self) -> str:
        """Get tool version"""
        pass
    
    @abstractmethod
    def execute(self, command: List[str], ...) -> bool:
        """Execute tool command"""
        pass
```

### Tool Manager

`ExternalToolManager` provides centralized access:
- Initializes all tools at startup
- Checks availability and logs status
- Provides graceful degradation
- Returns clear error messages

## Testing

Run the test script to check tool availability:

```bash
cd src-python/UI
python test_external_tools.py
```

This will:
- Detect all available external tools
- Show version information
- Display installation instructions for missing tools
- Test requirement checking

## Integration with UI Forge

External tools are automatically initialized when UI Forge starts. Generators can check tool availability and use them when available:

```python
from external import get_tool_manager

class MyGenerator(BaseGenerator):
    def generate(self, template: Template) -> np.ndarray:
        manager = get_tool_manager()
        
        if manager.is_tool_available('imagemagick'):
            # Use ImageMagick for advanced operations
            pass
        else:
            # Use Pillow fallback
            pass
```

## Best Practices

1. **Always check availability** before using external tools
2. **Provide fallbacks** using Pillow/numpy for basic operations
3. **Log warnings** when tools are missing but operation continues
4. **Use clear error messages** when tools are required but missing
5. **Test with and without** external tools to ensure fallbacks work

## Troubleshooting

### Tool not detected
- Ensure tool is installed and in system PATH
- Check tool version compatibility
- Review logs for initialization errors

### Command execution fails
- Verify input files exist
- Check file permissions
- Review command syntax in tool documentation
- Check timeout settings for long operations

### Version issues
- Some tools have breaking changes between versions
- Check minimum version requirements
- Update tool if needed

## Future Enhancements

Potential additions:
- FFmpeg for video/animation export
- Blender CLI for 3D rendering
- Potrace for bitmap to vector conversion
- OptiPNG/PNGCrush for PNG optimization
- WebP tools for WebP optimization
