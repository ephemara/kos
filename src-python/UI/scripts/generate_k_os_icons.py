#!/usr/bin/env python3
"""
K_OS DCC Suite Icon Generator
Generates comprehensive icon set for 3D DCC pipeline
Clean, minimal, solid-color design language
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Tuple


class KOSIconGenerator:
    """Generates complete K_OS DCC Suite icon set"""
    
    def __init__(self, output_dir: str = None):
        if output_dir is None:
            # Default to K_OS frontend assets
            output_dir = Path(__file__).parent.parent.parent.parent / "src-frontend" / "assets" / "icons"
        self.output_dir = Path(output_dir)
        self.icons_dir = self.output_dir
        self.icons_dir.mkdir(parents=True, exist_ok=True)
        
        # K_OS Color Palette - Clean, professional, modern
        self.colors = {
            # Primary actions
            "primary": "#8B5CF6",      # Purple - main actions
            "secondary": "#3B82F6",    # Blue - secondary actions
            "accent": "#EC4899",       # Pink - highlights
            "success": "#10B981",      # Green - success states
            "warning": "#F59E0B",      # Amber - warnings
            "danger": "#EF4444",       # Red - destructive actions
            
            # Tool categories
            "modeling": "#3B82F6",     # Blue
            "sculpting": "#8B5CF6",    # Purple
            "texturing": "#EC4899",    # Pink
            "rigging": "#F59E0B",      # Amber
            "animation": "#10B981",    # Green
            "rendering": "#EF4444",    # Red
            "simulation": "#06B6D4",   # Cyan
            "compositing": "#8B5CF6",  # Purple
            
            # UI elements
            "neutral": "#64748B",      # Slate
            "light": "#94A3B8",        # Light slate
            "dark": "#1E293B",         # Dark slate
        }
    
    # ============================================================================
    # MODELING TOOLS
    # ============================================================================
    
    def _icon_cube(self, color: str) -> str:
        """Primitive: Cube"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12 L52 24 L52 44 L32 56 L12 44 L12 24 Z" fill="{color}"/>
  <path d="M32 12 L32 56" stroke="#fff" stroke-width="2" opacity="0.3"/>
  <path d="M12 24 L52 24" stroke="#fff" stroke-width="2" opacity="0.3"/>
  <path d="M12 44 L32 56 L52 44" stroke="#fff" stroke-width="2" opacity="0.3"/>
</svg>'''
    
    def _icon_sphere(self, color: str) -> str:
        """Primitive: Sphere"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="20" fill="{color}"/>
  <ellipse cx="32" cy="32" rx="20" ry="8" stroke="#fff" stroke-width="2" fill="none" opacity="0.3"/>
  <ellipse cx="32" cy="32" rx="8" ry="20" stroke="#fff" stroke-width="2" fill="none" opacity="0.3"/>
  <circle cx="32" cy="32" r="14" stroke="#fff" stroke-width="2" fill="none" opacity="0.2"/>
</svg>'''
    
    def _icon_cylinder(self, color: str) -> str:
        """Primitive: Cylinder"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="16" rx="16" ry="6" fill="{color}"/>
  <rect x="16" y="16" width="32" height="32" fill="{color}"/>
  <ellipse cx="32" cy="48" rx="16" ry="6" fill="{color}"/>
  <ellipse cx="32" cy="16" rx="16" ry="6" stroke="#fff" stroke-width="2" fill="none" opacity="0.3"/>
</svg>'''
    
    def _icon_cone(self, color: str) -> str:
        """Primitive: Cone"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12 L52 48 L12 48 Z" fill="{color}"/>
  <ellipse cx="32" cy="48" rx="20" ry="6" fill="{color}"/>
  <line x1="32" y1="12" x2="32" y2="48" stroke="#fff" stroke-width="2" opacity="0.3"/>
</svg>'''
    
    def _icon_torus(self, color: str) -> str:
        """Primitive: Torus"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="18" stroke="{color}" stroke-width="8" fill="none"/>
  <ellipse cx="32" cy="32" rx="18" ry="6" stroke="#fff" stroke-width="2" fill="none" opacity="0.3"/>
  <ellipse cx="32" cy="32" rx="6" ry="18" stroke="#fff" stroke-width="2" fill="none" opacity="0.3"/>
</svg>'''
    
    def _icon_plane(self, color: str) -> str:
        """Primitive: Plane"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 20 L52 20 L48 44 L16 44 Z" fill="{color}"/>
  <line x1="12" y1="20" x2="16" y2="44" stroke="#fff" stroke-width="2" opacity="0.3"/>
  <line x1="52" y1="20" x2="48" y2="44" stroke="#fff" stroke-width="2" opacity="0.3"/>
  <line x1="32" y1="20" x2="32" y2="44" stroke="#fff" stroke-width="2" opacity="0.3"/>
</svg>'''
    
    def _icon_extrude(self, color: str) -> str:
        """Extrude tool"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="16" y="32" width="32" height="20" fill="{color}" opacity="0.5"/>
  <rect x="20" y="12" width="24" height="20" fill="{color}"/>
  <path d="M32 32 L32 20 M28 24 L32 20 L36 24" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    def _icon_bevel(self, color: str) -> str:
        """Bevel tool"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 16 L48 16 L48 48 L16 48 Z" fill="{color}" opacity="0.3"/>
  <path d="M20 20 L44 20 L44 44 L20 44 Z" fill="{color}"/>
  <path d="M16 16 L20 20 M48 16 L44 20 M48 48 L44 44 M16 48 L20 44" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
</svg>'''
    
    def _icon_boolean_union(self, color: str) -> str:
        """Boolean: Union"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="32" r="16" fill="{color}"/>
  <circle cx="40" cy="32" r="16" fill="{color}"/>
  <path d="M24 16 A16 16 0 0 1 24 48 M40 16 A16 16 0 0 0 40 48" stroke="#fff" stroke-width="2" opacity="0.5"/>
</svg>'''
    
    def _icon_boolean_subtract(self, color: str) -> str:
        """Boolean: Subtract"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="32" r="16" fill="{color}"/>
  <circle cx="40" cy="32" r="16" fill="#1E293B"/>
  <circle cx="40" cy="32" r="16" stroke="{color}" stroke-width="2" fill="none"/>
</svg>'''
    
    def _icon_boolean_intersect(self, color: str) -> str:
        """Boolean: Intersect"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="32" r="16" fill="{color}" opacity="0.3"/>
  <circle cx="40" cy="32" r="16" fill="{color}" opacity="0.3"/>
  <path d="M32 20 A12 12 0 0 1 32 44 A12 12 0 0 1 32 20" fill="{color}"/>
</svg>'''

    
    def _icon_subdivide(self, color: str) -> str:
        """Subdivide surface"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="40" height="40" stroke="{color}" stroke-width="3" fill="none"/>
  <line x1="32" y1="12" x2="32" y2="52" stroke="{color}" stroke-width="2"/>
  <line x1="12" y1="32" x2="52" y2="32" stroke="{color}" stroke-width="2"/>
  <line x1="22" y1="12" x2="22" y2="52" stroke="{color}" stroke-width="1" opacity="0.5"/>
  <line x1="42" y1="12" x2="42" y2="52" stroke="{color}" stroke-width="1" opacity="0.5"/>
  <line x1="12" y1="22" x2="52" y2="22" stroke="{color}" stroke-width="1" opacity="0.5"/>
  <line x1="12" y1="42" x2="52" y2="42" stroke="{color}" stroke-width="1" opacity="0.5"/>
</svg>'''
    
    def _icon_mirror(self, color: str) -> str:
        """Mirror modifier"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 16 L28 16 L28 48 L12 48 Z" fill="{color}"/>
  <path d="M36 16 L52 16 L52 48 L36 48 Z" fill="{color}" opacity="0.5"/>
  <line x1="32" y1="8" x2="32" y2="56" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/>
</svg>'''
    
    def _icon_array(self, color: str) -> str:
        """Array modifier"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="24" width="12" height="16" fill="{color}"/>
  <rect x="26" y="24" width="12" height="16" fill="{color}" opacity="0.7"/>
  <rect x="44" y="24" width="12" height="16" fill="{color}" opacity="0.4"/>
</svg>'''
    
    def _icon_lattice(self, color: str) -> str:
        """Lattice deformer"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 16 L48 16 L48 48 L16 48 Z" stroke="{color}" stroke-width="2" fill="none"/>
  <line x1="16" y1="24" x2="48" y2="24" stroke="{color}" stroke-width="1.5"/>
  <line x1="16" y1="32" x2="48" y2="32" stroke="{color}" stroke-width="1.5"/>
  <line x1="16" y1="40" x2="48" y2="40" stroke="{color}" stroke-width="1.5"/>
  <line x1="24" y1="16" x2="24" y2="48" stroke="{color}" stroke-width="1.5"/>
  <line x1="32" y1="16" x2="32" y2="48" stroke="{color}" stroke-width="1.5"/>
  <line x1="40" y1="16" x2="40" y2="48" stroke="{color}" stroke-width="1.5"/>
  <circle cx="24" cy="24" r="2" fill="{color}"/>
  <circle cx="32" cy="32" r="2" fill="{color}"/>
  <circle cx="40" cy="40" r="2" fill="{color}"/>
