"""
Quick test script to generate icons and preview them in HTML gallery.
Tests the complete pipeline: Template → Generator → Preview Gallery

NO MODIFICATIONS TO GENERATORS - pure data-driven approach!
"""

import sys
from pathlib import Path

# Add UI module to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import Template, GeneratorType, OutputFormat, AlphaMode
from core import UIForgeEngine
from preview_manager import PreviewManager
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def create_test_templates():
    """Create test icon templates - pure data, no code changes!"""
    
    templates = []
    
    # Template 1: Simple circle icon (primary color)
    templates.append(Template(
        name="circle-icon-primary",
        description="Simple circular icon with primary color",
        generator_type=GeneratorType.ICON,
        category="icons",
        tags=["circle", "simple", "primary"],
        output_formats=[OutputFormat.PNG, OutputFormat.SVG],
        dimensions={"width": 64, "height": 64},
        colors=["#3b82f6"],  # Blue
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                {
                    "type": "circle",
                    "geometry": {"cx": 32, "cy": 32, "r": 24},
                    "fill": {"type": "solid", "colors": ["#3b82f6"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                }
            ],
            "padding": 4,
            "antialias_factor": 2
        },
        version="1.0"
    ))
    
    # Template 2: Gradient circle icon
    templates.append(Template(
        name="circle-icon-gradient",
        description="Circular icon with radial gradient",
        generator_type=GeneratorType.ICON,
        category="icons",
        tags=["circle", "gradient", "radial"],
        output_formats=[OutputFormat.PNG, OutputFormat.SVG],
        dimensions={"width": 64, "height": 64},
        colors=["#3b82f6", "#8b5cf6"],  # Blue to purple
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                {
                    "type": "circle",
                    "geometry": {"cx": 32, "cy": 32, "r": 24},
                    "fill": {
                        "type": "radial_gradient",
                        "colors": ["#3b82f6", "#8b5cf6"],
                        "stops": [0.0, 1.0]
                    },
                    "blend_mode": "normal",
                    "opacity": 1.0
                }
            ],
            "padding": 4,
            "antialias_factor": 2
        },
        version="1.0"
    ))
    
    # Template 3: Rectangle with stroke
    templates.append(Template(
        name="rect-icon-stroke",
        description="Rectangle icon with stroke outline",
        generator_type=GeneratorType.ICON,
        category="icons",
        tags=["rectangle", "stroke", "outline"],
        output_formats=[OutputFormat.PNG, OutputFormat.SVG],
        dimensions={"width": 64, "height": 64},
        colors=["#10b981"],  # Green
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                {
                    "type": "rect",
                    "geometry": {"x": 12, "y": 12, "width": 40, "height": 40, "rx": 8},
                    "fill": None,
                    "stroke": {
                        "color": "#10b981",
                        "width": 4,
                        "cap": "round",
                        "join": "round"
                    },
                    "blend_mode": "normal",
                    "opacity": 1.0
                }
            ],
            "padding": 4,
            "antialias_factor": 2
        },
        version="1.0"
    ))
    
    # Template 4: Multi-layer icon (background + foreground)
    templates.append(Template(
        name="layered-icon-complex",
        description="Multi-layer icon with background and foreground",
        generator_type=GeneratorType.ICON,
        category="icons",
        tags=["layered", "complex", "multi-color"],
        output_formats=[OutputFormat.PNG, OutputFormat.SVG],
        dimensions={"width": 64, "height": 64},
        colors=["#ef4444", "#fbbf24"],  # Red and yellow
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                # Background circle
                {
                    "type": "circle",
                    "geometry": {"cx": 32, "cy": 32, "r": 28},
                    "fill": {"type": "solid", "colors": ["#ef4444"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Foreground smaller circle
                {
                    "type": "circle",
                    "geometry": {"cx": 32, "cy": 32, "r": 16},
                    "fill": {"type": "solid", "colors": ["#fbbf24"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                }
            ],
            "padding": 4,
            "antialias_factor": 2
        },
        version="1.0"
    ))
    
    # Template 5: Triangle icon
    templates.append(Template(
        name="triangle-icon-warning",
        description="Triangle warning icon",
        generator_type=GeneratorType.ICON,
        category="icons",
        tags=["triangle", "warning", "alert"],
        output_formats=[OutputFormat.PNG, OutputFormat.SVG],
        dimensions={"width": 64, "height": 64},
        colors=["#fbbf24"],  # Yellow
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                {
                    "type": "polygon",
                    "geometry": {
                        "points": [
                            [32, 12],   # Top
                            [52, 52],   # Bottom right
                            [12, 52]    # Bottom left
                        ]
                    },
                    "fill": {"type": "solid", "colors": ["#fbbf24"]},
                    "stroke": {
                        "color": "#78350f",
                        "width": 2,
                        "cap": "round",
                        "join": "round"
                    },
                    "blend_mode": "normal",
                    "opacity": 1.0
                }
            ],
            "padding": 4,
            "antialias_factor": 2
        },
        version="1.0"
    ))
    
    # Template 6: Linear gradient rectangle
    templates.append(Template(
        name="rect-icon-linear-gradient",
        description="Rectangle with linear gradient fill",
        generator_type=GeneratorType.ICON,
        category="icons",
        tags=["rectangle", "gradient", "linear"],
        output_formats=[OutputFormat.PNG, OutputFormat.SVG],
        dimensions={"width": 64, "height": 64},
        colors=["#06b6d4", "#3b82f6"],  # Cyan to blue
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                {
                    "type": "rect",
                    "geometry": {"x": 12, "y": 12, "width": 40, "height": 40, "rx": 8},
                    "fill": {
                        "type": "linear_gradient",
                        "colors": ["#06b6d4", "#3b82f6"],
                        "stops": [0.0, 1.0],
                        "angle": 45
                    },
                    "blend_mode": "normal",
                    "opacity": 1.0
                }
            ],
            "padding": 4,
            "antialias_factor": 2
        },
        version="1.0"
    ))
    
    return templates


