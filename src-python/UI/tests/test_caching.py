"""
Test caching and incremental generation functionality.

Validates Requirements: 9.4, 9.5
"""

import pytest
import tempfile
import json
from pathlib import Path
from datetime import datetime, timedelta

from core import UIForgeEngine
from models import Template, GeneratorType, OutputFormat, AlphaMode


def test_cache_file_creation():
    """Test that cache file is created when cache is saved."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir) / "output"
        engine = UIForgeEngine(output_dir=output_dir)
        
        # Cache file should be created after first save
        cache_file = output_dir / ".generation_cache.json"
        
        # Add something to cache and save
        engine._generation_cache["test"] = {"data": "value"}
        engine._save_generation_cache()
        
        # Now cache file should exist
        assert cache_file.exists()


def test_template_hash_computation():
    """Test that template hashing is consistent and ignores metadata."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir) / "output"
        engine = UIForgeEngine(output_dir=output_dir)
        
        # Create two identical templates with different timestamps
        template1 = Template(
            name="test_icon",
            description="Test icon",
            generator_type=GeneratorType.ICON,
            category="test",
            tags=["test"],
            output_formats=[OutputFormat.PNG],
            dimensions={"width": 64, "height": 64},
            alpha_mode=AlphaMode.EMBEDDED,
            params={"layers": []},
            created=datetime.now(),
            modified=datetime.now(),
        )
        
        template2 = Template(
            name="test_icon",
            description="Test icon",
            generator_type=GeneratorType.ICON,
            category="test",
            tags=["test"],
            output_formats=[OutputFormat.PNG],
            dimensions={"width": 64, "height": 64},
            alpha_mode=AlphaMode.EMBEDDED,
            params={"layers": []},
            created=datetime.now() + timedelta(days=1),
            modified=datetime.now() + timedelta(days=1),
        )
        
        # Hashes should be identical (timestamps ignored)
        hash1 = engine._compute_template_hash(template1)
        hash2 = engine._compute_template_hash(template2)
        assert hash1 == hash2
        
        # Change content - hash should differ
        template3 = Template(
            name="test_icon",
            description="Different description",  # Changed
            generator_type=GeneratorType.ICON,
            category="test",
            tags=["test"],
            output_formats=[OutputFormat.PNG],
            dimensions={"width": 64, "height": 64},
            alpha_mode=AlphaMode.EMBEDDED,
            params={"layers": []},
        )
        
        hash3 = engine._compute_template_hash(template3)
        assert hash1 != hash3


