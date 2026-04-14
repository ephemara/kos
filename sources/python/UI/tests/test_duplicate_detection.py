"""
Tests for duplicate detection functionality in validators.py

Tests perceptual hashing, hash distance calculation, and duplicate detection.
"""

import pytest
from pathlib import Path
from PIL import Image
import numpy as np

from validators import AssetValidator


class TestPerceptualHashing:
    """Test perceptual hash computation"""
    
    def test_compute_hash_identical_images(self, tmp_path):
        """Identical images should produce identical hashes"""
        validator = AssetValidator()
        
        # Create identical images
        img1_path = tmp_path / "img1.png"
        img2_path = tmp_path / "img2.png"
        
        img = Image.new('RGB', (64, 64), color='red')
        img.save(img1_path)
        img.save(img2_path)
        
        hash1 = validator.compute_perceptual_hash(img1_path)
        hash2 = validator.compute_perceptual_hash(img2_path)
        
        assert hash1 == hash2
        assert len(hash1) == 16  # 64-bit hash as hex string
    
    def test_compute_hash_different_images(self, tmp_path):
        """Different images should produce different hashes"""
        validator = AssetValidator()
        
        # Create different images
        img1_path = tmp_path / "img1.png"
        img2_path = tmp_path / "img2.png"
        
        img1 = Image.new('RGB', (64, 64), color='red')
        img2 = Image.new('RGB', (64, 64), color='blue')
        
        img1.save(img1_path)
        img2.save(img2_path)
        
        hash1 = validator.compute_perceptual_hash(img1_path)
        hash2 = validator.compute_perceptual_hash(img2_path)
        
        assert hash1 != hash2
    
    def test_compute_hash_similar_images(self, tmp_path):
        """Similar images should produce similar hashes"""
        validator = AssetValidator()
        
        # Create similar images (same content, slightly different)
        img1_path = tmp_path / "img1.png"
        img2_path = tmp_path / "img2.png"
        
        # Create base image
        img1 = Image.new('RGB', (64, 64), color='red')
        img1.save(img1_path)
        
        # Create slightly modified version
        img2 = Image.new('RGB', (64, 64), color='red')
        pixels = img2.load()
        # Change a few pixels
        for i in range(5):
            pixels[i, i] = (255, 0, 100)
        img2.save(img2_path)
        
        hash1 = validator.compute_perceptual_hash(img1_path)
        hash2 = validator.compute_perceptual_hash(img2_path)
        
        # Hashes should be different but similar
        distance = validator.compute_hash_distance(hash1, hash2)
        assert 0 < distance < 10  # Small distance for similar images
    
    def test_compute_hash_invalid_file(self, tmp_path):
        """Invalid file should return empty hash"""
        validator = AssetValidator()
        
        invalid_path = tmp_path / "nonexistent.png"
        hash_value = validator.compute_perceptual_hash(invalid_path)
        
        assert hash_value == ""
    
    def test_compute_hash_grayscale_image(self, tmp_path):
        """Grayscale images should produce valid hashes"""
        validator = AssetValidator()
        
        img_path = tmp_path / "gray.png"
        img = Image.new('L', (64, 64), color=128)
        img.save(img_path)
        
        hash_value = validator.compute_perceptual_hash(img_path)
        
        assert len(hash_value) == 16
        assert hash_value != ""
    
    def test_compute_hash_rgba_image(self, tmp_path):
        """RGBA images should produce valid hashes"""
        validator = AssetValidator()
        
        img_path = tmp_path / "rgba.png"
        img = Image.new('RGBA', (64, 64), color=(255, 0, 0, 128))
        img.save(img_path)
        
        hash_value = validator.compute_perceptual_hash(img_path)
        
        assert len(hash_value) == 16
        assert hash_value != ""


