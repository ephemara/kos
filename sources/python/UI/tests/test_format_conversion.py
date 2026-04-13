"""
Test suite for format conversion and output functionality.

Tests Requirements: 2.7, 2.8, 17.1, 17.3, 17.4, 17.5

This test suite validates:
- All output formats (PNG, SVG, JPEG, WebP, TIFF, BMP, ICO)
- Format-specific quality parameters (JPEG quality, PNG compression, WebP lossless)
- Format compatibility validation (transparency requirements)
- Multiple format output from single template
"""

import pytest
import numpy as np
from pathlib import Path
import tempfile
import shutil
from PIL import Image

from models import (
    Template,
    OutputFormat,
    AlphaMode,
    GeneratorType,
    AspectRatio,
)
from core import (
    resolve_ico_sizes,
    save_image_format,
    validate_format_compatibility,
    UIForgeEngine,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def temp_output_dir():
    """Create temporary output directory"""
    temp_dir = Path(tempfile.mkdtemp())
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def rgba_image():
    """Create test RGBA image (64x64)"""
    # Create gradient with alpha
    image = np.zeros((64, 64, 4), dtype=np.uint8)
    for y in range(64):
        for x in range(64):
            image[y, x] = [
                int(x * 255 / 63),  # Red gradient
                int(y * 255 / 63),  # Green gradient
                128,                 # Blue constant
                int((x + y) * 255 / 126),  # Alpha gradient
            ]
    return image


@pytest.fixture
def rgb_image():
    """Create test RGB image (64x64)"""
    # Create gradient without alpha
    image = np.zeros((64, 64, 3), dtype=np.uint8)
    for y in range(64):
        for x in range(64):
            image[y, x] = [
                int(x * 255 / 63),  # Red gradient
                int(y * 255 / 63),  # Green gradient
                128,                 # Blue constant
            ]
    return image


@pytest.fixture
def grayscale_image():
    """Create test grayscale image (64x64)"""
    image = np.zeros((64, 64, 1), dtype=np.uint8)
    for y in range(64):
        for x in range(64):
            image[y, x, 0] = int((x + y) * 255 / 126)
    return image


@pytest.fixture
def basic_template():
    """Create basic template for testing"""
    return Template(
        name="test_asset",
        description="Test asset for format conversion",
        generator_type=GeneratorType.ICON,
        category="test",
        tags=["test"],
        output_formats=[OutputFormat.PNG],
        dimensions={"width": 64, "height": 64},
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [],  # Empty layers for basic template
        },
        colors=[],  # Empty array instead of None
        theme_variants=[],  # Empty array instead of None
        alpha_params=None,  # AlphaParams can be None
        animation=None,
        version="1.0",
        parent_template=None,
        template_id=None,
        created=None,
        modified=None,
        jpeg_quality=95,
        png_compression=6,
        webp_lossless=True,
        aspect_ratio=AspectRatio.FIXED,  # Use enum value
        aspect_ratio_value=None,
        author="test_author",  # Provide author to avoid None validation issue
    )


# ============================================================================
# Test Format Saving
# ============================================================================

def test_save_png_rgba(rgba_image, temp_output_dir):
    """Test saving RGBA image as PNG"""
    output_path = temp_output_dir / "test.png"
    
    success = save_image_format(
        rgba_image,
        output_path,
        OutputFormat.PNG,
        png_compression=6,
    )
    
    assert success, "PNG save should succeed"
    assert output_path.exists(), "PNG file should exist"
    
    # Verify image can be loaded and has correct properties
    img = Image.open(output_path)
    assert img.mode == 'RGBA', "PNG should preserve RGBA mode"
    assert img.size == (64, 64), "PNG should have correct dimensions"


def test_save_png_rgb(rgb_image, temp_output_dir):
    """Test saving RGB image as PNG"""
    output_path = temp_output_dir / "test.png"
    
    success = save_image_format(
        rgb_image,
        output_path,
        OutputFormat.PNG,
        png_compression=9,
    )
    
    assert success, "PNG save should succeed"
    assert output_path.exists(), "PNG file should exist"
    
    img = Image.open(output_path)
    assert img.mode == 'RGB', "PNG should preserve RGB mode"
    assert img.size == (64, 64), "PNG should have correct dimensions"


