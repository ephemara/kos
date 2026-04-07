"""
UI Forge Core Engine

Orchestrates the entire UI asset generation pipeline, coordinating between
TemplateManager, GeneratorManager, PreviewManager, and LibraryManager.

Supports:
- Single asset generation
- Parallel batch processing with multiprocessing
- Incremental generation (only regenerate changed templates)
- Progress tracking for long-running operations
- Error recovery and comprehensive logging

Requirements: 9.1, 9.2, 9.5
"""

import logging
import time
import hashlib
import json
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from multiprocessing import Pool, Manager, cpu_count
from dataclasses import asdict
import traceback

from PIL import Image
import numpy as np

from models import (
    Template,
    GenerationResult,
    AssetMetadata,
    ProgressInfo,
    OutputFormat,
    AlphaMode,
)
from template_manager import TemplateManager
from generator_manager import GeneratorManager
from utils import image_from_array


# Configure logging
logger = logging.getLogger(__name__)


DEFAULT_ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)


def resolve_ico_sizes(
    image_size: Tuple[int, int],
    requested_sizes: Optional[List[int]] = None,
) -> List[Tuple[int, int]]:
    """
    Resolve the size entries to embed in a Windows .ico bundle.

    ICO containers only support square icon entries up to 256x256. If the template
    does not provide explicit sizes, we derive a sensible Windows-oriented set from
    the source image dimensions.
    """
    width, height = image_size
    max_square_size = min(width, height, 256)

    if max_square_size <= 0:
        raise ValueError("ICO export requires positive image dimensions")

    if requested_sizes:
        candidates = requested_sizes
    else:
        candidates = [size for size in DEFAULT_ICO_SIZES if size <= max_square_size]
        if max_square_size not in candidates:
            candidates.append(max_square_size)

    unique_sizes = sorted({int(size) for size in candidates if 0 < int(size) <= max_square_size})
    if not unique_sizes:
        unique_sizes = [max_square_size]

    return [(size, size) for size in unique_sizes]


# ============================================================================
# Format Conversion Utilities
# ============================================================================

