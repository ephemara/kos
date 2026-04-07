"""
Unit tests for TemplateManager

Tests template loading, validation, inheritance, and color token resolution.
"""

import pytest
import json
import yaml
from pathlib import Path
from jsonschema import ValidationError

from template_manager import TemplateManager, COLOR_TOKENS
from models import (
    Template,
    GeneratorType,
    OutputFormat,
    AlphaMode,
    AspectRatio,
)


@pytest.fixture
def temp_templates_dir(tmp_path):
    """Create temporary templates directory"""
    templates_dir = tmp_path / "templates"
    templates_dir.mkdir()
    (templates_dir / "icons").mkdir()
    (templates_dir / "brushes").mkdir()
    return templates_dir


@pytest.fixture
def template_manager(temp_templates_dir):
    """Create TemplateManager instance"""
    return TemplateManager(temp_templates_dir)


@pytest.fixture
def base_template_data():
    """Base template data for testing"""
    return {
        "name": "Test Icon",
        "description": "Test icon template",
        "generator_type": "icon",
        "category": "test",
        "tags": ["test", "icon"],
        "output_formats": ["png", "svg"],
        "dimensions": {"width": 64, "height": 64},
        "params": {"padding": 8},
    }


class TestTemplateLoading:
    """Test template loading from JSON and YAML"""

    def test_load_json_template(self, template_manager, temp_templates_dir, base_template_data):
        """Test loading JSON template"""
        template_path = temp_templates_dir / "icons" / "test.json"
        with open(template_path, "w") as f:
            json.dump(base_template_data, f)
        
        template = template_manager.load_template(template_path)
        
        assert template.name == "Test Icon"
        assert template.generator_type == GeneratorType.ICON
        assert template.category == "test"
        assert OutputFormat.PNG in template.output_formats
        assert template.dimensions["width"] == 64

    def test_load_yaml_template(self, template_manager, temp_templates_dir, base_template_data):
        """Test loading YAML template"""
        template_path = temp_templates_dir / "icons" / "test.yaml"
        with open(template_path, "w") as f:
            yaml.dump(base_template_data, f)
        
        template = template_manager.load_template(template_path)
        
        assert template.name == "Test Icon"
        assert template.generator_type == GeneratorType.ICON
        assert template.category == "test"

    def test_load_nonexistent_template(self, template_manager, temp_templates_dir):
        """Test loading nonexistent template raises error"""
        with pytest.raises(FileNotFoundError):
            template_manager.load_template(temp_templates_dir / "nonexistent.json")

    def test_load_invalid_format(self, template_manager, temp_templates_dir):
        """Test loading unsupported format raises error"""
        template_path = temp_templates_dir / "test.txt"
        template_path.write_text("invalid")
        
        with pytest.raises(ValueError, match="Unsupported template format"):
            template_manager.load_template(template_path)

    def test_json_yaml_equivalence(self, template_manager, temp_templates_dir, base_template_data):
        """Test JSON and YAML produce equivalent templates"""
        json_path = temp_templates_dir / "test.json"
        yaml_path = temp_templates_dir / "test.yaml"
        
        with open(json_path, "w") as f:
            json.dump(base_template_data, f)
        with open(yaml_path, "w") as f:
            yaml.dump(base_template_data, f)
        
        json_template = template_manager.load_template(json_path)
        yaml_template = template_manager.load_template(yaml_path)
        
        assert json_template.name == yaml_template.name
        assert json_template.generator_type == yaml_template.generator_type
        assert json_template.dimensions == yaml_template.dimensions


class TestTemplateValidation:
    """Test template validation"""

    def test_validate_valid_template(self, template_manager, base_template_data):
        """Test validation of valid template"""
        result = template_manager.validate_template_data(base_template_data)
        
        assert result["valid"] is True
        assert len(result["errors"]) == 0

    def test_validate_missing_required_field(self, template_manager):
        """Test validation fails for missing required fields"""
        invalid_data = {
            "name": "Test",
            # Missing description, generator_type, category
        }
        
        result = template_manager.validate_template_data(invalid_data)
        assert result["valid"] is False
        assert len(result["errors"]) > 0

    def test_validate_invalid_dimensions(self, template_manager, base_template_data):
        """Test validation fails for invalid dimensions"""
        base_template_data["dimensions"] = {"width": -10, "height": 64}
        
        result = template_manager.validate_template_data(base_template_data)
        assert result["valid"] is False
        # Check for either "positive" or "minimum" in error (schema validation uses "minimum")
        assert any("positive" in err.lower() or "minimum" in err.lower() for err in result["errors"])

    def test_validate_alpha_format_compatibility(self, template_manager, base_template_data):
        """Test validation of alpha mode with output formats"""
        base_template_data["alpha_mode"] = "embedded"
        base_template_data["output_formats"] = ["jpeg"]  # No transparency support
        
        result = template_manager.validate_template_data(base_template_data)
        assert result["valid"] is False
        assert any("transparency" in err.lower() for err in result["errors"])

    def test_validate_locked_aspect_ratio(self, template_manager, base_template_data):
        """Test validation of locked aspect ratio requires value"""
        base_template_data["aspect_ratio"] = "locked"
        # Missing aspect_ratio_value
        
        result = template_manager.validate_template_data(base_template_data)
        assert result["valid"] is False
        assert any("aspect_ratio_value" in err for err in result["errors"])

    def test_validate_unknown_color_token(self, template_manager, base_template_data):
        """Test validation warns about unknown color tokens"""
        base_template_data["colors"] = ["$primary", "$unknown_token"]
        
        result = template_manager.validate_template_data(base_template_data)
        assert result["valid"] is True  # Warning, not error
        assert any("unknown_token" in warn.lower() for warn in result["warnings"])


