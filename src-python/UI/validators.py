"""
UI Forge Asset Validators

Comprehensive validation system for generated UI assets.
Validates technical properties, quality metrics, and compliance with specifications.

Validation Categories:
- Alpha channel validation (PNG/WebP)
- SVG structure and rendering validation
- Dimension validation against template specs
- File size validation (icons < 100KB, brushes < 500KB, SVG < 50KB)
- Color mode validation (RGBA vs RGB)
- DPI validation (72 DPI for screen assets)
- Perceptual duplicate detection
- Quality metrics (artifacts, banding, aliasing)

Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.8, 10.9
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
import xml.etree.ElementTree as ET
from PIL import Image
import numpy as np

from models import (
    ValidationResult,
    Template,
    OutputFormat,
    AlphaMode,
    GeneratorType
)


# ============================================================================
# Validation Configuration
# ============================================================================

# File size limits (bytes)
FILE_SIZE_LIMITS = {
    GeneratorType.ICON: 100 * 1024,      # 100KB for icons
    GeneratorType.BRUSH: 500 * 1024,     # 500KB for brushes
    GeneratorType.PATTERN: 500 * 1024,   # 500KB for patterns
    GeneratorType.CURSOR: 100 * 1024,    # 100KB for cursors
    GeneratorType.OVERLAY: 200 * 1024,   # 200KB for overlays
    GeneratorType.ALPHA: 100 * 1024,     # 100KB for alpha masks
}

# SVG file size limit
SVG_SIZE_LIMIT = 50 * 1024  # 50KB for SVG files

# Expected DPI for screen assets
SCREEN_DPI = 72

# Perceptual hash size for duplicate detection
PHASH_SIZE = 8


# ============================================================================
# Validator Class
# ============================================================================

class AssetValidator:
    """
    Comprehensive asset validation system.
    
    Validates generated assets against quality standards and template specifications.
    Returns structured validation results with errors, warnings, and quality metrics.
    """
    
    def __init__(self):
        """Initialize validator"""
        self.phash_cache: Dict[str, str] = {}  # Cache for perceptual hashes
    
    def validate_asset(
        self,
        file_path: Path,
        template: Template,
        output_format: OutputFormat
    ) -> ValidationResult:
        """
        Validate a generated asset against template specifications.
        
        Args:
            file_path: Path to generated asset file
            template: Template used for generation
            output_format: Output format of the asset
            
        Returns:
            ValidationResult with pass/fail status, errors, warnings, and metrics
        """
        checks: Dict[str, bool] = {}
        errors: List[str] = []
        warnings: List[str] = []
        metrics: Dict[str, Any] = {}
        
        # Check file exists
        if not file_path.exists():
            errors.append(f"Asset file not found: {file_path}")
            return ValidationResult(
                passed=False,
                checks={"file_exists": False},
                errors=errors,
                warnings=warnings,
                metrics=metrics
            )
        
        checks["file_exists"] = True
        
        # File size validation
        file_size = file_path.stat().st_size
        metrics["file_size_bytes"] = file_size
        
        if output_format == OutputFormat.SVG:
            size_check = self._validate_svg_file_size(file_size, errors, warnings)
            checks["file_size"] = size_check
        else:
            size_check = self._validate_raster_file_size(
                file_size, template.generator_type, errors, warnings
            )
            checks["file_size"] = size_check
        
        # Format-specific validation
        if output_format == OutputFormat.SVG:
            self._validate_svg(file_path, template, checks, errors, warnings, metrics)
        else:
            self._validate_raster(
                file_path, template, output_format, checks, errors, warnings, metrics
            )
        
        # Determine overall pass/fail
        passed = all(checks.values()) and len(errors) == 0
        
        return ValidationResult(
            passed=passed,
            checks=checks,
            errors=errors,
            warnings=warnings,
            metrics=metrics
        )
    
    # ========================================================================
    # File Size Validation
    # ========================================================================
    
    def _validate_svg_file_size(
        self,
        file_size: int,
        errors: List[str],
        warnings: List[str]
    ) -> bool:
        """Validate SVG file size"""
        if file_size > SVG_SIZE_LIMIT:
            errors.append(
                f"SVG file size ({file_size / 1024:.1f}KB) exceeds limit "
                f"({SVG_SIZE_LIMIT / 1024:.0f}KB)"
            )
            return False
        
        # Warning if approaching limit
        if file_size > SVG_SIZE_LIMIT * 0.8:
            warnings.append(
                f"SVG file size ({file_size / 1024:.1f}KB) is approaching limit "
                f"({SVG_SIZE_LIMIT / 1024:.0f}KB)"
            )
        
        return True
    
    def _validate_raster_file_size(
        self,
        file_size: int,
        generator_type: GeneratorType,
        errors: List[str],
        warnings: List[str]
    ) -> bool:
        """Validate raster image file size"""
        limit = FILE_SIZE_LIMITS.get(generator_type, 500 * 1024)
        
        if file_size > limit:
            errors.append(
                f"File size ({file_size / 1024:.1f}KB) exceeds limit for "
                f"{generator_type.value} ({limit / 1024:.0f}KB)"
            )
            return False
        
        # Warning if approaching limit
        if file_size > limit * 0.8:
            warnings.append(
                f"File size ({file_size / 1024:.1f}KB) is approaching limit "
                f"({limit / 1024:.0f}KB)"
            )
        
        return True
    
    # ========================================================================
    # SVG Validation
    # ========================================================================
    
    def _validate_svg(
        self,
        file_path: Path,
        template: Template,
        checks: Dict[str, bool],
        errors: List[str],
        warnings: List[str],
        metrics: Dict[str, Any]
    ) -> None:
        """Validate SVG file structure and rendering"""
        try:
            # Parse SVG
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # Extract namespace
            ns = {'svg': 'http://www.w3.org/2000/svg'}
            if root.tag.startswith('{'):
                ns['svg'] = root.tag.split('}')[0][1:]
            
            # Validate viewBox
            viewbox_check = self._validate_svg_viewbox(
                root, template, errors, warnings, metrics
            )
            checks["svg_viewbox"] = viewbox_check
            
            # Validate paths
            paths_check = self._validate_svg_paths(root, ns, errors, warnings, metrics)
            checks["svg_paths"] = paths_check
            
            # Validate structure
            structure_check = self._validate_svg_structure(
                root, ns, errors, warnings, metrics
            )
            checks["svg_structure"] = structure_check
            
            # Check for rendering issues
            rendering_check = self._validate_svg_rendering(
                root, ns, errors, warnings, metrics
            )
            checks["svg_rendering"] = rendering_check
            
        except ET.ParseError as e:
            errors.append(f"SVG parsing error: {e}")
            checks["svg_parse"] = False
        except Exception as e:
            errors.append(f"SVG validation error: {e}")
            checks["svg_validation"] = False
    
    def _validate_svg_viewbox(
        self,
        root: ET.Element,
        template: Template,
        errors: List[str],
        warnings: List[str],
        metrics: Dict[str, Any]
    ) -> bool:
        """Validate SVG viewBox attribute"""
        viewbox = root.get('viewBox')
        
        if not viewbox:
            errors.append("SVG missing viewBox attribute")
            return False
        
        try:
            # Parse viewBox: "min-x min-y width height"
            parts = viewbox.split()
            if len(parts) != 4:
                errors.append(f"Invalid viewBox format: {viewbox}")
                return False
            
            min_x, min_y, width, height = map(float, parts)
            metrics["svg_viewbox"] = {
                "min_x": min_x,
                "min_y": min_y,
                "width": width,
                "height": height
            }
            
            # Validate dimensions match template
            expected_width = template.dimensions["width"]
            expected_height = template.dimensions["height"]
            
            if abs(width - expected_width) > 0.1 or abs(height - expected_height) > 0.1:
                warnings.append(
                    f"SVG viewBox dimensions ({width}x{height}) don't match "
                    f"template dimensions ({expected_width}x{expected_height})"
                )
            
            return True
            
        except (ValueError, IndexError) as e:
            errors.append(f"Invalid viewBox values: {e}")
            return False
    
    def _validate_svg_paths(
        self,
        root: ET.Element,
        ns: Dict[str, str],
        errors: List[str],
        warnings: List[str],
        metrics: Dict[str, Any]
    ) -> bool:
        """Validate SVG path elements"""
        paths = root.findall('.//svg:path', ns)
        
        if not paths:
            # No paths is okay - might use other primitives
            metrics["svg_path_count"] = 0
            return True
        
        metrics["svg_path_count"] = len(paths)
        invalid_paths = 0
        
        for i, path in enumerate(paths):
            d = path.get('d')
            if not d or not d.strip():
                errors.append(f"Path {i} has empty 'd' attribute")
                invalid_paths += 1
                continue
            
            # Basic path command validation
            valid_commands = set('MmLlHhVvCcSsQqTtAaZz')
            commands = [c for c in d if c.isalpha()]
            
            invalid_commands = [c for c in commands if c not in valid_commands]
            if invalid_commands:
                errors.append(
                    f"Path {i} contains invalid commands: {invalid_commands}"
                )
                invalid_paths += 1
        
        metrics["svg_invalid_paths"] = invalid_paths
        return invalid_paths == 0
    
    def _validate_svg_structure(
        self,
        root: ET.Element,
        ns: Dict[str, str],
        errors: List[str],
        warnings: List[str],
        metrics: Dict[str, Any]
    ) -> bool:
        """Validate SVG structure and organization"""
        # Count elements
        element_counts = {
            "rect": len(root.findall('.//svg:rect', ns)),
            "circle": len(root.findall('.//svg:circle', ns)),
            "ellipse": len(root.findall('.//svg:ellipse', ns)),
            "line": len(root.findall('.//svg:line', ns)),
            "polyline": len(root.findall('.//svg:polyline', ns)),
            "polygon": len(root.findall('.//svg:polygon', ns)),
            "path": len(root.findall('.//svg:path', ns)),
            "g": len(root.findall('.//svg:g', ns)),
        }
        
        metrics["svg_elements"] = element_counts
        total_elements = sum(element_counts.values())
        
        if total_elements == 0:
            warnings.append("SVG contains no drawable elements")
        
        # Check for excessive complexity
        if total_elements > 1000:
            warnings.append(
                f"SVG has high element count ({total_elements}), "
                "may impact performance"
            )
        
        return True
    
    def _validate_svg_rendering(
        self,
        root: ET.Element,
        ns: Dict[str, str],
        errors: List[str],
        warnings: List[str],
        metrics: Dict[str, Any]
    ) -> bool:
        """Validate SVG for potential rendering issues"""
        issues = []
        
        # Check for elements with zero dimensions
        for rect in root.findall('.//svg:rect', ns):
            width = float(rect.get('width', 0))
            height = float(rect.get('height', 0))
            if width == 0 or height == 0:
                issues.append("Found rect with zero width or height")
        
        for circle in root.findall('.//svg:circle', ns):
            r = float(circle.get('r', 0))
            if r == 0:
                issues.append("Found circle with zero radius")
        
        # Check for invalid coordinates (NaN, Inf)
        for elem in root.iter():
            for attr in elem.attrib.values():
                if isinstance(attr, str) and ('nan' in attr.lower() or 'inf' in attr.lower()):
                    issues.append(f"Found invalid coordinate value: {attr}")
        
        if issues:
            for issue in issues:
                warnings.append(f"Rendering issue: {issue}")
        
        metrics["svg_rendering_issues"] = len(issues)
        return len(issues) == 0
    
    # ========================================================================
    # Raster Image Validation
    # ========================================================================
    
    def _validate_raster(
        self,
        file_path: Path,
        template: Template,
        output_format: OutputFormat,
        checks: Dict[str, bool],
        errors: List[str],
        warnings: List[str],
        metrics: Dict[str, Any]
    ) -> None:
        """Validate raster image file"""
        try:
            with Image.open(file_path) as img:
                # Dimension validation
                dim_check = self._validate_dimensions(
                    img, template, errors, warnings, metrics
                )
                checks["dimensions"] = dim_check
                
                # Color mode validation
                mode_check = self._validate_color_mode(
                    img, template, output_format, errors, warnings, metrics
                )
                checks["color_mode"] = mode_check
                
                # Alpha channel validation
                if output_format in [OutputFormat.PNG, OutputFormat.WEBP]:
                    alpha_check = self._validate_alpha_channel(
                        img, template, errors, warnings, metrics
                    )
                    checks["alpha_channel"] = alpha_check
                
                # DPI validation
                dpi_check = self._validate_dpi(img, errors, warnings, metrics)
                checks["dpi"] = dpi_check
                
                # Quality metrics
                self._compute_quality_metrics(img, metrics, warnings)
                
        except Exception as e:
            errors.append(f"Failed to open/validate image: {e}")
            checks["image_open"] = False
    
    def _validate_dimensions(
        self,
        img: Image.Image,
        template: Template,
        errors: List[str],
        warnings: List[str],
        metrics: Dict[str, Any]
    ) -> bool:
        """Validate image dimensions against template specifications"""
        actual_width, actual_height = img.size
        expected_width = template.dimensions["width"]
        expected_height = template.dimensions["height"]
        
        metrics["dimensions"] = {
            "actual": (actual_width, actual_height),
            "expected": (expected_width, expected_height)
        }
        
        if actual_width != expected_width or actual_height != expected_height:
            errors.append(
                f"Dimension mismatch: expected {expected_width}x{expected_height}, "
                f"got {actual_width}x{actual_height}"
            )
            return False
        
        return True
    
    def _validate_color_mode(
        self,
        img: Image.Image,
        template: Template,
        output_format: OutputFormat,
        errors: List[str],
        warnings: List[str],
        metrics: Dict[str, Any]
    ) -> bool:
        """Validate image color mode"""
        mode = img.mode
        metrics["color_mode"] = mode
        
        # Check if alpha is required
        requires_alpha = template.alpha_mode in [AlphaMode.EMBEDDED, AlphaMode.BOTH]
        
        if requires_alpha:
            # Should have alpha channel
            if mode not in ['RGBA', 'LA', 'PA']:
                errors.append(
                    f"Template requires alpha channel but image mode is '{mode}'"
                )
                return False
        else:
            # Should not have alpha channel (unless format supports it)
            if mode in ['RGBA', 'LA', 'PA']:
                if output_format not in [OutputFormat.PNG, OutputFormat.WEBP]:
                    warnings.append(
                        f"Image has alpha channel (mode '{mode}') but format "
                        f"'{output_format.value}' may not preserve it"
                    )
        
        # Validate mode is appropriate for format
        if output_format == OutputFormat.JPEG and mode in ['RGBA', 'LA', 'PA']:
            errors.append(
                f"JPEG format does not support alpha channel (image mode: '{mode}')"
            )
            return False
        
        return True
    
    def _validate_alpha_channel(
        self,
        img: Image.Image,
        template: Template,
        errors: List[str],
        warnings: List[str],
        metrics: Dict[str, Any]
    ) -> bool:
        """Validate alpha channel properties"""
        if img.mode not in ['RGBA', 'LA', 'PA']:
            # No alpha channel
            if template.alpha_mode in [AlphaMode.EMBEDDED, AlphaMode.BOTH]:
                errors.append("Template requires alpha channel but image has none")
                return False
            return True
        
        # Extract alpha channel
        if img.mode == 'RGBA':
            alpha = np.array(img)[:, :, 3]
        elif img.mode == 'LA':
            alpha = np.array(img)[:, :, 1]
        else:  # PA
            alpha = np.array(img.convert('RGBA'))[:, :, 3]
        
        # Compute alpha statistics
        alpha_min = int(alpha.min())
        alpha_max = int(alpha.max())
        alpha_mean = float(alpha.mean())
        alpha_unique = len(np.unique(alpha))
        
        metrics["alpha_channel"] = {
            "min": alpha_min,
            "max": alpha_max,
            "mean": alpha_mean,
            "unique_values": alpha_unique,
            "is_binary": alpha_unique <= 2,
            "is_constant": alpha_unique == 1
        }
        
        # Check for issues
        if alpha_unique == 1:
            if alpha_min == 255:
                warnings.append("Alpha channel is fully opaque (constant 255)")
            elif alpha_min == 0:
                warnings.append("Alpha channel is fully transparent (constant 0)")
        
        # Check for premultiplied alpha issues
        if img.mode == 'PA':
            warnings.append(
                "Image uses premultiplied alpha (mode 'PA'), "
                "ensure correct handling in compositing"
            )
        
        return True
    
    def _validate_dpi(
        self,
        img: Image.Image,
        errors: List[str],
        warnings: List[str],
        metrics: Dict[str, Any]
    ) -> bool:
        """Validate DPI metadata"""
        dpi = img.info.get('dpi', (72, 72))
        
        if isinstance(dpi, (int, float)):
            dpi = (dpi, dpi)
        
        metrics["dpi"] = dpi
        
        # Check if DPI matches expected screen DPI
        if dpi[0] != SCREEN_DPI or dpi[1] != SCREEN_DPI:
            warnings.append(
                f"DPI ({dpi[0]}x{dpi[1]}) differs from standard screen DPI "
                f"({SCREEN_DPI}x{SCREEN_DPI})"
            )
            # Not a hard error, just a warning
        
        return True
    
    def _compute_quality_metrics(
        self,
        img: Image.Image,
        metrics: Dict[str, Any],
        warnings: List[str]
    ) -> None:
        """Compute image quality metrics"""
        # Convert to numpy array
        arr = np.array(img)
        
        # Handle different color modes
        if img.mode in ['RGBA', 'RGB']:
            # Use RGB channels only
            if img.mode == 'RGBA':
                rgb = arr[:, :, :3]
            else:
                rgb = arr
            
            # Compute metrics on grayscale version
            gray = np.mean(rgb, axis=2)
        elif img.mode in ['L', 'LA']:
            # Already grayscale
            gray = arr[:, :, 0] if img.mode == 'LA' else arr
        else:
            # Unsupported mode for quality metrics
            return
        
        # Detect banding (posterization)
        unique_values = len(np.unique(gray))
        total_possible = 256
        value_ratio = unique_values / total_possible
        
        metrics["quality"] = {
            "unique_gray_values": unique_values,
            "value_ratio": value_ratio
        }
        
        if value_ratio < 0.1:  # Less than 10% of possible values used
            warnings.append(
                f"Possible banding detected: only {unique_values} unique "
                f"gray values out of {total_possible}"
            )
        
        # Detect potential aliasing (high-frequency noise)
        # Compute gradient magnitude
        if gray.shape[0] > 1 and gray.shape[1] > 1:
            gy, gx = np.gradient(gray.astype(float))
            gradient_mag = np.sqrt(gx**2 + gy**2)
            
            # High gradient values might indicate aliasing
            high_gradient_ratio = np.sum(gradient_mag > 50) / gradient_mag.size
            metrics["quality"]["high_gradient_ratio"] = float(high_gradient_ratio)
            
            if high_gradient_ratio > 0.3:  # More than 30% high gradients
                warnings.append(
                    "Possible aliasing detected: high proportion of sharp edges"
                )
    
    # ========================================================================
    # Duplicate Detection
    # ========================================================================
    
    def compute_perceptual_hash(self, file_path: Path) -> str:
        """
        Compute perceptual hash for duplicate detection.
        
        Uses difference hash (dHash) algorithm for fast perceptual comparison.
        
        Args:
            file_path: Path to image file
            
        Returns:
            Hexadecimal hash string
        """
        try:
            with Image.open(file_path) as img:
                # Convert to grayscale and resize
                img = img.convert('L').resize(
                    (PHASH_SIZE + 1, PHASH_SIZE),
                    Image.Resampling.LANCZOS
                )
                
                # Convert to numpy array
                pixels = np.array(img)
                
                # Compute horizontal gradient
                diff = pixels[:, 1:] > pixels[:, :-1]
                
                # Convert to hash
                hash_value = 0
                for i, row in enumerate(diff):
                    for j, val in enumerate(row):
                        if val:
                            hash_value |= 1 << (i * PHASH_SIZE + j)
                
                # Convert to hex string
                return f"{hash_value:016x}"
                
        except Exception as e:
            # Return empty hash on error
            return ""
    
    def compute_hash_distance(self, hash1: str, hash2: str) -> int:
        """
        Compute Hamming distance between two perceptual hashes.
        
        Args:
            hash1: First hash (hex string)
            hash2: Second hash (hex string)
            
        Returns:
            Hamming distance (number of differing bits)
        """
        if not hash1 or not hash2:
            return -1
        
        try:
            val1 = int(hash1, 16)
            val2 = int(hash2, 16)
            
            # XOR and count set bits
            xor = val1 ^ val2
            distance = bin(xor).count('1')
            
            return distance
            
        except ValueError:
            return -1
    
    def is_duplicate(
        self,
        file_path: Path,
        threshold: int = 5
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if asset is a perceptual duplicate of a cached asset.
        
        Args:
            file_path: Path to asset file
            threshold: Maximum Hamming distance to consider duplicate (default: 5)
            
        Returns:
            Tuple of (is_duplicate, duplicate_file_path)
        """
        # Compute hash for this file
        current_hash = self.compute_perceptual_hash(file_path)
        
        if not current_hash:
            return False, None
        
        # Compare with cached hashes
        for cached_path, cached_hash in self.phash_cache.items():
            distance = self.compute_hash_distance(current_hash, cached_hash)
            
            if 0 <= distance <= threshold:
                return True, cached_path
        
        # Not a duplicate - add to cache
        self.phash_cache[str(file_path)] = current_hash
        
        return False, None
    
    def clear_cache(self) -> None:
        """Clear perceptual hash cache"""
        self.phash_cache.clear()