</svg>'''
    
    # ============================================================================
    # SCULPTING TOOLS
    # ============================================================================
    
    def _icon_sculpt_draw(self, color: str) -> str:
        """Sculpt: Draw"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="16" fill="{color}" opacity="0.3"/>
  <circle cx="32" cy="32" r="12" fill="{color}" opacity="0.5"/>
  <circle cx="32" cy="32" r="8" fill="{color}"/>
</svg>'''
    
    def _icon_sculpt_grab(self, color: str) -> str:
        """Sculpt: Grab"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 32 Q32 20 44 32" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="20" cy="32" r="4" fill="{color}"/>
  <circle cx="44" cy="32" r="4" fill="{color}"/>
  <path d="M28 28 L36 28" stroke="#fff" stroke-width="2" opacity="0.5"/>
</svg>'''
    
    def _icon_sculpt_smooth(self, color: str) -> str:
        """Sculpt: Smooth"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 32 Q22 20 32 32 Q42 44 52 32" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M12 32 Q22 38 32 32 Q42 26 52 32" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.5"/>
</svg>'''
    
    def _icon_sculpt_inflate(self, color: str) -> str:
        """Sculpt: Inflate"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="18" fill="{color}" opacity="0.3"/>
  <path d="M32 20 L32 14 M28 16 L32 14 L36 16" stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M44 32 L50 32 M48 28 L50 32 L48 36" stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 44 L32 50 M28 48 L32 50 L36 48" stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20 32 L14 32 M16 28 L14 32 L16 36" stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    def _icon_sculpt_crease(self, color: str) -> str:
        """Sculpt: Crease"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 40 L32 16 L52 40" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20 40 L32 24 L44 40" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
</svg>'''
    
    def _icon_sculpt_pinch(self, color: str) -> str:
        """Sculpt: Pinch"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="18" stroke="{color}" stroke-width="3" fill="none"/>
  <path d="M20 32 L28 32 M36 32 L44 32" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <path d="M24 32 L28 32 M36 32 L40 32" stroke="{color}" stroke-width="4" stroke-linecap="round"/>
</svg>'''
    
    def _icon_sculpt_clay(self, color: str) -> str:
        """Sculpt: Clay strips"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="20" width="40" height="8" fill="{color}"/>
  <rect x="12" y="32" width="40" height="8" fill="{color}" opacity="0.7"/>
  <rect x="12" y="44" width="40" height="8" fill="{color}" opacity="0.4"/>
</svg>'''
    
    def _icon_sculpt_flatten(self, color: str) -> str:
        """Sculpt: Flatten"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 24 Q22 16 32 24 Q42 32 52 24" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <line x1="12" y1="40" x2="52" y2="40" stroke="{color}" stroke-width="4" stroke-linecap="round"/>
  <path d="M32 24 L32 40" stroke="#fff" stroke-width="2" opacity="0.5" stroke-dasharray="2 2"/>
</svg>'''
    
    # ============================================================================
    # TEXTURING & UV TOOLS
    # ============================================================================
    
    def _icon_uv_unwrap(self, color: str) -> str:
        """UV Unwrap"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12 L52 24 L52 44 L32 56 L12 44 L12 24 Z" stroke="{color}" stroke-width="2" fill="none" opacity="0.3"/>
  <rect x="36" y="16" width="20" height="20" stroke="{color}" stroke-width="2" fill="none"/>
  <line x1="36" y1="26" x2="56" y2="26" stroke="{color}" stroke-width="1"/>
  <line x1="46" y1="16" x2="46" y2="36" stroke="{color}" stroke-width="1"/>
</svg>'''
    
    def _icon_texture_paint(self, color: str) -> str:
        """Texture Paint"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 44 L24 12 L28 12 L32 44 Z" fill="{color}"/>
  <ellipse cx="26" cy="48" rx="8" ry="4" fill="{color}"/>
  <circle cx="40" cy="20" r="6" fill="{color}" opacity="0.6"/>
  <circle cx="48" cy="32" r="4" fill="{color}" opacity="0.4"/>
</svg>'''
    
    def _icon_material(self, color: str) -> str:
        """Material editor"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="18" fill="{color}"/>
  <circle cx="24" cy="24" r="6" fill="#fff" opacity="0.8"/>
  <circle cx="26" cy="26" r="3" fill="#fff"/>
</svg>'''
    
    def _icon_shader(self, color: str) -> str:
        """Shader nodes"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="16" width="20" height="16" rx="2" fill="{color}"/>
  <rect x="36" y="24" width="20" height="16" rx="2" fill="{color}"/>
  <line x1="28" y1="24" x2="36" y2="32" stroke="#fff" stroke-width="2"/>
  <circle cx="28" cy="24" r="2" fill="#fff"/>
  <circle cx="36" cy="32" r="2" fill="#fff"/>
</svg>'''
    
    def _icon_normal_map(self, color: str) -> str:
        """Normal map"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="40" height="40" fill="{color}" opacity="0.3"/>
  <path d="M32 20 L32 44 M28 24 L32 20 L36 24" stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="20" cy="20" r="3" fill="#FF0000" opacity="0.5"/>
  <circle cx="44" cy="20" r="3" fill="#00FF00" opacity="0.5"/>
  <circle cx="32" cy="44" r="3" fill="#0000FF" opacity="0.5"/>
</svg>'''
    
    def _icon_bake(self, color: str) -> str:
        """Texture baking"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="16" y="24" width="32" height="24" rx="2" fill="{color}"/>
  <path d="M20 16 Q32 8 44 16" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="24" cy="32" r="2" fill="#fff" opacity="0.6"/>
  <circle cx="32" cy="36" r="2" fill="#fff" opacity="0.6"/>
  <circle cx="40" cy="32" r="2" fill="#fff" opacity="0.6"/>
</svg>'''
    
    # ============================================================================
    # RIGGING & ANIMATION TOOLS
    # ============================================================================
    
    def _icon_bone(self, color: str) -> str:
        """Bone/Armature"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="6" fill="{color}"/>
  <circle cx="44" cy="44" r="6" fill="{color}"/>
  <path d="M24 24 L40 40" stroke="{color}" stroke-width="6" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="4" fill="{color}"/>
</svg>'''
    
    def _icon_ik(self, color: str) -> str:
        """IK (Inverse Kinematics)"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="4" fill="{color}"/>
  <line x1="16" y1="20" x2="32" y2="32" stroke="{color}" stroke-width="3"/>
  <circle cx="32" cy="32" r="4" fill="{color}"/>
  <line x1="32" y1="36" x2="48" y2="48" stroke="{color}" stroke-width="3"/>
  <circle cx="48" cy="48" r="6" fill="{color}"/>
  <path d="M48 48 L52 52 M48 48 L44 52" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
</svg>'''
    
    def _icon_fk(self, color: str) -> str:
        """FK (Forward Kinematics)"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="6" fill="{color}"/>
  <line x1="16" y1="22" x2="32" y2="32" stroke="{color}" stroke-width="3"/>
  <circle cx="32" cy="32" r="4" fill="{color}"/>
  <line x1="32" y1="36" x2="48" y2="48" stroke="{color}" stroke-width="3"/>
  <circle cx="48" cy="48" r="4" fill="{color}"/>
  <path d="M12 12 L16 16 M16 16 L12 20" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
</svg>'''
    
    def _icon_constraint(self, color: str) -> str:
        """Constraint"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="20" r="6" fill="{color}"/>
  <circle cx="20" cy="44" r="6" fill="{color}"/>
  <circle cx="44" cy="44" r="6" fill="{color}"/>
  <line x1="32" y1="26" x2="20" y2="38" stroke="{color}" stroke-width="2" stroke-dasharray="4 4"/>
  <line x1="32" y1="26" x2="44" y2="38" stroke="{color}" stroke-width="2" stroke-dasharray="4 4"/>
</svg>'''
    
    def _icon_keyframe(self, color: str) -> str:
        """Keyframe"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12 L48 32 L32 52 L16 32 Z" fill="{color}"/>
  <circle cx="32" cy="32" r="6" fill="#fff"/>
</svg>'''
    
    def _icon_timeline(self, color: str) -> str:
        """Timeline"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="8" y1="32" x2="56" y2="32" stroke="{color}" stroke-width="3"/>
  <circle cx="16" cy="32" r="4" fill="{color}"/>
  <circle cx="32" cy="32" r="4" fill="{color}"/>
  <circle cx="48" cy="32" r="4" fill="{color}"/>
  <path d="M40 20 L44 32 L40 44" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    def _icon_graph_editor(self, color: str) -> str:
        """Graph Editor"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="12" y1="52" x2="52" y2="52" stroke="{color}" stroke-width="2"/>
  <line x1="12" y1="12" x2="12" y2="52" stroke="{color}" stroke-width="2"/>
  <path d="M12 48 Q24 40 32 32 Q40 24 52 16" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="12" cy="48" r="3" fill="{color}"/>
  <circle cx="32" cy="32" r="3" fill="{color}"/>
  <circle cx="52" cy="16" r="3" fill="{color}"/>
</svg>'''
    
    def _icon_dope_sheet(self, color: str) -> str:
        """Dope Sheet"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="8" y1="20" x2="56" y2="20" stroke="{color}" stroke-width="2"/>
  <line x1="8" y1="32" x2="56" y2="32" stroke="{color}" stroke-width="2"/>
  <line x1="8" y1="44" x2="56" y2="44" stroke="{color}" stroke-width="2"/>
  <rect x="16" y="17" width="4" height="6" fill="{color}"/>
  <rect x="32" y="17" width="4" height="6" fill="{color}"/>
  <rect x="24" y="29" width="4" height="6" fill="{color}"/>
  <rect x="40" y="29" width="4" height="6" fill="{color}"/>
  <rect x="20" y="41" width="4" height="6" fill="{color}"/>
  <rect x="36" y="41" width="4" height="6" fill="{color}"/>
</svg>'''

    
    # ============================================================================
    # RENDERING & LIGHTING
    # ============================================================================
    
    def _icon_camera(self, color: str) -> str:
        """Camera"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="16" y="20" width="32" height="24" rx="2" fill="{color}"/>
  <circle cx="32" cy="32" r="8" fill="#fff" opacity="0.3"/>
  <circle cx="32" cy="32" r="5" fill="#fff"/>
  <rect x="44" y="16" width="8" height="4" fill="{color}"/>