class TestTemplateInheritance:
    """Test template inheritance resolution"""

    def test_resolve_inheritance(self, template_manager, temp_templates_dir):
        """Test template inheritance resolution"""
        # Create parent template
        parent_data = {
            "name": "Base Icon",
            "description": "Base template",
            "generator_type": "icon",
            "category": "base",
            "output_formats": ["png", "svg"],
            "dimensions": {"width": 64, "height": 64},
            "params": {"padding": 8, "antialias_factor": 2},
        }
        parent_path = temp_templates_dir / "base.json"
        with open(parent_path, "w") as f:
            json.dump(parent_data, f)
        
        # Create child template
        child_data = {
            "name": "Sculpt Icon",
            "description": "Sculpt tool icon",
            "generator_type": "icon",
            "category": "toolbar",
            "parent_template": "base.json",
            "tags": ["sculpt"],
            "params": {"padding": 16},  # Override parent
        }
        child_path = temp_templates_dir / "sculpt.json"
        with open(child_path, "w") as f:
            json.dump(child_data, f)
        
        # Load child template (should merge with parent)
        template = template_manager.load_template(child_path)
        
        assert template.name == "Sculpt Icon"  # Child value
        assert template.dimensions["width"] == 64  # Inherited from parent
        assert template.params["padding"] == 16  # Child override
        assert template.params["antialias_factor"] == 2  # Inherited from parent
        assert "sculpt" in template.tags

    def test_resolve_nested_inheritance(self, template_manager, temp_templates_dir):
        """Test multi-level template inheritance"""
        # Grandparent
        grandparent_data = {
            "name": "Root",
            "description": "Root template",
            "generator_type": "icon",
            "category": "base",
            "dimensions": {"width": 32, "height": 32},
        }
        with open(temp_templates_dir / "root.json", "w") as f:
            json.dump(grandparent_data, f)
        
        # Parent
        parent_data = {
            "name": "Parent",
            "description": "Parent template",
            "generator_type": "icon",
            "category": "base",
            "parent_template": "root.json",
            "dimensions": {"width": 64, "height": 64},
        }
        with open(temp_templates_dir / "parent.json", "w") as f:
            json.dump(parent_data, f)
        
        # Child
        child_data = {
            "name": "Child",
            "description": "Child template",
            "generator_type": "icon",
            "category": "toolbar",
            "parent_template": "parent.json",
        }
        child_path = temp_templates_dir / "child.json"
        with open(child_path, "w") as f:
            json.dump(child_data, f)
        
        template = template_manager.load_template(child_path)
        
        assert template.name == "Child"
        assert template.dimensions["width"] == 64  # From parent, not grandparent

    def test_resolve_missing_parent(self, template_manager, temp_templates_dir):
        """Test error when parent template not found"""
        child_data = {
            "name": "Child",
            "description": "Child template",
            "generator_type": "icon",
            "category": "test",
            "parent_template": "nonexistent.json",
        }
        child_path = temp_templates_dir / "child.json"
        with open(child_path, "w") as f:
            json.dump(child_data, f)
        
        with pytest.raises(FileNotFoundError, match="Parent template not found"):
            template_manager.load_template(child_path)