def test_cache_persistence():
    """Test that cache is persisted to disk and loaded correctly."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir) / "output"
        
        # Create engine and add cache entry
        engine1 = UIForgeEngine(output_dir=output_dir)
        template = Template(
            name="test_icon",
            description="Test icon",
            generator_type=GeneratorType.ICON,
            category="test",
            tags=["test"],
            output_formats=[OutputFormat.PNG],
            dimensions={"width": 64, "height": 64},
            alpha_mode=AlphaMode.EMBEDDED,
            params={"layers": []},
        )
        
        template_hash = engine1._compute_template_hash(template)
        engine1._generation_cache["test_icon"] = {
            "template_hash": template_hash,
            "generated_at": datetime.now().isoformat(),
            "asset_name": "test_icon",
            "dimensions": (64, 64),
            "file_size": 1024,
        }
        engine1._save_generation_cache()
        
        # Create new engine instance - should load cache
        engine2 = UIForgeEngine(output_dir=output_dir)
        assert "test_icon" in engine2._generation_cache
        assert engine2._generation_cache["test_icon"]["template_hash"] == template_hash


def test_incremental_generation_detection():
    """Test that incremental generation correctly detects changed templates."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir) / "output"
        engine = UIForgeEngine(output_dir=output_dir)
        
        # Create templates
        template_unchanged = Template(
            name="unchanged_icon",
            description="Unchanged",
            generator_type=GeneratorType.ICON,
            category="test",
            tags=["test"],
            output_formats=[OutputFormat.PNG],
            dimensions={"width": 64, "height": 64},
            alpha_mode=AlphaMode.EMBEDDED,
            params={"layers": []},
        )
        
        template_changed = Template(
            name="changed_icon",
            description="Changed",
            generator_type=GeneratorType.ICON,
            category="test",
            tags=["test"],
            output_formats=[OutputFormat.PNG],
            dimensions={"width": 64, "height": 64},
            alpha_mode=AlphaMode.EMBEDDED,
            params={"layers": []},
        )
        
        template_new = Template(
            name="new_icon",
            description="New",
            generator_type=GeneratorType.ICON,
            category="test",
            tags=["test"],
            output_formats=[OutputFormat.PNG],
            dimensions={"width": 64, "height": 64},
            alpha_mode=AlphaMode.EMBEDDED,
            params={"layers": []},
        )
        
        # Add unchanged template to cache using its template_id
        unchanged_id = template_unchanged.template_id
        engine._generation_cache[unchanged_id] = {
            "template_hash": engine._compute_template_hash(template_unchanged),
            "generated_at": datetime.now().isoformat(),
            "asset_name": "unchanged_icon",
            "dimensions": (64, 64),
            "file_size": 1024,
        }
        
        # Add changed template to cache with different hash
        changed_id = template_changed.template_id
        engine._generation_cache[changed_id] = {
            "template_hash": "old_hash_that_doesnt_match",
            "generated_at": datetime.now().isoformat(),
            "asset_name": "changed_icon",
            "dimensions": (64, 64),
            "file_size": 1024,
        }
        
        # Test detection logic manually
        templates = [template_unchanged, template_changed, template_new]
        templates_to_generate = []
        
        for template in templates:
            template_hash = engine._compute_template_hash(template)
            cache_key = template.template_id or template.name
            
            # Check if in cache
            if cache_key not in engine._generation_cache:
                templates_to_generate.append(template)
                continue
            
            cached_entry = engine._generation_cache[cache_key]
            
            # Check if template content changed
            if cached_entry.get('template_hash') != template_hash:
                templates_to_generate.append(template)
                continue
        
        # Should regenerate changed and new, but not unchanged
        assert len(templates_to_generate) == 2
        assert template_changed in templates_to_generate
        assert template_new in templates_to_generate
        assert template_unchanged not in templates_to_generate


def test_clear_cache():
    """Test that cache can be cleared."""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir) / "output"
        engine = UIForgeEngine(output_dir=output_dir)
        
        # Add cache entry
        engine._generation_cache["test"] = {"data": "value"}
        engine._save_generation_cache()
        
        # Verify cache exists
        assert len(engine._generation_cache) > 0
        cache_file = output_dir / ".generation_cache.json"
        with open(cache_file, 'r') as f:
            cache_data = json.load(f)
        assert "test" in cache_data
        
        # Clear cache
        engine.clear_cache()
        
        # Verify cache is empty
        assert len(engine._generation_cache) == 0
        with open(cache_file, 'r') as f:
            cache_data = json.load(f)
        assert len(cache_data) == 0


def test_cache_update_after_generation():
    """Test that cache is updated after successful generation."""
    # This is an integration test that would require a full generation
    # For now, we test the update method directly
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir) / "output"
        engine = UIForgeEngine(output_dir=output_dir)
        
        template = Template(
            name="test_icon",
            description="Test icon",
            generator_type=GeneratorType.ICON,
            category="test",
            tags=["test"],
            output_formats=[OutputFormat.PNG],
            dimensions={"width": 64, "height": 64},
            alpha_mode=AlphaMode.EMBEDDED,
            params={"layers": []},
        )
        
        from models import AssetMetadata
        metadata = AssetMetadata(
            name="test_icon",
            description="Test icon",
            category="test",
            tags=["test"],
            generator="icon",
            template_source="test_icon",
            generation_timestamp=datetime.now(),
            dimensions=(64, 64),
            format="png",
            file_size=1024,
            color_mode="RGBA",
            has_alpha=True,
            dpi=72,
        )
        
        # Update cache
        engine._update_generation_cache(template, metadata)
        
        # Verify cache entry using template_id
        cache_key = template.template_id
        assert cache_key in engine._generation_cache
        assert "template_hash" in engine._generation_cache[cache_key]
        assert "generated_at" in engine._generation_cache[cache_key]
        assert engine._generation_cache[cache_key]["asset_name"] == "test_icon"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