</svg>'''
    
    def _icon_light_point(self, color: str) -> str:
        """Point Light"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="8" fill="{color}"/>
  <line x1="32" y1="12" x2="32" y2="20" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="32" y1="44" x2="32" y2="52" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="12" y1="32" x2="20" y2="32" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="44" y1="32" x2="52" y2="32" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="18" y1="18" x2="24" y2="24" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="46" y1="18" x2="40" y2="24" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="18" y1="46" x2="24" y2="40" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="46" y1="46" x2="40" y2="40" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
</svg>'''
    
    def _icon_light_spot(self, color: str) -> str:
        """Spot Light"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="16" r="6" fill="{color}"/>
  <path d="M26 22 L16 48 L48 48 L38 22" fill="{color}" opacity="0.3"/>
  <line x1="26" y1="22" x2="16" y2="48" stroke="{color}" stroke-width="2"/>
  <line x1="38" y1="22" x2="48" y2="48" stroke="{color}" stroke-width="2"/>
  <line x1="32" y1="22" x2="32" y2="48" stroke="{color}" stroke-width="2" stroke-dasharray="4 4" opacity="0.5"/>
</svg>'''
    
    def _icon_light_area(self, color: str) -> str:
        """Area Light"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="16" y="16" width="32" height="20" fill="{color}"/>
  <line x1="20" y1="36" x2="16" y2="48" stroke="{color}" stroke-width="2" opacity="0.5"/>
  <line x1="32" y1="36" x2="32" y2="48" stroke="{color}" stroke-width="2" opacity="0.5"/>
  <line x1="44" y1="36" x2="48" y2="48" stroke="{color}" stroke-width="2" opacity="0.5"/>
</svg>'''
    
    def _icon_light_sun(self, color: str) -> str:
        """Sun/Directional Light"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="24" r="8" fill="{color}"/>
  <line x1="32" y1="8" x2="32" y2="14" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="16" y1="24" x2="22" y2="24" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="42" y1="24" x2="48" y2="24" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="20" y1="12" x2="24" y2="16" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="44" y1="12" x2="40" y2="16" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="12" y1="40" x2="20" y2="48" stroke="{color}" stroke-width="2" opacity="0.5"/>
  <line x1="28" y1="40" x2="32" y2="52" stroke="{color}" stroke-width="2" opacity="0.5"/>
  <line x1="44" y1="40" x2="52" y2="48" stroke="{color}" stroke-width="2" opacity="0.5"/>
</svg>'''
    
    def _icon_render(self, color: str) -> str:
        """Render"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="40" height="40" rx="2" stroke="{color}" stroke-width="3" fill="none"/>
  <path d="M20 32 L28 24 L36 32 L44 20" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="40" cy="24" r="4" fill="{color}"/>
</svg>'''
    
    def _icon_viewport(self, color: str) -> str:
        """Viewport shading"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="16" fill="{color}"/>
  <path d="M20 24 L32 32 L44 24" stroke="#fff" stroke-width="2" opacity="0.5"/>
  <circle cx="24" cy="24" r="4" fill="#fff" opacity="0.8"/>
</svg>'''
    
    def _icon_wireframe(self, color: str) -> str:
        """Wireframe mode"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12 L52 24 L52 44 L32 56 L12 44 L12 24 Z" stroke="{color}" stroke-width="2" fill="none"/>
  <line x1="32" y1="12" x2="32" y2="56" stroke="{color}" stroke-width="2"/>
  <line x1="12" y1="24" x2="52" y2="24" stroke="{color}" stroke-width="2"/>
  <line x1="12" y1="44" x2="52" y2="44" stroke="{color}" stroke-width="2"/>
  <line x1="12" y1="24" x2="32" y2="12" stroke="{color}" stroke-width="2"/>
  <line x1="52" y1="24" x2="32" y2="12" stroke="{color}" stroke-width="2"/>
</svg>'''
    
    # ============================================================================
    # SIMULATION & PHYSICS
    # ============================================================================
    
    def _icon_particle(self, color: str) -> str:
        """Particle System"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="4" fill="{color}"/>
  <circle cx="20" cy="20" r="2" fill="{color}" opacity="0.8"/>
  <circle cx="44" cy="20" r="2" fill="{color}" opacity="0.8"/>
  <circle cx="16" cy="32" r="2" fill="{color}" opacity="0.6"/>
  <circle cx="48" cy="32" r="2" fill="{color}" opacity="0.6"/>
  <circle cx="20" cy="44" r="2" fill="{color}" opacity="0.4"/>
  <circle cx="44" cy="44" r="2" fill="{color}" opacity="0.4"/>
  <circle cx="32" cy="16" r="2" fill="{color}" opacity="0.7"/>
  <circle cx="32" cy="48" r="2" fill="{color}" opacity="0.5"/>
</svg>'''
    
    def _icon_cloth(self, color: str) -> str:
        """Cloth Simulation"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 12 L52 12 Q52 32 32 48 Q12 32 12 12" fill="{color}" opacity="0.3"/>
  <path d="M12 12 L52 12 Q52 32 32 48 Q12 32 12 12" stroke="{color}" stroke-width="2" fill="none"/>
  <line x1="22" y1="12" x2="22" y2="36" stroke="{color}" stroke-width="1" opacity="0.5"/>
  <line x1="32" y1="12" x2="32" y2="48" stroke="{color}" stroke-width="1" opacity="0.5"/>
  <line x1="42" y1="12" x2="42" y2="36" stroke="{color}" stroke-width="1" opacity="0.5"/>
</svg>'''
    
    def _icon_fluid(self, color: str) -> str:
        """Fluid Simulation"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 40 Q20 32 32 36 Q44 40 52 32 L52 52 L12 52 Z" fill="{color}"/>
  <path d="M12 40 Q20 32 32 36 Q44 40 52 32" stroke="{color}" stroke-width="2" fill="none"/>
  <circle cx="24" cy="28" r="3" fill="{color}" opacity="0.5"/>
  <circle cx="40" cy="24" r="2" fill="{color}" opacity="0.5"/>
</svg>'''
    
    def _icon_smoke(self, color: str) -> str:
        """Smoke Simulation"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 48 Q28 44 28 40 Q28 36 32 32 Q36 28 36 24 Q36 20 32 16" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M24 48 Q20 44 20 40 Q20 36 24 32" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>
  <path d="M40 48 Q44 44 44 40 Q44 36 40 32" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>
</svg>'''
    
    def _icon_collision(self, color: str) -> str:
        """Collision"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="32" r="12" stroke="{color}" stroke-width="3" fill="none"/>
  <circle cx="40" cy="32" r="12" stroke="{color}" stroke-width="3" fill="none"/>
  <line x1="32" y1="24" x2="32" y2="40" stroke="{color}" stroke-width="4"/>
  <path d="M28 28 L24 32 L28 36" stroke="{color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M36 28 L40 32 L36 36" stroke="{color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    def _icon_force_field(self, color: str) -> str:
        """Force Field"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="6" fill="{color}"/>
  <circle cx="32" cy="32" r="12" stroke="{color}" stroke-width="2" fill="none" opacity="0.6"/>
  <circle cx="32" cy="32" r="18" stroke="{color}" stroke-width="2" fill="none" opacity="0.3"/>
  <path d="M32 14 L32 8 M28 10 L32 8 L36 10" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M50 32 L56 32 M54 28 L56 32 L54 36" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 50 L32 56 M28 54 L32 56 L36 54" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14 32 L8 32 M10 28 L8 32 L10 36" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    # ============================================================================
    # SELECTION & TRANSFORM
    # ============================================================================
    
    def _icon_select_box(self, color: str) -> str:
        """Box Select"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="16" y="16" width="32" height="32" stroke="{color}" stroke-width="3" fill="none" stroke-dasharray="8 4"/>
  <rect x="14" y="14" width="4" height="4" fill="{color}"/>
  <rect x="46" y="14" width="4" height="4" fill="{color}"/>
  <rect x="14" y="46" width="4" height="4" fill="{color}"/>
  <rect x="46" y="46" width="4" height="4" fill="{color}"/>
