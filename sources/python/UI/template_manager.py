"""
UI Forge Template Manager

Handles template loading, validation, inheritance resolution, and color token management.
Supports JSON and YAML formats with jsonschema validation.

Requirements: 3.1, 3.2, 3.3, 3.6, 3.9, 14.4
"""

import json
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import asdict
import jsonschema
from jsonschema import validate, ValidationError

from models import (
    Template,
    GeneratorType,
    OutputFormat,
    AlphaMode,
    AspectRatio,
    AnimationConfig,
    AlphaParams,
    IconParams,
    BrushParams,
    Layer,
    FillStyle,
    StrokeStyle,
    BlendMode,
    GradientType,
    StrokeCap,
    StrokeJoin,
    BrushShape,
    FalloffCurve,
    AlphaType,
    NoiseType,
    MotionType,
    AnimationEasing,
    SpriteSheetLayout,
    AnimationOutputType,
)
from themes import ThemeManager, get_theme_manager


# ============================================================================
# JSON Schema for Template Validation
# ============================================================================

TEMPLATE_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["name", "description", "generator_type", "category"],
    "properties": {
        "name": {"type": "string", "minLength": 1},
        "description": {"type": "string"},
        "generator_type": {
            "type": "string",
            "enum": ["icon", "brush", "pattern", "cursor", "overlay", "alpha"],
        },
        "category": {"type": "string", "minLength": 1},
        "tags": {"type": "array", "items": {"type": "string"}},
        "output_formats": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": ["png", "svg", "jpeg", "webp", "tiff", "bmp", "ico"],
            },
        },
        "dimensions": {
            "type": "object",
            "required": ["width", "height"],
            "properties": {
                "width": {"type": "integer", "minimum": 1},
                "height": {"type": "integer", "minimum": 1},
            },
        },
        "aspect_ratio": {
            "type": "string",
            "enum": ["fixed", "free", "locked"],
        },
        "aspect_ratio_value": {"type": "string"},
        "jpeg_quality": {"type": "integer", "minimum": 1, "maximum": 100},
        "png_compression": {"type": "integer", "minimum": 0, "maximum": 9},
        "webp_lossless": {"type": "boolean"},
        "ico_sizes": {
            "type": "array",
            "items": {"type": "integer", "minimum": 1, "maximum": 256},
            "minItems": 1,
            "uniqueItems": True,
        },
        "colors": {"type": "array", "items": {"type": "string"}},
        "theme_variants": {
            "type": "array",
            "items": {"type": "string", "enum": ["light", "dark", "high-contrast"]},
        },
        "params": {"type": "object"},
        "alpha_mode": {
            "type": "string",
            "enum": ["embedded", "separate", "both", "none"],
        },
        "alpha_params": {"type": "object"},
        "animation": {"type": "object"},
        "version": {"type": "string"},
        "parent_template": {"type": "string"},
        "author": {"type": "string"},
    },
}


# ============================================================================
# Template Manager
# ============================================================================


