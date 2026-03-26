"""
K_OS Asset Browser Utilities
============================
Thumbnail generation and metadata extraction for the Bevy asset browser.
"""

import os
import sys
import base64
from io import BytesIO
from typing import Dict, Any, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from main import register

# Lazy imports
_PIL = None
_trimesh = None
_pyrender = None


def get_pil():
    global _PIL
    if _PIL is None:
        from PIL import Image
        _PIL = Image
    return _PIL


def get_trimesh():
    global _trimesh
    if _trimesh is None:
        import trimesh
        _trimesh = trimesh
    return _trimesh


@register("browser.generate_thumbnail")
def generate_thumbnail(
    path: str,
    size: int = 128,
    format: str = "PNG"
) -> Dict[str, Any]:
    """
    Generate a thumbnail image for a 3D model file.
    
    Args:
        path: Path to 3D model (GLTF, OBJ, FBX, etc.)
        size: Thumbnail size in pixels (square)
        format: Output format (PNG, JPEG)
    
    Returns:
        Dict with base64-encoded image data
    """
    Image = get_pil()
    trimesh = get_trimesh()
    
    try:
        # Load the mesh
        mesh = trimesh.load(path)
        
        # Handle Scene vs Trimesh
        if isinstance(mesh, trimesh.Scene):
            # Get the combined geometry
            if len(mesh.geometry) == 0:
                raise ValueError("Empty scene")
            mesh = trimesh.util.concatenate(list(mesh.geometry.values()))
        
        # Create a simple rendered preview using trimesh's built-in
        # This creates an orthographic view of the mesh
        scene = trimesh.Scene(mesh)
        
        # Try to render with pyrender if available, otherwise use simple preview
        try:
            # Use trimesh's scene.save_image for a quick render
            png_data = scene.save_image(resolution=[size, size], visible=False)
            img = Image.open(BytesIO(png_data))
        except Exception:
            # Fallback: create a simple silhouette/bounds visualization
            # This works without OpenGL
            img = _create_simple_preview(mesh, size, Image)
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format=format)
        base64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return {
            "success": True,
            "data": base64_data,
            "format": format.lower(),
            "size": size,
            "mime": f"image/{format.lower()}"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def _create_simple_preview(mesh, size: int, Image):
    """Create a simple 2D preview without OpenGL rendering."""
    import numpy as np
    
    # Get mesh bounds
    bounds = mesh.bounds
    center = (bounds[0] + bounds[1]) / 2
    scale = max(bounds[1] - bounds[0])
    
    # Project vertices to 2D (simple orthographic from front)
    vertices = mesh.vertices.copy()
    vertices -= center
    vertices /= (scale * 0.5)  # Normalize to [-1, 1]
    
    # Create image
    img = Image.new('RGBA', (size, size), (30, 30, 30, 255))
    pixels = img.load()
    
    # Draw edges as simple lines
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    
    # Draw wireframe
    if hasattr(mesh, 'edges_unique'):
        edges = mesh.edges_unique
        for edge in edges[:500]:  # Limit for performance
            v0 = vertices[edge[0]]
            v1 = vertices[edge[1]]
            
            # Project X, Y (ignore Z for now - front view)
            x0 = int((v0[0] + 1) * size / 2)
            y0 = int((1 - v0[1]) * size / 2)  # Flip Y
            x1 = int((v1[0] + 1) * size / 2)
            y1 = int((1 - v1[1]) * size / 2)
            
            # Clamp to image bounds
            x0, y0 = max(0, min(size-1, x0)), max(0, min(size-1, y0))
            x1, y1 = max(0, min(size-1, x1)), max(0, min(size-1, y1))
            
            draw.line([(x0, y0), (x1, y1)], fill=(100, 180, 255, 255), width=1)
    
    return img


@register("browser.get_file_metadata")
def get_file_metadata(path: str) -> Dict[str, Any]:
    """
    Extract metadata from a file (3D model, image, etc.)
    
    Args:
        path: Path to file
    
    Returns:
        Dict with file metadata
    """
    import os
    from datetime import datetime
    
    if not os.path.exists(path):
        return {"success": False, "error": "File not found"}
    
    stat = os.stat(path)
    _, ext = os.path.splitext(path)
    
    metadata = {
        "success": True,
        "path": path,
        "name": os.path.basename(path),
        "extension": ext.lower(),
        "size_bytes": stat.st_size,
        "size_human": _format_size(stat.st_size),
        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
    }
    
    # Try to get 3D-specific metadata
    if ext.lower() in ['.gltf', '.glb', '.obj', '.fbx', '.stl', '.ply']:
        try:
            trimesh = get_trimesh()
            mesh = trimesh.load(path)
            
            if isinstance(mesh, trimesh.Scene):
                metadata["type"] = "scene"
                metadata["geometry_count"] = len(mesh.geometry)
                total_verts = sum(g.vertices.shape[0] for g in mesh.geometry.values() if hasattr(g, 'vertices'))
                total_faces = sum(g.faces.shape[0] for g in mesh.geometry.values() if hasattr(g, 'faces'))
                metadata["vertex_count"] = total_verts
                metadata["face_count"] = total_faces
            else:
                metadata["type"] = "mesh"
                metadata["vertex_count"] = len(mesh.vertices)
                metadata["face_count"] = len(mesh.faces) if hasattr(mesh, 'faces') else 0
                metadata["bounds"] = mesh.bounds.tolist()
                metadata["is_watertight"] = mesh.is_watertight if hasattr(mesh, 'is_watertight') else None
                
        except Exception as e:
            metadata["mesh_error"] = str(e)
    
    return metadata


def _format_size(size_bytes: int) -> str:
    """Format bytes to human readable string."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


@register("browser.batch_thumbnails")
def batch_thumbnails(paths: list, size: int = 64) -> Dict[str, Any]:
    """
    Generate thumbnails for multiple files.
    
    Args:
        paths: List of file paths
        size: Thumbnail size
    
    Returns:
        Dict mapping paths to thumbnail data
    """
    results = {}
    for path in paths:
        results[path] = generate_thumbnail(path, size)
    
    return {"thumbnails": results}