</svg>'''
    
    def _icon_select_circle(self, color: str) -> str:
        """Circle Select"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="18" stroke="{color}" stroke-width="3" fill="none" stroke-dasharray="8 4"/>
  <circle cx="32" cy="14" r="2" fill="{color}"/>
  <circle cx="50" cy="32" r="2" fill="{color}"/>
  <circle cx="32" cy="50" r="2" fill="{color}"/>
  <circle cx="14" cy="32" r="2" fill="{color}"/>
</svg>'''
    
    def _icon_select_lasso(self, color: str) -> str:
        """Lasso Select"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 24 Q12 32 16 40 Q24 48 32 44 Q40 40 44 32 Q48 24 40 16 Q32 12 24 16 Q16 20 16 24" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="8 4"/>
</svg>'''
    
    def _icon_move(self, color: str) -> str:
        """Move/Translate"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="32" y1="12" x2="32" y2="52" stroke="{color}" stroke-width="3"/>
  <line x1="12" y1="32" x2="52" y2="32" stroke="{color}" stroke-width="3"/>
  <path d="M32 12 L28 18 L36 18 Z" fill="{color}"/>
  <path d="M52 32 L46 28 L46 36 Z" fill="{color}"/>
  <path d="M32 52 L28 46 L36 46 Z" fill="{color}"/>
  <path d="M12 32 L18 28 L18 36 Z" fill="{color}"/>
</svg>'''
    
    def _icon_rotate(self, color: str) -> str:
        """Rotate"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12 A20 20 0 1 1 12 32" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M32 12 L28 18 L36 18 Z" fill="{color}"/>
  <circle cx="32" cy="32" r="4" fill="{color}"/>
</svg>'''
    
    def _icon_scale(self, color: str) -> str:
        """Scale"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="20" width="24" height="24" stroke="{color}" stroke-width="3" fill="none"/>
  <line x1="20" y1="20" x2="12" y2="12" stroke="{color}" stroke-width="2"/>
  <line x1="44" y1="20" x2="52" y2="12" stroke="{color}" stroke-width="2"/>
  <line x1="20" y1="44" x2="12" y2="52" stroke="{color}" stroke-width="2"/>
  <line x1="44" y1="44" x2="52" y2="52" stroke="{color}" stroke-width="2"/>
  <rect x="10" y="10" width="4" height="4" fill="{color}"/>
  <rect x="50" y="10" width="4" height="4" fill="{color}"/>
  <rect x="10" y="50" width="4" height="4" fill="{color}"/>
  <rect x="50" y="50" width="4" height="4" fill="{color}"/>
</svg>'''
    
    # ============================================================================
    # VIEW & NAVIGATION
    # ============================================================================
    
    def _icon_view_front(self, color: str) -> str:
        """Front View"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="16" y="16" width="32" height="32" fill="{color}"/>
  <line x1="32" y1="16" x2="32" y2="48" stroke="#fff" stroke-width="2" opacity="0.3"/>
  <line x1="16" y1="32" x2="48" y2="32" stroke="#fff" stroke-width="2" opacity="0.3"/>
</svg>'''
    
    def _icon_view_side(self, color: str) -> str:
        """Side View"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 16 L48 20 L48 44 L16 48 Z" fill="{color}"/>
  <line x1="16" y1="32" x2="48" y2="32" stroke="#fff" stroke-width="2" opacity="0.3"/>
</svg>'''
    
    def _icon_view_top(self, color: str) -> str:
        """Top View"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 20 L48 16 L52 48 L20 52 Z" fill="{color}"/>
  <line x1="16" y1="20" x2="52" y2="48" stroke="#fff" stroke-width="2" opacity="0.3"/>
  <line x1="48" y1="16" x2="20" y2="52" stroke="#fff" stroke-width="2" opacity="0.3"/>
</svg>'''
    
    def _icon_view_perspective(self, color: str) -> str:
        """Perspective View"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12 L52 24 L52 44 L32 56 L12 44 L12 24 Z" fill="{color}" opacity="0.3"/>
  <path d="M32 12 L52 24 L52 44 L32 56 L12 44 L12 24 Z" stroke="{color}" stroke-width="2" fill="none"/>
  <line x1="32" y1="12" x2="32" y2="56" stroke="#fff" stroke-width="1" opacity="0.3"/>
  <line x1="12" y1="24" x2="52" y2="44" stroke="#fff" stroke-width="1" opacity="0.3"/>
</svg>'''
    
    def _icon_zoom_in(self, color: str) -> str:
        """Zoom In"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="28" cy="28" r="14" stroke="{color}" stroke-width="3" fill="none"/>
  <line x1="28" y1="20" x2="28" y2="36" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="20" y1="28" x2="36" y2="28" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="38" y1="38" x2="50" y2="50" stroke="{color}" stroke-width="4" stroke-linecap="round"/>
</svg>'''
    
    def _icon_zoom_out(self, color: str) -> str:
        """Zoom Out"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="28" cy="28" r="14" stroke="{color}" stroke-width="3" fill="none"/>
  <line x1="20" y1="28" x2="36" y2="28" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="38" y1="38" x2="50" y2="50" stroke="{color}" stroke-width="4" stroke-linecap="round"/>
</svg>'''
    
    def _icon_frame_all(self, color: str) -> str:
        """Frame All"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="20" width="24" height="24" fill="{color}" opacity="0.3"/>
  <path d="M12 12 L12 20 L20 20 M52 12 L52 20 L44 20 M12 52 L12 44 L20 44 M52 52 L52 44 L44 44" stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

    
    # ============================================================================
    # FILE & PROJECT OPERATIONS
    # ============================================================================
    
    def _icon_new(self, color: str) -> str:
        """New File"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 8 L16 56 L48 56 L48 20 L36 8 Z" fill="{color}"/>
  <path d="M36 8 L36 20 L48 20" fill="{color}" opacity="0.5"/>
  <line x1="32" y1="28" x2="32" y2="44" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <line x1="24" y1="36" x2="40" y2="36" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
</svg>'''
    
    def _icon_open(self, color: str) -> str:
        """Open File"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 16 L12 48 L52 48 L52 24 L32 24 L28 16 Z" fill="{color}"/>
  <path d="M20 32 L32 32 L28 36 M32 32 L28 28" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    def _icon_save(self, color: str) -> str:
        """Save"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="40" height="40" rx="2" fill="{color}"/>
  <rect x="16" y="12" width="24" height="12" fill="#fff" opacity="0.3"/>
  <rect x="20" y="32" width="24" height="20" fill="#fff" opacity="0.5"/>
  <rect x="40" y="16" width="8" height="8" fill="#fff" opacity="0.3"/>
</svg>'''
    
    def _icon_import(self, color: str) -> str:
        """Import"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12 L32 40 M28 36 L32 40 L36 36" stroke="{color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 44 L16 52 L48 52 L48 44" stroke="{color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    def _icon_export(self, color: str) -> str:
        """Export"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 40 L32 12 M28 16 L32 12 L36 16" stroke="{color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 44 L16 52 L48 52 L48 44" stroke="{color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    
    def _icon_undo(self, color: str) -> str:
        """Undo"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 32 L12 24 L20 16" stroke="{color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 24 L32 24 Q48 24 48 40 Q48 52 36 52" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>'''
    
    def _icon_redo(self, color: str) -> str:
        """Redo"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M44 32 L52 24 L44 16" stroke="{color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M52 24 L32 24 Q16 24 16 40 Q16 52 28 52" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>'''
    
    # ============================================================================
    # LAYERS & ORGANIZATION
    # ============================================================================
    
    def _icon_layer(self, color: str) -> str:
        """Layer"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12 L52 24 L32 36 L12 24 Z" fill="{color}"/>
  <path d="M12 32 L32 44 L52 32" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 40 L32 52 L52 40" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
</svg>'''
    
    def _icon_group(self, color: str) -> str:
        """Group"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="20" height="20" rx="2" fill="{color}"/>
  <rect x="32" y="12" width="20" height="20" rx="2" fill="{color}" opacity="0.7"/>
  <rect x="12" y="32" width="20" height="20" rx="2" fill="{color}" opacity="0.7"/>
  <rect x="32" y="32" width="20" height="20" rx="2" fill="{color}" opacity="0.5"/>
</svg>'''
    
    def _icon_collection(self, color: str) -> str:
        """Collection"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 16 L12 48 L52 48 L52 24 L32 24 L28 16 Z" fill="{color}"/>
  <circle cx="24" cy="34" r="4" fill="#fff" opacity="0.6"/>
  <circle cx="32" cy="34" r="4" fill="#fff" opacity="0.6"/>
  <circle cx="40" cy="34" r="4" fill="#fff" opacity="0.6"/>
</svg>'''
    
    def _icon_outliner(self, color: str) -> str:
        """Outliner"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="16" y1="16" x2="48" y2="16" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="20" y1="28" x2="48" y2="28" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="24" y1="40" x2="48" y2="40" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <line x1="16" y1="16" x2="16" y2="40" stroke="{color}" stroke-width="2"/>
  <line x1="16" y1="28" x2="20" y2="28" stroke="{color}" stroke-width="2"/>
  <line x1="20" y1="28" x2="20" y2="40" stroke="{color}" stroke-width="2"/>
  <line x1="20" y1="40" x2="24" y2="40" stroke="{color}" stroke-width="2"/>
</svg>'''
    
    def _icon_visible(self, color: str) -> str:
        """Visible/Eye"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 32 Q16 16 32 16 Q48 16 56 32 Q48 48 32 48 Q16 48 8 32" fill="{color}" opacity="0.3"/>
  <path d="M8 32 Q16 16 32 16 Q48 16 56 32 Q48 48 32 48 Q16 48 8 32" stroke="{color}" stroke-width="3" fill="none"/>
  <circle cx="32" cy="32" r="8" fill="{color}"/>
  <circle cx="32" cy="32" r="4" fill="#fff"/>
