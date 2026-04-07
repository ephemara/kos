"""
UI Forge Generator Modules

Auto-discovered generator modules for procedural asset generation.
Each generator implements the BaseGenerator interface and is automatically
registered with the GeneratorManager.

Available Generators:
- IconGenerator: Geometric primitives, gradients, layering
- BrushGenerator: Brush preview rendering with falloff curves
- PatternGenerator: Tileable patterns and textures
- CursorGenerator: Custom cursor graphics with hotspot metadata
- OverlayGenerator: Viewport overlays and HUD elements
- AlphaGenerator: Alpha mask generation and compositing
"""

from .base import (
    BaseGenerator,
    GeneratorRegistry,
    register_generator,
    get_registry
)

__all__ = [
    "BaseGenerator",
    "GeneratorRegistry",
    "register_generator",
    "get_registry"
]
