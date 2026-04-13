"""
UI Forge SVG Animator

Generates SMIL-based animated SVG files from static SVG icons and motion configurations.
Uses <animate>, <animateTransform>, and <animateMotion> elements for smooth animations.

SMIL (Synchronized Multimedia Integration Language) provides declarative animations
that work in all modern browsers without JavaScript.

Requirements: 16.7
"""

import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import xml.etree.ElementTree as ET
from xml.dom import minidom

from models import AnimationConfig, AnimationEasing, MotionType
from animation.motion_library import get_motion_function, compose_motions


logger = logging.getLogger(__name__)


# ============================================================================
# SMIL Animation Generation
# ============================================================================

class SVGAnimator:
    """
    Generates SMIL-animated SVG files from static SVGs and motion configurations.
    
    Workflow:
    1. Load static SVG file
    2. Sample motion functions to generate keyframes
    3. Add SMIL animation elements to SVG
    4. Save animated SVG
    
    Usage:
        animator = SVGAnimator()
        animator.animate_svg(
            input_svg="icon.svg",
            output_svg="icon_animated.svg",
            animation_config=config
        )
    """
    
    def __init__(self):
        """Initialize SVG animator."""
        self.svg_namespace = "http://www.w3.org/2000/svg"
        ET.register_namespace('', self.svg_namespace)
    
    def animate_svg(
        self,
        input_svg: Path,
        output_svg: Path,
        animation_config: AnimationConfig,
    ) -> bool:
        """
        Generate animated SVG from static SVG and animation configuration.
        
        Args:
            input_svg: Path to static SVG file
            output_svg: Path to save animated SVG
            animation_config: Animation configuration
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Load static SVG
            tree = ET.parse(input_svg)
            root = tree.getroot()
            
            # Find the main group or create one
            main_group = self._get_or_create_main_group(root)
            
            # Sample motion functions to generate keyframes
            keyframes = self._generate_keyframes(animation_config)
            
            # Add SMIL animation elements
            self._add_smil_animations(main_group, keyframes, animation_config)
            
            # Pretty print and save
            self._save_svg(root, output_svg)
            
            logger.info(f"Generated animated SVG: {output_svg}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to animate SVG: {e}")
            return False
    
    def _get_or_create_main_group(self, root: ET.Element) -> ET.Element:
        """
        Get or create the main group element to animate.
        
        Args:
            root: SVG root element
            
        Returns:
            Main group element
        """
        # Look for existing group
        groups = root.findall('.//{http://www.w3.org/2000/svg}g')
        
        if groups:
            # Use first group
            return groups[0]
        else:
            # Create new group and move all children into it
            main_group = ET.Element('g', attrib={'id': 'animated-group'})
            
            # Move all children to group
            for child in list(root):
                if child.tag != '{http://www.w3.org/2000/svg}defs':
                    root.remove(child)
                    main_group.append(child)
            
            # Add group to root
            root.append(main_group)
            return main_group
    
    def _generate_keyframes(self, animation_config: AnimationConfig) -> List[Dict[str, Any]]:
        """
        Generate keyframes by sampling motion functions.
        
        Args:
            animation_config: Animation configuration
            
        Returns:
            List of keyframe dictionaries with time and transform values
        """
        num_frames = int(animation_config.duration * animation_config.fps)
        keyframes = []
        
        # Prepare motion configurations for composition
        motion_configs = []
        for motion_type in animation_config.motion_types:
            params = animation_config.motion_params.get(motion_type.value, {})
            motion_configs.append((motion_type.value, params))
        
        # Sample at each frame
        for frame in range(num_frames + 1):
            t = frame / num_frames if num_frames > 0 else 0.0
            
            # Apply easing
            t_eased = self._apply_easing(t, animation_config.easing)
            
            # Get composed transform
            if len(motion_configs) == 1:
                # Single motion
                motion_type, params = motion_configs[0]
                motion_func = get_motion_function(motion_type)
                transform = motion_func(t_eased, params)
            else:
                # Compose multiple motions
                transform = compose_motions(t_eased, motion_configs)
            
            keyframes.append({
                'time': t,
                'transform': transform,
            })
        
        return keyframes
    
    def _apply_easing(self, t: float, easing: AnimationEasing) -> float:
        """
        Apply easing function to normalized time.
        
        Args:
            t: Normalized time (0.0 to 1.0)
            easing: Easing function type
            
        Returns:
            Eased time value
        """
        if easing == AnimationEasing.LINEAR:
            return t
        elif easing == AnimationEasing.EASE_IN:
            return t * t
        elif easing == AnimationEasing.EASE_OUT:
            return 1 - (1 - t) * (1 - t)
        elif easing == AnimationEasing.EASE_IN_OUT:
            if t < 0.5:
                return 2 * t * t
            else:
                return 1 - 2 * (1 - t) * (1 - t)
        else:
            return t
    
    def _add_smil_animations(
        self,
        element: ET.Element,
        keyframes: List[Dict[str, Any]],
        animation_config: AnimationConfig,
    ) -> None:
        """
        Add SMIL animation elements to SVG element.
        
        Args:
            element: SVG element to animate
            keyframes: List of keyframe dictionaries
            animation_config: Animation configuration
        """
        duration = animation_config.duration
        
        # Extract transform values from keyframes
        translate_x_values = []
        translate_y_values = []
        rotate_values = []
        scale_x_values = []
        scale_y_values = []
        
        for kf in keyframes:
            tx, ty = kf['transform']['translate']
            translate_x_values.append(tx)
            translate_y_values.append(ty)
            rotate_values.append(kf['transform']['rotate'])
            sx, sy = kf['transform']['scale']
            scale_x_values.append(sx)
            scale_y_values.append(sy)
        
        # Check if we need each animation type
        has_translate = any(abs(tx) > 0.01 or abs(ty) > 0.01 for tx, ty in zip(translate_x_values, translate_y_values))
        has_rotate = any(abs(r) > 0.01 for r in rotate_values)
        has_scale = any(abs(sx - 1.0) > 0.01 or abs(sy - 1.0) > 0.01 for sx, sy in zip(scale_x_values, scale_y_values))
        
        # Add translate animation
        if has_translate:
            self._add_translate_animation(
                element,
                translate_x_values,
                translate_y_values,
                duration,
                animation_config,
            )
        
        # Add rotate animation
        if has_rotate:
            self._add_rotate_animation(
                element,
                rotate_values,
                duration,
                animation_config,
            )
        
        # Add scale animation
        if has_scale:
            self._add_scale_animation(
                element,
                scale_x_values,
                scale_y_values,
                duration,
                animation_config,
            )
    
    def _add_translate_animation(
        self,
        element: ET.Element,
        x_values: List[float],
        y_values: List[float],
        duration: float,
        animation_config: AnimationConfig,
    ) -> None:
        """
        Add translate animation using animateTransform.
        
        Args:
            element: SVG element to animate
            x_values: X translation values
            y_values: Y translation values
            duration: Animation duration in seconds
            animation_config: Animation configuration
        """
        # Format values as "x,y" pairs
        values = ';'.join([f"{x},{y}" for x, y in zip(x_values, y_values)])
        
        # Create animateTransform element
        anim = ET.SubElement(element, 'animateTransform')
        anim.set('attributeName', 'transform')
        anim.set('attributeType', 'XML')
        anim.set('type', 'translate')
        anim.set('values', values)
        anim.set('dur', f"{duration}s")
        anim.set('repeatCount', 'indefinite' if animation_config.loop else '1')
        
        if animation_config.delay > 0:
            anim.set('begin', f"{animation_config.delay}s")
        
        # Add calcMode for smooth interpolation
        anim.set('calcMode', 'spline')
        
        # Generate keyTimes
        key_times = ';'.join([str(i / (len(x_values) - 1)) for i in range(len(x_values))])
        anim.set('keyTimes', key_times)
        
        # Generate keySplines for smooth interpolation
        # Each segment needs a cubic bezier control points
        key_splines = []
        for i in range(len(x_values) - 1):
            # Use ease-in-out cubic bezier
            key_splines.append('0.42 0 0.58 1')
        anim.set('keySplines', ';'.join(key_splines))
        
        if animation_config.alternate:
            anim.set('fill', 'freeze')
            # Note: SMIL doesn't have built-in alternate, would need multiple animations
    
    def _add_rotate_animation(
        self,
        element: ET.Element,
        rotate_values: List[float],
        duration: float,
        animation_config: AnimationConfig,
    ) -> None:
        """
        Add rotation animation using animateTransform.
        
        Args:
            element: SVG element to animate
            rotate_values: Rotation values in degrees
            duration: Animation duration in seconds
            animation_config: Animation configuration
        """
        # Format values as "angle" (rotation around center)
        values = ';'.join([str(angle) for angle in rotate_values])
        
        # Create animateTransform element
        anim = ET.SubElement(element, 'animateTransform')
        anim.set('attributeName', 'transform')
        anim.set('attributeType', 'XML')
        anim.set('type', 'rotate')
        anim.set('values', values)
        anim.set('dur', f"{duration}s")
        anim.set('repeatCount', 'indefinite' if animation_config.loop else '1')
        anim.set('additive', 'sum')  # Combine with other transforms
        
        if animation_config.delay > 0:
            anim.set('begin', f"{animation_config.delay}s")
        
        # Add calcMode for smooth interpolation
        anim.set('calcMode', 'spline')
        
        # Generate keyTimes
        key_times = ';'.join([str(i / (len(rotate_values) - 1)) for i in range(len(rotate_values))])
        anim.set('keyTimes', key_times)
        
        # Generate keySplines
        key_splines = []
        for i in range(len(rotate_values) - 1):
            key_splines.append('0.42 0 0.58 1')
        anim.set('keySplines', ';'.join(key_splines))
    
    def _add_scale_animation(
        self,
        element: ET.Element,
        scale_x_values: List[float],
        scale_y_values: List[float],
        duration: float,
        animation_config: AnimationConfig,
    ) -> None:
        """
        Add scale animation using animateTransform.
        
        Args:
            element: SVG element to animate
            scale_x_values: X scale values
            scale_y_values: Y scale values
            duration: Animation duration in seconds
            animation_config: Animation configuration
        """
        # Format values as "sx,sy" pairs
        values = ';'.join([f"{sx},{sy}" for sx, sy in zip(scale_x_values, scale_y_values)])
        
        # Create animateTransform element
        anim = ET.SubElement(element, 'animateTransform')
        anim.set('attributeName', 'transform')
        anim.set('attributeType', 'XML')
        anim.set('type', 'scale')
        anim.set('values', values)
        anim.set('dur', f"{duration}s")
        anim.set('repeatCount', 'indefinite' if animation_config.loop else '1')
        anim.set('additive', 'sum')  # Combine with other transforms
        
        if animation_config.delay > 0:
            anim.set('begin', f"{animation_config.delay}s")
        
        # Add calcMode for smooth interpolation
        anim.set('calcMode', 'spline')
        
        # Generate keyTimes
        key_times = ';'.join([str(i / (len(scale_x_values) - 1)) for i in range(len(scale_x_values))])
        anim.set('keyTimes', key_times)
        
        # Generate keySplines
        key_splines = []
        for i in range(len(scale_x_values) - 1):
            key_splines.append('0.42 0 0.58 1')
        anim.set('keySplines', ';'.join(key_splines))
    
    def _save_svg(self, root: ET.Element, output_path: Path) -> None:
        """
        Save SVG with pretty printing.
        
        Args:
            root: SVG root element
            output_path: Output file path
        """
        # Convert to string
        svg_string = ET.tostring(root, encoding='unicode')
        
        # Pretty print with minidom
        dom = minidom.parseString(svg_string)
        pretty_svg = dom.toprettyxml(indent='  ')
        
        # Remove extra blank lines
        lines = [line for line in pretty_svg.split('\n') if line.strip()]
        pretty_svg = '\n'.join(lines)
        
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save to file
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(pretty_svg)


# ============================================================================
# Convenience Functions
# ============================================================================

def animate_svg_file(
    input_svg: Path,
    output_svg: Path,
    animation_config: AnimationConfig,
) -> bool:
    """
    Convenience function to animate an SVG file.
    
    Args:
        input_svg: Path to static SVG file
        output_svg: Path to save animated SVG
        animation_config: Animation configuration
        
    Returns:
        True if successful, False otherwise
    """
    animator = SVGAnimator()
    return animator.animate_svg(input_svg, output_svg, animation_config)


def create_animated_svg_from_template(
    static_svg_path: Path,
    output_dir: Path,
    animation_config: AnimationConfig,
    base_name: str,
) -> Optional[Path]:
    """
    Create animated SVG from static SVG with automatic naming.
    
    Args:
        static_svg_path: Path to static SVG
        output_dir: Output directory
        animation_config: Animation configuration
        base_name: Base name for output file
        
    Returns:
        Path to animated SVG or None if failed
    """
    # Generate output filename
    motion_names = '_'.join([mt.value for mt in animation_config.motion_types])
    output_filename = f"{base_name}_animated_{motion_names}.svg"
    output_path = output_dir / output_filename
    
    # Animate
    animator = SVGAnimator()
    success = animator.animate_svg(static_svg_path, output_path, animation_config)
    
    if success:
        return output_path
    else:
        return None


def batch_animate_svgs(
    input_svgs: List[Path],
    output_dir: Path,
    animation_config: AnimationConfig,
) -> List[Path]:
    """
    Batch animate multiple SVG files with the same animation configuration.
    
    Args:
        input_svgs: List of static SVG paths
        output_dir: Output directory
        animation_config: Animation configuration
        
    Returns:
        List of successfully generated animated SVG paths
    """
    animator = SVGAnimator()
    output_paths = []
    
    for input_svg in input_svgs:
        # Generate output path
        base_name = input_svg.stem
        motion_names = '_'.join([mt.value for mt in animation_config.motion_types])
        output_filename = f"{base_name}_animated_{motion_names}.svg"
        output_path = output_dir / output_filename
        
        # Animate
        success = animator.animate_svg(input_svg, output_path, animation_config)
        
        if success:
            output_paths.append(output_path)
        else:
            logger.warning(f"Failed to animate {input_svg}")
    
    logger.info(f"Batch animated {len(output_paths)}/{len(input_svgs)} SVG files")
    return output_paths