</svg>'''
    
    def _icon_hidden(self, color: str) -> str:
        """Hidden/Eye Closed"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 32 Q16 16 32 16 Q48 16 56 32" stroke="{color}" stroke-width="3" fill="none" opacity="0.5"/>
  <line x1="12" y1="52" x2="52" y2="12" stroke="{color}" stroke-width="4" stroke-linecap="round"/>
</svg>'''
    
    def _icon_lock(self, color: str) -> str:
        """Lock"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="32" width="24" height="20" rx="2" fill="{color}"/>
  <path d="M24 32 L24 24 Q24 16 32 16 Q40 16 40 24 L40 32" stroke="{color}" stroke-width="3" fill="none"/>
  <circle cx="32" cy="42" r="3" fill="#fff"/>
</svg>'''
    
    def _icon_unlock(self, color: str) -> str:
        """Unlock"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="32" width="24" height="20" rx="2" fill="{color}"/>
  <path d="M24 32 L24 24 Q24 16 32 16 Q40 16 40 24 L40 28" stroke="{color}" stroke-width="3" fill="none"/>
  <circle cx="32" cy="42" r="3" fill="#fff"/>
</svg>'''
    
    # ============================================================================
    # UTILITIES & SETTINGS
    # ============================================================================
    
    def _icon_settings(self, color: str) -> str:
        """Settings"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="8" fill="{color}"/>
  <path d="M32 12 L36 20 L44 20 L48 28 L44 36 L44 44 L36 48 L28 44 L20 44 L16 36 L20 28 L20 20 L28 16 Z" stroke="{color}" stroke-width="3" fill="none"/>
  <circle cx="32" cy="12" r="3" fill="{color}"/>
  <circle cx="48" cy="28" r="3" fill="{color}"/>
  <circle cx="44" cy="44" r="3" fill="{color}"/>
  <circle cx="28" cy="48" r="3" fill="{color}"/>
  <circle cx="16" cy="36" r="3" fill="{color}"/>
  <circle cx="20" cy="20" r="3" fill="{color}"/>
</svg>'''
    
    def _icon_preferences(self, color: str) -> str:
        """Preferences"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="16" width="40" height="8" rx="4" fill="{color}" opacity="0.3"/>
  <circle cx="36" cy="20" r="6" fill="{color}"/>
  <rect x="12" y="28" width="40" height="8" rx="4" fill="{color}" opacity="0.3"/>
  <circle cx="24" cy="32" r="6" fill="{color}"/>
  <rect x="12" y="40" width="40" height="8" rx="4" fill="{color}" opacity="0.3"/>
  <circle cx="40" cy="44" r="6" fill="{color}"/>
</svg>'''
    
    def _icon_help(self, color: str) -> str:
        """Help"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="20" stroke="{color}" stroke-width="3" fill="none"/>
  <path d="M26 24 Q26 18 32 18 Q38 18 38 24 Q38 28 32 30 L32 36" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="32" cy="44" r="2" fill="{color}"/>
</svg>'''
    
    def _icon_search(self, color: str) -> str:
        """Search"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="28" cy="28" r="14" stroke="{color}" stroke-width="3" fill="none"/>
  <line x1="38" y1="38" x2="52" y2="52" stroke="{color}" stroke-width="4" stroke-linecap="round"/>
</svg>'''
    
    def _icon_filter(self, color: str) -> str:
        """Filter"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 16 L52 16 L36 36 L36 52 L28 48 L28 36 Z" fill="{color}"/>
</svg>'''
    
    def _icon_pin(self, color: str) -> str:
        """Pin"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 12 L40 12 L44 24 L36 32 L36 52 L28 52 L28 32 L20 24 Z" fill="{color}"/>
  <circle cx="32" cy="16" r="3" fill="#fff"/>
</svg>'''
    
    def _icon_bookmark(self, color: str) -> str:
        """Bookmark"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 8 L48 8 L48 56 L32 44 L16 56 Z" fill="{color}"/>
</svg>'''
    
    def _icon_trash(self, color: str) -> str:
        """Delete/Trash"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 20 L20 52 L44 52 L44 20" fill="{color}"/>
  <rect x="16" y="16" width="32" height="4" fill="{color}"/>
  <path d="M26 12 L26 16 L38 16 L38 12" fill="{color}"/>
  <line x1="28" y1="28" x2="28" y2="44" stroke="#fff" stroke-width="2" opacity="0.5"/>
  <line x1="36" y1="28" x2="36" y2="44" stroke="#fff" stroke-width="2" opacity="0.5"/>
</svg>'''
    
    def _icon_duplicate(self, color: str) -> str:
        """Duplicate"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="32" height="32" rx="2" fill="{color}"/>
  <rect x="20" y="20" width="32" height="32" rx="2" fill="{color}" opacity="0.6"/>
</svg>'''
    
    def _icon_link(self, color: str) -> str:
        """Link"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M28 36 L36 28" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <path d="M20 28 L28 20 Q32 16 36 20 L40 24" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M44 36 L36 44 Q32 48 28 44 L24 40" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>'''
    
    def _icon_unlink(self, color: str) -> str:
        """Unlink"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 28 L28 20 Q32 16 36 20 L40 24" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M44 36 L36 44 Q32 48 28 44 L24 40" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <line x1="16" y1="48" x2="48" y2="16" stroke="{color}" stroke-width="4" stroke-linecap="round"/>
</svg>'''
    
    # ============================================================================
    # PLAYBACK & RECORDING
    # ============================================================================
    
    def _icon_play(self, color: str) -> str:
        """Play"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 12 L52 32 L20 52 Z" fill="{color}"/>
</svg>'''
    
    def _icon_pause(self, color: str) -> str:
        """Pause"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="18" y="12" width="12" height="40" fill="{color}"/>
  <rect x="34" y="12" width="12" height="40" fill="{color}"/>
</svg>'''
    
    def _icon_stop(self, color: str) -> str:
        """Stop"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="16" y="16" width="32" height="32" fill="{color}"/>
</svg>'''
    
    def _icon_record(self, color: str) -> str:
        """Record"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="16" fill="{color}"/>
  <circle cx="32" cy="32" r="20" stroke="{color}" stroke-width="2" fill="none" opacity="0.5"/>
</svg>'''
    
    def _icon_skip_forward(self, color: str) -> str:
        """Skip Forward"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 12 L36 32 L12 52 Z" fill="{color}"/>
  <path d="M32 12 L56 32 L32 52 Z" fill="{color}" opacity="0.6"/>
</svg>'''
    
    def _icon_skip_back(self, color: str) -> str:
        """Skip Back"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M52 12 L28 32 L52 52 Z" fill="{color}"/>
  <path d="M32 12 L8 32 L32 52 Z" fill="{color}" opacity="0.6"/>
</svg>'''
    
    def _icon_loop(self, color: str) -> str:
        """Loop"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 24 L48 24 Q52 24 52 28 L52 40 Q52 44 48 44 L24 44" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M24 44 L16 40 L24 36" fill="{color}"/>
  <path d="M48 24 L56 28 L48 32" fill="{color}"/>
</svg>'''

    
    # ============================================================================
    # COMPOSITING & POST-PROCESSING
    # ============================================================================
    
    def _icon_compositor(self, color: str) -> str:
        """Compositor"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="16" width="20" height="16" rx="2" fill="{color}" opacity="0.5"/>
  <rect x="36" y="16" width="20" height="16" rx="2" fill="{color}" opacity="0.5"/>
  <rect x="22" y="32" width="20" height="16" rx="2" fill="{color}"/>
  <line x1="18" y1="24" x2="22" y2="40" stroke="#fff" stroke-width="2"/>
  <line x1="46" y1="24" x2="42" y2="40" stroke="#fff" stroke-width="2"/>
</svg>'''
    
    def _icon_color_correction(self, color: str) -> str:
        """Color Correction"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="12" fill="#FF0000" opacity="0.5"/>
  <circle cx="40" cy="24" r="12" fill="#00FF00" opacity="0.5"/>
  <circle cx="32" cy="38" r="12" fill="#0000FF" opacity="0.5"/>
  <path d="M16 48 L48 48" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="32" cy="48" r="4" fill="{color}"/>
</svg>'''
    
    def _icon_blur(self, color: str) -> str:
        """Blur Effect"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="16" y="16" width="32" height="32" fill="{color}"/>
  <rect x="20" y="20" width="24" height="24" fill="{color}" opacity="0.7"/>
  <rect x="24" y="24" width="16" height="16" fill="{color}" opacity="0.4"/>
</svg>'''
    
    def _icon_glow(self, color: str) -> str:
        """Glow Effect"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="8" fill="{color}"/>
  <circle cx="32" cy="32" r="14" fill="{color}" opacity="0.5"/>
  <circle cx="32" cy="32" r="20" fill="{color}" opacity="0.2"/>
</svg>'''
    
    def _icon_mask(self, color: str) -> str:
        """Mask"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="40" height="40" fill="{color}" opacity="0.3"/>
  <circle cx="32" cy="32" r="16" fill="{color}"/>
  <path d="M16 16 L48 48 M48 16 L16 48" stroke="#fff" stroke-width="2" opacity="0.3"/>
</svg>'''
    
    # ============================================================================
    # GREASE PENCIL & 2D
    # ============================================================================
    
    def _icon_grease_pencil(self, color: str) -> str:
        """Grease Pencil"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 52 L20 44 L44 20 L52 12 L56 16 L48 24 L24 48 L16 56 Z" fill="{color}"/>
  <path d="M44 20 L52 12" stroke="#fff" stroke-width="2" opacity="0.5"/>
  <circle cx="54" cy="14" r="3" fill="#fff" opacity="0.5"/>