class TestColorTokenResolution:
    """Test color token resolution"""

    def test_resolve_color_tokens_light_theme(self, template_manager):
        """Test color token resolution for light theme"""
        colors = ["$primary", "$accent", "#ff0000"]
        resolved = template_manager.resolve_color_tokens(colors, "light")
        
        assert resolved[0] == COLOR_TOKENS["light"]["$primary"]
        assert resolved[1] == COLOR_TOKENS["light"]["$accent"]
        assert resolved[2] == "#ff0000"  # Direct color unchanged

    def test_resolve_color_tokens_dark_theme(self, template_manager):
        """Test color token resolution for dark theme"""
        colors = ["$primary", "$background"]
        resolved = template_manager.resolve_color_tokens(colors, "dark")
        
        assert resolved[0] == COLOR_TOKENS["dark"]["$primary"]
        assert resolved[1] == COLOR_TOKENS["dark"]["$background"]

    def test_resolve_unknown_token(self, template_manager, capsys):
        """Test resolution of unknown token produces warning"""
        colors = ["$unknown"]
        resolved = template_manager.resolve_color_tokens(colors, "light")
        
        assert resolved[0] == "$unknown"  # Kept as-is
        captured = capsys.readouterr()
        assert "unknown" in captured.out.lower()

    def test_resolve_invalid_theme(self, template_manager):
        """Test error for invalid theme"""
        with pytest.raises(ValueError, match="Unknown theme"):
            template_manager.resolve_color_tokens(["$primary"], "invalid_theme")

    def test_get_color_tokens(self, template_manager):
        """Test getting all tokens for a theme"""
        tokens = template_manager.get_color_tokens("light")
        
        assert "$primary" in tokens
        assert "$accent" in tokens
        assert tokens["$primary"] == COLOR_TOKENS["light"]["$primary"]

    def test_add_color_token(self, template_manager):
        """Test adding custom color token"""
        template_manager.add_color_token("custom", "#123456", "light")
        
        tokens = template_manager.get_color_tokens("light")
        assert "$custom" in tokens
        assert tokens["$custom"] == "#123456"


class TestTemplateDiscovery:
    """Test template discovery and listing"""

    def test_list_all_templates(self, template_manager, temp_templates_dir, base_template_data):
        """Test listing all templates"""
        # Create multiple templates
        for i in range(3):
            template_data = base_template_data.copy()
            template_data["name"] = f"Test {i}"
            path = temp_templates_dir / "icons" / f"test{i}.json"
            with open(path, "w") as f:
                json.dump(template_data, f)
        
        templates = template_manager.list_templates()
        assert len(templates) == 3

    def test_list_templates_by_category(self, template_manager, temp_templates_dir, base_template_data):
        """Test listing templates filtered by category"""
        # Create templates in different categories
        icon_data = base_template_data.copy()
        icon_data["category"] = "icons"
        icon_path = temp_templates_dir / "icons" / "icon.json"
        with open(icon_path, "w") as f:
            json.dump(icon_data, f)
        
        brush_data = base_template_data.copy()
        brush_data["generator_type"] = "brush"
        brush_data["category"] = "brushes"
        brush_path = temp_templates_dir / "brushes" / "brush.json"
        with open(brush_path, "w") as f:
            json.dump(brush_data, f)
        
        icon_templates = template_manager.list_templates("icons")
        assert len(icon_templates) == 1
        assert icon_templates[0].category == "icons"

    def test_list_templates_skips_hidden_files(self, template_manager, temp_templates_dir, base_template_data):
        """Test that hidden files are skipped"""
        # Create normal template
        normal_path = temp_templates_dir / "icons" / "normal.json"
        with open(normal_path, "w") as f:
            json.dump(base_template_data, f)
        
        # Create hidden file
        hidden_path = temp_templates_dir / "icons" / ".hidden.json"
        with open(hidden_path, "w") as f:
            json.dump(base_template_data, f)
        
        templates = template_manager.list_templates()
        assert len(templates) == 1

    def test_list_templates_handles_invalid_files(self, template_manager, temp_templates_dir, base_template_data, capsys):
        """Test that invalid templates are skipped with warning"""
        # Create valid template
        valid_path = temp_templates_dir / "icons" / "valid.json"
        with open(valid_path, "w") as f:
            json.dump(base_template_data, f)
        
        # Create invalid template
        invalid_path = temp_templates_dir / "icons" / "invalid.json"
        with open(invalid_path, "w") as f:
            json.dump({"invalid": "data"}, f)
        
        templates = template_manager.list_templates()
        assert len(templates) == 1  # Only valid template
        
        captured = capsys.readouterr()
        assert "warning" in captured.out.lower()


class TestCaching:
    """Test template caching"""

    def test_template_caching(self, template_manager, temp_templates_dir, base_template_data):
        """Test that templates are cached"""
        template_path = temp_templates_dir / "test.json"
        with open(template_path, "w") as f:
            json.dump(base_template_data, f)
        
        # Load template twice
        template1 = template_manager.load_template(template_path)
        template2 = template_manager.load_template(template_path)
        
        # Should be same object from cache
        assert str(template_path) in template_manager._template_cache

    def test_clear_cache(self, template_manager, temp_templates_dir, base_template_data):
        """Test cache clearing"""
        template_path = temp_templates_dir / "test.json"
        with open(template_path, "w") as f:
            json.dump(base_template_data, f)
        
        template_manager.load_template(template_path)
        assert len(template_manager._template_cache) > 0
        
        template_manager.clear_cache()
        assert len(template_manager._template_cache) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
