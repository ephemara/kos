"""
20 Animated Icons - Sprite Sheet Generation
Generates 20 animated icons using sprite sheets with proper metadata
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import (
    Template, GeneratorType, OutputFormat, AlphaMode,
    AnimationConfig, MotionType, AnimationEasing, AnimationOutputType,
    SpriteSheetLayout, FillStyle, StrokeStyle, Layer, GradientType
)
from core import UIForgeEngine
import logging
import json

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def create_animated_icons():
    """Create 20 animated icons with sprite sheet output"""
    templates = []
    
    # Define 20 motion types as requested
    motion_configs = [
        ("orbit-icon", "ORBIT", "#3b82f6", "Orbital rotation"),
        ("pulse-icon", "PULSE", "#8b5cf6", "Pulsing scale"),
        ("bounce-icon", "BOUNCE", "#ec4899", "Bouncing motion"),
        ("float-icon", "FLOAT", "#06b6d4", "Floating drift"),
        ("shake-icon", "SHAKE", "#f59e0b", "Shaking vibration"),
        ("wobble-icon", "WOBBLE", "#10b981", "Wobbling motion"),
        ("glitch-icon", "GLITCH", "#ef4444", "Glitch effect"),
        ("tumble-icon", "TUMBLE", "#6366f1", "Tumbling rotation"),
        ("strobe-icon", "STROBE", "#f97316", "Strobe flash"),
        ("sway-icon", "SWAY", "#14b8a6", "Swaying motion"),
        ("pendulum-icon", "PENDULUM", "#a855f7", "Pendulum swing"),
        ("figure8-icon", "FIGURE8", "#0ea5e9", "Figure-8 path"),
        ("heartbeat-icon", "HEARTBEAT", "#f43f5e", "Heartbeat pulse"),
        ("corkscrew-icon", "CORKSCREW", "#8b5cf6", "Corkscrew spiral"),
        ("shiver-icon", "SHIVER", "#06b6d4", "Shivering motion"),
        ("flip-icon", "FLIP", "#10b981", "Flipping rotation"),
        ("tremor-icon", "TREMOR", "#f59e0b", "Tremor shake"),
        ("scan-icon", "SCAN", "#3b82f6", "Scanning motion"),
        ("warp-icon", "WARP", "#ec4899", "Warp distortion"),
        ("drift-icon", "DRIFT", "#14b8a6", "Drifting motion"),
    ]
    
    for name, motion, color, description in motion_configs:
        motion_type = getattr(MotionType, motion)
        
        # Create a simple icon with a circle and a marker
        templates.append(Template(
            name=name,
            description=description,
            generator_type=GeneratorType.ICON,
            category="animated",
            tags=["animation", motion.lower()],
            output_formats=[OutputFormat.PNG],
            dimensions={"width": 128, "height": 128},
            colors=[color],
            alpha_mode=AlphaMode.EMBEDDED,
            params={
                "layers": [
                    # Background circle
                    {
                        "type": "circle",
                        "geometry": {"cx": 64, "cy": 64, "r": 45},
                        "fill": {"type": "solid", "colors": [color]},
                        "stroke": None,
                        "opacity": 0.3
                    },
                    # Main circle
                    {
                        "type": "circle",
                        "geometry": {"cx": 64, "cy": 64, "r": 35},
                        "fill": None,
                        "stroke": {"color": color, "width": 4}
                    },
                    # Marker dot (this will animate)
                    {
                        "type": "circle",
                        "geometry": {"cx": 64, "cy": 29, "r": 8},
                        "fill": {"type": "solid", "colors": [color]},
                        "stroke": None
                    }
                ],
                "padding": 8,
                "antialias_factor": 2
            },
            animation=AnimationConfig(
                enabled=True,
                motion_types=[motion_type],
                duration=2.0,
                fps=24,
                loop=True,
                output_type=AnimationOutputType.SPRITE_SHEET,
                sprite_sheet_layout=SpriteSheetLayout.GRID
            ),
            version="1.0"
        ))
    
    return templates


def generate_html_gallery(output_dir: Path, results: list):
    """Generate HTML gallery with canvas-based sprite sheet animation"""
    
    # Build icon data from results
    icon_data = []
    for result in results:
        if result.success:
            sprite_path = result.output_paths.get('sprite_sheet')
            sprite_metadata = result.output_paths.get('sprite_metadata')
            if sprite_path and sprite_metadata:
                # Get relative paths from output directory
                sprite_rel = Path(sprite_path).relative_to(output_dir.parent.parent)
                metadata_rel = Path(sprite_metadata).relative_to(output_dir.parent.parent)
                
                icon_data.append({
                    'name': result.template_name,
                    'sprite_path': str(sprite_rel).replace('\\', '/'),
                    'metadata_path': str(metadata_rel).replace('\\', '/')
                })
    
    # Generate JavaScript icon array
    icons_js = json.dumps(icon_data, indent=12)
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Animated Icons Gallery - Sprite Sheet Animation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
            color: #e0e7ff;
            font-family: 'Segoe UI', system-ui, sans-serif;
            padding: 40px 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        h1 {
            text-align: center;
            font-size: 3rem;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #ec4899 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: 0 0 40px rgba(96, 165, 250, 0.3);
        }
        
        .subtitle {
            text-align: center;
            color: #94a3b8;
            margin-bottom: 3rem;
            font-size: 1.1rem;
        }
        
        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 30px;
            padding: 20px;
        }
        
        .icon-card {
            background: rgba(30, 41, 59, 0.6);
            border: 1px solid rgba(96, 165, 250, 0.2);
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }
        
        .icon-card:hover {
            transform: translateY(-5px);
            border-color: rgba(96, 165, 250, 0.5);
            box-shadow: 0 10px 40px rgba(96, 165, 250, 0.2);
        }
        
        .icon-canvas {
            width: 128px;
            height: 128px;
            margin: 0 auto 15px;
            display: block;
            image-rendering: crisp-edges;
        }
        
        .icon-name {
            font-size: 0.9rem;
            color: #cbd5e1;
            margin-bottom: 5px;
            font-weight: 500;
        }
        
        .icon-motion {
            font-size: 0.75rem;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .controls {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(30, 41, 59, 0.6);
            border-radius: 12px;
            border: 1px solid rgba(96, 165, 250, 0.2);
        }
        
        .controls button {
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            margin: 0 10px;
            transition: all 0.3s ease;
        }
        
        .controls button:hover {
            transform: scale(1.05);
            box-shadow: 0 5px 20px rgba(59, 130, 246, 0.4);
        }
        
        .stats {
            text-align: center;
            margin-top: 30px;
            color: #64748b;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 Animated Icons Gallery</h1>
        <p class="subtitle">20 Sprite Sheet Animations with Canvas Rendering</p>
        
        <div class="controls">
            <button onclick="pauseAll()">⏸️ Pause All</button>
            <button onclick="playAll()">▶️ Play All</button>
            <button onclick="resetAll()">🔄 Reset All</button>
        </div>
        
        <div class="gallery" id="gallery"></div>
        
        <div class="stats">
            <p>Generated with K_OS UI Forge Engine | Sprite Sheet Animation System</p>
        </div>
    </div>
    
    <script>
        class SpriteAnimator {
            constructor(canvas, spritePath, metadataPath, name) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.name = name;
                this.image = new Image();
                this.metadata = null;
                this.currentFrame = 0;
                this.isPlaying = true;
                this.lastFrameTime = 0;
                
                // Load sprite sheet and metadata
                this.loadResources(spritePath, metadataPath);
            }
            
            async loadResources(spritePath, metadataPath) {
                try {
                    // Load metadata
                    const metadataResponse = await fetch(metadataPath);
                    this.metadata = await metadataResponse.json();
                    
                    // Load sprite sheet image
                    this.image.onload = () => {
                        this.start();
                    };
                    this.image.src = spritePath;
                } catch (error) {
                    console.error(`Failed to load resources for ${this.name}:`, error);
                }
            }
            
            start() {
                this.animate();
            }
            
            animate(timestamp = 0) {
                if (!this.metadata || !this.isPlaying) {
                    requestAnimationFrame((t) => this.animate(t));
                    return;
                }
                
                const frameDelay = 1000 / this.metadata.fps;
                
                if (timestamp - this.lastFrameTime >= frameDelay) {
                    this.drawFrame();
                    this.currentFrame = (this.currentFrame + 1) % this.metadata.frame_count;
                    this.lastFrameTime = timestamp;
                }
                
                requestAnimationFrame((t) => this.animate(t));
            }
            
            drawFrame() {
                if (!this.metadata) return;
                
                const { frame_width, frame_height, columns } = this.metadata;
                const row = Math.floor(this.currentFrame / columns);
                const col = this.currentFrame % columns;
                
                const sx = col * frame_width;
                const sy = row * frame_height;
                
                // Clear canvas
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                // Draw current frame
                this.ctx.drawImage(
                    this.image,
                    sx, sy, frame_width, frame_height,
                    0, 0, this.canvas.width, this.canvas.height
                );
            }
            
            pause() {
                this.isPlaying = false;
            }
            
            play() {
                this.isPlaying = true;
            }
            
            reset() {
                this.currentFrame = 0;
                this.drawFrame();
            }
        }
        
        // Global animator registry
        const animators = [];
        
        // Icon configurations
        const icons = [
            { name: "orbit-icon", motion: "ORBIT" },
            { name: "pulse-icon", motion: "PULSE" },
            { name: "bounce-icon", motion: "BOUNCE" },
            { name: "float-icon", motion: "FLOAT" },
            { name: "shake-icon", motion: "SHAKE" },
            { name: "wobble-icon", motion: "WOBBLE" },
            { name: "glitch-icon", motion: "GLITCH" },
            { name: "tumble-icon", motion: "TUMBLE" },
            { name: "strobe-icon", motion: "STROBE" },
            { name: "sway-icon", motion: "SWAY" },
            { name: "pendulum-icon", motion: "PENDULUM" },
            { name: "figure8-icon", motion: "FIGURE8" },
            { name: "heartbeat-icon", motion: "HEARTBEAT" },
            { name: "corkscrew-icon", motion: "CORKSCREW" },
            { name: "shiver-icon", motion: "SHIVER" },
            { name: "flip-icon", motion: "FLIP" },
            { name: "tremor-icon", motion: "TREMOR" },
            { name: "scan-icon", motion: "SCAN" },
            { name: "warp-icon", motion: "WARP" },
            { name: "drift-icon", motion: "DRIFT" }
        ];
        
        // Initialize gallery
        function initGallery() {
            const gallery = document.getElementById('gallery');
            
            icons.forEach(icon => {
                const card = document.createElement('div');
                card.className = 'icon-card';
                
                const canvas = document.createElement('canvas');
                canvas.className = 'icon-canvas';
                canvas.width = 128;
                canvas.height = 128;
                
                const nameDiv = document.createElement('div');
                nameDiv.className = 'icon-name';
                nameDiv.textContent = icon.name;
                
                const motionDiv = document.createElement('div');
                motionDiv.className = 'icon-motion';
                motionDiv.textContent = icon.motion;
                
                card.appendChild(canvas);
                card.appendChild(nameDiv);
                card.appendChild(motionDiv);
                gallery.appendChild(card);
                
                // Create animator
                const spritePath = `${icon.name}_sprite_sheet.png`;
                const metadataPath = `${icon.name}_sprite_sheet.json`;
                const animator = new SpriteAnimator(canvas, spritePath, metadataPath, icon.name);
                animators.push(animator);
            });
        }
        
        // Control functions
        function pauseAll() {
            animators.forEach(animator => animator.pause());
        }
        
        function playAll() {
            animators.forEach(animator => animator.play());
        }
        
        function resetAll() {
            animators.forEach(animator => animator.reset());
        }
        
        // Initialize on load
        window.addEventListener('DOMContentLoaded', initGallery);
    </script>
</body>
</html>
"""
    
    gallery_path = output_dir / "animated_gallery.html"
    gallery_path.write_text(html_content, encoding='utf-8')
    logger.info(f"✅ Generated HTML gallery: {gallery_path}")
    return gallery_path