</svg>'''
    
    def _icon_draw_line(self, color: str) -> str:
        """Draw Line"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="12" y1="52" x2="52" y2="12" stroke="{color}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="12" cy="52" r="4" fill="{color}"/>
  <circle cx="52" cy="12" r="4" fill="{color}"/>
</svg>'''
    
    def _icon_draw_curve(self, color: str) -> str:
        """Draw Curve"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 52 Q32 12 52 32" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="12" cy="52" r="4" fill="{color}"/>
  <circle cx="52" cy="32" r="4" fill="{color}"/>
</svg>'''
    
    def _icon_eraser(self, color: str) -> str:
        """Eraser"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 48 L32 32 L48 16 L56 24 L40 40 L24 56 Z" fill="{color}"/>
  <line x1="8" y1="56" x2="40" y2="56" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
</svg>'''
    
    def _icon_fill(self, color: str) -> str:
        """Fill/Bucket"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 32 L32 20 L44 32 L32 44 Z" fill="{color}"/>
  <path d="M32 44 L28 48 Q28 52 32 52 Q36 52 36 48 Z" fill="{color}"/>
  <circle cx="48" cy="16" r="4" fill="{color}" opacity="0.5"/>
</svg>'''
    
    # ============================================================================
    # CURVES & PATHS
    # ============================================================================
    
    def _icon_bezier(self, color: str) -> str:
        """Bezier Curve"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 48 Q32 12 52 48" stroke="{color}" stroke-width="3" fill="none"/>
  <circle cx="12" cy="48" r="4" fill="{color}"/>
  <circle cx="52" cy="48" r="4" fill="{color}"/>
  <circle cx="32" cy="12" r="4" fill="{color}" opacity="0.5"/>
  <line x1="12" y1="48" x2="32" y2="12" stroke="{color}" stroke-width="1" stroke-dasharray="4 4" opacity="0.3"/>
  <line x1="52" y1="48" x2="32" y2="12" stroke="{color}" stroke-width="1" stroke-dasharray="4 4" opacity="0.3"/>
</svg>'''
    
    def _icon_nurbs(self, color: str) -> str:
        """NURBS Curve"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 48 Q20 32 32 32 Q44 32 52 16" stroke="{color}" stroke-width="3" fill="none"/>
  <circle cx="12" cy="48" r="3" fill="{color}"/>
  <circle cx="20" cy="32" r="3" fill="{color}" opacity="0.5"/>
  <circle cx="32" cy="32" r="3" fill="{color}"/>
  <circle cx="44" cy="32" r="3" fill="{color}" opacity="0.5"/>
  <circle cx="52" cy="16" r="3" fill="{color}"/>
</svg>'''
    
    def _icon_path_edit(self, color: str) -> str:
        """Edit Path"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 48 L32 28 L52 48" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="48" r="4" fill="{color}"/>
  <circle cx="32" cy="28" r="4" fill="{color}"/>
  <circle cx="52" cy="48" r="4" fill="{color}"/>
  <rect x="28" y="24" width="8" height="8" fill="#fff" opacity="0.5"/>
</svg>'''
    
    def _icon_spline(self, color: str) -> str:
        """Spline"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 32 Q20 16 32 24 Q44 32 52 20" stroke="{color}" stroke-width="3" fill="none"/>
  <circle cx="12" cy="32" r="3" fill="{color}"/>
  <circle cx="32" cy="24" r="3" fill="{color}"/>
  <circle cx="52" cy="20" r="3" fill="{color}"/>
</svg>'''
    
    # ============================================================================
    # MEASUREMENT & ANALYSIS
    # ============================================================================
    
    def _icon_ruler(self, color: str) -> str:
        """Ruler/Measure"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="24" width="48" height="16" fill="{color}"/>
  <line x1="16" y1="24" x2="16" y2="32" stroke="#fff" stroke-width="2"/>
  <line x1="24" y1="24" x2="24" y2="36" stroke="#fff" stroke-width="2"/>
  <line x1="32" y1="24" x2="32" y2="32" stroke="#fff" stroke-width="2"/>
  <line x1="40" y1="24" x2="40" y2="36" stroke="#fff" stroke-width="2"/>
  <line x1="48" y1="24" x2="48" y2="32" stroke="#fff" stroke-width="2"/>
</svg>'''
    
    def _icon_protractor(self, color: str) -> str:
        """Protractor/Angle"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 48 A24 24 0 0 1 52 48" stroke="{color}" stroke-width="3" fill="none"/>
  <line x1="32" y1="48" x2="32" y2="24" stroke="{color}" stroke-width="2"/>
  <line x1="32" y1="48" x2="48" y2="36" stroke="{color}" stroke-width="2"/>
  <circle cx="32" cy="48" r="3" fill="{color}"/>
</svg>'''
    
    def _icon_grid(self, color: str) -> str:
        """Grid"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="12" y1="20" x2="52" y2="20" stroke="{color}" stroke-width="2"/>
  <line x1="12" y1="32" x2="52" y2="32" stroke="{color}" stroke-width="2"/>
  <line x1="12" y1="44" x2="52" y2="44" stroke="{color}" stroke-width="2"/>
  <line x1="20" y1="12" x2="20" y2="52" stroke="{color}" stroke-width="2"/>
  <line x1="32" y1="12" x2="32" y2="52" stroke="{color}" stroke-width="2"/>
  <line x1="44" y1="12" x2="44" y2="52" stroke="{color}" stroke-width="2"/>
</svg>'''
    
    def _icon_snap(self, color: str) -> str:
        """Snap to Grid"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="2" fill="{color}" opacity="0.3"/>
  <circle cx="32" cy="16" r="2" fill="{color}" opacity="0.3"/>
  <circle cx="48" cy="16" r="2" fill="{color}" opacity="0.3"/>
  <circle cx="16" cy="32" r="2" fill="{color}" opacity="0.3"/>
  <circle cx="32" cy="32" r="6" fill="{color}"/>
  <circle cx="48" cy="32" r="2" fill="{color}" opacity="0.3"/>
  <circle cx="16" cy="48" r="2" fill="{color}" opacity="0.3"/>
  <circle cx="32" cy="48" r="2" fill="{color}" opacity="0.3"/>
  <circle cx="48" cy="48" r="2" fill="{color}" opacity="0.3"/>
</svg>'''
    
    # ============================================================================
    # GEOMETRY NODES & PROCEDURAL
    # ============================================================================
    
    def _icon_geometry_nodes(self, color: str) -> str:
        """Geometry Nodes"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="32" r="6" fill="{color}"/>
  <circle cx="32" cy="20" r="6" fill="{color}"/>
  <circle cx="32" cy="44" r="6" fill="{color}"/>
  <circle cx="48" cy="32" r="6" fill="{color}"/>
  <line x1="22" y1="32" x2="26" y2="24" stroke="{color}" stroke-width="2"/>
  <line x1="22" y1="32" x2="26" y2="40" stroke="{color}" stroke-width="2"/>
  <line x1="38" y1="24" x2="42" y2="32" stroke="{color}" stroke-width="2"/>
  <line x1="38" y1="40" x2="42" y2="32" stroke="{color}" stroke-width="2"/>
</svg>'''
    
    def _icon_procedural(self, color: str) -> str:
        """Procedural Generation"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 12 L48 24 L48 40 L32 52 L16 40 L16 24 Z" stroke="{color}" stroke-width="2" fill="none"/>
  <circle cx="32" cy="32" r="8" fill="{color}"/>
  <circle cx="32" cy="12" r="3" fill="{color}"/>
  <circle cx="48" cy="24" r="3" fill="{color}"/>
  <circle cx="48" cy="40" r="3" fill="{color}"/>
  <circle cx="32" cy="52" r="3" fill="{color}"/>
  <circle cx="16" cy="40" r="3" fill="{color}"/>
  <circle cx="16" cy="24" r="3" fill="{color}"/>
</svg>'''
    
    def _icon_noise(self, color: str) -> str:
        """Noise Texture"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="40" height="40" fill="{color}" opacity="0.2"/>
  <circle cx="20" cy="20" r="3" fill="{color}"/>
  <circle cx="36" cy="18" r="2" fill="{color}" opacity="0.7"/>
  <circle cx="28" cy="28" r="4" fill="{color}" opacity="0.8"/>
  <circle cx="44" cy="32" r="3" fill="{color}" opacity="0.6"/>
  <circle cx="24" cy="40" r="2" fill="{color}" opacity="0.5"/>
  <circle cx="40" cy="44" r="3" fill="{color}" opacity="0.7"/>
