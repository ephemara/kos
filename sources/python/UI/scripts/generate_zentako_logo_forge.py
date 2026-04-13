#!/usr/bin/env python3
"""
ZENTAKO Logo Generator using UI Forge
Generates company logo at multiple sizes with PNG output
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from llm_api import render_catalog, circle, rect, path as svg_path, linear, solid


def generate_zentako_logos():
    """Generate ZENTAKO logos at all standard sizes using UI Forge."""
    
    sizes = [16, 32, 48, 64, 128, 256, 512, 1024]
    
    # ZENTAKO brand colors
    gradient_start = "#8B5CF6"  # Purple
    gradient_mid = "#EC4899"    # Pink
    gradient_end = "#06B6D4"    # Cyan
    secondary = "#06B6D4"       # Cyan
    accent = "#F59E0B"          # Amber
    primary = "#8B5CF6"         # Purple
    
    # Create catalog entries for each size
    catalog = []
    
    for size in sizes:
        # Scale factor
        scale = size / 128
        cx = size / 2
        cy = size / 2
        
        catalog.append({
            "name": f"zentako-logo-{size}",
            "size": size,  # Set individual size for each logo
            "layers": [
                # Background glow circle
                circle(cx, cy, int(60 * scale), fill=solid("#8B5CF6"), opacity=0.1),
                
                # 3D Wireframe Z - Top horizontal
                {
                    "type": "polygon",
                    "geometry": {
                        "points": [
                            [int(30 * scale), int(35 * scale)],
                            [int(98 * scale), int(35 * scale)],
                            [int(94 * scale), int(40 * scale)],
                            [int(34 * scale), int(40 * scale)]
                        ]
                    },
                    "fill": linear(gradient_start, gradient_end, angle=135),
                    "opacity": 1.0
                },
                
                # Diagonal slash
                {
                    "type": "polygon",
                    "geometry": {
                        "points": [
                            [int(94 * scale), int(40 * scale)],
                            [int(34 * scale), int(88 * scale)],
                            [int(30 * scale), int(93 * scale)],
                            [int(90 * scale), int(45 * scale)]
                        ]
                    },
                    "fill": linear(gradient_start, gradient_end, angle=135),
                    "opacity": 0.9
                },
                
                # Bottom horizontal
                {
                    "type": "polygon",
                    "geometry": {
                        "points": [
                            [int(34 * scale), int(88 * scale)],
                            [int(30 * scale), int(93 * scale)],
                            [int(98 * scale), int(93 * scale)],
                            [int(94 * scale), int(88 * scale)]
                        ]
                    },
                    "fill": linear(gradient_start, gradient_end, angle=135),
                    "opacity": 1.0
                },
                
                # Orbital rings
                {
                    "type": "ellipse",
                    "geometry": {
                        "cx": cx,
                        "cy": cy,
                        "rx": int(55 * scale),
                        "ry": int(20 * scale)
                    },
                    "fill": None,
                    "stroke": {"color": secondary, "width": max(1, int(1.5 * scale))},
                    "opacity": 0.4,
                    "transform": f"rotate(30 {cx} {cy})"
                },
                {
                    "type": "ellipse",
                    "geometry": {
                        "cx": cx,
                        "cy": cy,
                        "rx": int(55 * scale),
                        "ry": int(20 * scale)
                    },
                    "fill": None,
                    "stroke": {"color": accent, "width": max(1, int(1.5 * scale))},
                    "opacity": 0.3,
                    "transform": f"rotate(-30 {cx} {cy})"
                },
                
                # Corner nodes (3D vertices)
                circle(int(30 * scale), int(35 * scale), max(2, int(3 * scale)), fill=solid(primary)),
                circle(int(98 * scale), int(35 * scale), max(2, int(3 * scale)), fill=solid(secondary)),
                circle(int(30 * scale), int(93 * scale), max(2, int(3 * scale)), fill=solid(accent)),
                circle(int(98 * scale), int(93 * scale), max(2, int(3 * scale)), fill=solid(primary)),
                
                # Center energy core
                circle(cx, cy, max(2, int(4 * scale)), fill=linear(gradient_start, gradient_end, angle=45)),
                circle(cx, cy, max(1, int(2 * scale)), fill=solid("#ffffff"), opacity=0.8),
            ],
            "category": "branding",
            "tags": ["zentako", "logo", "company"],
            "formats": ["png", "svg"],
            "padding": max(2, int(4 * scale)),
        })
    
    # Render all logos
    print("🎨 Generating ZENTAKO Logos with UI Forge")
    print("=" * 60)
    
    results = render_catalog(
        catalog,
        parallel=True,
        output_dir="output/zentako-logo"
    )
    
    print("\n" + "=" * 60)
    print(f"🎉 Generated {len(results)} ZENTAKO logos!")
    print(f"📦 PNGs: output/branding/zentako-logo-*/")
    print(f"📦 SVGs: output/zentako-logo/")
    print("\n✅ All sizes generated:")
    for size in sizes:
        print(f"   - {size}x{size}px (PNG + SVG)")
    
    return results


if __name__ == "__main__":
    generate_zentako_logos()
