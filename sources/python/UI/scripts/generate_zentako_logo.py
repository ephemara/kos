#!/usr/bin/env python3
"""
ZENTAKO Logo Generator - Building the Future of 3D 🚀
Generates SVG and PNG logos at multiple sizes (with optional animation!)
"""

import os
import sys
from pathlib import Path
from typing import Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from svglib.svglib import svg2rlg
    from reportlab.graphics import renderPM
    HAS_SVGLIB = True
except ImportError:
    HAS_SVGLIB = False

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


class ZentakoLogoGenerator:
    """Generates ZENTAKO company logo in SVG and PNG formats."""
    
    def __init__(self, output_dir: str = "output/zentako-logo"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # ZENTAKO brand colors - futuristic 3D theme
        self.colors = {
            "primary": "#8B5CF6",      # Purple - innovation
            "secondary": "#06B6D4",    # Cyan - technology
            "accent": "#F59E0B",       # Amber - energy
            "gradient_start": "#8B5CF6",
            "gradient_mid": "#EC4899",
            "gradient_end": "#06B6D4",
        }
    
    def generate_zentako_logo_svg(self, size: int = 128) -> str:
        """
        Generate ZENTAKO logo - 3D wireframe Z with orbital rings
        Represents: Building the future of 3D
        """
        # Scale factor for different sizes
        scale = size / 128
        
        return f'''<svg width="{size}" height="{size}" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Futuristic gradient -->
    <linearGradient id="zentakoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{self.colors['gradient_start']};stop-opacity:1" />
      <stop offset="50%" style="stop-color:{self.colors['gradient_mid']};stop-opacity:1" />
      <stop offset="100%" style="stop-color:{self.colors['gradient_end']};stop-opacity:1" />
    </linearGradient>
    
    <!-- Glow effect -->
    <radialGradient id="zentakoGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:0.8" />
      <stop offset="100%" style="stop-color:{self.colors['primary']};stop-opacity:0" />
    </radialGradient>
    
    <!-- Filter for glow -->
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background circle with subtle glow -->
  <circle cx="64" cy="64" r="60" fill="url(#zentakoGlow)" opacity="0.1"/>
  
  <!-- 3D Wireframe Z (main letter) -->
  <!-- Top horizontal -->
  <path d="M30 35 L98 35 L94 40 L34 40 Z" fill="url(#zentakoGrad)" filter="url(#glow)"/>
  
  <!-- Diagonal slash (3D effect with depth) -->
  <path d="M94 40 L34 88 L30 93 L90 45 Z" fill="url(#zentakoGrad)" opacity="0.9"/>
  
  <!-- Bottom horizontal -->
  <path d="M34 88 L30 93 L98 93 L94 88 Z" fill="url(#zentakoGrad)" filter="url(#glow)"/>
  
  <!-- 3D depth lines (wireframe effect) -->
  <line x1="30" y1="35" x2="34" y2="40" stroke="{self.colors['secondary']}" stroke-width="1.5" opacity="0.6"/>
  <line x1="98" y1="35" x2="94" y2="40" stroke="{self.colors['secondary']}" stroke-width="1.5" opacity="0.6"/>
  <line x1="30" y1="93" x2="34" y2="88" stroke="{self.colors['secondary']}" stroke-width="1.5" opacity="0.6"/>
  <line x1="98" y1="93" x2="94" y2="88" stroke="{self.colors['secondary']}" stroke-width="1.5" opacity="0.6"/>
  
  <!-- Orbital rings (representing 3D space) -->
  <ellipse cx="64" cy="64" rx="55" ry="20" stroke="{self.colors['secondary']}" stroke-width="1.5" fill="none" opacity="0.4" transform="rotate(30 64 64)"/>
  <ellipse cx="64" cy="64" rx="55" ry="20" stroke="{self.colors['accent']}" stroke-width="1.5" fill="none" opacity="0.3" transform="rotate(-30 64 64)"/>
  
  <!-- Corner nodes (3D vertices) -->
  <circle cx="30" cy="35" r="3" fill="{self.colors['primary']}" filter="url(#glow)"/>
  <circle cx="98" cy="35" r="3" fill="{self.colors['secondary']}" filter="url(#glow)"/>
  <circle cx="30" cy="93" r="3" fill="{self.colors['accent']}" filter="url(#glow)"/>
  <circle cx="98" cy="93" r="3" fill="{self.colors['primary']}" filter="url(#glow)"/>
  
  <!-- Center energy core -->
  <circle cx="64" cy="64" r="4" fill="url(#zentakoGrad)" filter="url(#glow)"/>
  <circle cx="64" cy="64" r="2" fill="white" opacity="0.8"/>
</svg>'''

    
    def svg_to_png_svglib(self, svg_path: Path, png_path: Path, size: int) -> bool:
        """Convert SVG to PNG using svglib + reportlab (pure Python, no C deps)."""
        try:
            # Load SVG as ReportLab drawing
            drawing = svg2rlg(str(svg_path))
            if drawing is None:
                print(f"❌ Failed to load SVG: {svg_path}")
                return False
            
            # Scale to target size
            scale_x = size / drawing.width
            scale_y = size / drawing.height
            scale = min(scale_x, scale_y)
            
            drawing.width = size
            drawing.height = size
            drawing.scale(scale, scale)
            
            # Render to PNG
            renderPM.drawToFile(drawing, str(png_path), fmt='PNG', dpi=72)
            return True
        except Exception as e:
            print(f"❌ svglib conversion failed for {size}x{size}: {e}")
            return False
    
    def generate_all_sizes(self):
        """Generate logos at all standard sizes (SVG + PNG via ImageMagick)."""
        sizes = [16, 32, 48, 64, 128, 256, 512, 1024]
        
        print("🎨 Generating ZENTAKO Logos - Building the Future of 3D")
        print("=" * 60)
        
        # Check available conversion methods
        conversion_method = None
        if HAS_SVGLIB:
            conversion_method = "svglib"
            print("✅ svglib + reportlab detected - will generate PNGs")
        else:
            print("⚠️  No PNG conversion libraries available - SVG only")
        
        print()
        
        # Generate SVGs
        for size in sizes:
            svg_content = self.generate_zentako_logo_svg(size)
            svg_path = self.output_dir / f"zentako-logo-{size}.svg"
            svg_path.write_text(svg_content, encoding='utf-8')
            print(f"✅ Generated SVG: {size}x{size}px")
        
        # Generate master SVG (scalable)
        master_svg = self.generate_zentako_logo_svg(128)
        master_path = self.output_dir / "zentako-logo.svg"
        master_path.write_text(master_svg, encoding='utf-8')
        print(f"✅ Generated master SVG (scalable)")
        
        # Generate PNGs if conversion is available
        if conversion_method:
            print("\n🖼️  Converting to PNG...")
            for size in sizes:
                svg_path = self.output_dir / f"zentako-logo-{size}.svg"
                png_path = self.output_dir / f"zentako-logo-{size}.png"
                
                if conversion_method == "svglib":
                    success = self.svg_to_png_svglib(svg_path, png_path, size)
                    if success:
                        print(f"✅ Generated PNG: {size}x{size}px")
                    else:
                        print(f"❌ Failed to generate PNG {size}x{size}")
        
        print("\n" + "=" * 60)
        print(f"🎉 COMPLETE! Logos saved to: {self.output_dir}")
        print("\n📦 Generated files:")
        print(f"   - zentako-logo.svg (master, scalable)")
        for size in sizes:
            print(f"   - zentako-logo-{size}.svg")
            if conversion_method == "svglib":
                print(f"   - zentako-logo-{size}.png")
        
        if not conversion_method:
            print("\n💡 To convert SVG to PNG:")
            print("   Option 1: Install svglib + reportlab (pure Python)")
            print("     pip install svglib reportlab")
            print("\n   Option 2: Use Inkscape CLI")
            print("     inkscape zentako-logo.svg --export-type=png --export-width=128")
            print("\n   Option 3: Use online converter")
            print("     https://cloudconvert.com/svg-to-png")


def main():
    """Main entry point"""
    generator = ZentakoLogoGenerator()
    generator.generate_all_sizes()


if __name__ == "__main__":
    main()
