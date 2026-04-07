"""
Unit tests for BaseGenerator abstract class.

Tests the base generator interface, parameter validation,
and registry functionality.
"""

import pytest
import numpy as np
from typing import Dict, Any, Type, Optional
from generators.base import (
    BaseGenerator,
    GeneratorRegistry,
    register_generator,
    get_registry
)
from models import Template, GeneratorType, OutputFormat


# ============================================================================
# Mock Generator for Testing
# ============================================================================

class MockGenerator(BaseGenerator):
    """Mock generator for testing base functionality"""
    
    def _get_generator_type(self) -> GeneratorType:
        return GeneratorType.ICON
    
    def generate(self, template: Template) -> np.ndarray:
        """Generate simple solid color canvas"""
        width, height = self.get_dimensions(template)
        canvas = self.create_blank_canvas(width, height, "#FF0000")
        return canvas
    
    def supported_params(self) -> Dict[str, Type]:
        return {
            "color": str,
            "size": int,
            "optional_param": Optional[str]
        }


class InvalidGenerator(BaseGenerator):
    """Generator missing required method implementations"""
    
    def _get_generator_type(self) -> GeneratorType:
        return GeneratorType.BRUSH
    
    def generate(self, template: Template) -> np.ndarray:
        return np.zeros((64, 64, 4), dtype=np.uint8)
    
    # Missing supported_params() - should cause issues


# ============================================================================
# Test BaseGenerator Interface
# ============================================================================

def test_base_generator_is_abstract():
    """Test that BaseGenerator cannot be instantiated directly"""
    with pytest.raises(TypeError):
        BaseGenerator()


def test_mock_generator_instantiation():
    """Test that concrete generator can be instantiated"""
    gen = MockGenerator()
    assert gen.generator_type == GeneratorType.ICON
    assert isinstance(gen, BaseGenerator)


def test_generate_method():
    """Test generate() method produces valid numpy array"""
    gen = MockGenerator()
    template = Template(
        name="test",
        description="test template",
        generator_type=GeneratorType.ICON,
        category="test",
        dimensions={"width": 64, "height": 64}
    )
    
    result = gen.generate(template)
    
    # Check output shape
    assert result.shape == (64, 64, 4)
    assert result.dtype == np.uint8
    
    # Check it's red with full opacity
    assert np.all(result[:, :, 0] == 255)  # Red channel
    assert np.all(result[:, :, 1] == 0)    # Green channel
    assert np.all(result[:, :, 2] == 0)    # Blue channel
    assert np.all(result[:, :, 3] == 255)  # Alpha channel


def test_supported_params():
    """Test supported_params() returns schema"""
    gen = MockGenerator()
    schema = gen.supported_params()
    
    assert "color" in schema
    assert "size" in schema
    assert "optional_param" in schema
    assert schema["color"] == str
    assert schema["size"] == int


def test_validate_params_valid():
    """Test validate_params() accepts valid parameters"""
    gen = MockGenerator()
    params = {
        "color": "#FF0000",
        "size": 64
    }
    
    assert gen.validate_params(params) is True


def test_validate_params_with_optional():
    """Test validate_params() handles optional parameters"""
    gen = MockGenerator()
    
    # Without optional param
    params1 = {"color": "#FF0000", "size": 64}
    assert gen.validate_params(params1) is True
    
    # With optional param
    params2 = {"color": "#FF0000", "size": 64, "optional_param": "test"}
    assert gen.validate_params(params2) is True
    
    # With optional param as None
    params3 = {"color": "#FF0000", "size": 64, "optional_param": None}
    assert gen.validate_params(params3) is True


def test_validate_params_unknown_parameter():
    """Test validate_params() rejects unknown parameters"""
    gen = MockGenerator()
    params = {
        "color": "#FF0000",
        "size": 64,
        "unknown_param": "value"
    }
    
    with pytest.raises(ValueError, match="Unknown parameters"):
        gen.validate_params(params)


def test_validate_params_wrong_type():
    """Test validate_params() rejects wrong parameter types"""
    gen = MockGenerator()
    params = {
        "color": "#FF0000",
        "size": "not an int"  # Wrong type
    }
    
    with pytest.raises(ValueError, match="must be of type"):
        gen.validate_params(params)


# ============================================================================
# Test Dimension Handling
# ============================================================================

def test_get_dimensions():
    """Test get_dimensions() extracts dimensions correctly"""
    gen = MockGenerator()
    template = Template(
        name="test",
        description="test",
        generator_type=GeneratorType.ICON,
        category="test",
        dimensions={"width": 128, "height": 256}
    )
    
    width, height = gen.get_dimensions(template)
    assert width == 128
    assert height == 256


def test_get_dimensions_missing():
    """Test Template validation catches missing dimensions"""
    # Template.__post_init__ validates dimensions, so this should fail at creation
    with pytest.raises(ValueError, match="must be positive"):
        template = Template(
            name="test",
            description="test",
            generator_type=GeneratorType.ICON,
            category="test",
            dimensions={"width": 64}  # Missing height (defaults to 0)
        )

