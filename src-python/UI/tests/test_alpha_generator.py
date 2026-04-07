"""
Unit tests for Alpha Generator

Tests gradient alpha, shape-based alpha, procedural patterns,
alpha operations, and separate mask generation.
"""

import pytest
import numpy as np
from generators.alpha_generator import AlphaGenerator
from models import Template, GeneratorType, AlphaMode, OutputFormat


class TestAlphaGenerator:
    """Test suite for AlphaGenerator"""
    
    @pytest.fixture
    def generator(self):
        """Create alpha generator instance"""
        return AlphaGenerator()
    
    # ========================================================================
    # Gradient Alpha Tests
    # ========================================================================
    
    def test_linear_gradient_alpha(self, generator):
        """Test linear gradient alpha generation"""
        template = Template(
            name="test_linear_gradient",
            description="Test linear gradient alpha",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "gradient",
                "gradient_type": "linear",
                "gradient_angle": 0.0
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        assert result.dtype == np.uint8
        
        # Verify alpha channel is opaque
        assert np.all(result[:, :, 3] == 255)
        
        # Verify gradient (left to right at 0 degrees)
        # Left side should be darker, right side lighter
        left_avg = np.mean(result[:, :16, 0])
        right_avg = np.mean(result[:, 48:, 0])
        assert left_avg < right_avg
    
    def test_radial_gradient_alpha(self, generator):
        """Test radial gradient alpha generation"""
        template = Template(
            name="test_radial_gradient",
            description="Test radial gradient alpha",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "gradient",
                "gradient_type": "radial",
                "gradient_center": (0.5, 0.5)
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Verify radial gradient (center should be darker, edges lighter)
        center_val = result[32, 32, 0]
        edge_val = result[0, 0, 0]
        assert center_val < edge_val
    
    def test_angular_gradient_alpha(self, generator):
        """Test angular gradient alpha generation"""
        template = Template(
            name="test_angular_gradient",
            description="Test angular gradient alpha",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "gradient",
                "gradient_type": "angular",
                "gradient_angle": 0.0,
                "gradient_center": (0.5, 0.5)
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Verify angular gradient varies around center
        # Sample at different angles should have different values
        top = result[16, 32, 0]
        right = result[32, 48, 0]
        bottom = result[48, 32, 0]
        left = result[32, 16, 0]
        
        # At least some variation should exist
        values = [top, right, bottom, left]
        assert len(set(values)) > 1
    
    def test_gradient_with_stops(self, generator):
        """Test gradient with custom stops"""
        template = Template(
            name="test_gradient_stops",
            description="Test gradient with stops",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "gradient",
                "gradient_type": "linear",
                "gradient_angle": 0.0,
                "gradient_stops": [0.0, 0.5, 1.0]
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Gradient should still be monotonic
        left_avg = np.mean(result[:, :16, 0])
        right_avg = np.mean(result[:, 48:, 0])
        assert left_avg < right_avg
    
    # ========================================================================
    # Shape-Based Alpha Tests
    # ========================================================================
    
    def test_circle_shape_alpha(self, generator):
        """Test circular shape alpha"""
        template = Template(
            name="test_circle_shape",
            description="Test circle shape alpha",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "shape",
                "shape": "circle",
                "shape_geometry": {
                    "cx": 32,
                    "cy": 32,
                    "r": 20
                }
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Center should be opaque (white)
        assert result[32, 32, 0] > 200
        
        # Corners should be transparent (black)
        assert result[0, 0, 0] < 50
    
    def test_rect_shape_alpha(self, generator):
        """Test rectangular shape alpha"""
        template = Template(
            name="test_rect_shape",
            description="Test rect shape alpha",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "shape",
                "shape": "rect",
                "shape_geometry": {
                    "x": 16,
                    "y": 16,
                    "width": 32,
                    "height": 32
                }
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Center should be opaque
        assert result[32, 32, 0] > 200
        
        # Outside rect should be transparent
        assert result[0, 0, 0] < 50
    
    def test_shape_with_feathering(self, generator):
        """Test shape alpha with feathering"""
        template = Template(
            name="test_feathered_shape",
            description="Test feathered shape alpha",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "shape",
                "shape": "circle",
                "shape_geometry": {
                    "cx": 32,
                    "cy": 32,
                    "r": 20
                },
                "feather": 5.0
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Center should still be opaque
        assert result[32, 32, 0] > 200
        
        # Edge should have gradual transition (not hard edge)
        # Sample along radius
        edge_samples = [result[32, 32 + i, 0] for i in range(15, 25)]
        
        # Should have variation (not all same value)
        assert len(set(edge_samples)) > 3
    
    # ========================================================================
    # Procedural Alpha Tests
    # ========================================================================
    
    def test_perlin_noise_alpha(self, generator):
        """Test Perlin noise alpha generation"""
        template = Template(
            name="test_perlin_noise",
            description="Test Perlin noise alpha",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "procedural",
                "noise_type": "perlin",
                "noise_scale": 10.0,
                "noise_octaves": 4
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Verify noise has variation
        unique_values = len(np.unique(result[:, :, 0]))
        assert unique_values > 10  # Should have many different values
        
        # Verify values are in valid range
        assert np.all(result[:, :, 0] >= 0)
        assert np.all(result[:, :, 0] <= 255)
    
    def test_voronoi_noise_alpha(self, generator):
        """Test Voronoi noise alpha generation"""
        template = Template(
            name="test_voronoi_noise",
            description="Test Voronoi noise alpha",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "procedural",
                "noise_type": "voronoi",
                "noise_scale": 15.0
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Verify noise has variation
        unique_values = len(np.unique(result[:, :, 0]))
        assert unique_values > 5
    
    def test_cellular_noise_alpha(self, generator):
        """Test cellular noise alpha generation"""
        template = Template(
            name="test_cellular_noise",
            description="Test cellular noise alpha",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "procedural",
                "noise_type": "cellular",
                "noise_scale": 15.0
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Verify noise has variation
        unique_values = len(np.unique(result[:, :, 0]))
        assert unique_values > 5
    
    # ========================================================================
    # Alpha Operations Tests
    # ========================================================================
    
    def test_alpha_invert(self, generator):
        """Test alpha invert operation"""
        template = Template(
            name="test_alpha_invert",
            description="Test alpha invert",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "gradient",
                "gradient_type": "linear",
                "gradient_angle": 0.0,
                "invert": True
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Verify inversion (left should be lighter, right darker)
        left_avg = np.mean(result[:, :16, 0])
        right_avg = np.mean(result[:, 48:, 0])
        assert left_avg > right_avg  # Inverted from normal gradient
    
    def test_alpha_threshold(self, generator):
        """Test alpha threshold operation"""
        template = Template(
            name="test_alpha_threshold",
            description="Test alpha threshold",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            params={
                "type": "gradient",
                "gradient_type": "linear",
                "gradient_angle": 0.0,
                "threshold": 0.5
            }
        )
        
        result = generator.generate(template)
        
        # Verify output shape
        assert result.shape == (64, 64, 4)
        
        # Verify binary threshold (should only have 0 or 255)
        unique_values = np.unique(result[:, :, 0])
        assert len(unique_values) <= 2
        assert 0 in unique_values or 255 in unique_values
    
    def test_alpha_multiply_blend(self, generator):
        """Test alpha multiply blend operation"""
        # Create two alpha masks
        alpha1 = np.ones((64, 64), dtype=np.float32) * 0.8
        alpha2 = np.ones((64, 64), dtype=np.float32) * 0.5
        
        from models import BlendMode
        result = generator.apply_alpha_operation(alpha1, alpha2, BlendMode.MULTIPLY)
        
        # Verify multiply: 0.8 * 0.5 = 0.4
        expected = 0.4
        assert np.allclose(result, expected, atol=0.01)
    
    def test_alpha_screen_blend(self, generator):
        """Test alpha screen blend operation"""
        alpha1 = np.ones((64, 64), dtype=np.float32) * 0.5
        alpha2 = np.ones((64, 64), dtype=np.float32) * 0.5
        
        from models import BlendMode
        result = generator.apply_alpha_operation(alpha1, alpha2, BlendMode.SCREEN)
        
        # Verify screen: 1 - (1 - 0.5) * (1 - 0.5) = 1 - 0.25 = 0.75
        expected = 0.75
        assert np.allclose(result, expected, atol=0.01)
    
    # ========================================================================
    # Utility Tests
    # ========================================================================
    
    def test_alpha_from_luminance(self, generator):
        """Test alpha from luminance conversion"""
        # Create test image (gradient from black to white)
        image = np.zeros((64, 64, 3), dtype=np.uint8)
        for i in range(64):
            image[:, i, :] = int(i * 255 / 63)
        
        alpha = generator.alpha_from_luminance(image)
        
        # Verify output shape
        assert alpha.shape == (64, 64)
        
        # Verify gradient (left dark, right light)
        assert alpha[32, 0] < 0.1
        assert alpha[32, 63] > 0.9
    
    def test_dimension_validation(self, generator, tmp_path):
        """Test dimension validation between color and alpha"""
        from PIL import Image
        
        # Create test images with matching dimensions
        color_path = tmp_path / "color.png"
        alpha_path = tmp_path / "alpha.png"
        
        color_img = Image.new('RGB', (64, 64), color='white')
        alpha_img = Image.new('L', (64, 64), color='white')
        
        color_img.save(color_path)
        alpha_img.save(alpha_path)
        
        # Should pass validation
        assert generator.validate_dimensions(str(color_path), str(alpha_path))
        
        # Create mismatched dimensions
        alpha_mismatch_path = tmp_path / "alpha_mismatch.png"
        alpha_mismatch = Image.new('L', (32, 32), color='white')
        alpha_mismatch.save(alpha_mismatch_path)
        
        # Should fail validation
        assert not generator.validate_dimensions(str(color_path), str(alpha_mismatch_path))
    
    def test_separate_mask_generation(self, generator, tmp_path):
        """Test separate grayscale mask file generation"""
        template = Template(
            name="test_separate_mask",
            description="Test separate mask generation",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 64, "height": 64},
            alpha_mode=AlphaMode.SEPARATE,
            params={
                "type": "gradient",
                "gradient_type": "radial"
            }
        )
        
        output_path = tmp_path / "alpha_mask.png"
        generator.generate_separate_mask(template, str(output_path))
        
        # Verify file was created
        assert output_path.exists()
        
        # Verify it's a valid grayscale PNG
        from PIL import Image
        img = Image.open(output_path)
        assert img.mode == 'L'  # Grayscale
        assert img.size == (64, 64)
    
    # ========================================================================
    # Parameter Validation Tests
    # ========================================================================
    
    def test_invalid_alpha_type(self, generator):
        """Test validation of invalid alpha type"""
        with pytest.raises(ValueError, match="Invalid alpha type"):
            generator.validate_params({"type": "invalid_type"})
    
    def test_invalid_gradient_type(self, generator):
        """Test validation of invalid gradient type"""
        with pytest.raises(ValueError, match="Invalid gradient_type"):
            generator.validate_params({
                "type": "gradient",
                "gradient_type": "invalid_gradient"
            })
    
    def test_negative_feather(self, generator):
        """Test validation of negative feather"""
        with pytest.raises(ValueError, match="Feather must be non-negative"):
            generator.validate_params({
                "type": "shape",
                "feather": -5.0
            })
    
    def test_invalid_threshold(self, generator):
        """Test validation of invalid threshold"""
        with pytest.raises(ValueError, match="Threshold must be in"):
            generator.validate_params({
                "type": "gradient",
                "threshold": 1.5
            })
    
    def test_arbitrary_dimensions(self, generator):
        """Test alpha generation with arbitrary dimensions"""
        template = Template(
            name="test_arbitrary_dims",
            description="Test arbitrary dimensions",
            generator_type=GeneratorType.ALPHA,
            category="test",
            dimensions={"width": 128, "height": 256},
            params={
                "type": "gradient",
                "gradient_type": "linear"
            }
        )
        
        result = generator.generate(template)
        
        # Verify output matches requested dimensions
        assert result.shape == (256, 128, 4)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
