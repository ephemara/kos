"""
UI Forge Animation System

Optional post-processing system for adding procedural animations to static assets.
Supports SMIL-based SVG animations, sprite sheet generation, and APNG export.

Motion Types:
- Classics: orbit, float, pulse, shake, elastic
- Intermediate: pendulum, wobble, figure8, heartbeat, glitch
- Physics: bounce, tumble, strobe, corkscrew, shiver, sway
- Complex: lissajous, flip, tremor, scan, warp, drift
"""

from animation.motion_library import (
    get_motion_function,
    list_motion_types,
    compose_motions,
    MOTION_REGISTRY,
)

from animation.svg_animator import (
    SVGAnimator,
    animate_svg_file,
    create_animated_svg_from_template,
    batch_animate_svgs,
)

from animation.sprite_sheet import (
    SpriteSheetGenerator,
    generate_animation_frames,
    generate_sprite_sheet_from_array,
    generate_sprite_sheet_from_file,
    batch_generate_sprite_sheets,
)
from animation.apng_animator import (
    APNGAnimator,
    generate_apng_from_array,
)

__all__ = [
    # Motion library
    'get_motion_function',
    'list_motion_types',
    'compose_motions',
    'MOTION_REGISTRY',
    
    # SVG animator
    'SVGAnimator',
    'animate_svg_file',
    'create_animated_svg_from_template',
    'batch_animate_svgs',
    
    # Sprite sheet generator
    'generate_animation_frames',
    'SpriteSheetGenerator',
    'generate_sprite_sheet_from_array',
    'generate_sprite_sheet_from_file',
    'batch_generate_sprite_sheets',

    # APNG animator
    'APNGAnimator',
    'generate_apng_from_array',
]
