"""
UI Forge Tauri Bridge

JSON-RPC interface between Python backend and Tauri/React frontend.
Exposes all major UI Forge functionality via decorated RPC functions.

Features:
- @register decorator for JSON-RPC function registration
- Structured error handling with clear error messages
- Async support for long-running operations
- Progress reporting for batch generation
- Hot-reload support for generators

Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8
"""

import asyncio
import logging
import traceback
from typing import Dict, List, Optional, Any, Callable
from functools import wraps
from pathlib import Path
from dataclasses import asdict

from core import UIForgeEngine, get_engine
from template_manager import TemplateManager
from preview_manager import PreviewManager
from library_manager import LibraryManager
from generator_manager import GeneratorManager
from models import Template, GeneratorType, OutputFormat, AlphaMode


# Configure logging
logger = logging.getLogger(__name__)


# ============================================================================
# JSON-RPC Registry
# ============================================================================

# Global registry for RPC functions
_rpc_registry: Dict[str, Callable] = {}


def register(name: str):
    """
    Decorator to register a function for JSON-RPC calls.
    
    Usage:
        @register("ui_forge.generate_asset")
        async def generate_asset_rpc(template_data: dict) -> dict:
            # Implementation
            pass
    
    Args:
        name: RPC function name (e.g., "ui_forge.generate_asset")
        
    Returns:
        Decorator function
    """
    def decorator(func: Callable) -> Callable:
        # Register the function
        _rpc_registry[name] = func
        logger.debug(f"Registered RPC function: {name}")
        
        # Wrap with error handling
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                # Call the original function
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)
                
                # Return success response
                return {
                    "success": True,
                    "data": result,
                    "error": None,
                }
                
            except Exception as e:
                # Log the error
                logger.error(f"RPC function '{name}' failed: {e}\n{traceback.format_exc()}")
                
                # Return error response
                return {
                    "success": False,
                    "data": None,
                    "error": {
                        "message": str(e),
                        "type": type(e).__name__,
                        "traceback": traceback.format_exc(),
                    },
                }
        
        return wrapper
    
    return decorator


def get_rpc_function(name: str) -> Optional[Callable]:
    """
    Get a registered RPC function by name.
    
    Args:
        name: RPC function name
        
    Returns:
        Callable function or None if not found
    """
    return _rpc_registry.get(name)


def list_rpc_functions() -> List[str]:
    """
    List all registered RPC function names.
    
    Returns:
        List of function names
    """
    return list(_rpc_registry.keys())


# ============================================================================
# Global Manager Instances
# ============================================================================

# These will be initialized on first use
_engine: Optional[UIForgeEngine] = None
_template_manager: Optional[TemplateManager] = None
_preview_manager: Optional[PreviewManager] = None
_library_manager: Optional[LibraryManager] = None
_generator_manager: Optional[GeneratorManager] = None


def get_managers() -> tuple:
    """
    Get or initialize all manager instances.
    
    Returns:
        Tuple of (engine, template_manager, preview_manager, library_manager, generator_manager)
    """
    global _engine, _template_manager, _preview_manager, _library_manager, _generator_manager
    
    if _engine is None:
        _engine = get_engine()
    
    if _template_manager is None:
        _template_manager = _engine.template_manager
    
    if _preview_manager is None:
        _preview_manager = PreviewManager()
        _preview_manager.load_all_previews()
    
    if _library_manager is None:
        _library_manager = LibraryManager()
        _library_manager.load_library()
    
    if _generator_manager is None:
        _generator_manager = _engine.generator_manager
    
    return _engine, _template_manager, _preview_manager, _library_manager, _generator_manager


# ============================================================================
# RPC Handler Functions
# ============================================================================

