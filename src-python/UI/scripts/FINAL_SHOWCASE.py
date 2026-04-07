"""FINAL SHOWCASE - 10 icons using EXACT working pattern"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from models import Template, GeneratorType, OutputFormat, AlphaMode
from generators.icon_generator import IconGenerator
import numpy as np
from PIL import Image

# Create generator directly
gen = IconGenerator()

print("🎨 GENERATING 10 SHOWCASE ICONS")
print("=" * 60)

icons = []

# 1. Blue Circle
t1 = Template(
    name="blue-circle", description="Blue circle", generator_type=GeneratorType.ICON,
    category="showcase", tags=["simple"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#3b82f6"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 50},
                        "fill": {"type": "solid", "colors": ["#3b82f6"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0"
)

# 2. Red Square
t2 = Template(
    name="red-square", description="Red square", generator_type=GeneratorType.ICON,
    category="showcase", tags=["simple"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#ef4444"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "rect", "geometry": {"x": 24, "y": 24, "width": 80, "height": 80, "rx": 8},
                        "fill": {"type": "solid", "colors": ["#ef4444"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0"
)

# 3. Green Triangle
t3 = Template(
    name="green-triangle", description="Green triangle", generator_type=GeneratorType.ICON,
    category="showcase", tags=["simple"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#10b981"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "polygon", "geometry": {"points": [[64, 20], [110, 100], [18, 100]]},
                        "fill": {"type": "solid", "colors": ["#10b981"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0"
)

# 4. Purple Gradient Circle
t4 = Template(
    name="purple-gradient", description="Purple gradient", generator_type=GeneratorType.ICON,
    category="showcase", tags=["gradient"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#8b5cf6", "#6366f1"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 50},
                        "fill": {"type": "radial_gradient", "colors": ["#8b5cf6", "#6366f1"], "stops": [0.0, 1.0]},
                        "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0"
)

# 5. Orange Star (pentagon approximation)
t5 = Template(
    name="orange-star", description="Orange star", generator_type=GeneratorType.ICON,
    category="showcase", tags=["complex"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#f59e0b"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "polygon", "geometry": {"points": [[64, 15], [80, 50], [115, 55], [85, 80], [95, 115], [64, 95], [33, 115], [43, 80], [13, 55], [48, 50]]},
                        "fill": {"type": "solid", "colors": ["#f59e0b"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0"
)

# 6. Cyan Diamond
t6 = Template(
    name="cyan-diamond", description="Cyan diamond", generator_type=GeneratorType.ICON,
    category="showcase", tags=["simple"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#06b6d4"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "polygon", "geometry": {"points": [[64, 20], [108, 64], [64, 108], [20, 64]]},
                        "fill": {"type": "solid", "colors": ["#06b6d4"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0"
)

# 7. Pink Heart (two circles + triangle)
t7 = Template(
    name="pink-heart", description="Pink heart", generator_type=GeneratorType.ICON,
    category="showcase", tags=["complex"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#ec4899"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [
        {"type": "circle", "geometry": {"cx": 48, "cy": 45, "r": 22}, "fill": {"type": "solid", "colors": ["#ec4899"]}, "opacity": 1.0},
        {"type": "circle", "geometry": {"cx": 80, "cy": 45, "r": 22}, "fill": {"type": "solid", "colors": ["#ec4899"]}, "opacity": 1.0},
        {"type": "polygon", "geometry": {"points": [[64, 55], [105, 75], [64, 115], [23, 75]]}, "fill": {"type": "solid", "colors": ["#ec4899"]}, "opacity": 1.0}
    ], "padding": 8, "antialias_factor": 2}, version="1.0"
)

# 8. Yellow Sun (circle + triangles)
t8 = Template(
    name="yellow-sun", description="Yellow sun", generator_type=GeneratorType.ICON,
    category="showcase", tags=["complex"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#fbbf24"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [
        {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 30}, "fill": {"type": "solid", "colors": ["#fbbf24"]}, "opacity": 1.0},
        {"type": "polygon", "geometry": {"points": [[64, 10], [70, 30], [58, 30]]}, "fill": {"type": "solid", "colors": ["#fbbf24"]}, "opacity": 1.0},
        {"type": "polygon", "geometry": {"points": [[64, 118], [70, 98], [58, 98]]}, "fill": {"type": "solid", "colors": ["#fbbf24"]}, "opacity": 1.0},
        {"type": "polygon", "geometry": {"points": [[10, 64], [30, 70], [30, 58]]}, "fill": {"type": "solid", "colors": ["#fbbf24"]}, "opacity": 1.0},
        {"type": "polygon", "geometry": {"points": [[118, 64], [98, 70], [98, 58]]}, "fill": {"type": "solid", "colors": ["#fbbf24"]}, "opacity": 1.0}
    ], "padding": 8, "antialias_factor": 2}, version="1.0"
)

# 9. Teal Hexagon
t9 = Template(
    name="teal-hexagon", description="Teal hexagon", generator_type=GeneratorType.ICON,
    category="showcase", tags=["simple"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#14b8a6"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "polygon", "geometry": {"points": [[64, 20], [100, 40], [100, 88], [64, 108], [28, 88], [28, 40]]},
                        "fill": {"type": "solid", "colors": ["#14b8a6"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0"
)

# 10. Multi-layer Rainbow
t10 = Template(
    name="rainbow-layers", description="Rainbow layers", generator_type=GeneratorType.ICON,
    category="showcase", tags=["complex"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"],
    alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [
        {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 55}, "fill": {"type": "solid", "colors": ["#ef4444"]}, "opacity": 1.0},
        {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 45}, "fill": {"type": "solid", "colors": ["#f59e0b"]}, "opacity": 1.0},
        {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 35}, "fill": {"type": "solid", "colors": ["#10b981"]}, "opacity": 1.0},
        {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 25}, "fill": {"type": "solid", "colors": ["#3b82f6"]}, "opacity": 1.0},
        {"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 15}, "fill": {"type": "solid", "colors": ["#8b5cf6"]}, "opacity": 1.0}
    ], "padding": 8, "antialias_factor": 2}, version="1.0"
)

templates = [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10]

# Generate all
output_dir = Path(__file__).parent / "output" / "showcase"
output_dir.mkdir(parents=True, exist_ok=True)

for i, t in enumerate(templates, 1):
    print(f"[{i}/10] {t.name}...", end=" ")
    try:
        img_array = gen.generate(t)
        img = Image.fromarray(img_array.astype(np.uint8))
        path = output_dir / f"{t.name}.png"
        img.save(path)
        icons.append((t.name, path))
        print("✓")
    except Exception as e:
        print(f"✗ {e}")

print("\n" + "=" * 60)
print(f"✨ Generated {len(icons)}/10 icons!")

# Create HTML gallery
if icons:
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>UI Forge - 10 Icon Showcase</title>
<style>
body{{background:linear-gradient(135deg,#667eea,#764ba2);font-family:sans-serif;padding:40px;margin:0}}
h1{{color:#fff;text-align:center;font-size:3em;margin-bottom:50px;text-shadow:2px 2px 4px rgba(0,0,0,0.3)}}
.gallery{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;max-width:1200px;margin:0 auto}}
.card{{background:#fff;border-radius:15px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,0.3);transition:transform 0.3s}}
.card:hover{{transform:translateY(-10px) scale(1.05)}}
.icon{{width:100%;height:150px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#f0f0f0 0% 25%,transparent 0% 50%) 50%/20px 20px;border-radius:10px;margin-bottom:15px}}
.icon img{{max-width:128px;max-height:128px}}
.title{{font-size:1.1em;font-weight:bold;color:#333;text-align:center}}
</style></head><body>
<h1>🎨 UI Forge Showcase</h1>
<div class="gallery">
"""
    
    for name, path in icons:
        rel = path.relative_to(Path(__file__).parent)
        html += f'<div class="card"><div class="icon"><img src="{rel}"></div><div class="title">{name.replace("-", " ").title()}</div></div>'
    
    html += '</div></body></html>'
    
    gallery_path = Path(__file__).parent / 'SHOWCASE_GALLERY.html'
    gallery_path.write_text(html, encoding='utf-8')
    
    print(f"\n✓ Gallery: {gallery_path}")
    print(f"🌐 file:///{gallery_path.absolute()}")
