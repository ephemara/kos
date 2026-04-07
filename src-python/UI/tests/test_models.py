"""
Basic validation tests for template data models.

Tests that the dataclass models can be instantiated and validated correctly.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from UI.models import (
    Template, GeneratorType, OutputFormat, AlphaMode, AspectRatio,
    IconParams, Layer, FillStyle, StrokeStyle, GradientType, BlendMode, StrokeCap, StrokeJoin,
    BrushParams, BrushShape, FalloffCurve,
    AlphaParams, AlphaType, NoiseType,
    AnimationConfig, MotionType, AnimationEasing, AnimationOutputType,
    AssetMetadata, GenerationResult, ValidationResult, ProgressInfo
)
from datetime import datetime


def test_basic_template_creation():
    """Test creating a basic template"""
    template = Template(
        name="Test Icon",
        description="A test icon template",
        generator_type=GeneratorType.ICON,
        category="test",
        tags=["test", "icon"],
        output_formats=[OutputFormat.PNG, OutputFormat.SVG],
        dimensions={"width": 64, "height": 64}
    )
    
    assert template.name == "Test Icon"
    assert template.generator_type == GeneratorType.ICON
    assert len(template.output_formats) == 2
    assert template.dimensions["width"] == 64
    assert template.template_id is not None  # Auto-generated
    print("✓ Basic template creation works")


def test_icon_params():
    """Test IconParams with layers"""
    fill = FillStyle(
        type=GradientType.SOLID,
        colors=["#FF0000"]
    )
    
    stroke = StrokeStyle(
        color="#000000",
        width=2.0,
        cap=StrokeCap.ROUND,
        join=StrokeJoin.ROUND
    )
    
    layer = Layer(
        type="circle",
        geometry={"cx": 32, "cy": 32, "r": 24},
        fill=fill,
        stroke=stroke,
        blend_mode=BlendMode.NORMAL,
        opacity=1.0
    )
    
    icon_params = IconParams(
        layers=[layer],
        background=None,
        padding=8,
        antialias_factor=2
    )
    
    assert len(icon_params.layers) == 1
    assert icon_params.layers[0].type == "circle"
    assert icon_params.padding == 8
    print("✓ IconParams with layers works")


def test_brush_params():
    """Test BrushParams"""
    brush_params = BrushParams(
        shape=BrushShape.CIRCULAR,
        size=64,
        hardness=0.8,
        spacing=0.25,
        falloff_curve=FalloffCurve.SMOOTH,
        stroke_preview=True
    )
    
    assert brush_params.shape == BrushShape.CIRCULAR
    assert brush_params.size == 64
    assert brush_params.hardness == 0.8
    print("✓ BrushParams works")


def test_alpha_params():
    """Test AlphaParams"""
    alpha_params = AlphaParams(
        type=AlphaType.GRADIENT,
        gradient_type="radial",
        gradient_center=(0.5, 0.5),
        invert=False
    )
    
    assert alpha_params.type == AlphaType.GRADIENT
    assert alpha_params.gradient_type == "radial"
    assert alpha_params.gradient_center == (0.5, 0.5)
    print("✓ AlphaParams works")


def test_animation_config():
    """Test AnimationConfig"""
    animation = AnimationConfig(
        enabled=True,
        motion_types=[MotionType.ORBIT, MotionType.PULSE],
        duration=2.0,
        fps=30,
        loop=True,
        easing=AnimationEasing.EASE_IN_OUT,
        output_type=AnimationOutputType.SVG_SMIL
    )
    
    assert animation.enabled is True
    assert len(animation.motion_types) == 2
    assert animation.duration == 2.0
    assert animation.fps == 30
    print("✓ AnimationConfig works")


def test_template_with_animation():
    """Test template with animation configuration"""
    animation = AnimationConfig(
        enabled=True,
        motion_types=[MotionType.FLOAT],
        duration=1.5,
        fps=30,
        loop=True
    )
    
    template = Template(
        name="Animated Icon",
        description="An animated icon",
        generator_type=GeneratorType.ICON,
        category="animated",
        output_formats=[OutputFormat.SVG],
        dimensions={"width": 128, "height": 128},
        animation=animation
    )
    
    assert template.animation is not None
    assert template.animation.enabled is True
    assert template.animation.motion_types[0] == MotionType.FLOAT
    print("✓ Template with animation works")


def test_template_validation_positive_dimensions():
    """Test that template validates positive dimensions"""
    try:
        template = Template(
            name="Invalid",
            description="Invalid dimensions",
            generator_type=GeneratorType.ICON,
            category="test",
            dimensions={"width": -10, "height": 64}
        )
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "positive integers" in str(e)
        print("✓ Template validates positive dimensions")


def test_template_validation_alpha_format_compatibility():
    """Test that template validates alpha mode with format compatibility"""
    try:
        template = Template(
            name="Invalid Alpha",
            description="Alpha without transparent format",
            generator_type=GeneratorType.ICON,
            category="test",
            output_formats=[OutputFormat.JPEG],  # JPEG doesn't support transparency
            alpha_mode=AlphaMode.EMBEDDED
        )
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "transparency" in str(e)
        print("✓ Template validates alpha format compatibility")


def test_arbitrary_dimensions():
    """Test that templates support arbitrary dimensions"""
    template = Template(
        name="Custom Size",
        description="Custom dimensions",
        generator_type=GeneratorType.ICON,
        category="test",
        dimensions={"width": 1920, "height": 1080}  # Arbitrary size
    )
    
    assert template.dimensions["width"] == 1920
    assert template.dimensions["height"] == 1080
    print("✓ Arbitrary dimensions supported")


def test_multi_format_output():
    """Test that templates support multiple output formats"""
    template = Template(
        name="Multi-format",
        description="Multiple formats",
        generator_type=GeneratorType.ICON,
        category="test",
        output_formats=[
            OutputFormat.PNG,
            OutputFormat.SVG,
            OutputFormat.WEBP,
            OutputFormat.JPEG
        ],
        dimensions={"width": 256, "height": 256}
    )
    
    assert len(template.output_formats) == 4
    assert OutputFormat.PNG in template.output_formats
    assert OutputFormat.SVG in template.output_formats
    print("✓ Multi-format output supported")


def test_template_ico_sizes_validation_and_normalization():
    """Test ICO sizes are accepted, deduplicated, and sorted."""
    template = Template(
        name="Windows Icon",
        description="ICO bundle",
        generator_type=GeneratorType.ICON,
        category="test",
        output_formats=[OutputFormat.ICO],
        ico_sizes=[64, 16, 32, 32],
        dimensions={"width": 256, "height": 256},
    )

    assert template.ico_sizes == [16, 32, 64]
    print("✓ ICO sizes normalize correctly")


def test_template_ico_sizes_reject_invalid_values():
    """Test ICO sizes reject unsupported values."""
    try:
        Template(
            name="Invalid ICO",
            description="Bad ico sizes",
            generator_type=GeneratorType.ICON,
            category="test",
            output_formats=[OutputFormat.ICO],
            ico_sizes=[0, 512],
            dimensions={"width": 256, "height": 256},
        )
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "ico_sizes" in str(e)
        print("✓ ICO sizes validate supported range")


def test_asset_metadata():
    """Test AssetMetadata creation"""
    metadata = AssetMetadata(
        name="test-icon",
        description="Test icon",
        category="icons",
        tags=["test"],
        generator="icon_generator",
        template_source="test_template.json",
        generation_timestamp=datetime.now(),
        dimensions=(64, 64),
        format="png",
        file_size=2048,
        color_mode="RGBA",
        has_alpha=True,
        dpi=72
    )
    
    assert metadata.name == "test-icon"
    assert metadata.dimensions == (64, 64)
    assert metadata.has_alpha is True
    print("✓ AssetMetadata works")


def test_generation_result():
    """Test GenerationResult creation"""
    metadata = AssetMetadata(
        name="test",
        description="Test",
        category="test",
        tags=[],
        generator="test",
        template_source="test.json",
        generation_timestamp=datetime.now(),
        dimensions=(64, 64),
        format="png",
        file_size=1024,
        color_mode="RGBA",
        has_alpha=True,
        dpi=72
    )
    
    result = GenerationResult(
        success=True,
        asset_id="test-001",
        template_name="Test Template",
        output_paths={"png": "/path/to/output.png"},
        metadata=metadata,
        generation_time=0.5
    )
    
    assert result.success is True
    assert result.asset_id == "test-001"
    assert "png" in result.output_paths
    print("✓ GenerationResult works")


def run_all_tests():
    """Run all validation tests"""
    print("\n=== Running Template Data Model Tests ===\n")
    
    test_basic_template_creation()
    test_icon_params()
    test_brush_params()
    test_alpha_params()
    test_animation_config()
    test_template_with_animation()
    test_template_validation_positive_dimensions()
    test_template_validation_alpha_format_compatibility()
    test_arbitrary_dimensions()
    test_multi_format_output()
    test_template_ico_sizes_validation_and_normalization()
    test_template_ico_sizes_reject_invalid_values()
    test_asset_metadata()
    test_generation_result()
    
    print("\n=== All Tests Passed! ===\n")


if __name__ == "__main__":
    run_all_tests()