def test_save_png_grayscale(grayscale_image, temp_output_dir):
    """Test saving grayscale image as PNG"""
    output_path = temp_output_dir / "test.png"
    
    success = save_image_format(
        grayscale_image,
        output_path,
        OutputFormat.PNG,
        png_compression=6,
    )
    
    assert success, "PNG save should succeed"
    assert output_path.exists(), "PNG file should exist"
    
    img = Image.open(output_path)
    assert img.mode == 'L', "PNG should preserve grayscale mode"
    assert img.size == (64, 64), "PNG should have correct dimensions"


def test_save_jpeg_rgb(rgb_image, temp_output_dir):
    """Test saving RGB image as JPEG"""
    output_path = temp_output_dir / "test.jpeg"
    
    success = save_image_format(
        rgb_image,
        output_path,
        OutputFormat.JPEG,
        jpeg_quality=95,
    )
    
    assert success, "JPEG save should succeed"
    assert output_path.exists(), "JPEG file should exist"
    
    img = Image.open(output_path)
    assert img.mode == 'RGB', "JPEG should be RGB mode"
    assert img.size == (64, 64), "JPEG should have correct dimensions"


def test_save_jpeg_rgba_flattens_alpha(rgba_image, temp_output_dir):
    """Test saving RGBA image as JPEG flattens alpha to white background"""
    output_path = temp_output_dir / "test.jpeg"
    
    success = save_image_format(
        rgba_image,
        output_path,
        OutputFormat.JPEG,
        jpeg_quality=90,
    )
    
    assert success, "JPEG save should succeed"
    assert output_path.exists(), "JPEG file should exist"
    
    img = Image.open(output_path)
    assert img.mode == 'RGB', "JPEG should be RGB mode (alpha flattened)"
    assert img.size == (64, 64), "JPEG should have correct dimensions"


def test_save_webp_rgba(rgba_image, temp_output_dir):
    """Test saving RGBA image as WebP"""
    output_path = temp_output_dir / "test.webp"
    
    success = save_image_format(
        rgba_image,
        output_path,
        OutputFormat.WEBP,
        webp_lossless=True,
    )
    
    assert success, "WebP save should succeed"
    assert output_path.exists(), "WebP file should exist"
    
    img = Image.open(output_path)
    assert img.mode == 'RGBA', "WebP should preserve RGBA mode"
    assert img.size == (64, 64), "WebP should have correct dimensions"


def test_save_webp_lossy(rgb_image, temp_output_dir):
    """Test saving RGB image as lossy WebP"""
    output_path = temp_output_dir / "test.webp"
    
    success = save_image_format(
        rgb_image,
        output_path,
        OutputFormat.WEBP,
        webp_lossless=False,
        jpeg_quality=80,
    )
    
    assert success, "WebP save should succeed"
    assert output_path.exists(), "WebP file should exist"
    
    img = Image.open(output_path)
    assert img.size == (64, 64), "WebP should have correct dimensions"


def test_save_tiff(rgba_image, temp_output_dir):
    """Test saving image as TIFF"""
    output_path = temp_output_dir / "test.tiff"
    
    success = save_image_format(
        rgba_image,
        output_path,
        OutputFormat.TIFF,
    )
    
    assert success, "TIFF save should succeed"
    assert output_path.exists(), "TIFF file should exist"
    
    img = Image.open(output_path)
    assert img.size == (64, 64), "TIFF should have correct dimensions"


def test_save_bmp_rgb(rgb_image, temp_output_dir):
    """Test saving RGB image as BMP"""
    output_path = temp_output_dir / "test.bmp"
    
    success = save_image_format(
        rgb_image,
        output_path,
        OutputFormat.BMP,
    )
    
    assert success, "BMP save should succeed"
    assert output_path.exists(), "BMP file should exist"
    
    img = Image.open(output_path)
    assert img.mode == 'RGB', "BMP should be RGB mode"
    assert img.size == (64, 64), "BMP should have correct dimensions"