class TestHashDistance:
    """Test hash distance calculation"""
    
    def test_distance_identical_hashes(self):
        """Identical hashes should have distance 0"""
        validator = AssetValidator()
        
        hash1 = "0123456789abcdef"
        hash2 = "0123456789abcdef"
        
        distance = validator.compute_hash_distance(hash1, hash2)
        assert distance == 0
    
    def test_distance_different_hashes(self):
        """Different hashes should have non-zero distance"""
        validator = AssetValidator()
        
        hash1 = "0000000000000000"
        hash2 = "ffffffffffffffff"
        
        distance = validator.compute_hash_distance(hash1, hash2)
        assert distance == 64  # All bits different
    
    def test_distance_single_bit_difference(self):
        """Single bit difference should have distance 1"""
        validator = AssetValidator()
        
        hash1 = "0000000000000000"
        hash2 = "0000000000000001"
        
        distance = validator.compute_hash_distance(hash1, hash2)
        assert distance == 1
    
    def test_distance_invalid_hashes(self):
        """Invalid hashes should return -1"""
        validator = AssetValidator()
        
        # Empty hash
        distance = validator.compute_hash_distance("", "0123456789abcdef")
        assert distance == -1
        
        # Invalid hex
        distance = validator.compute_hash_distance("invalid", "0123456789abcdef")
        assert distance == -1
    
    def test_distance_symmetric(self):
        """Distance should be symmetric"""
        validator = AssetValidator()
        
        hash1 = "0123456789abcdef"
        hash2 = "fedcba9876543210"
        
        distance1 = validator.compute_hash_distance(hash1, hash2)
        distance2 = validator.compute_hash_distance(hash2, hash1)
        
        assert distance1 == distance2


class TestDuplicateDetection:
    """Test duplicate detection functionality"""
    
    def test_is_duplicate_identical_images(self, tmp_path):
        """Identical images should be detected as duplicates"""
        validator = AssetValidator()
        
        # Create identical images
        img1_path = tmp_path / "img1.png"
        img2_path = tmp_path / "img2.png"
        
        img = Image.new('RGB', (64, 64), color='red')
        img.save(img1_path)
        img.save(img2_path)
        
        # First image is not a duplicate (cache is empty)
        is_dup, dup_path = validator.is_duplicate(img1_path)
        assert not is_dup
        assert dup_path is None
        
        # Second image should be detected as duplicate
        is_dup, dup_path = validator.is_duplicate(img2_path)
        assert is_dup
        assert dup_path == str(img1_path)
    
    def test_is_duplicate_different_images(self, tmp_path):
        """Different images should not be detected as duplicates"""
        validator = AssetValidator()
        
        # Create different images
        img1_path = tmp_path / "img1.png"
        img2_path = tmp_path / "img2.png"
        
        img1 = Image.new('RGB', (64, 64), color='red')
        img2 = Image.new('RGB', (64, 64), color='blue')
        
        img1.save(img1_path)
        img2.save(img2_path)
        
        # Add first image to cache
        validator.is_duplicate(img1_path)
        
        # Second image should not be duplicate
        is_dup, dup_path = validator.is_duplicate(img2_path)
        assert not is_dup
        assert dup_path is None
    
    def test_is_duplicate_similar_images_default_threshold(self, tmp_path):
        """Similar images should be detected as duplicates with default threshold"""
        validator = AssetValidator()
        
        # Create similar images
        img1_path = tmp_path / "img1.png"
        img2_path = tmp_path / "img2.png"
        
        # Create base image
        img1 = Image.new('RGB', (64, 64), color='red')
        img1.save(img1_path)
        
        # Create slightly modified version (very minor changes)
        img2 = Image.new('RGB', (64, 64), color='red')
        pixels = img2.load()
        pixels[0, 0] = (255, 0, 100)  # Change single pixel
        img2.save(img2_path)
        
        # Add first image to cache
        validator.is_duplicate(img1_path)
        
        # Second image should be detected as duplicate (default threshold = 5)
        is_dup, dup_path = validator.is_duplicate(img2_path, threshold=5)
        assert is_dup
        assert dup_path == str(img1_path)
    
    def test_is_duplicate_custom_threshold(self, tmp_path):
        """Custom threshold should affect duplicate detection"""
        validator = AssetValidator()
        
        # Create moderately different images
        img1_path = tmp_path / "img1.png"
        img2_path = tmp_path / "img2.png"
        
        img1 = Image.new('RGB', (64, 64), color='red')
        img1.save(img1_path)
        
        # Create more different version
        img2 = Image.new('RGB', (64, 64), color=(200, 0, 0))
        img2.save(img2_path)
        
        # Add first image to cache
        validator.is_duplicate(img1_path)
        
        # With strict threshold, should not be duplicate
        is_dup, _ = validator.is_duplicate(img2_path, threshold=2)
        assert not is_dup
        
        # With loose threshold, might be duplicate
        # (depends on actual hash distance)
    
    def test_is_duplicate_cache_persistence(self, tmp_path):
        """Cache should persist across multiple checks"""
        validator = AssetValidator()
        
        # Create multiple images
        img1_path = tmp_path / "img1.png"
        img2_path = tmp_path / "img2.png"
        img3_path = tmp_path / "img3.png"
        
        img = Image.new('RGB', (64, 64), color='red')
        img.save(img1_path)
        img.save(img2_path)
        img.save(img3_path)
        
        # Add first image
        validator.is_duplicate(img1_path)
        
        # Check second image (should be duplicate)
        is_dup, dup_path = validator.is_duplicate(img2_path)
        assert is_dup
        
        # Check third image (should also be duplicate of first)
        is_dup, dup_path = validator.is_duplicate(img3_path)
        assert is_dup
        assert dup_path == str(img1_path)
    
    def test_clear_cache(self, tmp_path):
        """Clear cache should remove all cached hashes"""
        validator = AssetValidator()
        
        # Create identical images
        img1_path = tmp_path / "img1.png"
        img2_path = tmp_path / "img2.png"
        
        img = Image.new('RGB', (64, 64), color='red')
        img.save(img1_path)
        img.save(img2_path)
        
        # Add first image to cache
        validator.is_duplicate(img1_path)
        assert len(validator.phash_cache) == 1
        
        # Clear cache
        validator.clear_cache()
        assert len(validator.phash_cache) == 0
        
        # Second image should not be detected as duplicate (cache is empty)
        is_dup, dup_path = validator.is_duplicate(img2_path)
        assert not is_dup
        assert dup_path is None
    
    def test_is_duplicate_invalid_file(self, tmp_path):
        """Invalid file should not be detected as duplicate"""
        validator = AssetValidator()
        
        invalid_path = tmp_path / "nonexistent.png"
        
        is_dup, dup_path = validator.is_duplicate(invalid_path)
        assert not is_dup
        assert dup_path is None