def main():
    """Generate icons and create HTML preview gallery"""
    
    logger.info("🚀 Starting UI Forge Icon Gallery Test")
    logger.info("=" * 60)
    
    # Initialize engine and preview manager
    engine = UIForgeEngine()
    preview_manager = PreviewManager()
    
    # Create test templates
    templates = create_test_templates()
    logger.info(f"📝 Created {len(templates)} test templates")
    
    # Generate preview ID
    preview_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_icon_test"
    logger.info(f"🎨 Preview ID: {preview_id}")
    
    # Generate all icons
    logger.info("\n🔨 Generating icons...")
    results = []
    for i, template in enumerate(templates, 1):
        logger.info(f"  [{i}/{len(templates)}] Generating {template.name}...")
        try:
            result = engine.generate_asset(template)
            if result.success:
                logger.info(f"    ✅ Success! Generated {len(result.output_paths)} formats")
                results.append(result)
                
                # Stage in preview
                preview_manager.stage_asset(result, preview_id=preview_id)
            else:
                logger.error(f"    ❌ Failed: {result.error}")
        except Exception as e:
            logger.error(f"    ❌ Exception: {e}")
    
    logger.info(f"\n✨ Generated {len(results)}/{len(templates)} icons successfully")
    
    # Generate HTML gallery
    logger.info("\n🎨 Generating HTML preview gallery...")
    try:
        gallery_path = preview_manager.generate_gallery(preview_id)
        logger.info(f"✅ Gallery created: {gallery_path}")
        
        # Get preview status
        status = preview_manager.get_preview_status(preview_id)
        logger.info(f"\n📊 Preview Status:")
        logger.info(f"  Total Assets: {status.total_assets}")
        logger.info(f"  Pending: {status.pending}")
        logger.info(f"  Approved: {status.approved}")
        logger.info(f"  Rejected: {status.rejected}")
        
        logger.info("\n" + "=" * 60)
        logger.info("🎉 SUCCESS! Open the gallery in your browser:")
        logger.info(f"   file:///{Path(gallery_path).absolute()}")
        logger.info("=" * 60)
        
        return gallery_path
        
    except Exception as e:
        logger.error(f"❌ Failed to generate gallery: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    gallery_path = main()
    if gallery_path:
        print(f"\n🌐 Open in browser: file:///{Path(gallery_path).absolute()}")