def test_get_dimensions_invalid():
    """Test Template validation catches invalid dimensions"""
    # Template.__post_init__ validates dimensions, so this should fail at creation
    with pytest.raises(ValueError, match="must be positive"):
        template = Template(
            name="test",
            description="test",
            generator_type=GeneratorType.ICON,
            category="test",
            dimensions={"width": -64, "height": 64}  # Negative width
        )


# ============================================================================
# Test Canvas Creation
# ============================================================================

def test_create_blank_canvas_transparent():
    """Test create_blank_canvas() with transparent background"""
    gen = MockGenerator()
    canvas = gen.create_blank_canvas(64, 64, background=None)
    
    assert canvas.shape == (64, 64, 4)
    assert canvas.dtype == np.uint8
    assert np.all(canvas == 0)  # All zeros for transparent


def test_create_blank_canvas_colored():
    """Test create_blank_canvas() with colored background"""
    gen = MockGenerator()
    canvas = gen.create_blank_canvas(64, 64, background="#FF5733")
    
    assert canvas.shape == (64, 64, 4)
    assert canvas.dtype == np.uint8
    
    # Check color (FF5733 = RGB(255, 87, 51))
    assert np.all(canvas[:, :, 0] == 255)  # Red
    assert np.all(canvas[:, :, 1] == 87)   # Green
    assert np.all(canvas[:, :, 2] == 51)   # Blue
    assert np.all(canvas[:, :, 3] == 255)  # Alpha


# ============================================================================
# Test Color Parsing
# ============================================================================

def test_parse_hex_color_6_digit():
    """Test _parse_hex_color() with 6-digit hex"""
    gen = MockGenerator()
    
    r, g, b = gen._parse_hex_color("#FF5733")
    assert (r, g, b) == (255, 87, 51)
    
    r, g, b = gen._parse_hex_color("FF5733")  # Without #
    assert (r, g, b) == (255, 87, 51)


def test_parse_hex_color_3_digit():
    """Test _parse_hex_color() with 3-digit hex"""
    gen = MockGenerator()
    
    r, g, b = gen._parse_hex_color("#F57")
    assert (r, g, b) == (255, 85, 119)  # F57 -> FF5577


def test_parse_hex_color_invalid():
    """Test _parse_hex_color() with invalid format"""
    gen = MockGenerator()
    
    with pytest.raises(ValueError, match="Invalid hex color format"):
        gen._parse_hex_color("#GGGGGG")
    
    with pytest.raises(ValueError, match="Invalid hex color format"):
        gen._parse_hex_color("#FF")


# ============================================================================
# Test Generator Registry
# ============================================================================

def test_registry_register():
    """Test GeneratorRegistry.register()"""
    registry = GeneratorRegistry()
    registry.register(MockGenerator)
    
    assert registry.is_registered(GeneratorType.ICON)
    assert GeneratorType.ICON in registry.list_types()


def test_registry_get():
    """Test GeneratorRegistry.get()"""
    registry = GeneratorRegistry()
    registry.register(MockGenerator)
    
    gen_class = registry.get(GeneratorType.ICON)
    assert gen_class == MockGenerator
    
    # Should be able to instantiate
    gen = gen_class()
    assert isinstance(gen, MockGenerator)


def test_registry_get_unregistered():
    """Test GeneratorRegistry.get() with unregistered type"""
    registry = GeneratorRegistry()
    
    with pytest.raises(KeyError, match="No generator registered"):
        registry.get(GeneratorType.BRUSH)


def test_registry_duplicate_registration():
    """Test GeneratorRegistry rejects duplicate registration"""
    registry = GeneratorRegistry()
    registry.register(MockGenerator)
    
    # Try to register another generator with same type
    class AnotherIconGenerator(BaseGenerator):
        def _get_generator_type(self):
            return GeneratorType.ICON
        
        def generate(self, template):
            return np.zeros((64, 64, 4), dtype=np.uint8)
        
        def supported_params(self):
            return {}
    
    with pytest.raises(ValueError, match="already registered"):
        registry.register(AnotherIconGenerator)


def test_register_decorator():
    """Test @register_generator decorator"""
    # Create a fresh registry for this test
    test_registry = GeneratorRegistry()
    
    # Manually register using the decorator pattern
    @register_generator
    class DecoratedGenerator(BaseGenerator):
        def _get_generator_type(self):
            return GeneratorType.PATTERN
        
        def generate(self, template):
            return np.zeros((64, 64, 4), dtype=np.uint8)
        
        def supported_params(self):
            return {}
    
    # Check it was registered in global registry
    global_registry = get_registry()
    assert global_registry.is_registered(GeneratorType.PATTERN)


def test_global_registry():
    """Test get_registry() returns singleton"""
    registry1 = get_registry()
    registry2 = get_registry()
    
    assert registry1 is registry2  # Same instance


# ============================================================================
# Test String Representation
# ============================================================================

def test_repr():
    """Test __repr__() method"""
    gen = MockGenerator()
    repr_str = repr(gen)
    
    assert "MockGenerator" in repr_str
    assert "icon" in repr_str.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])