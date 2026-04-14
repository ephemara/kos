"""
UI Forge - Procedural UI Asset Generation System for K_OS DCC Suite

A Python-based system for generating icons, brushes, patterns, cursors, and overlays
through data-driven templates and procedural algorithms.

Features:
- Multi-format output (PNG, SVG, JPEG, WebP, TIFF)
- Alpha channel and mask generation
- Optional animation system (SMIL SVG, sprite sheets)
- Theme support (light/dark/high-contrast)
- Preview-approval workflow
- Tauri JSON-RPC integration
- Library-first architecture leveraging numpy, Pillow, svgwrite

Directory Structure:
- generators/: Auto-discovered generator modules
- templates/: Data-driven asset definitions (JSON/YAML)
- preview/: Staging area for generated assets before approval
- library/: Production asset library with metadata
- animation/: Optional animation system
- external/: External tool wrappers (ImageMagick, Inkscape, GIMP)
- utils/: Shared utility functions
"""

import sys
from pathlib import Path


__version__ = "0.1.0"
__author__ = "K_OS Development"

_PACKAGE_ROOT = Path(__file__).resolve().parent
if str(_PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(_PACKAGE_ROOT))

# Import initialization functions for easy access
from .initialize import (
    initialize_ui_forge,
    get_system,
    shutdown_ui_forge,
    UIForgeSystem,
    setup_logging,
)
from .llm_api import (
    angular,
    animate,
    batch,
    catalog,
    catalog_plan,
    catalog_signature,
    circle,
    dedupe_catalog,
    ellipse,
    fill,
    icon,
    layer,
    line,
    linear,
    path,
    polygon,
    radial,
    rect,
    render_catalog,
    render_catalog_partitioned,
    partition_catalog,
    solid,
    stroke,
)

# Package metadata and exports
__all__ = [
    "__version__",
    "__author__",
    # Initialization
    "initialize_ui_forge",
    "get_system",
    "shutdown_ui_forge",
    "UIForgeSystem",
    "setup_logging",
    # LLM authoring API
    "angular",
    "animate",
    "batch",
    "catalog",
    "catalog_plan",
    "catalog_signature",
    "circle",
    "dedupe_catalog",
    "ellipse",
    "fill",
    "icon",
    "layer",
    "line",
    "linear",
    "path",
    "polygon",
    "radial",
    "rect",
    "render_catalog",
    "render_catalog_partitioned",
    "partition_catalog",
    "solid",
    "stroke",
]
