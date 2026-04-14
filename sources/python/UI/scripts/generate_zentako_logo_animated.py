#!/usr/bin/env python3
"""
ZENTAKO Animated Logo Generator - Building the Future of 3D 🚀
Uses UI Forge to generate PNG and APNG (animated) logos
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import (
    Template,
    GeneratorType,
    OutputFormat,
    AlphaMode,
    IconParams,
    AnimationParams,
)
from forge import UIForge


def create_zentako_templates():
    """Create ZENTAKO logo templates with animation."""
    
    templates = []
    
    # Static ZENTAKO logo (PNG)
    static_template = Template(
        name="zentako-logo-static",
        description="ZENTAKO - Building the Future of 3D (Static)",
        generator_type=GeneratorType.ICON,
        category="branding",
        tags=["zentako", "logo", "3d", "company"],
        output_formats=[OutputFormat.PNG, OutputFormat.SVG],
        dimensions={"width": 128, "height": 128},
        alpha_mode=AlphaMode.EMBEDDED,
        colors=[
            "#8B5CF6",  # Purple - innovation
            "#EC4899",  # Pink - creativity
            "#06B6D4",  # Cyan - technology
            "#F59E0B",  # Amber - energy
            "#FFFFFF",  # White - clarity
        ],
        params=IconParams(
            shape="custom",
            style="futuristic",
            complexity="high",
            effects=["gradient", "glow", "3d"],
        ),
    )
    templates.append(static_template)
    
    # Animated ZENTAKO logo (APNG) - Rotating orbital rings
    animated_template = Template(
        name="zentako-logo-animated",
        description="ZENTAKO - Building the Future of 3D (Animated)",
        generator_type=GeneratorType.ICON,
        category="branding",
        tags=["zentako", "logo", "3d", "company", "animated"],
        output_formats=[OutputFormat.PNG, OutputFormat.APNG],
        dimensions={"width": 128, "height": 128},
        alpha_mode=AlphaMode.EMBEDDED,
        colors=[
            "#8B5CF6",  # Purple
            "#EC4899",  # Pink
            "#06B6D4",  # Cyan
            "#F59E0B",  # Amber
            "#FFFFFF",  # White
        ],
        params=IconParams(
            shape="custom",
            style="futuristic",
            complexity="high",
            effects=["gradient", "glow", "3d", "rotation"],
        ),
        animation=AnimationParams(
            duration=2.0,  # 2 second loop
            fps=24,  # Smooth 24fps
            output="apng",
            loop=True,
            motion_params={
                "rotation": {
                    "enabled": True,
                    "speed": 1.0,
                    "axis": "z",
                },
                "pulse": {
                    "enabled": True,
                    "speed": 0.5,
                    "intensity": 0.2,
                },
            },
        ),
    )
    templates.append(animated_template)
    
    # High-res static for print/web
    hires_template = Template(
        name="zentako-logo-hires",
        description="ZENTAKO - High Resolution (512x512)",
        generator_type=GeneratorType.ICON,
        category="branding",
        tags=["zentako", "logo", "3d", "company", "hires"],
        output_formats=[OutputFormat.PNG, OutputFormat.SVG],
        dimensions={"width": 512, "height": 512},
        alpha_mode=AlphaMode.EMBEDDED,
        colors=[
            "#8B5CF6",
            "#EC4899",
            "#06B6D4",
            "#F59E0B",
            "#FFFFFF",
        ],
        params=IconParams(
            shape="custom",
            style="futuristic",
            complexity="high",
            effects=["gradient", "glow", "3d"],
        ),
    )
    templates.append(hires_template)
    
    return templates


def main():
    """Generate ZENTAKO logos using UI Forge."""
    print("🎨 Generating ZENTAKO Logos with UI Forge")
    print("=" * 60)
    
    # Create templates
    templates = create_zentako_templates()
    
    # Initialize UI Forge
    forge = UIForge(
        output_dir="output/zentako-branding",
        validate=True,
        verbose=True,
    )
    
    # Generate all templates
    results = forge.generate_batch(templates)
    
    print("\n" + "=" * 60)
    print("🎉 ZENTAKO Logo Generation Complete!")
    print(f"\n📊 Results:")
    print(f"   - Total templates: {len(templates)}")
    print(f"   - Successful: {sum(1 for r in results if r.success)}")
    print(f"   - Failed: {sum(1 for r in results if not r.success)}")
    
    print(f"\n📦 Generated files:")
    for result in results:
        if result.success:
            print(f"\n   {result.template_name}:")
            for fmt, path in result.output_paths.items():
                print(f"      - {fmt.upper()}: {path}")
    
    print(f"\n💡 Tips:")
    print(f"   - Static PNG: Use for favicons, app icons")
    print(f"   - Animated APNG: Use for website headers, loading screens")
    print(f"   - SVG: Use for scalable web graphics")
    print(f"   - High-res PNG: Use for print materials, presentations")


if __name__ == "__main__":
    main()