class TemplateManager:
    """
    Manages template loading, validation, inheritance, and color token resolution.
    
    Supports:
    - JSON and YAML template parsing
    - jsonschema validation
    - Template inheritance (parent_template field)
    - Color token resolution ($primary, $accent, etc.)
    - Template discovery from templates/ directory
    """

    def __init__(self, templates_dir: Optional[Path] = None, skip_validation: bool = True):
        """
        Initialize TemplateManager.
        
        Args:
            templates_dir: Path to templates directory (defaults to ./templates/)
            skip_validation: If True, skip schema validation (default: True for UI generation flexibility)
        """
        if templates_dir is None:
            templates_dir = Path(__file__).parent / "templates"
        self.templates_dir = Path(templates_dir)
        self._template_cache: Dict[str, Template] = {}
        self.theme_manager = get_theme_manager()
        self.skip_validation = skip_validation

    def load_template(self, path: Union[str, Path]) -> Template:
        """
        Load and parse a template from JSON or YAML file.
        
        Args:
            path: Path to template file (JSON or YAML)
            
        Returns:
            Parsed Template object
            
        Raises:
            FileNotFoundError: If template file doesn't exist
            ValueError: If template format is invalid
            ValidationError: If template fails schema validation
        """
        path = Path(path)
        
        if not path.exists():
            raise FileNotFoundError(f"Template file not found: {path}")
        
        # Parse file based on extension
        with open(path, "r", encoding="utf-8") as f:
            if path.suffix.lower() in [".yaml", ".yml"]:
                data = yaml.safe_load(f)
            elif path.suffix.lower() == ".json":
                data = json.load(f)
            else:
                raise ValueError(f"Unsupported template format: {path.suffix}")
        
        if not isinstance(data, dict):
            raise ValueError(f"Template must be a dictionary/object, got {type(data)}")
        
        # Validate against schema (skip if disabled)
        if not self.skip_validation:
            validation_result = self.validate_template_data(data)
            if not validation_result["valid"]:
                errors = "\n".join(validation_result["errors"])
                raise ValidationError(f"Template validation failed:\n{errors}")
        
        # Resolve inheritance if parent_template is specified
        if "parent_template" in data and data["parent_template"]:
            data = self._resolve_inheritance_data(data, path.parent)
        
        # Convert to Template object
        template = self._dict_to_template(data)
        
        # Cache the template
        self._template_cache[str(path)] = template
        
        return template

    def validate_template(self, template: Template) -> Dict[str, Any]:
        """
        Validate a Template object.
        
        Args:
            template: Template object to validate
            
        Returns:
            Validation result dict with 'valid' (bool) and 'errors' (list)
        """
        # Convert template to dict for schema validation
        data = asdict(template)
        return self.validate_template_data(data)

    def validate_template_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate template data against JSON schema.
        
        Args:
            data: Template data dictionary
            
        Returns:
            Dict with 'valid' (bool), 'errors' (list), 'warnings' (list)
        """
        errors = []
        warnings = []
        
        # Skip validation if disabled
        if self.skip_validation:
            return {"valid": True, "errors": [], "warnings": []}
        
        try:
            validate(instance=data, schema=TEMPLATE_SCHEMA)
        except ValidationError as e:
            errors.append(f"Schema validation error: {e.message}")
            return {"valid": False, "errors": errors, "warnings": warnings}
        
        # Additional custom validations
        
        # Check dimensions are positive (schema only checks >= 1, but we need to validate actual values)
        if "dimensions" in data:
            dims = data["dimensions"]
            width = dims.get("width", 0)
            height = dims.get("height", 0)
            if width <= 0:
                errors.append("Width must be a positive integer")
            if height <= 0:
                errors.append("Height must be a positive integer")
        
        # Check alpha mode compatibility with output formats
        alpha_mode = data.get("alpha_mode", "embedded")
        if alpha_mode in ["embedded", "both"]:
            formats = data.get("output_formats", ["png"])
            transparent_formats = {"png", "webp", "svg", "ico"}
            if not any(fmt in transparent_formats for fmt in formats):
                errors.append(
                    f"Alpha mode '{alpha_mode}' requires at least one format "
                    f"supporting transparency (png, webp, svg, or ico)"
                )
        
        # Check aspect ratio
        aspect_ratio = data.get("aspect_ratio", "fixed")
        if aspect_ratio == "locked" and not data.get("aspect_ratio_value"):
            errors.append("aspect_ratio_value required when aspect_ratio is 'locked'")
        
        # Validate color tokens
        colors = data.get("colors", [])
        for color in colors:
            if isinstance(color, str) and color.startswith("$"):
                # Check if token exists in any theme
                token_exists = False
                for theme_info in self.theme_manager.list_themes():
                    if color in theme_info.tokens:
                        token_exists = True
                        break
                
                if not token_exists:
                    warnings.append(f"Unknown color token: {color}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    def resolve_inheritance(self, template: Template) -> Template:
        """
        Resolve template inheritance by merging with parent template.
        
        Args:
            template: Template with potential parent_template reference
            
        Returns:
            Template with parent properties merged
        """
        if not template.parent_template:
            return template
        
        # Load parent template
        parent_path = self.templates_dir / template.parent_template
        if not parent_path.exists():
            # Try with common extensions
            for ext in [".json", ".yaml", ".yml"]:
                test_path = self.templates_dir / f"{template.parent_template}{ext}"
                if test_path.exists():
                    parent_path = test_path
                    break
        
        if not parent_path.exists():
            raise FileNotFoundError(f"Parent template not found: {template.parent_template}")
        
        parent = self.load_template(parent_path)
        
        # Merge parent and child (child overrides parent)
        merged_data = asdict(parent)
        child_data = asdict(template)
        
        # Deep merge dictionaries
        merged_data = self._deep_merge(merged_data, child_data)
        
        return self._dict_to_template(merged_data)

    def _resolve_inheritance_data(
        self, data: Dict[str, Any], base_dir: Path
    ) -> Dict[str, Any]:
        """
        Resolve template inheritance at the data level.
        
        Args:
            data: Template data with parent_template reference
            base_dir: Base directory for resolving relative paths
            
        Returns:
            Merged template data
        """
        parent_template = data.get("parent_template")
        if not parent_template:
            return data
        
        # Load parent template
        parent_path = base_dir / parent_template
        if not parent_path.exists():
            # Try with common extensions
            for ext in [".json", ".yaml", ".yml"]:
                test_path = base_dir / f"{parent_template}{ext}"
                if test_path.exists():
                    parent_path = test_path
                    break
        
        if not parent_path.exists():
            # Try in templates directory
            parent_path = self.templates_dir / parent_template
            if not parent_path.exists():
                for ext in [".json", ".yaml", ".yml"]:
                    test_path = self.templates_dir / f"{parent_template}{ext}"
                    if test_path.exists():
                        parent_path = test_path
                        break
        
        if not parent_path.exists():
            raise FileNotFoundError(f"Parent template not found: {parent_template}")
        
        # Load parent data
        with open(parent_path, "r", encoding="utf-8") as f:
            if parent_path.suffix.lower() in [".yaml", ".yml"]:
                parent_data = yaml.safe_load(f)
            else:
                parent_data = json.load(f)
        
        # Recursively resolve parent's inheritance
        if "parent_template" in parent_data:
            parent_data = self._resolve_inheritance_data(parent_data, parent_path.parent)
        
        # Merge parent and child (child overrides parent)
        return self._deep_merge(parent_data, data)

    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deep merge two dictionaries, with override taking precedence.
        
        Args:
            base: Base dictionary
            override: Override dictionary
            
        Returns:
            Merged dictionary
        """
        result = base.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        
        return result

    def list_templates(self, category: Optional[str] = None) -> List[Template]:
        """
        Discover and list all templates in the templates directory.
        
        Args:
            category: Optional category filter (e.g., 'icons', 'brushes')
            
        Returns:
            List of Template objects
        """
        templates = []
        
        # Determine search directory
        if category:
            search_dir = self.templates_dir / category
            if not search_dir.exists():
                return []
        else:
            search_dir = self.templates_dir
        
        # Find all template files
        for ext in ["*.json", "*.yaml", "*.yml"]:
            for template_file in search_dir.rglob(ext):
                # Skip hidden files and .gitkeep
                if template_file.name.startswith("."):
                    continue
                
                try:
                    template = self.load_template(template_file)
                    
                    # Filter by category if specified
                    if category and template.category != category:
                        continue
                    
                    templates.append(template)
                except Exception as e:
                    # Log error but continue discovering other templates
                    print(f"Warning: Failed to load template {template_file}: {e}")
        
        return templates

    def resolve_color_tokens(
        self, colors: List[str], theme: str = "light"
    ) -> List[str]:
        """
        Resolve color tokens to actual color values based on theme.
        
        Args:
            colors: List of color strings (hex codes or tokens like "$primary")
            theme: Theme variant name ('light', 'dark', 'high-contrast')
            
        Returns:
            List of resolved hex color codes
        """
        return self.theme_manager.resolve_color_tokens(colors, theme)

    def _dict_to_template(self, data: Dict[str, Any]) -> Template:
        """
        Convert dictionary to Template object with proper type conversions.
        
        Args:
            data: Template data dictionary
            
        Returns:
            Template object
        """
        # Convert enum strings to enum types
        if "generator_type" in data:
            data["generator_type"] = GeneratorType(data["generator_type"])
        
        if "output_formats" in data:
            data["output_formats"] = [OutputFormat(fmt) for fmt in data["output_formats"]]
        
        if "alpha_mode" in data:
            data["alpha_mode"] = AlphaMode(data["alpha_mode"])
        
        if "aspect_ratio" in data:
            data["aspect_ratio"] = AspectRatio(data["aspect_ratio"])
        
        # Convert nested objects
        if "alpha_params" in data and data["alpha_params"]:
            data["alpha_params"] = self._dict_to_alpha_params(data["alpha_params"])
        
        if "animation" in data and data["animation"]:
            data["animation"] = self._dict_to_animation_config(data["animation"])
        
        # Create Template object
        return Template(**data)

    def _dict_to_alpha_params(self, data: Dict[str, Any]) -> AlphaParams:
        """Convert dictionary to AlphaParams object"""
        if "type" in data:
            data["type"] = AlphaType(data["type"])
        if "noise_type" in data and data["noise_type"]:
            data["noise_type"] = NoiseType(data["noise_type"])
        if "blend_mode" in data and data["blend_mode"]:
            data["blend_mode"] = BlendMode(data["blend_mode"])
        
        return AlphaParams(**data)

    def _dict_to_animation_config(self, data: Dict[str, Any]) -> AnimationConfig:
        """Convert dictionary to AnimationConfig object"""
        if "motion_types" in data:
            data["motion_types"] = [MotionType(mt) for mt in data["motion_types"]]
        if "easing" in data:
            data["easing"] = AnimationEasing(data["easing"])
        if "output_type" in data:
            data["output_type"] = AnimationOutputType(data["output_type"])
        if "sprite_sheet_layout" in data and data["sprite_sheet_layout"]:
            data["sprite_sheet_layout"] = SpriteSheetLayout(data["sprite_sheet_layout"])
        
        return AnimationConfig(**data)

    def get_color_tokens(self, theme: str = "light") -> Dict[str, str]:
        """
        Get all color tokens for a specific theme.
        
        Args:
            theme: Theme variant name
            
        Returns:
            Dictionary of token names to hex colors
        """
        return self.theme_manager.get_theme_tokens(theme)

    def add_color_token(self, token: str, color: str, theme: str = "light") -> None:
        """
        Add or update a color token for a specific theme.
        
        Args:
            token: Token name (should start with $)
            color: Hex color code
            theme: Theme variant name
        """
        self.theme_manager.add_color_token(token, color, theme)

    def clear_cache(self) -> None:
        """Clear the template cache"""
        self._template_cache.clear()
