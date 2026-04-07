"""
Quick verification test for IconGenerator

Tests basic functionality:
- Generator discovery and registration
- Template parsing
- Basic icon generation with geometric primitives
"""

import sys
import os
import numpy as np
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from models import Template, GeneratorType, OutputFormat
from generator_manager import GeneratorManager
from generators.icon_generator import IconGenerator


def test_icon_generator_discovery():
    """Test that IconGenerator is discovered and registered"""
    print("Testing icon generator discovery...")
    
    manager = GeneratorManager()
    discovered = manager.discover_generators()
    
    assert GeneratorType.ICON in discovered, "IconGenerator not discovered"
    print("✓ IconGenerator discovered successfully")
    
    generator = manager.get_generator(GeneratorType.ICON)
    assert generator.generator_type == GeneratorType.ICON, "Wrong generator type"
    assert generator.__class__.__name__ == "IconGenerator", "Wrong generator class name"
    print("✓ IconGenerator instantiated correctly")


def test_simple_circle_icon():
    """Test generating a simple circle icon"""
    print("\nTesting simple circle icon generation...")
    
    # Create template
    template = Template(
        name="test_circle",
        description="Test circle icon",
        generator_type=GeneratorType.ICON,
        category="test",
        tags=["test"],
        output_formats=[OutputFormat.PNG],
        dimensions={"width": 64, "height": 64},
        params={
            "layers": [
                {
                    "type": "circle",
                    "geometry": {"cx": 32, "cy": 32, "r": 24},
                    "fill": {
                        "type": "solid",
                        "colors": ["#FF5733"]
                    },
                    "blend_mode": "normal",
                    "opacity": 1.0
                }
            ],
            "background": None,
            "padding": 4,
            "antialias_factor": 2
        }
    )
    
    # Generate icon
    generator = IconGenerator()
    result = generator.generate(template)
    
    # Verify output
    assert result.shape == (64, 64, 4), f"Wrong shape: {result.shape}"
    assert result.dtype == np.uint8, f"Wrong dtype: {result.dtype}"
    
    # Check that we have some non-zero pixels (the circle)
    assert np.any(result[:, :, 3] > 0), "No visible pixels in output"
    
    print(f"✓ Generated {result.shape} icon successfully")
    print(f"  - Non-transparent pixels: {np.sum(result[:, :, 3] > 0)}")


def test_gradient_fill():
    """Test gradient fill generation"""
    print("\nTesting gradient fill...")
    
    template = Template(
        name="test_gradient",
        description="Test gradient icon",
        generator_type=GeneratorType.ICON,
        category="test",
        tags=["test"],
        output_formats=[OutputFormat.PNG],
        dimensions={"width": 64, "height": 64},
        params={
            "layers": [
                {
                    "type": "rect",
                    "geometry": {"x": 8, "y": 8, "width": 48, "height": 48},
                    "fill": {
                        "type": "linear_gradient",
                        "colors": ["#FF0000", "#0000FF"],
                        "angle": 45
                    },
                    "blend_mode": "normal",
                    "opacity": 1.0
                }
            ],
            "background": None,
            "padding": 0,
            "antialias_factor": 2
        }
    )
    
    generator = IconGenerator()
    result = generator.generate(template)
    
    assert result.shape == (64, 64, 4), f"Wrong shape: {result.shape}"
    assert np.any(result[:, :, 3] > 0), "No visible pixels in output"
    
    print(f"✓ Generated gradient icon successfully")


def test_multiple_layers():
    """Test multiple layers with blend modes"""
    print("\nTesting multiple layers...")
    
    template = Template(
        name="test_layers",
        description="Test multi-layer icon",
        generator_type=GeneratorType.ICON,
        category="test",
        tags=["test"],
        output_formats=[OutputFormat.PNG],
        dimensions={"width": 64, "height": 64},
        params={
            "layers": [
                {
                    "type": "circle",
                    "geometry": {"cx": 32, "cy": 32, "r": 28},
                    "fill": {"type": "solid", "colors": ["#FF0000"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                {
                    "type": "circle",
                    "geometry": {"cx": 32, "cy": 32, "r": 20},
                    "fill": {"type": "solid", "colors": ["#0000FF"]},
                    "blend_mode": "normal",
                    "opacity": 0.7
                }
            ],
            "background": None,
            "padding": 4,
            "antialias_factor": 2
        }
    )
    
    generator = IconGenerator()
    result = generator.generate(template)
    
    assert result.shape == (64, 64, 4), f"Wrong shape: {result.shape}"
    assert np.any(result[:, :, 3] > 0), "No visible pixels in output"
    
    print(f"✓ Generated multi-layer icon successfully")


def test_svg_generation():
    """Test SVG output generation"""
    print("\nTesting SVG generation...")
    
    template = Template(
        name="test_svg",
        description="Test SVG icon",
        generator_type=GeneratorType.ICON,
        category="test",
        tags=["test"],
        output_formats=[OutputFormat.SVG],
        dimensions={"width": 64, "height": 64},
        params={
            "layers": [
                {
                    "type": "circle",
                    "geometry": {"cx": 32, "cy": 32, "r": 24},
                    "fill": {"type": "solid", "colors": ["#FF5733"]},
                    "stroke": {
                        "color": "#000000",
                        "width": 2,
                        "cap": "round",
                        "join": "round"
                    },
                    "blend_mode": "normal",
                    "opacity": 1.0
                }
            ],
            "background": None,
            "padding": 4,
            "antialias_factor": 1
        }
    )
    
    generator = IconGenerator()
    
    # Generate SVG to temp file
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.svg', delete=False) as f:
        svg_path = f.name
    
    try:
        generator.generate_svg(template, svg_path)
        
        # Verify SVG file was created
        assert os.path.exists(svg_path), "SVG file not created"
        
        # Read and verify SVG content
        with open(svg_path, 'r') as f:
            svg_content = f.read()
        
        assert '<svg' in svg_content, "Invalid SVG content"
        assert 'viewBox' in svg_content, "Missing viewBox"
        assert '<circle' in svg_content, "Missing circle element"
        
        print(f"✓ Generated SVG successfully ({len(svg_content)} bytes)")
        
    finally:
        # Cleanup
        if os.path.exists(svg_path):
            os.remove(svg_path)


if __name__ == "__main__":
    print("=" * 60)
    print("Icon Generator Verification Tests")
    print("=" * 60)
    
    try:
        test_icon_generator_discovery()
        test_simple_circle_icon()
        test_gradient_fill()
        test_multiple_layers()
        test_svg_generation()
        
        print("\n" + "=" * 60)
        print("✓ All tests passed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
