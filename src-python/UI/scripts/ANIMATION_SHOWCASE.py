"""ANIMATION SHOWCASE - Animated icons with different motion types"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from models import Template, GeneratorType, OutputFormat, AlphaMode, AnimationConfig
from core import UIForgeEngine

engine = UIForgeEngine()

print("🎬 GENERATING ANIMATED ICON SHOWCASE")
print("=" * 60)

# 1. Pulse - Breathing circle
pulse = Template(
    name="pulse-circle", description="Pulsing circle animation", generator_type=GeneratorType.ICON,
    category="animated", tags=["animation", "pulse"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#3b82f6"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 40},
                        "fill": {"type": "solid", "colors": ["#3b82f6"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0",
    animation=AnimationConfig(
        enabled=True, motion_types=["pulse"], duration=2.0, fps=30, loop=True,
        easing="ease-in-out", output_type="sprite_sheet", sprite_sheet_layout="horizontal"
    )
)

# 2. Float - Gentle up/down movement
float_icon = Template(
    name="float-star", description="Floating star animation", generator_type=GeneratorType.ICON,
    category="animated", tags=["animation", "float"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#fbbf24"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "polygon", 
                        "geometry": {"points": [[64, 15], [80, 50], [115, 55], [85, 80], [95, 115], [64, 95], [33, 115], [43, 80], [13, 55], [48, 50]]},
                        "fill": {"type": "solid", "colors": ["#fbbf24"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0",
    animation=AnimationConfig(
        enabled=True, motion_types=["float"], duration=3.0, fps=30, loop=True,
        easing="ease-in-out", output_type="sprite_sheet", sprite_sheet_layout="horizontal"
    )
)

# 3. Orbit - Spinning rotation
orbit = Template(
    name="orbit-square", description="Orbiting square animation", generator_type=GeneratorType.ICON,
    category="animated", tags=["animation", "orbit"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#ef4444"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "rect", "geometry": {"x": 34, "y": 34, "width": 60, "height": 60, "rx": 8},
                        "fill": {"type": "solid", "colors": ["#ef4444"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0",
    animation=AnimationConfig(
        enabled=True, motion_types=["orbit"], duration=2.0, fps=30, loop=True,
        easing="linear", output_type="sprite_sheet", sprite_sheet_layout="horizontal"
    )
)

# 4. Shake - Jittery movement
shake = Template(
    name="shake-triangle", description="Shaking triangle animation", generator_type=GeneratorType.ICON,
    category="animated", tags=["animation", "shake"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#10b981"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "polygon", "geometry": {"points": [[64, 20], [110, 100], [18, 100]]},
                        "fill": {"type": "solid", "colors": ["#10b981"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0",
    animation=AnimationConfig(
        enabled=True, motion_types=["shake"], duration=1.5, fps=30, loop=True,
        easing="linear", output_type="sprite_sheet", sprite_sheet_layout="horizontal"
    )
)

# 5. Elastic - Bouncy effect
elastic = Template(
    name="elastic-heart", description="Elastic heart animation", generator_type=GeneratorType.ICON,
    category="animated", tags=["animation", "elastic"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#ec4899"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [
        {"type": "circle", "geometry": {"cx": 48, "cy": 45, "r": 22}, "fill": {"type": "solid", "colors": ["#ec4899"]}, "opacity": 1.0},
        {"type": "circle", "geometry": {"cx": 80, "cy": 45, "r": 22}, "fill": {"type": "solid", "colors": ["#ec4899"]}, "opacity": 1.0},
        {"type": "polygon", "geometry": {"points": [[64, 55], [105, 75], [64, 115], [23, 75]]}, "fill": {"type": "solid", "colors": ["#ec4899"]}, "opacity": 1.0}
    ], "padding": 8, "antialias_factor": 2}, version="1.0",
    animation=AnimationConfig(
        enabled=True, motion_types=["elastic"], duration=2.5, fps=30, loop=True,
        easing="ease-out", output_type="sprite_sheet", sprite_sheet_layout="horizontal"
    )
)

# 6. Wobble - Side-to-side wobble
wobble = Template(
    name="wobble-hexagon", description="Wobbling hexagon animation", generator_type=GeneratorType.ICON,
    category="animated", tags=["animation", "wobble"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#14b8a6"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "polygon", "geometry": {"points": [[64, 20], [100, 40], [100, 88], [64, 108], [28, 88], [28, 40]]},
                        "fill": {"type": "solid", "colors": ["#14b8a6"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0",
    animation=AnimationConfig(
        enabled=True, motion_types=["wobble"], duration=2.0, fps=30, loop=True,
        easing="ease-in-out", output_type="sprite_sheet", sprite_sheet_layout="horizontal"
    )
)

# 7. Bounce - Bouncing effect
bounce = Template(
    name="bounce-diamond", description="Bouncing diamond animation", generator_type=GeneratorType.ICON,
    category="animated", tags=["animation", "bounce"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#06b6d4"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "polygon", "geometry": {"points": [[64, 20], [108, 64], [64, 108], [20, 64]]},
                        "fill": {"type": "solid", "colors": ["#06b6d4"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0",
    animation=AnimationConfig(
        enabled=True, motion_types=["bounce"], duration=2.0, fps=30, loop=True,
        easing="ease-out", output_type="sprite_sheet", sprite_sheet_layout="horizontal"
    )
)

# 8. Pendulum - Swinging motion
pendulum = Template(
    name="pendulum-circle", description="Pendulum circle animation", generator_type=GeneratorType.ICON,
    category="animated", tags=["animation", "pendulum"], output_formats=[OutputFormat.PNG],
    dimensions={"width": 128, "height": 128}, colors=["#8b5cf6"], alpha_mode=AlphaMode.EMBEDDED,
    params={"layers": [{"type": "circle", "geometry": {"cx": 64, "cy": 64, "r": 35},
                        "fill": {"type": "solid", "colors": ["#8b5cf6"]}, "opacity": 1.0}],
            "padding": 8, "antialias_factor": 2}, version="1.0",
    animation=AnimationConfig(
        enabled=True, motion_types=["pendulum"], duration=2.5, fps=30, loop=True,
        easing="ease-in-out", output_type="sprite_sheet", sprite_sheet_layout="horizontal"
    )
)

templates = [pulse, float_icon, orbit, shake, elastic, wobble, bounce, pendulum]

results = []
for i, t in enumerate(templates, 1):
    print(f"\n[{i}/{len(templates)}] {t.name}")
    try:
        result = engine.generate_asset(t)
        if result.success:
            print(f"  ✓ Generated in {result.generation_time:.2f}s")
            for fmt, path in result.output_paths.items():
                print(f"  → {fmt}: {Path(path).name}")
            results.append(result)
        else:
            print(f"  ✗ Failed: {result.error}")
    except Exception as e:
        print(f"  ✗ Error: {e}")

print("\n" + "=" * 60)
print(f"✨ Generated {len(results)}/{len(templates)} animated icons!")

# Create HTML gallery with sprite sheet previews
if results:
    html = """<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>UI Forge - Animation Showcase</title>