def test_save_bmp_rgba_flattens_alpha(rgba_image, temp_output_dir):
    """Test saving RGBA image as BMP flattens alpha to white background"""
    output_path = temp_output_dir / "test.bmp"
    
    success = save_image_format(
        rgba_image,
        output_path,
        OutputFormat.BMP,
    )
    
    assert success, "BMP save should succeed"
    assert output_path.exists(), "BMP file should exist"
    
    img = Image.open(output_path)
    assert img.mode == 'RGB', "BMP should be RGB mode (alpha flattened)"
    assert img.size == (64, 64), "BMP should have correct dimensions"


def test_save_ico(rgba_image, temp_output_dir):
    """Test saving image as ICO"""
    output_path = temp_output_dir / "test.ico"
    
    success = save_image_format(
        rgba_image,
        output_path,
        OutputFormat.ICO,
    )
    
    assert success, "ICO save should succeed"
    assert output_path.exists(), "ICO file should exist"
    
    img = Image.open(output_path)
    assert img.size == (64, 64), "ICO should have correct dimensions"


def test_save_ico_with_multiple_sizes(rgba_image, temp_output_dir):
    """Test saving ICO bundles multiple embedded icon sizes."""
    output_path = temp_output_dir / "test_multi.ico"

    success = save_image_format(
        rgba_image,
        output_path,
        OutputFormat.ICO,
        ico_sizes=[16, 32, 64],
    )

    assert success, "ICO save with explicit sizes should succeed"
    assert output_path.exists(), "ICO file should exist"

    img = Image.open(output_path)
    assert hasattr(img, "ico"), "ICO reader should expose icon directory"
    assert img.ico.sizes() == {(16, 16), (32, 32), (64, 64)}, "ICO should embed requested sizes"


