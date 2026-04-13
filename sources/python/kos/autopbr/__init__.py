"""
KAutoPBR Module
===============
Material sampling and PBR generation with AI/ML capabilities
"""

from . import photogrammetry_helper

# AI/ML functions (lazy import to avoid loading heavy dependencies)
def get_ai_processor():
    """Lazy load AI processor"""
    from .ai_processor import get_processor
    return get_processor()

def get_tiling_engine():
    """Lazy load tiling engine"""
    from .inpainting import get_engine
    return get_engine()

# Export RPC functions
__all__ = [
    'photogrammetry_helper',
    'get_ai_processor',
    'get_tiling_engine',
]