@register("ui_forge.generate_asset")
async def generate_asset_rpc(template_data: dict) -> dict:
    """
    Generate a single asset from template data.
    
    Args:
        template_data: Template dictionary with all required fields
        
    Returns:
        Dictionary with generation result:
        {
            "success": bool,
            "asset_id": str,
            "template_name": str,
            "output_paths": dict,
            "metadata": dict,
            "generation_time": float,
            "warnings": list,
        }
    """
    engine, template_manager, _, _, _ = get_managers()
    
    logger.info(f"RPC: generate_asset called for '{template_data.get('name', 'unknown')}'")
    
    # Parse template data
    template = template_manager._dict_to_template(template_data)
    
    # Generate asset
    result = engine.generate_asset(template)
    
    # Convert result to dict
    result_dict = {
        "success": result.success,
        "asset_id": result.asset_id,
        "template_name": result.template_name,
        "output_paths": result.output_paths,
        "metadata": asdict(result.metadata) if result.metadata else None,
        "generation_time": result.generation_time,
        "error": result.error,
        "warnings": result.warnings,
    }
    
    # Convert datetime objects to ISO strings
    if result_dict["metadata"]:
        for key, value in result_dict["metadata"].items():
            if hasattr(value, 'isoformat'):
                result_dict["metadata"][key] = value.isoformat()
    
    return result_dict


@register("ui_forge.batch_generate")
async def batch_generate_rpc(
    template_paths: List[str],
    parallel: bool = True,
    max_workers: Optional[int] = None,
) -> dict:
    """
    Generate multiple assets in batch with parallel processing.
    
    Args:
        template_paths: List of paths to template files
        parallel: Use multiprocessing for parallel generation
        max_workers: Maximum worker processes (defaults to CPU count)
        
    Returns:
        Dictionary with batch information:
        {
            "batch_id": str,
            "status": str,
            "total": int,
            "message": str,
        }
    """
    engine, template_manager, _, _, _ = get_managers()
    
    logger.info(f"RPC: batch_generate called with {len(template_paths)} templates")
    
    # Load templates
    templates = []
    for path_str in template_paths:
        try:
            template = template_manager.load_template(Path(path_str))
            templates.append(template)
        except Exception as e:
            logger.error(f"Failed to load template {path_str}: {e}")
    
    if not templates:
        raise ValueError("No valid templates to generate")
    
    # Start batch generation in background
    # For now, we'll run it synchronously but return immediately with batch ID
    # In a real implementation, this would be truly async
    
    import hashlib
    from datetime import datetime
    
    batch_id = hashlib.sha256(
        f"{datetime.now().isoformat()}-{len(templates)}".encode()
    ).hexdigest()[:16]
    
    # Run batch generation (this will block, but in production would be async)
    results = engine.batch_generate(templates, parallel=parallel, max_workers=max_workers)
    
    # Return batch info
    success_count = sum(1 for r in results if r.success)
    
    return {
        "batch_id": batch_id,
        "status": "completed",
        "total": len(templates),
        "completed": len(results),
        "successful": success_count,
        "failed": len(results) - success_count,
        "message": f"Batch generation completed: {success_count}/{len(templates)} successful",
    }


@register("ui_forge.get_progress")
async def get_progress_rpc(batch_id: str) -> dict:
    """
    Get progress information for a batch generation operation.
    
    Args:
        batch_id: Batch ID returned by batch_generate
        
    Returns:
        Dictionary with progress information:
        {
            "batch_id": str,
            "total": int,
            "completed": int,
            "failed": int,
            "current_asset": str,
            "percent_complete": float,
            "estimated_time_remaining": float,
            "errors": list,
        }
    """
    engine, _, _, _, _ = get_managers()
    
    logger.debug(f"RPC: get_progress called for batch '{batch_id}'")
    
    progress = engine.get_progress(batch_id)
    
    if progress is None:
        raise ValueError(f"Batch not found: {batch_id}")
    
    return {
        "batch_id": progress.batch_id,
        "total": progress.total,
        "completed": progress.completed,
        "failed": progress.failed,
        "current_asset": progress.current_asset,
        "percent_complete": progress.percent_complete,
        "estimated_time_remaining": progress.estimated_time_remaining,
        "errors": progress.errors,
    }