def test_resolve_ico_sizes_uses_windows_defaults():
    """Test ICO size resolution derives a Windows-friendly bundle."""
    sizes = resolve_ico_sizes((512, 512))
    assert sizes == [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def test_resolve_ico_sizes_caps_to_image_dimensions():
    """Test ICO size resolution does not upscale beyond the source image."""
    sizes = resolve_ico_sizes((40, 40))
    assert sizes == [(16, 16), (24, 24), (32, 32), (40, 40)]


def test_save_png_compression_levels(rgb_image, temp_output_dir):
    """Test PNG compression levels affect file size"""
    # Save with low compression
    path_low = temp_output_dir / "test_low.png"
    save_image_format(rgb_image, path_low, OutputFormat.PNG, png_compression=0)
    
    # Save with high compression
    path_high = temp_output_dir / "test_high.png"
    save_image_format(rgb_image, path_high, OutputFormat.PNG, png_compression=9)
    
    # High compression should produce smaller file
    size_low = path_low.stat().st_size
    size_high = path_high.stat().st_size
    
    assert size_high < size_low, "Higher compression should produce smaller file"


def test_save_jpeg_quality_levels(rgb_image, temp_output_dir):
    """Test JPEG quality levels affect file size"""
    # Save with low quality
    path_low = temp_output_dir / "test_low.jpeg"
    save_image_format(rgb_image, path_low, OutputFormat.JPEG, jpeg_quality=50)
    
    # Save with high quality
    path_high = temp_output_dir / "test_high.jpeg"
    save_image_format(rgb_image, path_high, OutputFormat.JPEG, jpeg_quality=95)
    
    # High quality should produce larger file
    size_low = path_low.stat().st_size
    size_high = path_high.stat().st_size
    
    assert size_high > size_low, "Higher quality should produce larger file"


def test_save_creates_parent_directories(rgb_image, temp_output_dir):
    """Test that save_image_format creates parent directories"""
    nested_path = temp_output_dir / "nested" / "dir" / "test.png"
    
    success = save_image_format(
        rgb_image,
        nested_path,
        OutputFormat.PNG,
    )
    
    assert success, "Save should succeed"
    assert nested_path.exists(), "File should exist in nested directory"
    assert nested_path.parent.exists(), "Parent directories should be created"


# ============================================================================
# Test Format Compatibility Validation
# ============================================================================

def test_validate_png_with_embedded_alpha(basic_template):
    """Test PNG is compatible with embedded alpha"""
    template = basic_template
    template.output_formats = [OutputFormat.PNG]
    template.alpha_mode = AlphaMode.EMBEDDED
    
    valid, errors = validate_format_compatibility(template)
    
    assert valid, "PNG should be compatible with embedded alpha"
    assert len(errors) == 0, "Should have no errors"


def test_validate_webp_with_embedded_alpha(basic_template):
    """Test WebP is compatible with embedded alpha"""
    template = basic_template
    template.output_formats = [OutputFormat.WEBP]
    template.alpha_mode = AlphaMode.EMBEDDED
    
    valid, errors = validate_format_compatibility(template)
    
    assert valid, "WebP should be compatible with embedded alpha"
    assert len(errors) == 0, "Should have no errors"


def test_validate_svg_with_embedded_alpha(basic_template):
    """Test SVG is compatible with embedded alpha"""
    template = basic_template
    template.output_formats = [OutputFormat.SVG]
    template.alpha_mode = AlphaMode.EMBEDDED
    
    valid, errors = validate_format_compatibility(template)
    
    assert valid, "SVG should be compatible with embedded alpha"
    assert len(errors) == 0, "Should have no errors"


def test_validate_ico_with_embedded_alpha(basic_template):
    """Test ICO is compatible with embedded alpha."""
    template = basic_template
    template.output_formats = [OutputFormat.ICO]
    template.alpha_mode = AlphaMode.EMBEDDED

    valid, errors = validate_format_compatibility(template)

    assert valid, "ICO should be compatible with embedded alpha"
    assert len(errors) == 0, "Should have no errors"


def test_validate_jpeg_with_embedded_alpha_fails(basic_template):
    """Test JPEG alone is not compatible with embedded alpha"""
    template = basic_template
    template.output_formats = [OutputFormat.JPEG]
    template.alpha_mode = AlphaMode.EMBEDDED
    
    valid, errors = validate_format_compatibility(template)
    
    assert not valid, "JPEG alone should not be compatible with embedded alpha"
    assert len(errors) > 0, "Should have validation errors"
    assert "transparency" in errors[0].lower(), "Error should mention transparency"


def test_validate_bmp_with_embedded_alpha_fails(basic_template):
    """Test BMP alone is not compatible with embedded alpha"""
    template = basic_template
    template.output_formats = [OutputFormat.BMP]
    template.alpha_mode = AlphaMode.EMBEDDED
    
    valid, errors = validate_format_compatibility(template)
    
    assert not valid, "BMP alone should not be compatible with embedded alpha"
    assert len(errors) > 0, "Should have validation errors"


def test_validate_mixed_formats_with_alpha(basic_template):
    """Test mixed formats with at least one supporting transparency"""
    template = basic_template
    template.output_formats = [OutputFormat.PNG, OutputFormat.JPEG]
    template.alpha_mode = AlphaMode.EMBEDDED
    
    valid, errors = validate_format_compatibility(template)
    
    assert valid, "Mixed formats should be valid if one supports transparency"
    assert len(errors) == 0, "Should have no errors"


def test_validate_both_alpha_mode(basic_template):
    """Test BOTH alpha mode requires transparency support"""
    template = basic_template
    template.output_formats = [OutputFormat.JPEG]
    template.alpha_mode = AlphaMode.BOTH
    
    valid, errors = validate_format_compatibility(template)
    
    assert not valid, "BOTH alpha mode should require transparency support"
    assert len(errors) > 0, "Should have validation errors"


def test_validate_separate_alpha_mode_allowed(basic_template):
    """Test SEPARATE alpha mode is allowed with any format"""
    template = basic_template
    template.output_formats = [OutputFormat.JPEG]
    template.alpha_mode = AlphaMode.SEPARATE
    
    valid, errors = validate_format_compatibility(template)
    
    # SEPARATE mode generates a separate PNG mask, so JPEG is fine
    assert valid, "SEPARATE alpha mode should be allowed with any format"
    assert len(errors) == 0, "Should have no errors"


def test_validate_none_alpha_mode_allowed(basic_template):
    """Test NONE alpha mode is allowed with any format"""
    template = basic_template
    template.output_formats = [OutputFormat.JPEG]
    template.alpha_mode = AlphaMode.NONE
    
    valid, errors = validate_format_compatibility(template)
    
    assert valid, "NONE alpha mode should be allowed with any format"
    assert len(errors) == 0, "Should have no errors"


# ============================================================================
# Test Multiple Format Output
# ============================================================================

def test_multiple_format_output(basic_template, temp_output_dir):
    """Test generating multiple formats from single template"""
    # Create engine with temp directory
    engine = UIForgeEngine(output_dir=temp_output_dir)
    
    # Configure template for multiple formats
    template = basic_template
    template.output_formats = [
        OutputFormat.PNG,
        OutputFormat.JPEG,
        OutputFormat.WEBP,
    ]
    template.alpha_mode = AlphaMode.NONE  # No alpha for JPEG compatibility
    
    # Generate asset
    result = engine.generate_asset(template)
    
    assert result.success, f"Generation should succeed: {result.error}"
    assert len(result.output_paths) >= 3, "Should generate at least 3 formats"
    
    # Verify each format exists
    assert 'png' in result.output_paths, "Should have PNG output"
    assert 'jpeg' in result.output_paths, "Should have JPEG output"
    assert 'webp' in result.output_paths, "Should have WebP output"
    
    # Verify files exist
    for format_name, path_str in result.output_paths.items():
        path = Path(path_str)
        assert path.exists(), f"{format_name} file should exist at {path}"


def test_multiple_format_with_quality_params(basic_template, temp_output_dir):
    """Test format-specific quality parameters are respected"""
    engine = UIForgeEngine(output_dir=temp_output_dir)
    
    template = basic_template
    template.output_formats = [OutputFormat.PNG, OutputFormat.JPEG]
    template.alpha_mode = AlphaMode.NONE
    template.jpeg_quality = 50  # Low quality
    template.png_compression = 9  # High compression
    
    result = engine.generate_asset(template)
    
    assert result.success, "Generation should succeed"
    
    # Verify files exist and have reasonable sizes
    png_path = Path(result.output_paths['png'])
    jpeg_path = Path(result.output_paths['jpeg'])
    
    assert png_path.exists(), "PNG should exist"
    assert jpeg_path.exists(), "JPEG should exist"
    
    # Low quality JPEG should be relatively small
    jpeg_size = jpeg_path.stat().st_size
    assert jpeg_size < 50000, "Low quality JPEG should be relatively small"


def test_all_formats_output(basic_template, temp_output_dir):
    """Test generating all supported formats"""
    engine = UIForgeEngine(output_dir=temp_output_dir)
    
    template = basic_template
    template.output_formats = [
        OutputFormat.PNG,
        OutputFormat.JPEG,
        OutputFormat.WEBP,
        OutputFormat.TIFF,
        OutputFormat.BMP,
        OutputFormat.ICO,
    ]
    template.alpha_mode = AlphaMode.NONE
    
    result = engine.generate_asset(template)
    
    assert result.success, f"Generation should succeed: {result.error}"
    
    # Verify all formats were generated
    expected_formats = {'png', 'jpeg', 'webp', 'tiff', 'bmp', 'ico'}
    generated_formats = set(result.output_paths.keys())
    
    assert expected_formats.issubset(generated_formats), \
        f"Should generate all formats. Expected: {expected_formats}, Got: {generated_formats}"


# ============================================================================
# Test Error Handling
# ============================================================================

def test_invalid_channel_count():
    """Test handling of invalid channel count"""
    # Create invalid image with 2 channels
    invalid_image = np.zeros((64, 64, 2), dtype=np.uint8)
    output_path = Path(tempfile.mktemp(suffix='.png'))
    
    success = save_image_format(
        invalid_image,
        output_path,
        OutputFormat.PNG,
    )
    
    assert not success, "Should fail with invalid channel count"
    
    # Clean up
    if output_path.exists():
        output_path.unlink()


def test_svg_format_warning(rgb_image, temp_output_dir):
    """Test SVG format generates warning (should be handled by generator)"""
    output_path = temp_output_dir / "test.svg"
    
    success = save_image_format(
        rgb_image,
        output_path,
        OutputFormat.SVG,
    )
    
    assert not success, "SVG should not be saved by core engine"


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
