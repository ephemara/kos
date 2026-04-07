"""
UI Forge Showcase Generator - DIY & Insane Styles
Generates 6 icons: 3 DIY/hand-drawn, 3 insane/complex
Creates beautiful HTML gallery for preview
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
    
    # ========================================================================
    # DIY / HAND-DRAWN STYLE (Sketchy, Simple, Organic)
    # ========================================================================
    
    # DIY 1: Paintbrush - Hand-drawn with wobbly bristles
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
                # Handle
                {
                    "type": "rect",
                    "geometry": {"x": 58, "y": 80, "width": 12, "height": 45, "rx": 2},
                    "fill": {"type": "solid", "colors": ["#8b4513"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Ferrule (metal part)
                {
                    "type": "rect",
                    "geometry": {"x": 56, "y": 70, "width": 16, "height": 12},
                    "fill": {"type": "solid", "colors": ["#2c2c2c"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Bristles (triangle)
                {
                    "type": "polygon",
                    "geometry": {"points": [[64, 70], [74, 35], [54, 35]]},
                    "fill": {"type": "solid", "colors": ["#ff6b6b"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Paint drip
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
    
    # DIY 2: Hammer - Sketchy construction tool
    templates.append(Template(
        name="diy-hammer",
        description="Sketchy hand-drawn hammer tool",
        generator_type=GeneratorType.ICON,
        category="showcase",
        tags=["diy", "handdrawn", "tool"],
        output_formats=[OutputFormat.PNG],
        dimensions={"width": 128, "height": 128},
        colors=["#8b4513", "#2c2c2c", "#696969"],
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                # Handle
                {
                    "type": "rect",
                    "geometry": {"x": 54, "y": 70, "width": 20, "height": 50, "rx": 3},
                    "fill": {"type": "solid", "colors": ["#8b4513"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Hammer head
                {
                    "type": "rect",
                    "geometry": {"x": 30, "y": 45, "width": 68, "height": 30, "rx": 4},
                    "fill": {"type": "solid", "colors": ["#2c2c2c"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Highlight on head
                {
                    "type": "rect",
                    "geometry": {"x": 35, "y": 50, "width": 20, "height": 8, "rx": 2},
                    "fill": {"type": "solid", "colors": ["#696969"]},
                    "blend_mode": "screen",
                    "opacity": 0.6
                },
            ],
            "padding": 12,
            "antialias_factor": 2
        },
        version="1.0"
    ))
    
    # DIY 3: Wrench - Hand-drawn adjustable wrench
    templates.append(Template(
        name="diy-wrench",
        description="Hand-drawn wrench tool with organic feel",
        generator_type=GeneratorType.ICON,
        category="showcase",
        tags=["diy", "handdrawn", "tool"],
        output_formats=[OutputFormat.PNG],
        dimensions={"width": 128, "height": 128},
        colors=["#708090", "#a9a9a9"],
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                # Wrench body
                {
                    "type": "rect",
                    "geometry": {"x": 50, "y": 70, "width": 28, "height": 50, "rx": 4},
                    "fill": {"type": "solid", "colors": ["#708090"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Left jaw
                {
                    "type": "rect",
                    "geometry": {"x": 45, "y": 30, "width": 12, "height": 45, "rx": 2},
                    "fill": {"type": "solid", "colors": ["#708090"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Right jaw
                {
                    "type": "rect",
                    "geometry": {"x": 71, "y": 30, "width": 12, "height": 45, "rx": 2},
                    "fill": {"type": "solid", "colors": ["#708090"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Highlight
                {
                    "type": "rect",
                    "geometry": {"x": 55, "y": 75, "width": 18, "height": 6, "rx": 1},
                    "fill": {"type": "solid", "colors": ["#a9a9a9"]},
                    "blend_mode": "screen",
                    "opacity": 0.5
                },
            ],
            "padding": 12,
            "antialias_factor": 2
        },
        version="1.0"
    ))
    
    # ========================================================================
    # INSANE / COMPLEX STYLE (Multi-layer, Gradients, Blend Modes)
    # ========================================================================
    
    # INSANE 1: Holographic Prism - Complex prismatic effect
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
                # Base hexagon
                {
                    "type": "polygon",
                    "geometry": {"points": [[64, 20], [95, 40], [95, 88], [64, 108], [33, 88], [33, 40]]},
                    "fill": {"type": "solid", "colors": ["#ff0080"]},
                    "blend_mode": "screen",
                    "opacity": 0.8
                },
                # Top facet
                {
                    "type": "polygon",
                    "geometry": {"points": [[64, 35], [80, 50], [64, 64]]},
                    "fill": {"type": "solid", "colors": ["#ffff00"]},
                    "blend_mode": "overlay",
                    "opacity": 0.6
                },
                # Right facet
                {
                    "type": "polygon",
                    "geometry": {"points": [[64, 64], [80, 78], [64, 93]]},
                    "fill": {"type": "solid", "colors": ["#00ffff"]},
                    "blend_mode": "overlay",
                    "opacity": 0.6
                },
                # Left facet
                {
                    "type": "polygon",
                    "geometry": {"points": [[64, 64], [48, 78], [64, 93]]},
                    "fill": {"type": "solid", "colors": ["#8000ff"]},
                    "blend_mode": "overlay",
                    "opacity": 0.6
                },
                # Top-left facet
                {
                    "type": "polygon",
                    "geometry": {"points": [[64, 35], [48, 50], [64, 64]]},
                    "fill": {"type": "solid", "colors": ["#ff0080"]},
                    "blend_mode": "overlay",
                    "opacity": 0.6
                },
                # Center glow
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
    
    # INSANE 2: Quantum Flux - Multi-ring energy effect
    templates.append(Template(
        name="insane-quantum",
        description="Quantum flux with concentric energy rings",
        generator_type=GeneratorType.ICON,
        category="showcase",
        tags=["insane", "quantum", "complex"],
        output_formats=[OutputFormat.PNG],
        dimensions={"width": 128, "height": 128},
        colors=["#00ffff", "#ff00ff", "#ffff00", "#ffffff"],
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                # Outer ring
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 64, "r": 50},
                    "fill": {"type": "solid", "colors": ["#00ffff"]},
                    "blend_mode": "normal",
                    "opacity": 0.3
                },
                # Middle ring
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 64, "r": 38},
                    "fill": {"type": "solid", "colors": ["#ff00ff"]},
                    "blend_mode": "normal",
                    "opacity": 0.3
                },
                # Inner ring
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 64, "r": 26},
                    "fill": {"type": "solid", "colors": ["#ffff00"]},
                    "blend_mode": "normal",
                    "opacity": 0.3
                },
                # Core
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 64, "r": 18},
                    "fill": {"type": "solid", "colors": ["#ffffff"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Energy particles - top
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 30, "r": 4},
                    "fill": {"type": "solid", "colors": ["#ffff00"]},
                    "blend_mode": "screen",
                    "opacity": 0.9
                },
                # Energy particles - right
                {
                    "type": "circle",
                    "geometry": {"cx": 90, "cy": 64, "r": 4},
                    "fill": {"type": "solid", "colors": ["#00ffff"]},
                    "blend_mode": "screen",
                    "opacity": 0.9
                },
                # Energy particles - bottom
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 98, "r": 4},
                    "fill": {"type": "solid", "colors": ["#ff00ff"]},
                    "blend_mode": "screen",
                    "opacity": 0.9
                },
                # Energy particles - left
                {
                    "type": "circle",
                    "geometry": {"cx": 38, "cy": 64, "r": 4},
                    "fill": {"type": "solid", "colors": ["#00ffff"]},
                    "blend_mode": "screen",
                    "opacity": 0.9
                },
            ],
            "padding": 8,
            "antialias_factor": 3
        },
        version="1.0"
    ))
    
    # INSANE 3: Cosmic Nebula - Radial gradient clouds
    templates.append(Template(
        name="insane-nebula",
        description="Cosmic nebula with radial gradient clouds",
        generator_type=GeneratorType.ICON,
        category="showcase",
        tags=["insane", "cosmic", "complex"],
        output_formats=[OutputFormat.PNG],
        dimensions={"width": 128, "height": 128},
        colors=["#1a0033", "#ff1493", "#00bfff", "#9400d3", "#ffffff"],
        alpha_mode=AlphaMode.EMBEDDED,
        params={
            "layers": [
                # Dark space background
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 64, "r": 60},
                    "fill": {"type": "solid", "colors": ["#1a0033"]},
                    "blend_mode": "normal",
                    "opacity": 1.0
                },
                # Pink nebula cloud
                {
                    "type": "circle",
                    "geometry": {"cx": 50, "cy": 50, "r": 35},
                    "fill": {
                        "type": "radial_gradient",
                        "colors": ["#ff1493", "#9400d3"],
                        "stops": [0.0, 1.0]
                    },
                    "blend_mode": "screen",
                    "opacity": 0.7
                },
                # Blue nebula cloud
                {
                    "type": "circle",
                    "geometry": {"cx": 78, "cy": 78, "r": 32},
                    "fill": {
                        "type": "radial_gradient",
                        "colors": ["#00bfff", "#9400d3"],
                        "stops": [0.0, 1.0]
                    },
                    "blend_mode": "screen",
                    "opacity": 0.7
                },
                # Bright star center
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 64, "r": 8},
                    "fill": {"type": "solid", "colors": ["#ffffff"]},
                    "blend_mode": "screen",
                    "opacity": 1.0
                },
                # Star glow
                {
                    "type": "circle",
                    "geometry": {"cx": 64, "cy": 64, "r": 16},
                    "fill": {
                        "type": "radial_gradient",
                        "colors": ["#ffffff", "#00bfff"],
                        "stops": [0.0, 1.0]
                    },
                    "blend_mode": "screen",
                    "opacity": 0.5
                },
            ],
            "padding": 8,
            "antialias_factor": 3
        },
        version="1.0"
    ))
    
    return templates


def create_html_gallery(results, output_path):
    """Create beautiful HTML gallery for showcase icons"""
    
    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI Forge Showcase Gallery</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 40px 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        h1 {
            color: #fff;
            text-align: center;
            font-size: 3.5em;
            margin-bottom: 20px;
            text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
            font-weight: 800;
            letter-spacing: -1px;
        }
        
        .subtitle {
            color: rgba(255, 255, 255, 0.95);
            text-align: center;
            font-size: 1.3em;
            margin-bottom: 60px;
            font-weight: 300;
        }
        
        .section {
            margin-bottom: 80px;
        }
        
        .section-title {
            color: #fff;
            font-size: 2.2em;
            margin-bottom: 40px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 3px;
            font-weight: 700;
            text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.2);
        }
        
        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 35px;
        }
        
        .card {
            background: #fff;
            border-radius: 24px;
            padding: 35px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            position: relative;
            overflow: hidden;
        }
        
        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 6px;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transform: scaleX(0);
            transition: transform 0.4s ease;
        }
        
        .card:hover {
            transform: translateY(-12px) scale(1.02);
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
        }
        
        .card:hover::before {
            transform: scaleX(1);
        }
        
        .icon-container {
            width: 100%;
            height: 220px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: 
                repeating-conic-gradient(#f5f5f5 0% 25%, transparent 0% 50%) 
                50% / 24px 24px;
            border-radius: 16px;
            margin-bottom: 25px;
            position: relative;
            overflow: hidden;
        }
        
        .icon-container::after {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 16px;
            border: 2px solid rgba(0, 0, 0, 0.05);
        }
        
        .icon-container img {
            max-width: 128px;
            max-height: 128px;
            filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
            transition: transform 0.3s ease;
        }
        
        .card:hover .icon-container img {
            transform: scale(1.1) rotate(2deg);
        }
        
        .title {
            font-size: 1.6em;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 12px;
            text-transform: capitalize;
        }
        
        .description {
            font-size: 0.95em;
            color: #718096;
            margin-bottom: 18px;
            line-height: 1.5;
        }
        
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .tag {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }
        
        .stats {
            margin-top: 60px;
            text-align: center;
            color: rgba(255, 255, 255, 0.9);
            font-size: 1.1em;
        }
        
        .stats strong {
            color: #fff;
            font-size: 1.3em;
        }
        
        @media (max-width: 768px) {
            h1 {
                font-size: 2.5em;
            }
            
            .section-title {
                font-size: 1.8em;
            }
            
            .gallery {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 UI Forge Showcase</h1>
        <p class="subtitle">Procedurally Generated Icons - DIY & Insane Styles</p>
"""
    
    # DIY Section
    diy_results = [r for r in results if "diy" in r.template_name]
    if diy_results:
        html += """
        <div class="section">
            <h2 class="section-title">🛠️ DIY / Hand-Drawn</h2>
            <div class="gallery">
"""
        for result in diy_results:
            png_path = result.output_paths.get('png', '')
            if png_path:
                rel_path = Path(png_path).relative_to(Path(__file__).parent)
                name = result.template_name.replace("-", " ").replace("diy ", "")
                desc = result.metadata.description if result.metadata else "Hand-drawn style icon"
                html += f"""
                <div class="card">
                    <div class="icon-container">
                        <img src="{rel_path}" alt="{name}">
                    </div>
                    <div class="title">{name}</div>
                    <div class="description">{desc}</div>
                    <div class="tags">
                        <span class="tag">DIY</span>
                        <span class="tag">Hand-Drawn</span>
                        <span class="tag">Organic</span>
                    </div>
                </div>
"""
        html += """
            </div>
        </div>
"""
    
    # Insane Section
    insane_results = [r for r in results if "insane" in r.template_name]
    if insane_results:
        html += """
        <div class="section">
            <h2 class="section-title">🌈 Insane / Complex</h2>
            <div class="gallery">
"""
        for result in insane_results:
            png_path = result.output_paths.get('png', '')
            if png_path:
                rel_path = Path(png_path).relative_to(Path(__file__).parent)
                name = result.template_name.replace("-", " ").replace("insane ", "")
                desc = result.metadata.description if result.metadata else "Complex multi-layer effect"
                html += f"""
                <div class="card">
                    <div class="icon-container">
                        <img src="{rel_path}" alt="{name}">
                    </div>
                    <div class="title">{name}</div>
                    <div class="description">{desc}</div>
                    <div class="tags">
                        <span class="tag">Insane</span>
                        <span class="tag">Complex</span>
                        <span class="tag">Multi-Layer</span>
                    </div>
                </div>
"""
        html += """
            </div>
        </div>
"""
    
    # Stats
    total = len(results)
    success = sum(1 for r in results if r.success)
    total_time = sum(r.generation_time for r in results)
    
    html += f"""
        <div class="stats">
            <p>Generated <strong>{success}/{total}</strong> icons successfully in <strong>{total_time:.2f}s</strong></p>
            <p style="margin-top: 10px; font-size: 0.9em; opacity: 0.8;">
                Powered by UI Forge - Data-Driven Procedural Asset Generation
            </p>
        </div>
    </div>
</body>
</html>
"""
    
    # Write HTML file
    output_path.write_text(html, encoding='utf-8')
    logger.info(f"Gallery created: {output_path}")