def save_image_format(
    image_array: np.ndarray,
    output_path: Path,
    format: OutputFormat,
    jpeg_quality: int = 95,
    png_compression: int = 6,
    webp_lossless: bool = True,
    ico_sizes: Optional[List[int]] = None,
) -> bool:
    """
    Save numpy array as image in specified format.
    
    Args:
        image_array: Numpy array (H, W, C) with uint8 dtype
        output_path: Output file path
        format: Output format enum
        jpeg_quality: JPEG quality (1-100)
        png_compression: PNG compression level (0-9)
        webp_lossless: WebP lossless mode
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Convert numpy array to PIL Image
        if image_array.shape[2] not in (1, 3, 4):
            logger.error(f"Unsupported channel count: {image_array.shape[2]}")
            return False
        image = image_from_array(image_array)
        
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save based on format
        if format == OutputFormat.PNG:
            image.save(output_path, format='PNG', compress_level=png_compression)

        elif format == OutputFormat.APNG:
            image.save(output_path, format='PNG', compress_level=png_compression)
        
        elif format == OutputFormat.JPEG:
            # Convert RGBA to RGB for JPEG
            if image.mode == 'RGBA':
                # Create white background
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[3])  # Use alpha as mask
                image = background
            image.save(output_path, format='JPEG', quality=jpeg_quality)
        
        elif format == OutputFormat.WEBP:
            image.save(output_path, format='WEBP', lossless=webp_lossless, quality=jpeg_quality)
        
        elif format == OutputFormat.TIFF:
            image.save(output_path, format='TIFF')
        
        elif format == OutputFormat.BMP:
            # Convert RGBA to RGB for BMP
            if image.mode == 'RGBA':
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[3])
                image = background
            image.save(output_path, format='BMP')
        
        elif format == OutputFormat.ICO:
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            image.save(output_path, format='ICO', sizes=resolve_ico_sizes(image.size, ico_sizes))
        
        elif format == OutputFormat.SVG:
            # SVG generation is handled separately by generators
            logger.warning(f"SVG format should be handled by generator, not core engine")
            return False
        
        else:
            logger.error(f"Unsupported output format: {format}")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to save image as {format}: {e}")
        return False


def validate_format_compatibility(template: Template) -> Tuple[bool, List[str]]:
    """
    Validate format compatibility with template features.
    
    Args:
        template: Template to validate
        
    Returns:
        Tuple of (is_valid, error_messages)
    """
    errors = []
    
    # Check alpha mode compatibility
    if template.alpha_mode in [AlphaMode.EMBEDDED, AlphaMode.BOTH]:
        transparent_formats = {
            OutputFormat.PNG,
            OutputFormat.APNG,
            OutputFormat.WEBP,
            OutputFormat.SVG,
            OutputFormat.ICO,
        }
        if not any(fmt in transparent_formats for fmt in template.output_formats):
            errors.append(
                f"Alpha mode '{template.alpha_mode.value}' requires at least one format "
                f"supporting transparency (PNG, APNG, WebP, SVG, or ICO)"
            )
    
    # Check JPEG compatibility
    if OutputFormat.JPEG in template.output_formats:
        if template.alpha_mode == AlphaMode.EMBEDDED:
            # Warning, not error - we'll convert to RGB
            logger.warning(
                f"Template '{template.name}' uses JPEG with embedded alpha. "
                f"Alpha channel will be flattened to white background."
            )
    
    return (len(errors) == 0, errors)


# ============================================================================
# Worker Functions for Multiprocessing
# ============================================================================

def _generate_asset_worker(args: Tuple[Template, Path, Dict[str, Any]]) -> GenerationResult:
    """
    Worker function for parallel asset generation.
    
    Args:
        args: Tuple of (template, output_dir, config)
        
    Returns:
        GenerationResult object
    """
    template, output_dir, config = args
    
    try:
        # Create engine instance (each worker needs its own)
        engine = UIForgeEngine(
            output_dir=output_dir,
            templates_dir=config.get('templates_dir'),
            generators_dir=config.get('generators_dir'),
        )
        
        # Generate asset
        result = engine.generate_asset(template)
        return result
        
    except Exception as e:
        # Return error result
        logger.error(f"Worker failed to generate asset '{template.name}': {e}")
        return GenerationResult(
            success=False,
            asset_id=template.template_id or template.name,
            template_name=template.name,
            output_paths={},
            metadata=None,
            generation_time=0.0,
            error=str(e),
            warnings=[],
        )


# ============================================================================
# UIForgeEngine - Core Orchestration
# ============================================================================

class UIForgeEngine:
    """
    Core engine orchestrating the UI Forge generation pipeline.
    
    Responsibilities:
    - Coordinate between TemplateManager, GeneratorManager, and other managers
    - Execute single asset generation
    - Execute parallel batch generation with multiprocessing
    - Track progress for long-running operations
    - Handle error recovery and logging
    - Support incremental generation (only regenerate changed templates)
    
    Usage:
        engine = UIForgeEngine()
        
        # Single asset
        result = engine.generate_asset(template)
        
        # Batch generation
        results = engine.batch_generate(templates, parallel=True)
        
        # Incremental generation
        results = engine.regenerate_changed(since=datetime(2024, 1, 1))
    """
    
    def __init__(
        self,
        output_dir: Optional[Path] = None,
        templates_dir: Optional[Path] = None,
        generators_dir: Optional[Path] = None,
        skip_validation: bool = True,
    ):
        """
        Initialize UIForgeEngine.
        
        Args:
            output_dir: Base output directory for generated assets
            templates_dir: Templates directory (defaults to ./templates/)
            generators_dir: Generators directory (defaults to ./generators/)
            skip_validation: If True, skip schema validation (default: True for UI generation flexibility)
        """
        # Set up directories
        if output_dir is None:
            output_dir = Path(__file__).parent / "output"
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize managers
        self.template_manager = TemplateManager(templates_dir=templates_dir, skip_validation=skip_validation)
        self.generator_manager = GeneratorManager(generators_dir=generators_dir)
        self.skip_validation = skip_validation
        
        # Discover generators
        self.generator_manager.discover_generators()
        
        # Progress tracking
        self._batch_progress: Dict[str, ProgressInfo] = {}
        
        # Cache for incremental generation
        self._generation_cache_file = self.output_dir / ".generation_cache.json"
        self._generation_cache = self._load_generation_cache()
        
        logger.info(f"UIForgeEngine initialized with output_dir: {self.output_dir}, skip_validation: {skip_validation}")
    
    def generate_asset(self, template: Template) -> GenerationResult:
        """
        Generate a single asset from template.
        
        Orchestrates the complete generation pipeline:
        1. Validate template and format compatibility
        2. Route to appropriate generator
        3. Generate asset as numpy array
        4. Convert to requested output formats
        5. Generate separate alpha mask if requested
        6. Create asset metadata
        7. Save all outputs
        
        Args:
            template: Template defining asset parameters
            
        Returns:
            GenerationResult with success status, output paths, and metadata
            
        Raises:
            ValueError: If template validation fails
            RuntimeError: If generation fails critically
        """
        start_time = time.time()
        asset_id = template.template_id or template.name
        
        logger.info(f"Generating asset: {template.name} ({template.generator_type.value})")
        
        try:
            # Validate template
            validation = self.template_manager.validate_template(template)
            if not validation['valid']:
                error_msg = f"Template validation failed: {', '.join(validation['errors'])}"
                logger.error(error_msg)
                return GenerationResult(
                    success=False,
                    asset_id=asset_id,
                    template_name=template.name,
                    output_paths={},
                    metadata=None,
                    generation_time=time.time() - start_time,
                    error=error_msg,
                    warnings=validation.get('warnings', []),
                )
            
            # Validate format compatibility
            format_valid, format_errors = validate_format_compatibility(template)
            if not format_valid:
                error_msg = f"Format compatibility check failed: {', '.join(format_errors)}"
                logger.error(error_msg)
                return GenerationResult(
                    success=False,
                    asset_id=asset_id,
                    template_name=template.name,
                    output_paths={},
                    metadata=None,
                    generation_time=time.time() - start_time,
                    error=error_msg,
                    warnings=[],
                )
            
            # Get appropriate generator
            generator = self.generator_manager.get_generator(template.generator_type)
            
            # Generate asset as numpy array
            logger.debug(f"Generating asset with {generator.__class__.__name__}")
            image_array = generator.generate(template)
            
            # Validate output dimensions
            height, width = image_array.shape[:2]
            expected_width = template.dimensions['width']
            expected_height = template.dimensions['height']
            
            if width != expected_width or height != expected_height:
                logger.warning(
                    f"Generator output dimensions ({width}x{height}) don't match "
                    f"template dimensions ({expected_width}x{expected_height})"
                )
            
            # Create output directory for this asset
            asset_dir = self.output_dir / template.category / template.name
            asset_dir.mkdir(parents=True, exist_ok=True)
            
            # Save in all requested formats
            output_paths = {}
            warnings = []
            
            for format in template.output_formats:
                if format == OutputFormat.SVG:
                    svg_path = asset_dir / f"{template.name}.svg"
                    if hasattr(generator, "generate_svg"):
                        try:
                            generator.generate_svg(template, str(svg_path))
                        except Exception as e:
                            warnings.append(
                                f"Failed to generate SVG with {generator.__class__.__name__}: {e}"
                            )
                    if svg_path.exists():
                        output_paths[format.value] = str(svg_path)
                    else:
                        warnings.append(f"SVG format requested but not generated by {generator.__class__.__name__}")
                    continue

                if format == OutputFormat.APNG and template.animation and template.animation.enabled:
                    # Animated PNG is generated during animation post-processing.
                    continue
                
                # Generate output filename
                output_filename = f"{template.name}.{format.value}"
                output_path = asset_dir / output_filename
                
                # Save image
                success = save_image_format(
                    image_array,
                    output_path,
                    format,
                    jpeg_quality=template.jpeg_quality,
                    png_compression=template.png_compression,
                    webp_lossless=template.webp_lossless,
                    ico_sizes=template.ico_sizes,
                )
                
                if success:
                    output_paths[format.value] = str(output_path)
                    logger.debug(f"Saved {format.value} to {output_path}")
                else:
                    warnings.append(f"Failed to save {format.value} format")
            
            # Generate separate alpha mask if requested
            if template.alpha_mode in [AlphaMode.SEPARATE, AlphaMode.BOTH]:
                if image_array.shape[2] == 4:
                    # Extract alpha channel
                    alpha_array = image_array[:, :, 3:4]  # Keep as (H, W, 1)
                    
                    # Save alpha mask
                    alpha_filename = f"{template.name}_alpha.png"
                    alpha_path = asset_dir / alpha_filename
                    
                    success = save_image_format(
                        alpha_array,
                        alpha_path,
                        OutputFormat.PNG,
                        png_compression=template.png_compression,
                    )
                    
                    if success:
                        output_paths['alpha_mask'] = str(alpha_path)
                        logger.debug(f"Saved alpha mask to {alpha_path}")
                    else:
                        warnings.append("Failed to save separate alpha mask")
                else:
                    warnings.append("Separate alpha mask requested but image has no alpha channel")
            
            # Optional animation post-processing
            if template.animation and template.animation.enabled:
                logger.debug(f"Applying animation to asset '{template.name}'")
                animation_paths = self._apply_animation(
                    template,
                    image_array,
                    asset_dir,
                    output_paths,
                )
                
                if animation_paths:
                    output_paths.update(animation_paths)
                    logger.debug(f"Generated {len(animation_paths)} animated outputs")
                else:
                    warnings.append("Animation generation failed, preserved static asset")
            
            # Create asset metadata
            metadata = self._create_metadata(template, image_array, output_paths)
            
            # Save metadata JSON
            metadata_path = asset_dir / f"{template.name}_metadata.json"
            self._save_metadata(metadata, metadata_path)
            
            # Update generation cache
            self._update_generation_cache(template, metadata)
            
            generation_time = time.time() - start_time
            logger.info(
                f"Successfully generated asset '{template.name}' in {generation_time:.2f}s "
                f"({len(output_paths)} outputs)"
            )
            
            return GenerationResult(
                success=True,
                asset_id=asset_id,
                template_name=template.name,
                output_paths=output_paths,
                metadata=metadata,
                generation_time=generation_time,
                error=None,
                warnings=warnings,
            )
            
        except Exception as e:
            generation_time = time.time() - start_time
            error_msg = f"Asset generation failed: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return GenerationResult(
                success=False,
                asset_id=asset_id,
                template_name=template.name,
                output_paths={},
                metadata=None,
                generation_time=generation_time,
                error=error_msg,
                warnings=[],
            )
    
    def generate_theme_variants(
        self,
        template: Template,
        themes: Optional[List[str]] = None,
    ) -> Dict[str, GenerationResult]:
        """
        Generate asset in multiple theme variants from a single template.
        
        Creates separate assets for each theme variant (light/dark/high-contrast),
        resolving color tokens appropriately for each theme. All variants are
        linked via theme_group metadata for consistency tracking.
        
        Args:
            template: Base template to generate variants from
            themes: List of theme names (defaults to template.theme_variants or all themes)
            
        Returns:
            Dictionary mapping theme name to GenerationResult
            
        Notes:
            - Each variant gets a unique name: {template.name}_{theme}
            - All variants share the same theme_group for linking
            - Color tokens are resolved per-theme before generation
            - Visual consistency is validated across variants
        """
        start_time = time.time()
        
        # Determine which themes to generate
        if themes is None:
            if template.theme_variants:
                themes = template.theme_variants
            else:
                # Generate for all available themes
                themes = [info.name for info in self.template_manager.theme_manager.list_themes()]
        
        logger.info(
            f"Generating theme variants for '{template.name}': {', '.join(themes)}"
        )
        
        # Generate theme group ID for linking variants
        theme_group = f"{template.name}_theme_group"
        
        results = {}
        
        for theme in themes:
            logger.debug(f"Generating variant for theme: {theme}")
            
            # Create variant template with resolved colors
            variant_template = self._create_theme_variant_template(
                template,
                theme,
                theme_group,
            )
            
            # Generate the variant
            result = self.generate_asset(variant_template)
            
            # Update metadata with theme info
            if result.success and result.metadata:
                result.metadata.theme_variant = theme
                result.metadata.theme_group = theme_group
                
                # Re-save metadata with theme info
                asset_dir = self.output_dir / variant_template.category / variant_template.name
                metadata_path = asset_dir / f"{variant_template.name}_metadata.json"
                self._save_metadata(result.metadata, metadata_path)
            
            results[theme] = result
        
        # Validate visual consistency across variants
        consistency_warnings = self._validate_theme_consistency(results)
        
        if consistency_warnings:
            logger.warning(
                f"Theme consistency warnings for '{template.name}':\n" +
                "\n".join(f"  - {w}" for w in consistency_warnings)
            )
            
            # Add warnings to all results
            for result in results.values():
                if result.success:
                    result.warnings.extend(consistency_warnings)
        
        total_time = time.time() - start_time
        success_count = sum(1 for r in results.values() if r.success)
        
        logger.info(
            f"Generated {success_count}/{len(themes)} theme variants "
            f"for '{template.name}' in {total_time:.2f}s"
        )
        
        return results
    
    def generate_dark_mode_variant(
        self,
        template: Template,
        auto_invert: bool = True,
    ) -> GenerationResult:
        """
        Generate a dark mode variant of an asset with automatic color inversion.
        
        Convenience method for creating dark mode variants. If auto_invert is True,
        automatically inverts colors that don't have explicit dark mode tokens.
        
        Args:
            template: Base template (typically light mode)
            auto_invert: Automatically invert colors for dark mode
            
        Returns:
            GenerationResult for dark mode variant
            
        Notes:
            - Creates a dark mode theme if it doesn't exist
            - Inverts colors using HSL lightness inversion
            - Preserves hue and saturation for visual consistency
        """
        logger.info(f"Generating dark mode variant for '{template.name}'")
        
        # Check if dark theme exists
        theme_manager = self.template_manager.theme_manager
        themes = [info.name for info in theme_manager.list_themes()]
        
        if 'dark' not in themes and auto_invert:
            logger.info("Dark theme not found, generating from light theme")
            theme_manager.generate_dark_mode_theme('light', 'dark')
        
        # Generate dark variant
        variants = self.generate_theme_variants(template, themes=['dark'])
        
        return variants.get('dark')
        """
        Generate a single asset from template.
        
        Orchestrates the complete generation pipeline:
        1. Validate template and format compatibility
        2. Route to appropriate generator
        3. Generate asset as numpy array
        4. Convert to requested output formats
        5. Generate separate alpha mask if requested
        6. Create asset metadata
        7. Save all outputs
        
        Args:
            template: Template defining asset parameters
            
        Returns:
            GenerationResult with success status, output paths, and metadata
            
        Raises:
            ValueError: If template validation fails
            RuntimeError: If generation fails critically
        """
        start_time = time.time()
        asset_id = template.template_id or template.name
        
        logger.info(f"Generating asset: {template.name} ({template.generator_type.value})")
        
        try:
            # Validate template
            validation = self.template_manager.validate_template(template)
            if not validation['valid']:
                error_msg = f"Template validation failed: {', '.join(validation['errors'])}"
                logger.error(error_msg)
                return GenerationResult(
                    success=False,
                    asset_id=asset_id,
                    template_name=template.name,
                    output_paths={},
                    metadata=None,
                    generation_time=time.time() - start_time,
                    error=error_msg,
                    warnings=validation.get('warnings', []),
                )
            
            # Validate format compatibility
            format_valid, format_errors = validate_format_compatibility(template)
            if not format_valid:
                error_msg = f"Format compatibility check failed: {', '.join(format_errors)}"
                logger.error(error_msg)
                return GenerationResult(
                    success=False,
                    asset_id=asset_id,
                    template_name=template.name,
                    output_paths={},
                    metadata=None,
                    generation_time=time.time() - start_time,
                    error=error_msg,
                    warnings=[],
                )
            
            # Get appropriate generator
            generator = self.generator_manager.get_generator(template.generator_type)
            
            # Generate asset as numpy array
            logger.debug(f"Generating asset with {generator.__class__.__name__}")
            image_array = generator.generate(template)
            
            # Validate output dimensions
            height, width = image_array.shape[:2]
            expected_width = template.dimensions['width']
            expected_height = template.dimensions['height']
            
            if width != expected_width or height != expected_height:
                logger.warning(
                    f"Generator output dimensions ({width}x{height}) don't match "
                    f"template dimensions ({expected_width}x{expected_height})"
                )
            
            # Create output directory for this asset
            asset_dir = self.output_dir / template.category / template.name
            asset_dir.mkdir(parents=True, exist_ok=True)
            
            # Save in all requested formats
            output_paths = {}
            warnings = []
            
            for format in template.output_formats:
                if format == OutputFormat.SVG:
                    # SVG should be generated by the generator itself
                    # Check if generator supports SVG output
                    svg_path = asset_dir / f"{template.name}.svg"
                    if svg_path.exists():
                        output_paths[format.value] = str(svg_path)
                    else:
                        warnings.append(f"SVG format requested but not generated by {generator.__class__.__name__}")
                    continue
                
                # Generate output filename
                output_filename = f"{template.name}.{format.value}"
                output_path = asset_dir / output_filename
                
                # Save image
                success = save_image_format(
                    image_array,
                    output_path,
                    format,
                    jpeg_quality=template.jpeg_quality,
                    png_compression=template.png_compression,
                    webp_lossless=template.webp_lossless,
                )
                
                if success:
                    output_paths[format.value] = str(output_path)
                    logger.debug(f"Saved {format.value} to {output_path}")
                else:
                    warnings.append(f"Failed to save {format.value} format")
            
            # Generate separate alpha mask if requested
            if template.alpha_mode in [AlphaMode.SEPARATE, AlphaMode.BOTH]:
                if image_array.shape[2] == 4:
                    # Extract alpha channel
                    alpha_array = image_array[:, :, 3:4]  # Keep as (H, W, 1)
                    
                    # Save alpha mask
                    alpha_filename = f"{template.name}_alpha.png"
                    alpha_path = asset_dir / alpha_filename
                    
                    success = save_image_format(
                        alpha_array,
                        alpha_path,
                        OutputFormat.PNG,
                        png_compression=template.png_compression,
                    )
                    
                    if success:
                        output_paths['alpha_mask'] = str(alpha_path)
                        logger.debug(f"Saved alpha mask to {alpha_path}")
                    else:
                        warnings.append("Failed to save separate alpha mask")
                else:
                    warnings.append("Separate alpha mask requested but image has no alpha channel")
            
            # Optional animation post-processing
            if template.animation and template.animation.enabled:
                logger.debug(f"Applying animation to asset '{template.name}'")
                animation_paths = self._apply_animation(
                    template,
                    image_array,
                    asset_dir,
                    output_paths,
                )
                
                if animation_paths:
                    output_paths.update(animation_paths)
                    logger.debug(f"Generated {len(animation_paths)} animated outputs")
                else:
                    warnings.append("Animation generation failed, preserved static asset")
            
            # Create asset metadata
            metadata = self._create_metadata(template, image_array, output_paths)
            
            # Save metadata JSON
            metadata_path = asset_dir / f"{template.name}_metadata.json"
            self._save_metadata(metadata, metadata_path)
            
            # Update generation cache
            self._update_generation_cache(template, metadata)
            
            generation_time = time.time() - start_time
            logger.info(
                f"Successfully generated asset '{template.name}' in {generation_time:.2f}s "
                f"({len(output_paths)} outputs)"
            )
            
            return GenerationResult(
                success=True,
                asset_id=asset_id,
                template_name=template.name,
                output_paths=output_paths,
                metadata=metadata,
                generation_time=generation_time,
                error=None,
                warnings=warnings,
            )
            
        except Exception as e:
            generation_time = time.time() - start_time
            error_msg = f"Asset generation failed: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return GenerationResult(
                success=False,
                asset_id=asset_id,
                template_name=template.name,
                output_paths={},
                metadata=None,
                generation_time=generation_time,
                error=error_msg,
                warnings=[],
            )
    
    def batch_generate(
        self,
        templates: List[Template],
        parallel: bool = True,
        max_workers: Optional[int] = None,
    ) -> List[GenerationResult]:
        """
        Generate multiple assets in batch, optionally using parallel processing.
        
        Uses multiprocessing to leverage all CPU cores for maximum throughput.
        Progress is tracked and can be queried via get_progress().
        
        Args:
            templates: List of templates to generate
            parallel: Use multiprocessing for parallel generation
            max_workers: Maximum worker processes (defaults to CPU count)
            
        Returns:
            List of GenerationResult objects (one per template)
            
        Notes:
            - Progress is reported every 10% completion
            - Errors in individual assets don't stop the batch
            - Failed assets are logged and included in results with success=False
        """
        if not templates:
            logger.warning("batch_generate called with empty template list")
            return []
        
        # Generate batch ID
        batch_id = hashlib.sha256(
            f"{datetime.now().isoformat()}-{len(templates)}".encode()
        ).hexdigest()[:16]
        
        logger.info(
            f"Starting batch generation: {len(templates)} assets "
            f"(parallel={parallel}, batch_id={batch_id})"
        )
        
        # Initialize progress tracking
        progress = ProgressInfo(
            batch_id=batch_id,
            total=len(templates),
            completed=0,
            failed=0,
            current_asset=None,
            percent_complete=0.0,
            estimated_time_remaining=None,
            errors=[],
        )
        self._batch_progress[batch_id] = progress
        
        start_time = time.time()
        results = []
        
        if parallel and len(templates) > 1:
            # Parallel processing with multiprocessing
            if max_workers is None:
                max_workers = cpu_count()
            
            logger.info(f"Using {max_workers} worker processes for parallel generation")
            
            # Prepare worker arguments
            config = {
                'templates_dir': self.template_manager.templates_dir,
                'generators_dir': self.generator_manager.generators_dir,
            }
            worker_args = [(template, self.output_dir, config) for template in templates]
            
            # Execute in parallel
            with Pool(processes=max_workers) as pool:
                # Use imap for progress tracking
                for i, result in enumerate(pool.imap(_generate_asset_worker, worker_args)):
                    results.append(result)
                    
                    # Update progress
                    progress.completed = i + 1
                    progress.percent_complete = (progress.completed / progress.total) * 100
                    
                    if not result.success:
                        progress.failed += 1
                        progress.errors.append((result.template_name, result.error))
                    
                    # Estimate time remaining
                    elapsed = time.time() - start_time
                    avg_time_per_asset = elapsed / progress.completed
                    remaining_assets = progress.total - progress.completed
                    progress.estimated_time_remaining = avg_time_per_asset * remaining_assets
                    
                    # Log progress every 10%
                    if progress.completed % max(1, progress.total // 10) == 0:
                        logger.info(
                            f"Batch progress: {progress.completed}/{progress.total} "
                            f"({progress.percent_complete:.1f}%) - "
                            f"Failed: {progress.failed}"
                        )
        else:
            # Sequential processing
            logger.info("Using sequential processing")
            
            for i, template in enumerate(templates):
                progress.current_asset = template.name
                
                result = self.generate_asset(template)
                results.append(result)
                
                # Update progress
                progress.completed = i + 1
                progress.percent_complete = (progress.completed / progress.total) * 100
                
                if not result.success:
                    progress.failed += 1
                    progress.errors.append((result.template_name, result.error))
                
                # Estimate time remaining
                elapsed = time.time() - start_time
                avg_time_per_asset = elapsed / progress.completed
                remaining_assets = progress.total - progress.completed
                progress.estimated_time_remaining = avg_time_per_asset * remaining_assets
                
                # Log progress every 10%
                if progress.completed % max(1, progress.total // 10) == 0:
                    logger.info(
                        f"Batch progress: {progress.completed}/{progress.total} "
                        f"({progress.percent_complete:.1f}%) - "
                        f"Failed: {progress.failed}"
                    )
        
        # Finalize progress
        progress.completed = progress.total
        progress.percent_complete = 100.0
        progress.estimated_time_remaining = 0.0
        progress.current_asset = None
        
        total_time = time.time() - start_time
        success_count = sum(1 for r in results if r.success)
        
        logger.info(
            f"Batch generation complete: {success_count}/{progress.total} successful "
            f"in {total_time:.2f}s (avg {total_time/progress.total:.2f}s per asset)"
        )
        
        if progress.failed > 0:
            logger.warning(f"Batch had {progress.failed} failures")
            for asset_name, error in progress.errors:
                logger.error(f"  - {asset_name}: {error}")
        
        return results
    
    def regenerate_changed(
        self,
        since: Optional[datetime] = None,
        templates: Optional[List[Template]] = None,
    ) -> List[GenerationResult]:
        """
        Regenerate only assets whose templates have changed since a given time.
        
        Uses generation cache to detect changes and avoid redundant regeneration.
        Useful for incremental builds and development workflows.
        
        Args:
            since: Only regenerate templates modified after this time
            templates: Optional list of templates to check (defaults to all discovered)
            
        Returns:
            List of GenerationResult objects for regenerated assets
            
        Notes:
            - Compares template content hash to detect changes
            - If since is None, regenerates all templates
            - If template is not in cache, it will be generated
        """
        logger.info(f"Starting incremental regeneration (since={since})")
        
        # Discover templates if not provided
        if templates is None:
            templates = self.template_manager.list_templates()
            logger.info(f"Discovered {len(templates)} templates")
        
        # Filter templates that need regeneration
        templates_to_generate = []
        
        for template in templates:
            template_hash = self._compute_template_hash(template)
            cache_key = template.template_id or template.name
            
            # Check if in cache
            if cache_key not in self._generation_cache:
                logger.debug(f"Template '{template.name}' not in cache, will generate")
                templates_to_generate.append(template)
                continue
            
            cached_entry = self._generation_cache[cache_key]
            
            # Check if template content changed
            if cached_entry.get('template_hash') != template_hash:
                logger.debug(f"Template '{template.name}' content changed, will regenerate")
                templates_to_generate.append(template)
                continue
            
            # Check if modified after 'since' time
            if since is not None:
                cached_time = datetime.fromisoformat(cached_entry.get('generated_at', '1970-01-01'))
                if template.modified and template.modified > since:
                    logger.debug(f"Template '{template.name}' modified after {since}, will regenerate")
                    templates_to_generate.append(template)
                    continue
            
            logger.debug(f"Template '{template.name}' unchanged, skipping")
        
        logger.info(
            f"Incremental regeneration: {len(templates_to_generate)}/{len(templates)} "
            f"templates need regeneration"
        )
        
        if not templates_to_generate:
            logger.info("No templates need regeneration")
            return []
        
        # Generate changed templates
        return self.batch_generate(templates_to_generate, parallel=True)
    
    def get_progress(self, batch_id: str) -> Optional[ProgressInfo]:
        """
        Get progress information for a batch generation operation.
        
        Args:
            batch_id: Batch ID returned by batch_generate()
            
        Returns:
            ProgressInfo object or None if batch_id not found
        """
        return self._batch_progress.get(batch_id)
    
    def clear_progress(self, batch_id: str) -> bool:
        """
        Clear progress tracking for a completed batch.
        
        Args:
            batch_id: Batch ID to clear
            
        Returns:
            True if cleared, False if not found
        """
        if batch_id in self._batch_progress:
            del self._batch_progress[batch_id]
            return True
        return False
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    def _create_theme_variant_template(
        self,
        base_template: Template,
        theme: str,
        theme_group: str,
    ) -> Template:
        """
        Create a theme-specific variant of a template.
        
        Resolves color tokens for the specified theme and creates a new
        template with a theme-specific name.
        
        Args:
            base_template: Base template to create variant from
            theme: Theme name to resolve colors for
            theme_group: Theme group ID for linking variants
            
        Returns:
            New Template with resolved colors and theme-specific name
        """
        # Create a copy of the template
        template_dict = asdict(base_template)
        
        # Update name to include theme
        template_dict['name'] = f"{base_template.name}_{theme}"
        
        # Resolve color tokens for this theme
        if template_dict.get('colors'):
            template_dict['colors'] = self.template_manager.resolve_color_tokens(
                template_dict['colors'],
                theme,
            )
        
        # Resolve colors in params (for icon layers, etc.)
        if 'params' in template_dict and template_dict['params']:
            template_dict['params'] = self._resolve_colors_in_params(
                template_dict['params'],
                theme,
            )
        
        # Create new template
        from models import Template as TemplateClass
        variant_template = self.template_manager._dict_to_template(template_dict)
        
        return variant_template
    
    def _resolve_colors_in_params(
        self,
        params: Dict[str, Any],
        theme: str,
    ) -> Dict[str, Any]:
        """
        Recursively resolve color tokens in parameter dictionary.
        
        Args:
            params: Parameter dictionary (may contain nested structures)
            theme: Theme name to resolve colors for
            
        Returns:
            Parameter dictionary with resolved colors
        """
        resolved_params = {}
        
        for key, value in params.items():
            if isinstance(value, str) and value.startswith('$'):
                # Color token - resolve it
                try:
                    resolved_params[key] = self.template_manager.theme_manager.resolve_color_token(
                        value,
                        theme,
                    )
                except ValueError:
                    # Keep original if resolution fails
                    resolved_params[key] = value
            
            elif isinstance(value, list):
                # List - resolve each item
                resolved_list = []
                for item in value:
                    if isinstance(item, str) and item.startswith('$'):
                        try:
                            resolved_list.append(
                                self.template_manager.theme_manager.resolve_color_token(item, theme)
                            )
                        except ValueError:
                            resolved_list.append(item)
                    elif isinstance(item, dict):
                        resolved_list.append(self._resolve_colors_in_params(item, theme))
                    else:
                        resolved_list.append(item)
                resolved_params[key] = resolved_list
            
            elif isinstance(value, dict):
                # Nested dict - recurse
                resolved_params[key] = self._resolve_colors_in_params(value, theme)
            
            else:
                # Other types - keep as is
                resolved_params[key] = value
        
        return resolved_params
    
    def _validate_theme_consistency(
        self,
        results: Dict[str, GenerationResult],
    ) -> List[str]:
        """
        Validate visual consistency across theme variants.
        
        Checks that all variants have:
        - Same dimensions
        - Same output formats
        - Similar file sizes (within reasonable range)
        - All successful or all failed
        
        Args:
            results: Dictionary of theme -> GenerationResult
            
        Returns:
            List of warning messages (empty if consistent)
        """
        warnings = []
        
        if not results:
            return warnings
        
        # Get successful results
        successful_results = {
            theme: result
            for theme, result in results.items()
            if result.success and result.metadata
        }
        
        if not successful_results:
            return warnings
        
        # Check if some variants failed
        failed_count = len(results) - len(successful_results)
        if failed_count > 0:
            warnings.append(
                f"{failed_count} theme variant(s) failed to generate"
            )
        
        # Get reference result (first successful one)
        ref_theme, ref_result = next(iter(successful_results.items()))
        ref_metadata = ref_result.metadata
        
        # Check dimensions consistency
        for theme, result in successful_results.items():
            if theme == ref_theme:
                continue
            
            if result.metadata.dimensions != ref_metadata.dimensions:
                warnings.append(
                    f"Dimension mismatch: {theme} has {result.metadata.dimensions}, "
                    f"{ref_theme} has {ref_metadata.dimensions}"
                )
        
        # Check format consistency
        ref_formats = set(ref_result.output_paths.keys())
        for theme, result in successful_results.items():
            if theme == ref_theme:
                continue
            
            variant_formats = set(result.output_paths.keys())
            if variant_formats != ref_formats:
                missing = ref_formats - variant_formats
                extra = variant_formats - ref_formats
                
                if missing:
                    warnings.append(
                        f"Format mismatch: {theme} missing formats: {', '.join(missing)}"
                    )
                if extra:
                    warnings.append(
                        f"Format mismatch: {theme} has extra formats: {', '.join(extra)}"
                    )
        
        # Check file size consistency (within 50% range is acceptable)
        ref_size = ref_metadata.file_size
        for theme, result in successful_results.items():
            if theme == ref_theme:
                continue
            
            variant_size = result.metadata.file_size
            size_ratio = variant_size / ref_size if ref_size > 0 else 1.0
            
            if size_ratio < 0.5 or size_ratio > 2.0:
                warnings.append(
                    f"File size variance: {theme} is {size_ratio:.1f}x the size of {ref_theme} "
                    f"({variant_size} vs {ref_size} bytes)"
                )
        
        return warnings
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    def _apply_animation(
        self,
        template: Template,
        base_image: np.ndarray,
        asset_dir: Path,
        existing_paths: Dict[str, str],
    ) -> Dict[str, str]:
        """
        Apply animation post-processing to generated asset.
        
        This is an optional step that runs after static asset generation.
        Generates animated SVG and/or sprite sheets based on animation config.
        
        Args:
            template: Template with animation configuration
            base_image: Base image array to animate
            asset_dir: Asset output directory
            existing_paths: Existing output paths (for SVG input)
            
        Returns:
            Dictionary of animation output paths (format -> path)
        """
        animation_paths = {}
        
        try:
            from animation.svg_animator import SVGAnimator
            from animation.apng_animator import APNGAnimator
            from animation.sprite_sheet import SpriteSheetGenerator
            from models import AnimationOutputType
            
            animation_config = template.animation
            output_type = animation_config.output_type
            
            supports_svg = output_type in [
                AnimationOutputType.SVG_SMIL,
                AnimationOutputType.BOTH,
                AnimationOutputType.ALL,
            ]
            supports_sprite_sheet = output_type in [
                AnimationOutputType.SPRITE_SHEET,
                AnimationOutputType.BOTH,
                AnimationOutputType.ALL,
            ]
            supports_apng = output_type in [
                AnimationOutputType.APNG,
                AnimationOutputType.ALL,
            ] or OutputFormat.APNG in template.output_formats

            # Generate animated SVG
            if supports_svg:
                # Check if we have a static SVG to animate
                svg_path = existing_paths.get('svg')
                
                if svg_path and Path(svg_path).exists():
                    # Animate existing SVG
                    animator = SVGAnimator()
                    
                    motion_names = '_'.join([mt.value for mt in animation_config.motion_types])
                    animated_svg_filename = f"{template.name}_animated_{motion_names}.svg"
                    animated_svg_path = asset_dir / animated_svg_filename
                    
                    success = animator.animate_svg(
                        Path(svg_path),
                        animated_svg_path,
                        animation_config,
                    )
                    
                    if success:
                        animation_paths['animated_svg'] = str(animated_svg_path)
                        logger.debug(f"Generated animated SVG: {animated_svg_path}")
                    else:
                        logger.warning("Failed to generate animated SVG")
                else:
                    logger.warning("Animated SVG requested but no static SVG found")
            
            # Generate sprite sheet
            if supports_sprite_sheet:
                generator = SpriteSheetGenerator()
                
                motion_names = '_'.join([mt.value for mt in animation_config.motion_types])
                sprite_filename = f"{template.name}_sprite_{motion_names}.png"
                sprite_path = asset_dir / sprite_filename
                
                sprite_result, metadata_result = generator.generate_sprite_sheet(
                    base_image,
                    animation_config,
                    sprite_path,
                )
                
                if sprite_result and metadata_result:
                    animation_paths['sprite_sheet'] = str(sprite_result)
                    animation_paths['sprite_metadata'] = str(metadata_result)
                    logger.debug(f"Generated sprite sheet: {sprite_result}")
                else:
                    logger.warning("Failed to generate sprite sheet")

            if supports_apng:
                apng_animator = APNGAnimator()
                motion_names = '_'.join([mt.value for mt in animation_config.motion_types])
                apng_filename = f"{template.name}_animated_{motion_names}.apng"
                apng_path = asset_dir / apng_filename
                apng_result = apng_animator.generate_apng(
                    base_image,
                    animation_config,
                    apng_path,
                )

                if apng_result:
                    animation_paths['apng'] = str(apng_result)
                    logger.debug(f"Generated APNG: {apng_result}")
                else:
                    logger.warning("Failed to generate APNG")
            
            return animation_paths
            
        except Exception as e:
            logger.error(f"Animation post-processing failed: {e}")
            # Don't fail the entire generation - just log and return empty
            return {}
    
    def _create_metadata(
        self,
        template: Template,
        image_array: np.ndarray,
        output_paths: Dict[str, str],
    ) -> AssetMetadata:
        """
        Create asset metadata from template and generated image.
        
        Args:
            template: Source template
            image_array: Generated image array
            output_paths: Dictionary of format -> file path
            
        Returns:
            AssetMetadata object
        """
        height, width, channels = image_array.shape
        
        # Determine color mode
        if channels == 4:
            color_mode = 'RGBA'
            has_alpha = True
        elif channels == 3:
            color_mode = 'RGB'
            has_alpha = False
        elif channels == 1:
            color_mode = 'L'
            has_alpha = False
        else:
            color_mode = 'UNKNOWN'
            has_alpha = False
        
        # Calculate file size (sum of all outputs)
        total_size = 0
        for path_str in output_paths.values():
            path = Path(path_str)
            if path.exists():
                total_size += path.stat().st_size
        
        # Determine primary format
        primary_format = template.output_formats[0].value if template.output_formats else 'png'
        
        # Animation info
        is_animated = template.animation is not None and template.animation.enabled
        animation_type = None
        frame_count = None
        duration = None
        
        if is_animated:
            animation_type = ','.join([mt.value for mt in template.animation.motion_types])
            duration = template.animation.duration
            frame_count = int(template.animation.duration * template.animation.fps)
        
        return AssetMetadata(
            name=template.name,
            description=template.description,
            category=template.category,
            tags=template.tags,
            generator=template.generator_type.value,
            template_source=template.parent_template or template.name,
            generation_timestamp=datetime.now(),
            dimensions=(width, height),
            format=primary_format,
            file_size=total_size,
            color_mode=color_mode,
            has_alpha=has_alpha,
            dpi=72,  # Standard screen DPI
            theme_variant=template.theme_variants[0] if template.theme_variants else None,
            theme_group=None,  # Will be set by library manager
            is_animated=is_animated,
            animation_type=animation_type,
            frame_count=frame_count,
            duration=duration,
            usage_count=0,
            last_used=None,
            validation_passed=True,
            validation_warnings=[],
        )
    
    def _save_metadata(self, metadata: AssetMetadata, output_path: Path) -> bool:
        """
        Save asset metadata to JSON file.
        
        Args:
            metadata: AssetMetadata object
            output_path: Path to save JSON file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert to dict
            metadata_dict = asdict(metadata)
            
            # Convert datetime objects to ISO format strings
            for key, value in metadata_dict.items():
                if isinstance(value, datetime):
                    metadata_dict[key] = value.isoformat()
            
            # Save to JSON
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(metadata_dict, f, indent=2)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to save metadata to {output_path}: {e}")
            return False
    
    def _compute_template_hash(self, template: Template) -> str:
        """
        Compute hash of template content for change detection.
        
        Args:
            template: Template to hash
            
        Returns:
            SHA256 hash string
        """
        # Convert template to dict and serialize
        template_dict = asdict(template)
        
        # Remove fields that don't affect generation
        template_dict.pop('created', None)
        template_dict.pop('modified', None)
        template_dict.pop('template_id', None)
        
        # Serialize to JSON (sorted keys for consistency)
        template_json = json.dumps(template_dict, sort_keys=True)
        
        # Compute hash
        return hashlib.sha256(template_json.encode()).hexdigest()
    
    def _load_generation_cache(self) -> Dict[str, Any]:
        """
        Load generation cache from disk.
        
        Returns:
            Cache dictionary
        """
        if not self._generation_cache_file.exists():
            return {}
        
        try:
            with open(self._generation_cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load generation cache: {e}")
            return {}
    
    def _save_generation_cache(self) -> bool:
        """
        Save generation cache to disk.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            with open(self._generation_cache_file, 'w', encoding='utf-8') as f:
                json.dump(self._generation_cache, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Failed to save generation cache: {e}")
            return False
    
    def _update_generation_cache(self, template: Template, metadata: AssetMetadata) -> None:
        """
        Update generation cache with new entry.
        
        Args:
            template: Generated template
            metadata: Asset metadata
        """
        cache_key = template.template_id or template.name
        
        self._generation_cache[cache_key] = {
            'template_hash': self._compute_template_hash(template),
            'generated_at': datetime.now().isoformat(),
            'asset_name': metadata.name,
            'dimensions': metadata.dimensions,
            'file_size': metadata.file_size,
        }
        
        # Save cache to disk
        self._save_generation_cache()
    
    def clear_cache(self) -> None:
        """
        Clear generation cache.
        
        Forces regeneration of all assets on next incremental build.
        """
        self._generation_cache.clear()
        self._save_generation_cache()
        logger.info("Generation cache cleared")
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get engine statistics.
        
        Returns:
            Dictionary with statistics about cached assets, generators, etc.
        """
        return {
            'output_dir': str(self.output_dir),
            'cached_assets': len(self._generation_cache),
            'active_batches': len(self._batch_progress),
            'available_generators': len(self.generator_manager.list_generators()),
            'templates_dir': str(self.template_manager.templates_dir),
            'generators_dir': str(self.generator_manager.generators_dir),
        }
    
    def __repr__(self) -> str:
        """String representation"""
        stats = self.get_statistics()
        return (
            f"UIForgeEngine("
            f"output_dir={stats['output_dir']}, "
            f"cached_assets={stats['cached_assets']}, "
            f"generators={stats['available_generators']})"
        )


# ============================================================================
# Convenience Functions
# ============================================================================

# Global engine instance (singleton pattern)
_engine: Optional[UIForgeEngine] = None


def get_engine(
    output_dir: Optional[Path] = None,
    templates_dir: Optional[Path] = None,
    generators_dir: Optional[Path] = None,
) -> UIForgeEngine:
    """
    Get the global UIForgeEngine instance.
    
    Creates and initializes the engine on first call.
    
    Args:
        output_dir: Base output directory (only used on first call)
        templates_dir: Templates directory (only used on first call)
        generators_dir: Generators directory (only used on first call)
        
    Returns:
        Global UIForgeEngine instance
    """
    global _engine
    if _engine is None:
        _engine = UIForgeEngine(
            output_dir=output_dir,
            templates_dir=templates_dir,
            generators_dir=generators_dir,
        )
    return _engine


def reset_engine() -> None:
    """
    Reset the global UIForgeEngine instance.
    
    Useful for testing or when configuration changes.
    """
    global _engine
    _engine = None
