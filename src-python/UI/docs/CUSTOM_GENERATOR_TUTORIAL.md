# Custom Generator Tutorial

Learn how to create custom generators for UI Forge to extend the system with your own asset types.

## Table of Contents

1. [Overview](#overview)
2. [Generator Basics](#generator-basics)
3. [Step-by-Step Tutorial](#step-by-step-tutorial)
4. [Advanced Features](#advanced-features)
5. [Testing Your Generator](#testing-your-generator)
6. [Best Practices](#best-practices)

---

## Overview

UI Forge uses an auto-discovery system for generators. Any Python file in the `generators/` directory that implements the `BaseGenerator` interface will be automatically discovered and registered.

### What You'll Learn

- How to create a custom generator from scratch
- How to define generator parameters
- How to work with numpy arrays for image generation
- How to integrate with the UI Forge pipeline
- How to test and validate your generator

### Prerequisites

- Basic Python knowledge
- Understanding of numpy arrays
- Familiarity with image processing concepts
- UI Forge installed and working

---

## Generator Basics

### BaseGenerator Interface

All generators must inherit from `BaseGenerator` and implement two required methods:

```python
from generators.base import BaseGenerator
import numpy as np

class MyGenerator(BaseGenerator):
    def generate(self, template) -> np.ndarray:
        """
        Generate asset as numpy array.
        
        Args:
            template: Template object with all configuration
            
        Returns:
            numpy array with shape (height, width, 4) and dtype uint8
            Channels: RGBA (Red, Green, Blue, Alpha)
        """
        pass
    
    def supported_params(self) -> dict:
        """
        Return supported parameter schema.
        
        Returns:
            Dictionary mapping parameter names to types
        """
        pass
```

### Key Concepts

1. **Output Format**: Always return RGBA numpy array (height, width, 4)
2. **Data Type**: Use `np.uint8` (0-255 range)
3. **Dimensions**: Get from `template.dimensions['width']` and `template.dimensions['height']`
4. **Parameters**: Access via `template.params`
5. **Auto-Discovery**: Place file in `generators/` directory

---

## Step-by-Step Tutorial

Let's create a **Gradient Generator** that creates simple gradient images.

### Step 1: Create Generator File

Create `generators/gradient_generator.py`:

```python
"""
Gradient Generator
Generates simple gradient images for backgrounds and overlays.
"""

from generators.base import BaseGenerator
import numpy as np
from typing import Dict, Any

class GradientGenerator(BaseGenerator):
    """Generator for gradient images."""
    
    def generate(self, template) -> np.ndarray:
        """Generate gradient image."""
        # Get dimensions from template
        width = template.dimensions['width']
        height = template.dimensions['height']
        
        # Get parameters
        params = template.params
        gradient_type = params.get('gradient_type', 'linear')
        colors = params.get('colors', ['#000000', '#ffffff'])
        angle = params.get('angle', 0)
        
        # Create RGBA image
        image = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Generate gradient based on type
        if gradient_type == 'linear':
            image = self._generate_linear_gradient(
                width, height, colors, angle
            )
        elif gradient_type == 'radial':
            image = self._generate_radial_gradient(
                width, height, colors
            )
        else:
            raise ValueError(f"Unknown gradient type: {gradient_type}")
        
        return image
    
    def supported_params(self) -> Dict[str, type]:
        """Return supported parameters."""
        return {
            'gradient_type': str,  # 'linear' or 'radial'
            'colors': list,        # List of hex colors
            'angle': float,        # Angle for linear gradient (degrees)
        }
    
    def _generate_linear_gradient(
        self, 
        width: int, 
        height: int, 
        colors: list, 
        angle: float
    ) -> np.ndarray:
        """Generate linear gradient."""
        # Convert angle to radians
        angle_rad = np.radians(angle)
        
        # Create coordinate grids
        x = np.linspace(0, 1, width)
        y = np.linspace(0, 1, height)
        xx, yy = np.meshgrid(x, y)
        
        # Calculate gradient position based on angle
        gradient_pos = (
            xx * np.cos(angle_rad) + 
            yy * np.sin(angle_rad)
        )
        
        # Normalize to 0-1 range
        gradient_pos = (gradient_pos - gradient_pos.min()) / (
            gradient_pos.max() - gradient_pos.min()
        )
        
        # Parse colors
        start_color = self._hex_to_rgb(colors[0])
        end_color = self._hex_to_rgb(colors[1])
        
        # Interpolate colors
        image = np.zeros((height, width, 4), dtype=np.uint8)
        for i in range(3):  # RGB channels
            image[:, :, i] = (
                start_color[i] * (1 - gradient_pos) + 
                end_color[i] * gradient_pos
            ).astype(np.uint8)
        
        # Set alpha to fully opaque
        image[:, :, 3] = 255
        
        return image
    
    def _generate_radial_gradient(
        self, 
        width: int, 
        height: int, 
        colors: list
    ) -> np.ndarray:
        """Generate radial gradient."""
        # Create coordinate grids centered at image center
        x = np.linspace(-1, 1, width)
        y = np.linspace(-1, 1, height)
        xx, yy = np.meshgrid(x, y)
        
        # Calculate distance from center
        distance = np.sqrt(xx**2 + yy**2)
        
        # Normalize to 0-1 range
        distance = np.clip(distance / np.sqrt(2), 0, 1)
        
        # Parse colors
        start_color = self._hex_to_rgb(colors[0])
        end_color = self._hex_to_rgb(colors[1])
        
        # Interpolate colors
        image = np.zeros((height, width, 4), dtype=np.uint8)
        for i in range(3):  # RGB channels
            image[:, :, i] = (
                start_color[i] * (1 - distance) + 
                end_color[i] * distance
            ).astype(np.uint8)
        
        # Set alpha to fully opaque
        image[:, :, 3] = 255
        
        return image
    
    def _hex_to_rgb(self, hex_color: str) -> tuple:
        """Convert hex color to RGB tuple."""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
```

### Step 2: Create Template

Create `templates/gradients/linear_gradient.yaml`:

```yaml
name: "Linear Gradient"
description: "Simple linear gradient background"
generator_type: "gradient"
category: "backgrounds"
tags: ["gradient", "background"]

output_formats:
  - "png"

dimensions:
  width: 512
  height: 512

params:
  gradient_type: "linear"
  colors:
    - "#2563eb"
    - "#1e40af"
  angle: 45

version: "1.0"
```

### Step 3: Test Your Generator

```python
from UI.core import UIForgeEngine
from UI.template_manager import TemplateManager

# Initialize
engine = UIForgeEngine()
tm = TemplateManager()

# Load template
template = tm.load_template("templates/gradients/linear_gradient.yaml")

# Generate
result = engine.generate_asset(template)

if result.success:
    print(f"Generated: {result.output_paths}")
else:
    print(f"Error: {result.error}")
```

### Step 4: Verify Auto-Discovery

```python
from UI.generator_manager import GeneratorManager

gm = GeneratorManager()
generators = gm.discover_generators()

print("Available generators:")
for name, gen_class in generators.items():
    print(f"  - {name}: {gen_class.__name__}")
```

You should see `gradient` in the list!

---

## Advanced Features

### Parameter Validation

Add validation to ensure parameters are correct:

```python
def generate(self, template) -> np.ndarray:
    # Validate parameters
    self.validate_params(template.params)
    
    # ... rest of generation code

def validate_params(self, params: dict) -> bool:
    """Validate parameters against schema."""
    supported = self.supported_params()
    
    for key, value in params.items():
        if key not in supported:
            raise ValueError(f"Unsupported parameter: {key}")
        
        expected_type = supported[key]
        if not isinstance(value, expected_type):
            raise TypeError(
                f"Parameter '{key}' must be {expected_type}, "
                f"got {type(value)}"
            )
    
    # Custom validation
    if 'gradient_type' in params:
        valid_types = ['linear', 'radial']
        if params['gradient_type'] not in valid_types:
            raise ValueError(
                f"gradient_type must be one of {valid_types}"
            )
    
    return True
```

### Color Token Support

Integrate with the theme system:

```python
from themes import resolve_color_token

def _parse_color(self, color: str, theme: str = 'light') -> tuple:
    """Parse color with token support."""
    if color.startswith('$'):
        # Resolve color token
        color = resolve_color_token(color, theme)
    
    return self._hex_to_rgb(color)
```

### Anti-Aliasing

Add anti-aliasing for smooth edges:

```python
def generate(self, template) -> np.ndarray:
    width = template.dimensions['width']
    height = template.dimensions['height']
    
    # Get anti-aliasing factor
    aa_factor = template.params.get('antialias_factor', 2)
    
    # Generate at higher resolution
    aa_width = width * aa_factor
    aa_height = height * aa_factor
    
    # Generate high-res image
    image_aa = self._generate_gradient(aa_width, aa_height, ...)
    
    # Downsample with anti-aliasing
    from PIL import Image
    pil_image = Image.fromarray(image_aa)
    pil_image = pil_image.resize(
        (width, height), 
        Image.Resampling.LANCZOS
    )
    
    return np.array(pil_image)
```

### Progress Reporting

Report progress for long operations:

```python
def generate(self, template) -> np.ndarray:
    width = template.dimensions['width']
    height = template.dimensions['height']
    
    # Create image
    image = np.zeros((height, width, 4), dtype=np.uint8)
    
    # Process in chunks with progress
    chunk_size = 100
    for y in range(0, height, chunk_size):
        # Process chunk
        chunk_height = min(chunk_size, height - y)
        image[y:y+chunk_height] = self._process_chunk(...)
        
        # Report progress (if callback available)
        if hasattr(template, 'progress_callback'):
            progress = (y + chunk_height) / height
            template.progress_callback(progress)
    
    return image
```

### External Tool Integration

Use external tools for advanced features:

```python
from external import get_tool_manager

def generate(self, template) -> np.ndarray:
    # Generate base image
    image = self._generate_base(template)
    
    # Apply external tool if available
    manager = get_tool_manager()
    if manager.is_tool_available('imagemagick'):
        imagemagick = manager.get_tool('imagemagick')
        
        # Save temp file
        temp_path = "temp_gradient.png"
        self._save_image(image, temp_path)
        
        # Apply effect
        output_path = "temp_gradient_processed.png"
        imagemagick.apply_effect(
            temp_path,
            output_path,
            effect='blur',
            radius=5
        )
        
        # Load processed image
        image = self._load_image(output_path)
    
    return image
```

---

## Testing Your Generator

### Unit Tests

Create `tests/test_gradient_generator.py`:

```python
import pytest
import numpy as np
from generators.gradient_generator import GradientGenerator
from models import Template

def test_gradient_generator_linear():
    """Test linear gradient generation."""
    generator = GradientGenerator()
    
    template = Template(
        name="test_gradient",
        generator_type="gradient",
        dimensions={"width": 100, "height": 100},
        output_formats=["png"],
        params={
            "gradient_type": "linear",
            "colors": ["#000000", "#ffffff"],
            "angle": 0
        }
    )
    
    result = generator.generate(template)
    
    # Verify output shape
    assert result.shape == (100, 100, 4)
    assert result.dtype == np.uint8
    
    # Verify gradient (left should be darker than right)
    left_avg = result[:, 0, :3].mean()
    right_avg = result[:, -1, :3].mean()
    assert left_avg < right_avg

def test_gradient_generator_radial():
    """Test radial gradient generation."""
    generator = GradientGenerator()
    
    template = Template(
        name="test_gradient",
        generator_type="gradient",
        dimensions={"width": 100, "height": 100},
        output_formats=["png"],
        params={
            "gradient_type": "radial",
            "colors": ["#ffffff", "#000000"]
        }
    )
    
    result = generator.generate(template)
    
    # Verify output shape
    assert result.shape == (100, 100, 4)
    
    # Verify gradient (center should be lighter than edges)
    center_avg = result[50, 50, :3].mean()
    edge_avg = result[0, 0, :3].mean()
    assert center_avg > edge_avg

def test_gradient_generator_invalid_type():
    """Test error handling for invalid gradient type."""
    generator = GradientGenerator()
    
    template = Template(
        name="test_gradient",
        generator_type="gradient",
        dimensions={"width": 100, "height": 100},
        output_formats=["png"],
        params={
            "gradient_type": "invalid",
            "colors": ["#000000", "#ffffff"]
        }
    )
    
    with pytest.raises(ValueError):
        generator.generate(template)
```

### Integration Tests

Test with the full pipeline:

```python
def test_gradient_generator_integration():
    """Test gradient generator with full pipeline."""
    from UI.core import UIForgeEngine
    from UI.template_manager import TemplateManager
    
    engine = UIForgeEngine()
    tm = TemplateManager()
    
    template = tm.load_template("templates/gradients/linear_gradient.yaml")
    result = engine.generate_asset(template)
    
    assert result.success
    assert 'png' in result.output_paths
    assert result.validation.passed
```

---

## Best Practices

### 1. Use Numpy Efficiently

```python
# Good: Vectorized operations
gradient = start_color * (1 - t) + end_color * t

# Bad: Loops
for y in range(height):
    for x in range(width):
        gradient[y, x] = ...  # Slow!
```

### 2. Handle Edge Cases

```python
def generate(self, template) -> np.ndarray:
    # Validate dimensions
    width = template.dimensions.get('width')
    height = template.dimensions.get('height')
    
    if not width or not height:
        raise ValueError("Dimensions must be specified")
    
    if width <= 0 or height <= 0:
        raise ValueError("Dimensions must be positive")
    
    # Validate parameters
    params = template.params
    if 'colors' not in params:
        raise ValueError("colors parameter is required")
    
    if len(params['colors']) < 2:
        raise ValueError("At least 2 colors required for gradient")
```

### 3. Document Your Generator

```python
class GradientGenerator(BaseGenerator):
    """
    Gradient Generator
    
    Generates gradient images for backgrounds and overlays.
    
    Supported Parameters:
        gradient_type (str): Type of gradient ('linear' or 'radial')
        colors (list): List of hex colors (minimum 2)
        angle (float): Angle for linear gradient in degrees (default: 0)
    
    Examples:
        Linear gradient:
            params:
              gradient_type: "linear"
              colors: ["#000000", "#ffffff"]
              angle: 45
        
        Radial gradient:
            params:
              gradient_type: "radial"
              colors: ["#ffffff", "#000000"]
    """
```

### 4. Provide Sensible Defaults

```python
def generate(self, template) -> np.ndarray:
    params = template.params
    
    # Provide defaults
    gradient_type = params.get('gradient_type', 'linear')
    colors = params.get('colors', ['#000000', '#ffffff'])
    angle = params.get('angle', 0)
    
    # ... generation code
```

### 5. Return Proper RGBA

```python
def generate(self, template) -> np.ndarray:
    # Always return RGBA
    image = np.zeros((height, width, 4), dtype=np.uint8)
    
    # Set RGB channels
    image[:, :, :3] = rgb_data
    
    # Set alpha channel (fully opaque)
    image[:, :, 3] = 255
    
    return image
```

---

## Complete Example: Star Generator

Here's a complete example of a more complex generator:

```python
"""
Star Generator
Generates star shapes with customizable points and styling.
"""

from generators.base import BaseGenerator
import numpy as np
from typing import Dict, Any
import math

class StarGenerator(BaseGenerator):
    """Generator for star shapes."""
    
    def generate(self, template) -> np.ndarray:
        """Generate star image."""
        width = template.dimensions['width']
        height = template.dimensions['height']
        params = template.params
        
        # Get parameters with defaults
        num_points = params.get('num_points', 5)
        inner_radius = params.get('inner_radius', 0.4)
        outer_radius = params.get('outer_radius', 0.9)
        rotation = params.get('rotation', 0)
        fill_color = params.get('fill_color', '#ffff00')
        stroke_color = params.get('stroke_color', None)
        stroke_width = params.get('stroke_width', 2)
        
        # Create image
        image = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Generate star points
        points = self._generate_star_points(
            num_points, inner_radius, outer_radius, rotation
        )
        
        # Scale points to image size
        center_x, center_y = width / 2, height / 2
        scale = min(width, height) / 2
        points = [(center_x + x * scale, center_y + y * scale) 
                  for x, y in points]
        
        # Fill star
        if fill_color:
            self._fill_polygon(image, points, fill_color)
        
        # Stroke star
        if stroke_color:
            self._stroke_polygon(image, points, stroke_color, stroke_width)
        
        return image
    
    def supported_params(self) -> Dict[str, type]:
        """Return supported parameters."""
        return {
            'num_points': int,
            'inner_radius': float,
            'outer_radius': float,
            'rotation': float,
            'fill_color': str,
            'stroke_color': str,
            'stroke_width': int,
        }
    
    def _generate_star_points(
        self, 
        num_points: int, 
        inner_radius: float, 
        outer_radius: float, 
        rotation: float
    ) -> list:
        """Generate star point coordinates."""
        points = []
        angle_step = 2 * math.pi / (num_points * 2)
        rotation_rad = math.radians(rotation)
        
        for i in range(num_points * 2):
            angle = i * angle_step + rotation_rad
            radius = outer_radius if i % 2 == 0 else inner_radius
            x = radius * math.cos(angle)
            y = radius * math.sin(angle)
            points.append((x, y))
        
        return points
    
    def _fill_polygon(self, image: np.ndarray, points: list, color: str):
        """Fill polygon with color."""
        from PIL import Image, ImageDraw
        
        # Create PIL image
        pil_image = Image.fromarray(image)
        draw = ImageDraw.Draw(pil_image)
        
        # Parse color
        rgb = self._hex_to_rgb(color)
        rgba = rgb + (255,)
        
        # Draw filled polygon
        draw.polygon(points, fill=rgba)
        
        # Convert back to numpy
        image[:] = np.array(pil_image)
    
    def _stroke_polygon(
        self, 
        image: np.ndarray, 
        points: list, 
        color: str, 
        width: int
    ):
        """Stroke polygon outline."""
        from PIL import Image, ImageDraw
        
        pil_image = Image.fromarray(image)
        draw = ImageDraw.Draw(pil_image)
        
        rgb = self._hex_to_rgb(color)
        rgba = rgb + (255,)
        
        # Draw polygon outline
        draw.polygon(points, outline=rgba, width=width)
        
        image[:] = np.array(pil_image)
    
    def _hex_to_rgb(self, hex_color: str) -> tuple:
        """Convert hex color to RGB tuple."""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
```

---

## Next Steps

1. **Experiment**: Modify the gradient generator to add more features
2. **Create**: Build your own generator for a specific use case
3. **Share**: Contribute your generator back to the project
4. **Optimize**: Profile and optimize performance for large images
5. **Document**: Write comprehensive documentation for your generator

## See Also

- `../generators/base.py` - Base generator interface
- `../generators/icon_generator.py` - Complex generator example
- `TEMPLATE_SCHEMA.md` - Template field reference
- `../README.md` - Main documentation