@register("ui_forge.list_templates")
async def list_templates_rpc(category: Optional[str] = None) -> List[dict]:
    """
    List available templates, optionally filtered by category.
    
    Args:
        category: Optional category filter (e.g., 'icons', 'brushes')
        
    Returns:
        List of template dictionaries with basic info:
        [
            {
                "name": str,
                "description": str,
                "generator_type": str,
                "category": str,
                "tags": list,
                "dimensions": dict,
                "output_formats": list,
            },
            ...
        ]
    """
    _, template_manager, _, _, _ = get_managers()
    
    logger.info(f"RPC: list_templates called (category={category})")
    
    templates = template_manager.list_templates(category=category)
    
    # Convert to simplified dicts
    template_list = []
    for template in templates:
        template_list.append({
            "name": template.name,
            "description": template.description,
            "generator_type": template.generator_type.value,
            "category": template.category,
            "tags": template.tags,
            "dimensions": template.dimensions,
            "output_formats": [fmt.value for fmt in template.output_formats],
            "theme_variants": template.theme_variants,
            "has_animation": template.animation is not None and template.animation.enabled,
        })
    
    return template_list


@register("ui_forge.approve_preview")
async def approve_preview_rpc(
    asset_ids: List[str],
    preview_id: Optional[str] = None,
    move_to_library: bool = True,
) -> dict:
    """
    Approve preview assets and optionally move to production library.
    
    Args:
        asset_ids: List of asset IDs to approve
        preview_id: Optional preview batch ID (searches all if None)
        move_to_library: If True, move approved assets to library
        
    Returns:
        Dictionary with approval results:
        {
            "approved": int,
            "moved_to_library": int,
            "library_asset_ids": list,
        }
    """
    _, _, preview_manager, library_manager, _ = get_managers()
    
    logger.info(f"RPC: approve_preview called for {len(asset_ids)} assets")
    
    # Approve assets
    approved_count = preview_manager.approve_assets(asset_ids, preview_id=preview_id)
    
    library_asset_ids = []
    
    # Move to library if requested
    if move_to_library:
        # Get approved entries
        if preview_id:
            approved_entries = preview_manager.get_approved_assets(preview_id)
        else:
            # Search all previews
            approved_entries = []
            for pid in preview_manager._previews.keys():
                approved_entries.extend(preview_manager.get_approved_assets(pid))
        
        # Filter to requested asset IDs
        entries_to_move = [e for e in approved_entries if e.asset_id in asset_ids]
        
        # Move to library
        library_asset_ids = library_manager.add_batch_to_library(entries_to_move)
    
    return {
        "approved": approved_count,
        "moved_to_library": len(library_asset_ids),
        "library_asset_ids": library_asset_ids,
    }


@register("ui_forge.get_library_index")
async def get_library_index_rpc() -> dict:
    """
    Get the complete library index with all assets and metadata.
    
    Returns:
        Library index dictionary:
        {
            "version": str,
            "generated": str,
            "total_assets": int,
            "categories": dict,
            "assets": list,
            "theme_groups": dict,
        }
    """
    _, _, _, library_manager, _ = get_managers()
    
    logger.info("RPC: get_library_index called")
    
    index = library_manager.get_index()
    
    return index


@register("ui_forge.reload_generator")
async def reload_generator_rpc(generator_type: str) -> dict:
    """
    Hot-reload a generator module without restarting the Python sidecar.
    
    Args:
        generator_type: Generator type to reload (e.g., 'icon', 'brush')
        
    Returns:
        Dictionary with reload status:
        {
            "status": str,
            "generator": str,
            "message": str,
        }
    """
    _, _, _, _, generator_manager = get_managers()
    
    logger.info(f"RPC: reload_generator called for '{generator_type}'")
    
    # Convert string to enum
    try:
        gen_type = GeneratorType(generator_type)
    except ValueError:
        raise ValueError(f"Invalid generator type: {generator_type}")
    
    # Reload generator
    generator_manager.reload_generator(gen_type)
    
    return {
        "status": "reloaded",
        "generator": generator_type,
        "message": f"Generator '{generator_type}' reloaded successfully",
    }