<style>
body{background:linear-gradient(135deg,#1e293b,#0f172a);font-family:sans-serif;padding:40px;margin:0}
h1{color:#fff;text-align:center;font-size:3em;margin-bottom:20px;text-shadow:2px 2px 4px rgba(0,0,0,0.5)}
.subtitle{color:rgba(255,255,255,0.8);text-align:center;font-size:1.2em;margin-bottom:50px}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:30px;max-width:1400px;margin:0 auto}
.card{background:rgba(255,255,255,0.05);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:30px;box-shadow:0 10px 40px rgba(0,0,0,0.5);transition:transform 0.3s,box-shadow 0.3s}
.card:hover{transform:translateY(-10px);box-shadow:0 20px 60px rgba(0,0,0,0.7)}
.sprite-container{width:100%;height:200px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#2d3748 0% 25%,transparent 0% 50%) 50%/20px 20px;border-radius:15px;margin-bottom:20px;overflow:hidden;position:relative}
.sprite-sheet{max-width:100%;max-height:100%;object-fit:contain;animation:sprite-scroll 3s linear infinite}
@keyframes sprite-scroll{0%{transform:translateX(0)}100%{transform:translateX(-80%)}}
.title{font-size:1.3em;font-weight:bold;color:#fff;margin-bottom:10px;text-align:center}
.motion-type{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:6px 14px;border-radius:20px;font-size:0.9em;display:inline-block;margin-top:10px}
.stats{color:rgba(255,255,255,0.7);font-size:0.85em;margin-top:10px;text-align:center}
</style></head><body>
<h1>🎬 UI Forge Animation Showcase</h1>
<p class="subtitle">Procedurally Generated Animated Icons with Motion Types</p>
<div class="gallery">
"""
    
    for result in results:
        sprite_path = result.output_paths.get('sprite_sheet', '')
        if sprite_path:
            rel = Path(sprite_path).relative_to(Path(__file__).parent)
            motion = result.template_name.split('-')[0].title()
            html += f"""
<div class="card">
    <div class="sprite-container">
        <img class="sprite-sheet" src="{rel}" alt="{result.template_name}">
    </div>
    <div class="title">{result.template_name.replace('-', ' ').title()}</div>
    <div style="text-align:center">
        <span class="motion-type">{motion} Motion</span>
    </div>
    <div class="stats">Generated in {result.generation_time:.2f}s</div>
</div>
"""
    
    html += """
</div>
<div style="text-align:center;margin-top:60px;color:rgba(255,255,255,0.6);font-size:0.9em">
    <p>All animations are sprite sheets with horizontal layout</p>
    <p>Motion types: Pulse, Float, Orbit, Shake, Elastic, Wobble, Bounce, Pendulum</p>
</div>
</body></html>
"""
    
    gallery_path = Path(__file__).parent / 'ANIMATION_SHOWCASE.html'
    gallery_path.write_text(html, encoding='utf-8')
    
    print(f"\n✓ Gallery: {gallery_path}")
    print(f"🌐 file:///{gallery_path.absolute()}")
