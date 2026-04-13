"""Ultra-simple showcase - no validation issues"""
import sys
import os
os.chdir(r'M:\K_OS\sources/python\UI')
sys.path.insert(0, r'M:\K_OS\sources/python\UI')

from models import Template, IconParams, Layer, FillStyle, AnimationConfig, OutputFormat, GeneratorType
from core import UIForgeEngine

engine = UIForgeEngine()

# Simple DIY Paintbrush
paintbrush = Template(
    name="DIY_Paintbrush",
    description="Hand-drawn paintbrush",
    generator_type=GeneratorType.ICON,
    category="showcase",
    tags=["diy"],
    output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128},
    params=IconParams(
        padding=12,
        antialias_factor=2,
        layers=[
            Layer(type="rect", geometry={"x": 58, "y": 80, "width": 12, "height": 45}, 
                  fill=FillStyle(type="solid", colors=["#8b4513"]), opacity=1.0),
            Layer(type="rect", geometry={"x": 56, "y": 70, "width": 16, "height": 12}, 
                  fill=FillStyle(type="solid", colors=["#2c2c2c"]), opacity=1.0),
            Layer(type="polygon", geometry={"points": [[64, 70], [74, 35], [54, 35]]}, 
                  fill=FillStyle(type="solid", colors=["#ff6b6b"]), opacity=1.0),
            Layer(type="circle", geometry={"cx": 64, "cy": 32, "r": 6}, 
                  fill=FillStyle(type="solid", colors=["#ff6b6b"]), opacity=0.8),
        ]
    )
)

# Simple Holographic
holo = Template(
    name="Holographic_Prism",
    description="Prismatic effect",
    generator_type=GeneratorType.ICON,
    category="showcase",
    tags=["insane"],
    output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128},
    params=IconParams(
        padding=8,
        antialias_factor=3,
        layers=[
            Layer(type="polygon", geometry={"points": [[64, 20], [95, 40], [95, 88], [64, 108], [33, 88], [33, 40]]},
                  fill=FillStyle(type="solid", colors=["#ff0080"]), opacity=0.8, blend_mode="screen"),
            Layer(type="polygon", geometry={"points": [[64, 35], [80, 50], [64, 64]]},
                  fill=FillStyle(type="solid", colors=["#ffff00"]), opacity=0.6, blend_mode="overlay"),
            Layer(type="polygon", geometry={"points": [[64, 64], [80, 78], [64, 93]]},
                  fill=FillStyle(type="solid", colors=["#00ffff"]), opacity=0.6, blend_mode="overlay"),
            Layer(type="circle", geometry={"cx": 64, "cy": 64, "r": 12},
                  fill=FillStyle(type="solid", colors=["#ffffff"]), opacity=1.0, blend_mode="screen"),
        ]
    )
)

# Simple Quantum
quantum = Template(
    name="Quantum_Flux",
    description="Quantum effect",
    generator_type=GeneratorType.ICON,
    category="showcase",
    tags=["insane"],
    output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128},
    params=IconParams(
        padding=8,
        antialias_factor=3,
        layers=[
            Layer(type="circle", geometry={"cx": 64, "cy": 64, "r": 50},
                  fill=FillStyle(type="solid", colors=["#00ffff"]), opacity=0.3),
            Layer(type="circle", geometry={"cx": 64, "cy": 64, "r": 38},
                  fill=FillStyle(type="solid", colors=["#ff00ff"]), opacity=0.3),
            Layer(type="circle", geometry={"cx": 64, "cy": 64, "r": 18},
                  fill=FillStyle(type="solid", colors=["#ffffff"]), opacity=1.0),
            Layer(type="circle", geometry={"cx": 64, "cy": 30, "r": 4},
                  fill=FillStyle(type="solid", colors=["#ffff00"]), opacity=0.9, blend_mode="screen"),
            Layer(type="circle", geometry={"cx": 90, "cy": 64, "r": 4},
                  fill=FillStyle(type="solid", colors=["#00ffff"]), opacity=0.9, blend_mode="screen"),
        ]
    )
)

# Simple Hammer
hammer = Template(
    name="DIY_Hammer",
    description="Hand-drawn hammer",
    generator_type=GeneratorType.ICON,
    category="showcase",
    tags=["diy"],
    output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128},
    params=IconParams(
        padding=12,
        antialias_factor=2,
        layers=[
            Layer(type="rect", geometry={"x": 54, "y": 70, "width": 20, "height": 50},
                  fill=FillStyle(type="solid", colors=["#8b4513"]), opacity=1.0),
            Layer(type="rect", geometry={"x": 30, "y": 45, "width": 68, "height": 30},
                  fill=FillStyle(type="solid", colors=["#2c2c2c"]), opacity=1.0),
        ]
    )
)

templates = [paintbrush, holo, quantum, hammer]

print("🎨 Generating Showcase Icons")
print("=" * 60)

results = []
for template in templates:
    print(f"\n📦 {template.name}")
    try:
        result = engine.generate_asset(template)
        results.append(result)
        
        if result.success:
            print(f"   ✓ Success! ({result.generation_time:.2f}s)")
            for fmt, path in result.output_paths.items():
                print(f"   → {fmt}: {os.path.basename(path)}")
        else:
            print(f"   ✗ Failed: {result.error}")
    except Exception as e:
        print(f"   ✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 60)
success_count = len([r for r in results if r.success])
print(f"✨ Generated {success_count}/{len(templates)} icons!")

# Create HTML gallery
if success_count > 0:
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>UI Forge Showcase</title>
<style>
body {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: sans-serif; padding: 40px; }}
h1 {{ color: white; text-align: center; font-size: 3em; margin-bottom: 40px; }}
.gallery {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; max-width: 1400px; margin: 0 auto; }}
.card {{ background: white; border-radius: 20px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); transition: transform 0.3s; }}
.card:hover {{ transform: translateY(-10px); }}
.icon {{ width: 100%; height: 200px; display: flex; align-items: center; justify-content: center; 
         background: repeating-conic-gradient(#f0f0f0 0% 25%, transparent 0% 50%) 50% / 20px 20px; 
         border-radius: 10px; margin-bottom: 20px; }}
.icon img {{ max-width: 128px; max-height: 128px; }}
.title {{ font-size: 1.5em; font-weight: bold; margin-bottom: 10px; }}
.tag {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 5px 12px; 
        border-radius: 15px; font-size: 0.85em; display: inline-block; margin: 5px; }}
</style></head><body>
<h1>🎨 UI Forge Showcase</h1>
<div class="gallery">
"""
    
    for result in results:
        if result.success:
            png_path = result.output_paths.get('png', '')
            if png_path:
                rel_path = os.path.relpath(png_path, r'M:\K_OS\sources/python\UI')
                tag = "DIY" if "diy" in result.template_name.lower() else "INSANE"
                html += f"""
<div class="card">
    <div class="icon"><img src="{rel_path}" alt="{result.template_name}"></div>
    <div class="title">{result.template_name.replace('_', ' ')}</div>
    <span class="tag">{tag}</span>
    <span class="tag">Procedural</span>
</div>
"""
    
    html += """
</div></body></html>
"""
    
    gallery_path = r'M:\K_OS\sources/python\UI\showcase_gallery.html'
    with open(gallery_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"\n✓ Gallery: {gallery_path}")
    print(f"🌐 file:///{gallery_path}")