def main():
    """Main execution"""
    logger.info("🎬 Starting 20 Animated Icons Generation (Sprite Sheets)")
    
    # Create templates
    templates = create_animated_icons()
    logger.info(f"✅ Created {len(templates)} animated icon templates")
    
    # Initialize engine
    engine = UIForgeEngine()
    
    # Output directory
    output_dir = Path(__file__).parent / "output" / "animated_icons_20"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate all icons
    results = []
    for i, template in enumerate(templates, 1):
        logger.info(f"[{i}/{len(templates)}] Generating {template.name}...")
        try:
            result = engine.generate_asset(template)
            results.append(result)
            if result.success:
                sprite_path = result.output_paths.get('sprite_sheet', 'N/A')
                logger.info(f"  ✅ Generated sprite sheet: {sprite_path}")
            else:
                logger.error(f"  ❌ Failed: {result.error}")
        except Exception as e:
            logger.error(f"  ❌ Failed to generate {template.name}: {e}")
    
    # Generate HTML gallery
    gallery_path = generate_html_gallery(output_dir)
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("🎉 GENERATION COMPLETE!")
    logger.info("="*60)
    logger.info(f"✅ Generated: {len(results)}/{len(templates)} icons")
    logger.info(f"📁 Output directory: {output_dir}")
    logger.info(f"🌐 HTML Gallery: {gallery_path}")
    logger.info("\n💡 Open the HTML file in a browser to see animated sprite sheets!")
    logger.info("="*60)


if __name__ == "__main__":
    main()
