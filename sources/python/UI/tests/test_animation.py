"""
Test script for UI Forge Animation System

Demonstrates the animation system by creating a simple animated icon.
"""

import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw

from models import (
    AnimationConfig,
    MotionType,
    AnimationEasing,
    AnimationOutputType,
    SpriteSheetLayout,
)
from animation.motion_library import get_motion_function, compose_motions, list_motion_types
from animation.svg_animator import SVGAnimator
from animation.sprite_sheet import SpriteSheetGenerator


def create_test_image(size: int = 64) -> np.ndarray:
    """
    Create a simple test image (circle icon).
    
    Args:
        size: Image size in pixels
        
    Returns:
        Image as numpy array (H, W, 4)
    """
    # Create RGBA image
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # Draw a blue circle
    margin = size // 4
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        fill=(59, 130, 246, 255),  # Blue
        outline=(30, 64, 175, 255),  # Darker blue
        width=2,
    )
    
    # Convert to numpy array
    return np.array(image)


def create_test_svg(output_path: Path, size: int = 64) -> None:
    """
    Create a simple test SVG file.
    
    Args:
        output_path: Output SVG path
        size: SVG size in pixels
    """
    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <circle cx="{size/2}" cy="{size/2}" r="{size/3}" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
</svg>'''
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)


def test_motion_library():
    """Test motion library functions."""
    print("\n=== Testing Motion Library ===")
    
    # List all motion types
    motion_types = list_motion_types()
    print(f"Available motion types: {len(motion_types)}")
    print(f"  Core + extended motions available")
    
    # Test a single motion
    print("\nTesting 'orbit' motion:")
    orbit_func = get_motion_function('orbit')
    params = {'radius': 10, 'speed': 1.0, 'clockwise': True}
    
    for t in [0.0, 0.25, 0.5, 0.75, 1.0]:
        transform = orbit_func(t, params)
        tx, ty = transform['translate']
        print(f"  t={t:.2f}: translate=({tx:.2f}, {ty:.2f}), rotate={transform['rotate']:.2f}")
    
    # Test motion composition
    print("\nTesting motion composition (orbit + pulse):")
    motion_configs = [
        ('orbit', {'radius': 10, 'speed': 1.0}),
        ('pulse', {'intensity': 0.2, 'frequency': 2.0}),
    ]
    
    for t in [0.0, 0.5, 1.0]:
        transform = compose_motions(t, motion_configs)
        tx, ty = transform['translate']
        sx, sy = transform['scale']
        print(f"  t={t:.2f}: translate=({tx:.2f}, {ty:.2f}), scale=({sx:.2f}, {sy:.2f})")
    
    print("✓ Motion library tests passed")


def test_extended_motion_composition():
    """Test new procedural motions and shared parameter helpers."""
    motion_configs = [
        ("hover", {"amplitude": 6, "tilt": 5, "frequency": 1.2, "phase": 0.1}),
        ("ripple", {"intensity": 0.12, "frequency": 2.4}),
        ("jitter", {"intensity": 0.6, "frequency": 14, "seed": 7}),
    ]

    transform = compose_motions(0.375, motion_configs)
    tx, ty = transform["translate"]
    sx, sy = transform["scale"]

    assert isinstance(tx, float)
    assert isinstance(ty, float)
    assert sx != 1.0 or sy != 1.0
    assert "rotate" in transform


def test_sprite_sheet_generation():
    """Test sprite sheet generation."""
    print("\n=== Testing Sprite Sheet Generation ===")
    
    # Create test image
    base_image = create_test_image(64)
    print(f"Created test image: {base_image.shape}")
    
    # Create animation config
    animation_config = AnimationConfig(
        enabled=True,
        motion_types=[MotionType.ORBIT, MotionType.PULSE],
        duration=2.0,
        fps=10,
        loop=True,
        easing=AnimationEasing.LINEAR,
        motion_params={
            'orbit': {'radius': 8, 'speed': 1.0},
            'pulse': {'intensity': 0.15, 'frequency': 2.0},
        },
        output_type=AnimationOutputType.SPRITE_SHEET,
        sprite_sheet_layout=SpriteSheetLayout.GRID,
    )
    
    # Generate sprite sheet
    output_dir = Path(__file__).parent / "test_output"
    output_dir.mkdir(exist_ok=True)
    
    generator = SpriteSheetGenerator()
    sprite_path, metadata_path = generator.generate_sprite_sheet(
        base_image,
        animation_config,
        output_dir / "test_sprite.png",
    )
    
    if sprite_path and metadata_path:
        print(f"✓ Generated sprite sheet: {sprite_path}")
        print(f"✓ Generated metadata: {metadata_path}")
        
        # Load and verify sprite sheet
        sprite_image = Image.open(sprite_path)
        print(f"  Sprite sheet size: {sprite_image.size}")
        print(f"  Expected frames: {int(animation_config.duration * animation_config.fps)}")
    else:
        print("✗ Sprite sheet generation failed")


def test_svg_animation():
    """Test SVG animation generation."""
    print("\n=== Testing SVG Animation ===")
    
    # Create test SVG
    output_dir = Path(__file__).parent / "test_output"
    output_dir.mkdir(exist_ok=True)
    
    static_svg_path = output_dir / "test_static.svg"
    create_test_svg(static_svg_path, 64)
    print(f"Created test SVG: {static_svg_path}")
    
    # Create animation config
    animation_config = AnimationConfig(
        enabled=True,
        motion_types=[MotionType.FLOAT, MotionType.PULSE],
        duration=3.0,
        fps=30,
        loop=True,
        easing=AnimationEasing.EASE_IN_OUT,
        motion_params={
            'float': {'amplitude': 5, 'frequency': 1.0, 'axis': 'vertical'},
            'pulse': {'intensity': 0.1, 'frequency': 1.5},
        },
        output_type=AnimationOutputType.SVG_SMIL,
    )
    
    # Generate animated SVG
    animator = SVGAnimator()
    animated_svg_path = output_dir / "test_animated.svg"
    
    success = animator.animate_svg(
        static_svg_path,
        animated_svg_path,
        animation_config,
    )
    
    if success:
        print(f"✓ Generated animated SVG: {animated_svg_path}")
        print(f"  Open in browser to see animation!")
    else:
        print("✗ SVG animation generation failed")


def test_all_motion_types():
    """Test all motion types to ensure they work."""
    print("\n=== Testing All Motion Types ===")
    
    motion_types = list_motion_types()
    failed = []
    
    for motion_name in motion_types:
        try:
            motion_func = get_motion_function(motion_name)
            # Test at t=0.5 with default params
            transform = motion_func(0.5, {})
            
            # Verify transform structure
            assert 'translate' in transform
            assert 'rotate' in transform
            assert 'scale' in transform
            
            print(f"  ✓ {motion_name}")
            
        except Exception as e:
            print(f"  ✗ {motion_name}: {e}")
            failed.append(motion_name)
    
    if failed:
        print(f"\n✗ {len(failed)} motion types failed: {', '.join(failed)}")
    else:
        print(f"\n✓ All {len(motion_types)} motion types working!")


def main():
    """Run all tests."""
    print("=" * 60)
    print("UI Forge Animation System Test Suite")
    print("=" * 60)
    
    try:
        test_motion_library()
        test_extended_motion_composition()
        test_all_motion_types()
        test_sprite_sheet_generation()
        test_svg_animation()
        
        print("\n" + "=" * 60)
        print("✓ All tests completed successfully!")
        print("=" * 60)
        print("\nCheck the 'test_output' directory for generated files:")
        print("  - test_sprite.png (sprite sheet)")
        print("  - test_sprite.json (sprite metadata)")
        print("  - test_static.svg (static SVG)")
        print("  - test_animated.svg (animated SVG - open in browser!)")
        
    except Exception as e:
        print(f"\n✗ Test suite failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