</svg>'''
    
    def _icon_voronoi(self, color: str) -> str:
        """Voronoi Texture"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 12 L32 12 L32 32 Z" fill="{color}" opacity="0.3"/>
  <path d="M32 12 L52 12 L52 28 L32 32 Z" fill="{color}" opacity="0.5"/>
  <path d="M12 12 L12 40 L24 52 L32 32 Z" fill="{color}" opacity="0.4"/>
  <path d="M32 32 L52 28 L52 52 L24 52 Z" fill="{color}" opacity="0.6"/>
  <circle cx="20" cy="24" r="2" fill="{color}"/>
  <circle cx="42" cy="20" r="2" fill="{color}"/>
  <circle cx="18" cy="42" r="2" fill="{color}"/>
  <circle cx="40" cy="40" r="2" fill="{color}"/>
</svg>'''
    
    # ============================================================================
    # MODIFIERS & DEFORMERS
    # ============================================================================
    
    def _icon_modifier(self, color: str) -> str:
        """Modifier Stack"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="40" height="10" rx="2" fill="{color}"/>
  <rect x="12" y="27" width="40" height="10" rx="2" fill="{color}" opacity="0.7"/>
  <rect x="12" y="42" width="40" height="10" rx="2" fill="{color}" opacity="0.5"/>
</svg>'''
    
    def _icon_bend(self, color: str) -> str:
        """Bend Deformer"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 12 L24 52" stroke="{color}" stroke-width="3" stroke-dasharray="4 4" opacity="0.3"/>
  <path d="M24 12 Q32 24 32 32 Q32 40 24 52" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="24" cy="12" r="3" fill="{color}"/>
  <circle cx="24" cy="52" r="3" fill="{color}"/>
</svg>'''
    
    def _icon_twist(self, color: str) -> str:
        """Twist Deformer"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="20" rx="12" ry="4" fill="{color}"/>
  <path d="M20 20 Q24 32 32 32 Q40 32 44 44" stroke="{color}" stroke-width="3" fill="none"/>
  <path d="M44 20 Q40 32 32 32 Q24 32 20 44" stroke="{color}" stroke-width="3" fill="none"/>
  <ellipse cx="32" cy="44" rx="12" ry="4" fill="{color}"/>
</svg>'''
    
    def _icon_wave(self, color: str) -> str:
        """Wave Deformer"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 32 Q20 20 28 32 Q36 44 44 32 Q52 20 60 32" stroke="{color}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M12 24 Q20 12 28 24 Q36 36 44 24 Q52 12 60 24" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"/>
  <path d="M12 40 Q20 28 28 40 Q36 52 44 40 Q52 28 60 40" stroke="{color}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"/>
</svg>'''
    
    def _icon_shrinkwrap(self, color: str) -> str:
        """Shrinkwrap"""
        return f'''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="16" fill="{color}" opacity="0.3"/>
  <rect x="20" y="20" width="24" height="24" stroke="{color}" stroke-width="2" fill="none" stroke-dasharray="4 4"/>
  <path d="M20 20 Q24 24 28 24 M44 20 Q40 24 36 24 M20 44 Q24 40 28 40 M44 44 Q40 40 36 40" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
</svg>'''

    
    # ============================================================================
    # ICON REGISTRY & GENERATION
    # ============================================================================
    
    def get_all_icons(self) -> Dict[str, Dict[str, any]]:
        """Return complete icon registry with categories"""
        return {
            # MODELING TOOLS
            "modeling": {
                "cube": {"method": self._icon_cube, "color": self.colors["modeling"]},
                "sphere": {"method": self._icon_sphere, "color": self.colors["modeling"]},
                "cylinder": {"method": self._icon_cylinder, "color": self.colors["modeling"]},
                "cone": {"method": self._icon_cone, "color": self.colors["modeling"]},
                "torus": {"method": self._icon_torus, "color": self.colors["modeling"]},
                "plane": {"method": self._icon_plane, "color": self.colors["modeling"]},
                "extrude": {"method": self._icon_extrude, "color": self.colors["modeling"]},
                "bevel": {"method": self._icon_bevel, "color": self.colors["modeling"]},
                "boolean_union": {"method": self._icon_boolean_union, "color": self.colors["modeling"]},
                "boolean_subtract": {"method": self._icon_boolean_subtract, "color": self.colors["modeling"]},
                "boolean_intersect": {"method": self._icon_boolean_intersect, "color": self.colors["modeling"]},
                "subdivide": {"method": self._icon_subdivide, "color": self.colors["modeling"]},
                "mirror": {"method": self._icon_mirror, "color": self.colors["modeling"]},
                "array": {"method": self._icon_array, "color": self.colors["modeling"]},
                "lattice": {"method": self._icon_lattice, "color": self.colors["modeling"]},
            },
            
            # SCULPTING TOOLS
            "sculpting": {
                "sculpt_draw": {"method": self._icon_sculpt_draw, "color": self.colors["sculpting"]},
                "sculpt_grab": {"method": self._icon_sculpt_grab, "color": self.colors["sculpting"]},
                "sculpt_smooth": {"method": self._icon_sculpt_smooth, "color": self.colors["sculpting"]},
                "sculpt_inflate": {"method": self._icon_sculpt_inflate, "color": self.colors["sculpting"]},
                "sculpt_crease": {"method": self._icon_sculpt_crease, "color": self.colors["sculpting"]},
                "sculpt_pinch": {"method": self._icon_sculpt_pinch, "color": self.colors["sculpting"]},
                "sculpt_clay": {"method": self._icon_sculpt_clay, "color": self.colors["sculpting"]},
                "sculpt_flatten": {"method": self._icon_sculpt_flatten, "color": self.colors["sculpting"]},
            },
            
            # TEXTURING & UV
            "texturing": {
                "uv_unwrap": {"method": self._icon_uv_unwrap, "color": self.colors["texturing"]},
                "texture_paint": {"method": self._icon_texture_paint, "color": self.colors["texturing"]},
                "material": {"method": self._icon_material, "color": self.colors["texturing"]},
                "shader": {"method": self._icon_shader, "color": self.colors["texturing"]},
                "normal_map": {"method": self._icon_normal_map, "color": self.colors["texturing"]},
                "bake": {"method": self._icon_bake, "color": self.colors["texturing"]},
            },
            
            # RIGGING & ANIMATION
            "rigging": {
                "bone": {"method": self._icon_bone, "color": self.colors["rigging"]},
                "ik": {"method": self._icon_ik, "color": self.colors["rigging"]},
                "fk": {"method": self._icon_fk, "color": self.colors["rigging"]},
                "constraint": {"method": self._icon_constraint, "color": self.colors["rigging"]},
            },
            
            "animation": {
                "keyframe": {"method": self._icon_keyframe, "color": self.colors["animation"]},
                "timeline": {"method": self._icon_timeline, "color": self.colors["animation"]},
                "graph_editor": {"method": self._icon_graph_editor, "color": self.colors["animation"]},
                "dope_sheet": {"method": self._icon_dope_sheet, "color": self.colors["animation"]},
            },
            
            # RENDERING & LIGHTING
            "rendering": {
                "camera": {"method": self._icon_camera, "color": self.colors["rendering"]},
                "light_point": {"method": self._icon_light_point, "color": self.colors["rendering"]},
                "light_spot": {"method": self._icon_light_spot, "color": self.colors["rendering"]},
                "light_area": {"method": self._icon_light_area, "color": self.colors["rendering"]},
                "light_sun": {"method": self._icon_light_sun, "color": self.colors["rendering"]},
                "render": {"method": self._icon_render, "color": self.colors["rendering"]},
                "viewport": {"method": self._icon_viewport, "color": self.colors["rendering"]},
                "wireframe": {"method": self._icon_wireframe, "color": self.colors["rendering"]},
            },
            
            # SIMULATION & PHYSICS
            "simulation": {
                "particle": {"method": self._icon_particle, "color": self.colors["simulation"]},
                "cloth": {"method": self._icon_cloth, "color": self.colors["simulation"]},
                "fluid": {"method": self._icon_fluid, "color": self.colors["simulation"]},
                "smoke": {"method": self._icon_smoke, "color": self.colors["simulation"]},
                "collision": {"method": self._icon_collision, "color": self.colors["simulation"]},
                "force_field": {"method": self._icon_force_field, "color": self.colors["simulation"]},
            },
            
            # SELECTION & TRANSFORM
            "selection": {
                "select_box": {"method": self._icon_select_box, "color": self.colors["primary"]},
                "select_circle": {"method": self._icon_select_circle, "color": self.colors["primary"]},
                "select_lasso": {"method": self._icon_select_lasso, "color": self.colors["primary"]},
                "move": {"method": self._icon_move, "color": self.colors["primary"]},
                "rotate": {"method": self._icon_rotate, "color": self.colors["primary"]},
                "scale": {"method": self._icon_scale, "color": self.colors["primary"]},
            },
            
            # VIEW & NAVIGATION
            "view": {
                "view_front": {"method": self._icon_view_front, "color": self.colors["neutral"]},
                "view_side": {"method": self._icon_view_side, "color": self.colors["neutral"]},
                "view_top": {"method": self._icon_view_top, "color": self.colors["neutral"]},
                "view_perspective": {"method": self._icon_view_perspective, "color": self.colors["neutral"]},
                "zoom_in": {"method": self._icon_zoom_in, "color": self.colors["neutral"]},
                "zoom_out": {"method": self._icon_zoom_out, "color": self.colors["neutral"]},
                "frame_all": {"method": self._icon_frame_all, "color": self.colors["neutral"]},
            },
            
            # FILE & PROJECT
            "file": {
                "new": {"method": self._icon_new, "color": self.colors["primary"]},
                "open": {"method": self._icon_open, "color": self.colors["primary"]},
                "save": {"method": self._icon_save, "color": self.colors["primary"]},
                "import": {"method": self._icon_import, "color": self.colors["secondary"]},
                "export": {"method": self._icon_export, "color": self.colors["secondary"]},
                "undo": {"method": self._icon_undo, "color": self.colors["neutral"]},
                "redo": {"method": self._icon_redo, "color": self.colors["neutral"]},
            },
            
            # LAYERS & ORGANIZATION
            "organization": {
                "layer": {"method": self._icon_layer, "color": self.colors["neutral"]},
                "group": {"method": self._icon_group, "color": self.colors["neutral"]},
                "collection": {"method": self._icon_collection, "color": self.colors["neutral"]},
                "outliner": {"method": self._icon_outliner, "color": self.colors["neutral"]},
                "visible": {"method": self._icon_visible, "color": self.colors["success"]},
                "hidden": {"method": self._icon_hidden, "color": self.colors["neutral"]},
                "lock": {"method": self._icon_lock, "color": self.colors["warning"]},
                "unlock": {"method": self._icon_unlock, "color": self.colors["success"]},
            },
            
            # UTILITIES
            "utilities": {
                "settings": {"method": self._icon_settings, "color": self.colors["neutral"]},
                "preferences": {"method": self._icon_preferences, "color": self.colors["neutral"]},
                "help": {"method": self._icon_help, "color": self.colors["secondary"]},
                "search": {"method": self._icon_search, "color": self.colors["neutral"]},
                "filter": {"method": self._icon_filter, "color": self.colors["neutral"]},
                "pin": {"method": self._icon_pin, "color": self.colors["accent"]},
                "bookmark": {"method": self._icon_bookmark, "color": self.colors["accent"]},
                "trash": {"method": self._icon_trash, "color": self.colors["danger"]},
                "duplicate": {"method": self._icon_duplicate, "color": self.colors["neutral"]},
                "link": {"method": self._icon_link, "color": self.colors["secondary"]},
                "unlink": {"method": self._icon_unlink, "color": self.colors["neutral"]},
            },
            
            # PLAYBACK
            "playback": {
                "play": {"method": self._icon_play, "color": self.colors["success"]},
                "pause": {"method": self._icon_pause, "color": self.colors["warning"]},
                "stop": {"method": self._icon_stop, "color": self.colors["danger"]},
                "record": {"method": self._icon_record, "color": self.colors["danger"]},
                "skip_forward": {"method": self._icon_skip_forward, "color": self.colors["neutral"]},
                "skip_back": {"method": self._icon_skip_back, "color": self.colors["neutral"]},
                "loop": {"method": self._icon_loop, "color": self.colors["accent"]},
            },
            
            # COMPOSITING
            "compositing": {
                "compositor": {"method": self._icon_compositor, "color": self.colors["compositing"]},
                "color_correction": {"method": self._icon_color_correction, "color": self.colors["compositing"]},
                "blur": {"method": self._icon_blur, "color": self.colors["compositing"]},
                "glow": {"method": self._icon_glow, "color": self.colors["compositing"]},
                "mask": {"method": self._icon_mask, "color": self.colors["compositing"]},
            },
            
            # GREASE PENCIL & 2D
            "grease_pencil": {
                "grease_pencil": {"method": self._icon_grease_pencil, "color": self.colors["accent"]},
                "draw_line": {"method": self._icon_draw_line, "color": self.colors["accent"]},
                "draw_curve": {"method": self._icon_draw_curve, "color": self.colors["accent"]},
                "eraser": {"method": self._icon_eraser, "color": self.colors["neutral"]},
                "fill": {"method": self._icon_fill, "color": self.colors["accent"]},
            },
            
            # CURVES & PATHS
            "curves": {
                "bezier": {"method": self._icon_bezier, "color": self.colors["secondary"]},
                "nurbs": {"method": self._icon_nurbs, "color": self.colors["secondary"]},
                "path_edit": {"method": self._icon_path_edit, "color": self.colors["secondary"]},
                "spline": {"method": self._icon_spline, "color": self.colors["secondary"]},
            },
            
            # MEASUREMENT
            "measurement": {
                "ruler": {"method": self._icon_ruler, "color": self.colors["neutral"]},
                "protractor": {"method": self._icon_protractor, "color": self.colors["neutral"]},
                "grid": {"method": self._icon_grid, "color": self.colors["neutral"]},
                "snap": {"method": self._icon_snap, "color": self.colors["accent"]},
            },
            
            # GEOMETRY NODES & PROCEDURAL
            "procedural": {
                "geometry_nodes": {"method": self._icon_geometry_nodes, "color": self.colors["secondary"]},
                "procedural": {"method": self._icon_procedural, "color": self.colors["secondary"]},
                "noise": {"method": self._icon_noise, "color": self.colors["secondary"]},
                "voronoi": {"method": self._icon_voronoi, "color": self.colors["secondary"]},
            },
            
            # MODIFIERS & DEFORMERS
            "modifiers": {
                "modifier": {"method": self._icon_modifier, "color": self.colors["neutral"]},
                "bend": {"method": self._icon_bend, "color": self.colors["secondary"]},
                "twist": {"method": self._icon_twist, "color": self.colors["secondary"]},
                "wave": {"method": self._icon_wave, "color": self.colors["secondary"]},
                "shrinkwrap": {"method": self._icon_shrinkwrap, "color": self.colors["secondary"]},
            },
        }
    
    def generate_all_icons(self):
        """Generate complete K_OS icon set"""
        print("🎨 K_OS DCC Suite Icon Generator")
        print("=" * 60)
        
        all_icons = self.get_all_icons()
        total_icons = sum(len(category) for category in all_icons.values())
        generated = 0
        
        print(f"📊 Generating {total_icons} icons across {len(all_icons)} categories...")
        print()
        
        # Generate icons by category
        for category_name, icons in all_icons.items():
            category_dir = self.icons_dir / category_name
            category_dir.mkdir(parents=True, exist_ok=True)
            
            print(f"📁 {category_name.upper()}: {len(icons)} icons")
            
            for icon_name, icon_data in icons.items():
                method = icon_data["method"]
                color = icon_data["color"]
                
                # Generate SVG
                svg_content = method(color)
                
                # Save to category folder
                svg_path = category_dir / f"{icon_name}.svg"
                svg_path.write_text(svg_content)
                
                generated += 1
                
                if generated % 10 == 0:
                    print(f"  ✓ {generated}/{total_icons} icons generated...")
        
        print()
        print("=" * 60)
        print(f"✅ SUCCESS! Generated {generated} icons")
        print(f"📂 Output directory: {self.output_dir}")
        print()
        
        # Generate index JSON
        self._generate_index(all_icons)
        
        # Generate README
        self._generate_readme(all_icons, generated)
        
        print("🎉 K_OS Icon Set Complete!")
        print()
        print("Next steps:")
        print("  1. Review icons in output/k-os-icons/")
        print("  2. Import into K_OS frontend")
        print("  3. Use in toolbar, menus, and UI panels")
    
    def _generate_index(self, all_icons: Dict):
        """Generate icon index JSON"""
        index = {
            "name": "K_OS DCC Suite Icons",
            "version": "1.0.0",
            "description": "Complete icon set for K_OS 3D DCC Suite",
            "total_icons": sum(len(category) for category in all_icons.values()),
            "categories": {}
        }
        
        for category_name, icons in all_icons.items():
            index["categories"][category_name] = {
                "count": len(icons),
                "icons": list(icons.keys())
            }
        
        index_path = self.output_dir / "icon_index.json"
        index_path.write_text(json.dumps(index, indent=2))
        print(f"📄 Icon index saved: {index_path}")
    
    def _generate_readme(self, all_icons: Dict, total: int):
        """Generate README documentation"""
        readme = f"""# K_OS DCC Suite Icon Set

