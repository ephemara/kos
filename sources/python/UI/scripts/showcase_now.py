"""Generate showcase icons - DIY and INSANE styles"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from models import Template, GeneratorType, OutputFormat, AlphaMode
from core import UIForgeEngine
from datetime import datetime

engine = UIForgeEngine()

# DIY Paintbrush
paintbrush = Template(
    name="diy-paintbrush",
    description="Hand-drawn paintbrush with wobbly style",
    generator_type=GeneratorType.ICON,
    category="showcase",
    tags=["diy", "handdrawn"],
    output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128},
    colors=["#8b4513", "#ff6b6b", "#2c2c2c"],
    alpha_mode=AlphaMode.EMBEDDED,
    params={
        "layers": [
            {"type": "rect", "geometry": {"x": 58, "y": 80, "width": 12, "height": 45, "rx": 2},
             "fill": {"type": "solid", "colors": ["#8b4513"]}, "opacity": 1.0},
            {"type": "rect", "geometry": {"x": 56, "y": 70, "width": 16, "height": 12},
             "fill": {"type": "solid", "colors": ["#2c2c2c"]}, "opacity": 1.0},
            {"type": "polygon", "geometry": {"points": [[64, 70], [74, 35], [54, 35]]},
             "fill": {"type": "solid", "colors": ["#ff6b6b"]}, "opacity": 1.0},
            {"type": "circle", "geometry": {"cx": 64, "cy": 32, "r": 6},
             "fill": {"type": "solid", "colors": ["#ff6b6b"]}, "opacity": 0.8},
        ],
        "padding": 12,
        "antialias_factor": 2
    },
    version="1.0"
)

# DIY Hammer
hammer = Template(
    name="diy-hammer",
    description="Sketchy hand-drawn hammer",
    generator_type=GeneratorType.ICON,
    category="showcase",
    tags=["diy", "handdrawn"],
    output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128},
    colors=["#8b4513", "#2c2c2c"],
    alpha_mode=AlphaMode.EMBEDDED,
    params={
        "layers": [
            {"type": "rect", "geometry": {"x": 54, "y": 70, "width": 20, "height": 50, "rx": 3},
             "fill": {"type": "solid", "colors": ["#8b4513"]}, "opacity": 1.0},
            {"type": "rect", "geometry": {"x": 30, "y": 45, "width": 68, "height": 30, "rx": 4},
             "fill": {"type": "solid", "colors": ["#2c2c2c"]}, "opacity": 1.0},
        ],
        "padding": 12,
        "antialias_factor": 2
    },
    version="1.0"
)

# DIY Wrench
wrench = Template(
    name="diy-wrench",
    description="Hand-drawn wrench tool",
    generator_type=GeneratorType.ICON,
    category="showcase",
    tags=["diy", "handdrawn"],
    output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128},
    colors=["#708090"],
    alpha_mode=AlphaMode.EMBEDDED,
    params={
        "layers": [
            {"type": "rect", "geometry": {"x": 50, "y": 70, "width": 28, "height": 50, "rx": 4},
             "fill": {"type": "solid", "colors": ["#708090"]}, "opacity": 1.0},
            {"type": "rect", "geometry": {"x": 45, "y": 30, "width": 12, "height": 45, "rx": 2},
             "fill": {"type": "solid", "colors": ["#708090"]}, "opacity": 1.0},
            {"type": "rect", "geometry": {"x": 71, "y": 30, "width": 12, "height": 45, "rx": 2},
             "fill": {"type": "solid", "colors": ["#708090"]}, "opacity": 1.0},
        ],
        "padding": 12,
        "antialias_factor": 2
    },
    version="1.0"
)

# INSANE Holographic Prism
holo = Template(
    name="insane-holographic",
    description="Complex prismatic holographic effect",
    generator_type=GeneratorType.ICON,
    category="showcase",
    tags=["insane", "holographic"],
    output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128},
    colors=["#ff0080", "#00ffff", "#ffff00", "#8000ff"],
    alpha_mode=AlphaMode.EMBEDDED,
    params={
        "layers": [
            {"type": "polygon", "geometry": {"points": [[64, 20], [95, 40], [95, 88], [64, 108], [33, 88], [33, 40]]},
             "fill": {"type": "solid", "colors": ["#ff0080"]}, "opacity": 0.8, "blend_mode": "screen"},
            {"type": "polygon", "geometry": {"points": [[64, 35], [80, 50], [64, 64]]},
             "fill": {"type": "solid", "colors": ["#ffff00"]}, "opacity": 0.6, "blend_mode": "overlay"},
            {"type": "polygon", "geometry": {"points": [[64, 64], [80, 78], [64, 93]]},
             "fill": {"type": "solid", "colors": ["#00ffff"]}, "opacity": 0.6, "blend_mode": "overlay"},
            {"type": "polygon", "geometry": {"points": [[64, 64], [48, 78], [64, 93]]},
             "fill": {"type": "solid", "colors": ["#8000ff"]}, "opacity": 0.6, "blend_mode": "overlay"},
            {"type": "polygon", "geometry": {"points": [[64, 35], [48, 50], [64, 64]]},
             "fill": {"type": "solid", "colors": ["#ff0080"]}, "opacity": 0.6, "blend_mode": "overlay"},
            {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 12},
             "fill": {"type": "solid", "colors": ["#ffffff"]}, "opacity": 1.0, "blend_mode": "screen"},
        ],
        "padding": 8,
        "antialias_factor": 3
    },
    version="1.0"
)

# INSANE Quantum Flux
quantum = Template(
    name="insane-quantum",
    description="Multi-layer quantum flux effect",
    generator_type=GeneratorType.ICON,
    category="showcase",
    tags=["insane", "quantum"],
    output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128},
    colors=["#00ffff", "#ff00ff", "#ffff00"],
    alpha_mode=AlphaMode.EMBEDDED,
    params={
        "layers": [
            {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 50},
             "fill": {"type": "solid", "colors": ["#00ffff"]}, "opacity": 0.3},
            {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 38},
             "fill": {"type": "solid", "colors": ["#ff00ff"]}, "opacity": 0.3},
            {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 26},
             "fill": {"type": "solid", "colors": ["#ffff00"]}, "opacity": 0.3},
            {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 18},
             "fill": {"type": "solid", "colors": ["#ffffff"]}, "opacity": 1.0},
            {"type": "circle", "geometry": {"cx": 64, "cy": 30, "r": 4},
             "fill": {"type": "solid", "colors": ["#ffff00"]}, "opacity": 0.9, "blend_mode": "screen"},
            {"type": "circle", "geometry": {"cx": 90, "cy": 64, "r": 4},
             "fill": {"type": "solid", "colors": ["#00ffff"]}, "opacity": 0.9, "blend_mode": "screen"},
            {"type": "circle", "geometry": {"cx": 64, "cy": 98, "r": 4},
             "fill": {"type": "solid", "colors": ["#ff00ff"]}, "opacity": 0.9, "blend_mode": "screen"},
            {"type": "circle", "geometry": {"cx": 38, "cy": 64, "r": 4},
             "fill": {"type": "solid", "colors": ["#00ffff"]}, "opacity": 0.9, "blend_mode": "screen"},
        ],
        "padding": 8,
        "antialias_factor": 3
    },
    version="1.0"
)

# INSANE Nebula
nebula = Template(
    name="insane-nebula",
    description="Cosmic nebula with multiple clouds",
    generator_type=GeneratorType.ICON,
    category="showcase",
    tags=["insane", "cosmic"],
    output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128},
    colors=["#ff1493", "#00bfff", "#9400d3"],
    alpha_mode=AlphaMode.EMBEDDED,
    params={
        "layers": [
            {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 60},
             "fill": {"type": "solid", "colors": ["#1a0033"]}, "opacity": 1.0},
            {"type": "circle", "geometry": {"cx": 50, "cy": 50, "r": 35},
             "fill": {"type": "radial_gradient", "colors": ["#ff1493", "#9400d3"], "stops": [0.0, 1.0]},
             "opacity": 0.7, "blend_mode": "screen"},
            {"type": "circle", "geometry": {"cx": 78, "cy": 78, "r": 32},
             "fill": {"type": "radial_gradient", "colors": ["#00bfff", "#9400d3"], "stops": [0.0, 1.0]},
             "opacity": 0.7, "blend_mode": "screen"},
            {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 8},
             "fill": {"type": "solid", "colors": ["#ffffff"]}, "opacity": 1.0, "blend_mode": "screen"},
        ],
        "padding": 8,
        "antialias_factor": 3
    },
    version="1.0"
)

templates = [paintbrush, hammer, wrench, holo, quantum, nebula]

print("🎨 UI FORGE SHOWCASE")
print("=" * 60)

results = []
for i, template in enumerate(templates, 1):
    print(f"\n[{i}/{len(templates)}] {template.name}")
    try:
        result = engine.generate_asset(template)
        if result.success:
            print(f"  ✓ Generated in {result.generation_time:.2f}s")
            results.append(result)
        else:
            print(f"  ✗ Failed: {result.error}")
    except Exception as e:
        print(f"  ✗ Error: {e}")

print("\n" + "=" * 60)
print(f"✨ {len(results)}/{len(templates)} icons generated!")

# Create HTML gallery
if results:
    html = """<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>UI Forge Showcase</title>