def main():
    """Generate showcase icons and create HTML gallery"""
    
    logger.info("=" * 70)
    logger.info("🎨 UI FORGE SHOWCASE GENERATOR")
    logger.info("=" * 70)
    
    # Initialize engine
    engine = UIForgeEngine()
    
    # Create templates
    templates = create_showcase_templates()
    logger.info(f"\n📝 Created {len(templates)} showcase templates:")
    logger.info(f"   - {sum(1 for t in templates if 'diy' in t.name)} DIY/Hand-Drawn")
    logger.info(f"   - {sum(1 for t in templates if 'insane' in t.name)} Insane/Complex")
    
    # Generate all icons
    logger.info("\n🔨 Generating icons...")
    results = []
    
    for i, template in enumerate(templates, 1):
        logger.info(f"\n[{i}/{len(templates)}] {template.name}")
        logger.info(f"  Description: {template.description}")
        
        try:
            result = engine.generate_asset(template)
            
            if result.success:
                logger.info(f"  ✅ Success! Generated in {result.generation_time:.2f}s")
                logger.info(f"  📁 Outputs: {', '.join(result.output_paths.keys())}")
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
    
    if results:
        total_time = sum(r.generation_time for r in results)
        avg_time = total_time / len(results)
        logger.info(f"⏱️  Total time: {total_time:.2f}s (avg: {avg_time:.2f}s per icon)")
        
        # Create HTML gallery
        logger.info("\n🎨 Creating HTML gallery...")
        gallery_path = Path(__file__).parent / "showcase_gallery.html"
        
        try:
            create_html_gallery(results, gallery_path)
            
            logger.info("\n" + "=" * 70)
            logger.info("🎉 SUCCESS! Showcase gallery created!")
            logger.info("=" * 70)
            logger.info(f"\n📂 Gallery location:")
            logger.info(f"   {gallery_path.absolute()}")
            logger.info(f"\n🌐 Open in browser:")
            logger.info(f"   file:///{gallery_path.absolute()}")
            logger.info("\n" + "=" * 70)
            
            return str(gallery_path.absolute())
            
        except Exception as e:
            logger.error(f"❌ Failed to create gallery: {e}")
            import traceback
            traceback.print_exc()
            return None
    else:
        logger.error("❌ No icons were generated successfully")
        return None


if __name__ == "__main__":
    gallery_path = main()
    
    if gallery_path:
        print(f"\n✨ Open the gallery: file:///{gallery_path}")
    else:
        print("\n❌ Gallery generation failed")
        sys.exit(1)