Clean, minimal, solid-color icons for the K_OS 3D DCC Suite.

## Overview

- **Total Icons**: {total}
- **Categories**: {len(all_icons)}
- **Format**: SVG (64x64px)
- **Style**: Minimal, flat, solid colors

## Categories

"""
        
        for category_name, icons in all_icons.items():
            readme += f"### {category_name.replace('_', ' ').title()} ({len(icons)} icons)\n\n"
            readme += "```\n"
            for icon_name in icons.keys():
                readme += f"  - {icon_name}\n"
            readme += "```\n\n"
        
        readme += """## Usage

### React/TypeScript

```typescript
import CubeIcon from '@/assets/icons/modeling/cube.svg';

function ToolButton() {
  return <img src={CubeIcon} alt="Cube" width={24} height={24} />;
}
```

### Direct SVG Import

```typescript
import { ReactComponent as CubeIcon } from '@/assets/icons/modeling/cube.svg';

function ToolButton() {
  return <CubeIcon className="w-6 h-6 text-blue-500" />;
}
```

## Color Palette

- **Primary**: #8B5CF6 (Purple) - Main actions
- **Secondary**: #3B82F6 (Blue) - Secondary actions
- **Accent**: #EC4899 (Pink) - Highlights
- **Success**: #10B981 (Green) - Success states
- **Warning**: #F59E0B (Amber) - Warnings
- **Danger**: #EF4444 (Red) - Destructive actions

### Category Colors

- **Modeling**: Blue (#3B82F6)
- **Sculpting**: Purple (#8B5CF6)
- **Texturing**: Pink (#EC4899)
- **Rigging**: Amber (#F59E0B)
- **Animation**: Green (#10B981)
- **Rendering**: Red (#EF4444)
- **Simulation**: Cyan (#06B6D4)
- **Compositing**: Purple (#8B5CF6)

## License

Part of the K_OS DCC Suite project.
"""
        
        readme_path = self.output_dir / "README.md"
        readme_path.write_text(readme)
        print(f"📄 README saved: {readme_path}")


def main():
    """Main entry point"""
    generator = KOSIconGenerator()
    generator.generate_all_icons()


if __name__ == "__main__":
    main()
