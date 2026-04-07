"""
UI Forge Showcase Generator - Default Mode
Generates showcase icons with validation OFF (the default behavior)
Perfect for UI/icon generation - no annoying schema validation!
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from models import Template, GeneratorType, OutputFormat, AlphaMode
from core import UIForgeEngine
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def create_showcase_templates():
    """Create showcase icon templates - DIY and INSANE styles"""
    
    templates = []
    
    # DIY 1: Paintbrush
    templates.append(Template(
        name="diy-paintbrush",
        description="Hand-drawn paintbrush with sketchy style",
        generator_type=GeneratorType.ICON,
        category="showcase",
        tags=["diy", "handdrawn", "tool"],
        output_formats=[OutputFormat.PNG],
        dimensions={"width": 128, "height": 128},
        colors=["#8b4513", "#ff6b6b", "#2c2c2c"],
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                {
                    "type": "rect",
                    "geometry": {"x": 58, "y": 80, "width": 12, "height": 45, "rx": 2},
                    "fill": {"type": "solid", "colors": ["#8b4513"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                {
                    "type": "rect",
                    "geometry": {"x": 56, "y": 70, "width": 16, "height": 12},
                    "fill": {"type": "solid", "colors": ["#2c2c2c"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                {
                    "type": "polygon",
                    "geometry": {"points": [[64, 70], [74, 35], [54, 35]]},
                    "fill": {"type": "solid", "colors": ["#ff6b6b"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 32, "r": 6},
                    "fill": {"type": "solid", "colors": ["#ff6b6b"]},
                    "blend_mode": "normal",
                    "opacity": 0.8
                },
            ],
            "padding": 12,
            "antialias_factor": 2
        },
        version="1.0"
    ))
    
    # INSANE 1: Holographic Prism
    templates.append(Template(
        name="insane-holographic",
        description="Complex holographic prism with multi-layer effects",
        generator_type=GeneratorType.ICON,
        category="showcase",
        tags=["insane", "holographic", "complex"],
        output_formats=[OutputFormat.PNG],
        dimensions={"width": 128, "height": 128},
        colors=["#ff0080", "#00ffff", "#ffff00", "#8000ff", "#ffffff"],
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                {
                    "type": "polygon",
                    "geometry": {"points": [[64, 20], [95, 40], [95, 88], [64, 108], [33, 88], [33, 40]]},
                    "fill": {"type": "solid", "colors": ["#ff0080"]},
                    "blend_mode": "screen",
                    "opacity": 0.8
                },
                {
                    "type": "polygon",
                    "geometry": {"points": [[64, 35], [80, 50], [64, 64]]},
                    "fill": {"type": "solid", "colors": ["#ffff00"]},
                    "blend_mode": "overlay",
                    "opacity": 0.6
                },
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 64, "r": 12},
                    "fill": {"type": "solid", "colors": ["#ffffff"]},
                    "blend_mode": "screen",
                    "opacity": 1.0
                },
            ],
            "padding": 8,
            "antialias_factor": 3
        },
        version="1.0"
    ))
    
    return templates


def main():
    """Generate showcase icons (validation is OFF by default now!)"""
    
    logger.info("=" * 70)
    logger.info("🎨 UI FORGE SHOWCASE GENERATOR")
    logger.info("=" * 70)
    logger.info("✨ Validation is OFF by default - no annoying schema errors!")
    
    # Initialize engine (validation is off by default)
    engine = UIForgeEngine()
    
    # Create templates
    templates = create_showcase_templates()
    logger.info(f"\n📝 Created {len(templates)} showcase templates")
    
    # Generate all icons
    logger.info("\n🔨 Generating icons...")
    results = []
    
    for i, template in enumerate(templates, 1):
        logger.info(f"\n[{i}/{len(templates)}] {template.name}")
        
        try:
            result = engine.generate_asset(template)
            
            if result.success:
                logger.info(f"  ✅ Success! Generated in {result.generation_time:.2f}s")
                results.append(result)
            else:
                logger.error(f"  ❌ Failed: {result.error}")
                
        except Exception as e:
            logger.error(f"  ❌ Exception: {e}")
            import traceback
            traceback.print_exc()
    
    # Summary
    logger.info("\n" + "=" * 70)
    logger.info(f"✨ Generated {len(results)}/{len(templates)} icons successfully")
    logger.info("=" * 70)
    
    if results:
        for result in results:
            for fmt, path in result.output_paths.items():
                logger.info(f"  📁 {result.template_name}.{fmt}: {path}")
    
    return len(results) > 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