@register("ui_forge.get_preview_status")
async def get_preview_status_rpc(preview_id: str) -> dict:
    """
    Get status information for a preview batch.
    
    Args:
        preview_id: Preview batch ID
        
    Returns:
        Dictionary with preview status:
        {
            "preview_id": str,
            "total_assets": int,
            "pending": int,
            "approved": int,
            "rejected": int,
            "timestamp": str,
            "gallery_path": str,
        }
    """
    _, _, preview_manager, _, _ = get_managers()
    
    logger.debug(f"RPC: get_preview_status called for '{preview_id}'")
    
    status = preview_manager.get_preview_status(preview_id)
    
    return {
        "preview_id": status.preview_id,
        "total_assets": status.total_assets,
        "pending": status.pending,
        "approved": status.approved,
        "rejected": status.rejected,
        "timestamp": status.timestamp.isoformat(),
        "gallery_path": status.gallery_path,
    }


@register("ui_forge.list_generators")
async def list_generators_rpc() -> List[dict]:
    """
    List all available generators with metadata.
    
    Returns:
        List of generator info dictionaries:
        [
            {
                "generator_type": str,
                "class_name": str,
                "module_name": str,
                "file_path": str,
            },
            ...
        ]
    """
    _, _, _, _, generator_manager = get_managers()
    
    logger.info("RPC: list_generators called")
    
    generators = generator_manager.list_generators()
    
    return [
        {
            "generator_type": gen.generator_type.value,
            "class_name": gen.class_name,
            "module_name": gen.module_name,
            "file_path": gen.file_path,
        }
        for gen in generators
    ]


@register("ui_forge.search_library")
async def search_library_rpc(
    query: Optional[str] = None,
    category: Optional[str] = None,
    tags: Optional[List[str]] = None,
    theme_variant: Optional[str] = None,
    min_resolution: Optional[int] = None,
    max_resolution: Optional[int] = None,
) -> List[dict]:
    """
    Search library assets with filters.
    
    Args:
        query: Text search in name/description
        category: Filter by category
        tags: Filter by tags (any match)
        theme_variant: Filter by theme variant
        min_resolution: Minimum resolution (width or height)
        max_resolution: Maximum resolution (width or height)
        
    Returns:
        List of matching asset metadata dictionaries
    """
    _, _, _, library_manager, _ = get_managers()
    
    logger.info(f"RPC: search_library called (query={query}, category={category})")
    
    results = library_manager.search_assets(
        query=query,
        category=category,
        tags=tags,
        theme_variant=theme_variant,
        min_resolution=min_resolution,
        max_resolution=max_resolution,
    )
    
    # Convert to dicts
    return [
        {
            "name": metadata.name,
            "description": metadata.description,
            "category": metadata.category,
            "tags": metadata.tags,
            "dimensions": metadata.dimensions,
            "format": metadata.format,
            "file_size": metadata.file_size,
            "theme_variant": metadata.theme_variant,
            "is_animated": metadata.is_animated,
            "usage_count": metadata.usage_count,
        }
        for metadata in results
    ]


@register("ui_forge.get_statistics")
async def get_statistics_rpc() -> dict:
    """
    Get comprehensive statistics about the UI Forge system.
    
    Returns:
        Dictionary with statistics:
        {
            "engine": dict,
            "library": dict,
            "generators": int,
        }
    """
    engine, _, _, library_manager, generator_manager = get_managers()
    
    logger.info("RPC: get_statistics called")
    
    return {
        "engine": engine.get_statistics(),
        "library": library_manager.get_statistics(),
        "generators": len(generator_manager.list_generators()),
    }


# ============================================================================
# Initialization
# ============================================================================

def initialize_bridge():
    """
    Initialize the Tauri bridge and all managers.
    
    Call this on Python sidecar startup to ensure all systems are ready.
    """
    logger.info("Initializing UI Forge Tauri Bridge")
    
    # Initialize managers
    get_managers()
    
    # Log registered functions
    functions = list_rpc_functions()
    logger.info(f"Registered {len(functions)} RPC functions:")
    for func_name in functions:
        logger.info(f"  - {func_name}")
    
    logger.info("UI Forge Tauri Bridge initialized successfully")


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Initialize bridge
    initialize_bridge()
    
    # Print available functions
    print("\nAvailable RPC Functions:")
    for func_name in list_rpc_functions():
        print(f"  - {func_name}")