<style>
body{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);font-family:sans-serif;padding:40px;margin:0}
h1{color:#fff;text-align:center;font-size:3em;margin:0 0 20px;text-shadow:2px 2px 4px rgba(0,0,0,0.3)}
.subtitle{color:rgba(255,255,255,0.9);text-align:center;font-size:1.2em;margin-bottom:50px}
.section{margin-bottom:60px}
.section-title{color:#fff;font-size:2em;margin-bottom:30px;text-align:center;text-transform:uppercase;letter-spacing:2px}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:30px;max-width:1400px;margin:0 auto}
.card{background:#fff;border-radius:20px;padding:30px;box-shadow:0 10px 30px rgba(0,0,0,0.3);transition:transform 0.3s}
.card:hover{transform:translateY(-10px)}
.icon{width:100%;height:200px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#f0f0f0 0% 25%,transparent 0% 50%) 50%/20px 20px;border-radius:10px;margin-bottom:20px}
.icon img{max-width:128px;max-height:128px}
.title{font-size:1.5em;font-weight:bold;color:#333;margin-bottom:10px}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}
.tag{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:5px 12px;border-radius:15px;font-size:0.85em}
</style></head><body>
<h1>🎨 UI Forge Showcase</h1>
<p class="subtitle">Procedurally Generated Icons - DIY & Insane Styles</p>
"""
    
    # DIY Section
    diy = [r for r in results if "diy" in r.template_name]
    if diy:
        html += '<div class="section"><h2 class="section-title">🛠️ DIY / Hand-Drawn</h2><div class="gallery">'
        for r in diy:
            path = r.output_paths.get('png', '')
            if path:
                rel = Path(path).relative_to(Path(__file__).parent)
                html += f'<div class="card"><div class="icon"><img src="{rel}"></div><div class="title">{r.template_name.replace("-", " ").title()}</div><div class="tags"><span class="tag">DIY</span><span class="tag">Hand-Drawn</span></div></div>'
        html += '</div></div>'
    
    # Insane Section
    insane = [r for r in results if "insane" in r.template_name]
    if insane:
        html += '<div class="section"><h2 class="section-title">🌈 Insane / Complex</h2><div class="gallery">'
        for r in insane:
            path = r.output_paths.get('png', '')
            if path:
                rel = Path(path).relative_to(Path(__file__).parent)
                html += f'<div class="card"><div class="icon"><img src="{rel}"></div><div class="title">{r.template_name.replace("-", " ").title()}</div><div class="tags"><span class="tag">Insane</span><span class="tag">Complex</span></div></div>'
        html += '</div></div>'
    
    html += '</body></html>'
    
    gallery_path = Path(__file__).parent / 'showcase_gallery.html'
    gallery_path.write_text(html, encoding='utf-8')
    
    print(f"\n✓ Gallery: {gallery_path}")
    print(f"🌐 file:///{gallery_path.absolute()}")