# ============================================================================
# Convenience Functions
# ============================================================================

def validate_asset(
    file_path: Path,
    template: Template,
    output_format: OutputFormat
) -> ValidationResult:
    """
    Convenience function to validate a single asset.
    
    Args:
        file_path: Path to generated asset file
        template: Template used for generation
        output_format: Output format of the asset
        
    Returns:
        ValidationResult with validation details
    """
    validator = AssetValidator()
    return validator.validate_asset(file_path, template, output_format)


def validate_batch(
    assets: List[Tuple[Path, Template, OutputFormat]]
) -> List[ValidationResult]:
    """
    Validate multiple assets in batch.
    
    Args:
        assets: List of (file_path, template, output_format) tuples
        
    Returns:
        List of ValidationResult objects
    """
    validator = AssetValidator()
    results = []
    
    for file_path, template, output_format in assets:
        result = validator.validate_asset(file_path, template, output_format)
        results.append(result)
    
    return results


def generate_validation_report(
    results: List[ValidationResult],
    output_path: Optional[Path] = None
) -> str:
    """
    Generate human-readable validation report.
    
    Args:
        results: List of validation results
        output_path: Optional path to write report file
        
    Returns:
        Report text
    """
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed
    
    report_lines = [
        "=" * 80,
        "UI FORGE ASSET VALIDATION REPORT",
        "=" * 80,
        "",
        f"Total Assets: {total}",
        f"Passed: {passed} ({passed/total*100:.1f}%)",
        f"Failed: {failed} ({failed/total*100:.1f}%)",
        "",
    ]
    
    if failed > 0:
        report_lines.extend([
            "FAILED ASSETS:",
            "-" * 80,
        ])
        
        for i, result in enumerate(results):
            if not result.passed:
                report_lines.append(f"\nAsset #{i+1}:")
                report_lines.append(f"  Checks: {result.checks}")
                
                if result.errors:
                    report_lines.append("  Errors:")
                    for error in result.errors:
                        report_lines.append(f"    - {error}")
                
                if result.warnings:
                    report_lines.append("  Warnings:")
                    for warning in result.warnings:
                        report_lines.append(f"    - {warning}")
    
    # Summary of warnings
    all_warnings = [w for r in results for w in r.warnings]
    if all_warnings:
        report_lines.extend([
            "",
            f"TOTAL WARNINGS: {len(all_warnings)}",
            "-" * 80,
        ])
        
        # Count unique warnings
        warning_counts: Dict[str, int] = {}
        for warning in all_warnings:
            warning_counts[warning] = warning_counts.get(warning, 0) + 1
        
        for warning, count in sorted(
            warning_counts.items(),
            key=lambda x: x[1],
            reverse=True
        ):
            report_lines.append(f"  [{count}x] {warning}")
    
    report_lines.extend([
        "",
        "=" * 80,
    ])
    
    report_text = "\n".join(report_lines)
    
    # Write to file if requested
    if output_path:
        output_path.write_text(report_text, encoding='utf-8')
    
    return report_text
