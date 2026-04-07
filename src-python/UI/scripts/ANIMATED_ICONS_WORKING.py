"""
20 ACTUALLY Animated Icons - SVG with SMIL Animations
Generates animated SVG icons that actually animate in the browser!
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import (
    Template, GeneratorType, OutputFormat, AlphaMode,
    AnimationConfig, MotionType, AnimationEasing, AnimationOutputType
)
from core import UIForgeEngine
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def create_animated_icons():
    """Create 20 animated icons - SVG format for actual animation"""
    templates = []
    
    # 1. Loading Spinner
    templates.append(Template(
        name="loading-spinner",
        description="Classic loading spinner",
        generator_type=GeneratorType.ICON,
        category="animated",
        tags=["loading", "spinner"],
        output_formats=[OutputFormat.SVG, OutputFormat.PNG],  # SVG for animation!
        dimensions={"width": 128, "height": 128},
        colors=["#3b82f6"],
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 50},
                 "fill": None, "stroke": {"color": "#3b82f6", "width": 8}},
                {"type": "circle", "geometry": {"cx": 64, "cy": 14, "r": 8},
                 "fill": {"type": "solid", "colors": ["#3b82f6"]}}
            ],
            "padding": 8, "antialias_factor": 2
        },
        animation=AnimationConfig(
            enabled=True,
            motion_types=[MotionType.ORBIT],
            duration=2.0,
            fps=30,
            loop=True,
            output_type=AnimationOutputType.SVG_SMIL  # SVG animation!
        ),
        version="1.0"
    ))