class TestDuplicateDetectionIntegration:
    """Integration tests for duplicate detection in validation workflow"""
    
    def test_duplicate_detection_in_batch(self, tmp_path):
        """Duplicate detection should work in batch validation"""
        validator = AssetValidator()
        
        # Create multiple identical images
        images = []
        for i in range(5):
            img_path = tmp_path / f"img{i}.png"
            img = Image.new('RGB', (64, 64), color='red')
            img.save(img_path)
            images.append(img_path)
        
        # Check for duplicates
        duplicates = []
        for img_path in images:
            is_dup, dup_path = validator.is_duplicate(img_path)
            if is_dup:
                duplicates.append((img_path, dup_path))
        
        # Should detect 4 duplicates (all except the first)
        assert len(duplicates) == 4
        
        # All duplicates should reference the first image
        for img_path, dup_path in duplicates:
            assert dup_path == str(images[0])
    
    def test_duplicate_detection_mixed_batch(self, tmp_path):
        """Duplicate detection should handle mixed unique and duplicate images"""
        validator = AssetValidator()
        
        # Create mix of unique and duplicate images
        img1_path = tmp_path / "img1.png"
        img2_path = tmp_path / "img2.png"  # Duplicate of img1
        img3_path = tmp_path / "img3.png"  # Unique
        img4_path = tmp_path / "img4.png"  # Duplicate of img3
        
        img1 = Image.new('RGB', (64, 64), color='red')
        img1.save(img1_path)
        img1.save(img2_path)
        
        img3 = Image.new('RGB', (64, 64), color='blue')
        img3.save(img3_path)
        img3.save(img4_path)
        
        # Check all images
        results = []
        for img_path in [img1_path, img2_path, img3_path, img4_path]:
            is_dup, dup_path = validator.is_duplicate(img_path)
            results.append((img_path.name, is_dup, dup_path))
        
        # img1: not duplicate (first)
        assert not results[0][1]
        
        # img2: duplicate of img1
        assert results[1][1]
        assert results[1][2] == str(img1_path)
        
        # img3: not duplicate (unique)
        assert not results[2][1]
        
        # img4: duplicate of img3
        assert results[3][1]
        assert results[3][2] == str(img3_path)


class TestValidationReport:
    """Test validation report generation with duplicate detection"""
    
    def test_report_includes_duplicate_info(self, tmp_path):
        """Validation report should include duplicate detection information"""
        from validators import generate_validation_report
        from models import ValidationResult
        
        # Create mock validation results
        results = [
            ValidationResult(
                passed=True,
                checks={"duplicate": False},
                errors=[],
                warnings=[],
                metrics={}
            ),
            ValidationResult(
                passed=True,
                checks={"duplicate": True},
                errors=[],
                warnings=["Duplicate of img1.png"],
                metrics={}
            ),
        ]
        
        report = generate_validation_report(results)
        
        assert "TOTAL WARNINGS: 1" in report
        assert "Duplicate of img1.png" in report


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
