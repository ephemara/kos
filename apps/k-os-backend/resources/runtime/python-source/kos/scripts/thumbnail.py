"""
K_OS Thumbnail Generator
========================
GPU-quality thumbnail generation using trimesh for smart camera positioning.
Uses PCA-based auto-orientation and best-view detection for perfect framing.
"""

import base64
import io
import numpy as np
from typing import Optional, Tuple
import sys
import os

# Add parent to get the register decorator
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import register

# Lazy imports
_trimesh = None
_PIL = None

def get_trimesh():
    global _trimesh
    if _trimesh is None:
        import trimesh
        _trimesh = trimesh
    return _trimesh

def get_PIL():
    global _PIL
    if _PIL is None:
        from PIL import Image
        _PIL = Image
    return _PIL


def compute_best_camera_angles(mesh, num_samples: int = 8) -> list:
    """
    Sample multiple camera angles and return them sorted by visible surface area.
    Uses hemisphere sampling to get good coverage.
    """
    angles = []
    # Golden angle spiral for even hemisphere coverage
    phi = np.pi * (3.0 - np.sqrt(5.0))  # Golden angle
    
    for i in range(num_samples):
        y = 1 - (i / float(num_samples - 1)) * 0.8  # 0.2 to 1.0 (upper hemisphere)
        radius = np.sqrt(1 - y * y)
        theta = phi * i
        
        x = np.cos(theta) * radius
        z = np.sin(theta) * radius
        
        angles.append((x, y, z))
    
    # Add some nice standard angles
    angles.extend([
        (1, 0.5, 1),      # Classic 3/4 view
        (1, 0.3, 0.5),    # Front-ish
        (0, 1, 0.1),      # Top-down (for flat objects)
        (1, 0, 0),        # Side view (for thin objects)
    ])
    
    return angles


def score_camera_angle(mesh, camera_pos: Tuple[float, float, float]) -> float:
    """
    Score a camera angle by estimated visible surface area.
    Higher = more geometry visible = better angle.
    """
    trimesh = get_trimesh()
    
    # Normalize camera direction
    cam = np.array(camera_pos)
    cam = cam / np.linalg.norm(cam)
    
    # Compute face visibility (dot product with face normals)
    face_normals = mesh.face_normals
    visibility = np.dot(face_normals, -cam)  # Negative because we want faces facing camera
    
    # Weight by face area and visibility
    face_areas = mesh.area_faces
    visible_mask = visibility > 0
    
    # Score = sum of visible face areas weighted by how directly they face camera
    score = np.sum(face_areas[visible_mask] * visibility[visible_mask])
    
    return score


def auto_orient_mesh(mesh):
    """
    Auto-orient mesh using PCA to align principal axes.
    This ensures consistent orientation regardless of original model axis.
    """
    trimesh = get_trimesh()
    
    # Center the mesh
    centroid = mesh.centroid
    mesh.vertices -= centroid
    
    # PCA on vertices
    try:
        from sklearn.decomposition import PCA
        pca = PCA(n_components=3)
        pca.fit(mesh.vertices)
        
        # Rotate to align with principal components
        rotation_matrix = pca.components_.T
        mesh.vertices = mesh.vertices @ rotation_matrix
    except ImportError:
        # Fallback: use simple bounding box alignment
        # Just ensure the longest axis is horizontal
        bounds = mesh.bounds
        extents = bounds[1] - bounds[0]
        
        # If Z is longest, rotate to make it X
        if extents[2] > extents[0] and extents[2] > extents[1]:
            rotation = trimesh.transformations.rotation_matrix(
                np.pi/2, [0, 1, 0]
            )[:3, :3]
            mesh.vertices = mesh.vertices @ rotation
    
    return mesh


def render_with_trimesh(mesh, camera_pos, size: int = 256, background: str = "transparent"):
    """
    Render using trimesh's built-in scene renderer.
    Works on all platforms without GPU dependencies.
    """
    trimesh = get_trimesh()
    Image = get_PIL()
    
    # Create scene
    scene = trimesh.Scene(mesh)
    
    # Compute camera distance based on bounding sphere
    bounds = mesh.bounds
    center = (bounds[0] + bounds[1]) / 2
    radius = np.linalg.norm(bounds[1] - bounds[0]) / 2
    distance = radius * 2.5  # Give some margin
    
    # Set camera position
    cam_direction = np.array(camera_pos)
    cam_direction = cam_direction / np.linalg.norm(cam_direction)
    cam_location = center + cam_direction * distance
    
    # Create camera transform (look at center)
    camera_transform = trimesh.transformations.look_at(
        cam_location,
        center,
        up=[0, 1, 0]
    )
    
    scene.camera_transform = camera_transform
    
    # Set resolution
    scene.camera.resolution = [size, size]
    scene.camera.fov = [45, 45]
    
    # Render
    try:
        # Try to use pyrender for better quality if available
        try:
            import pyrender
            
            # Convert trimesh scene to pyrender
            pr_mesh = pyrender.Mesh.from_trimesh(mesh, smooth=True)
            pr_scene = pyrender.Scene(ambient_light=[0.3, 0.3, 0.3])
            pr_scene.add(pr_mesh)
            
            # Add lights (3-point lighting)
            # Key light
            key_light = pyrender.DirectionalLight(color=[1.0, 0.95, 0.9], intensity=3.0)
            key_pose = np.eye(4)
            key_pose[:3, :3] = trimesh.transformations.rotation_matrix(
                np.radians(-45), [0, 1, 0]
            )[:3, :3] @ trimesh.transformations.rotation_matrix(
                np.radians(-30), [1, 0, 0]
            )[:3, :3]
            pr_scene.add(key_light, pose=key_pose)
            
            # Fill light
            fill_light = pyrender.DirectionalLight(color=[0.8, 0.85, 1.0], intensity=1.5)
            fill_pose = np.eye(4)
            fill_pose[:3, :3] = trimesh.transformations.rotation_matrix(
                np.radians(60), [0, 1, 0]
            )[:3, :3]
            pr_scene.add(fill_light, pose=fill_pose)
            
            # Rim light
            rim_light = pyrender.DirectionalLight(color=[1.0, 1.0, 1.0], intensity=2.0)
            rim_pose = np.eye(4)
            rim_pose[:3, :3] = trimesh.transformations.rotation_matrix(
                np.radians(150), [0, 1, 0]
            )[:3, :3] @ trimesh.transformations.rotation_matrix(
                np.radians(20), [1, 0, 0]
            )[:3, :3]
            pr_scene.add(rim_light, pose=rim_pose)
            
            # Camera
            camera = pyrender.PerspectiveCamera(yfov=np.radians(45))
            pr_scene.add(camera, pose=camera_transform)
            
            # Render
            renderer = pyrender.OffscreenRenderer(size, size)
            
            if background == "transparent":
                color, _ = renderer.render(pr_scene, flags=pyrender.RenderFlags.RGBA)
            else:
                color, _ = renderer.render(pr_scene)
                
            renderer.delete()
            
            img = Image.fromarray(color)
            
        except (ImportError, Exception) as e:
            # Fallback to trimesh's simple renderer
            print(f"[thumbnail] pyrender unavailable ({e}), using trimesh renderer", file=sys.stderr)
            
            # Use trimesh's save_image with a nice angle
            png_bytes = scene.save_image(resolution=[size, size])
            img = Image.open(io.BytesIO(png_bytes))
            
    except Exception as e:
        print(f"[thumbnail] render error: {e}", file=sys.stderr)
        # Create a fallback gray placeholder
        if background == "transparent":
            img = Image.new('RGBA', (size, size), (128, 128, 128, 255))
        else:
            img = Image.new('RGB', (size, size), (64, 64, 64))
    
    return img


@register("thumbnail.generate")
def generate_thumbnail(
    glb_base64: str,
    size: int = 256,
    background: str = "transparent",
    auto_orient: bool = True,
    best_view: bool = True
) -> str:
    """
    Generate a thumbnail from a GLB model.
    
    Args:
        glb_base64: Base64-encoded GLB file data
        size: Output image size in pixels (square)
        background: "transparent", "dark", or "light"
        auto_orient: Use PCA to auto-orient the model
        best_view: Sample multiple angles and pick the best
    
    Returns:
        Base64-encoded PNG image (data URI format)
    """
    trimesh = get_trimesh()
    Image = get_PIL()
    
    # Decode GLB
    glb_bytes = base64.b64decode(glb_base64)
    
    # Load mesh
    try:
        # Load as scene to handle multi-mesh GLTFs
        scene = trimesh.load(
            io.BytesIO(glb_bytes),
            file_type='glb',
            force='scene'
        )
        
        # Merge all meshes into one
        if hasattr(scene, 'dump'):
            meshes = scene.dump(concatenate=True)
            if isinstance(meshes, list):
                mesh = trimesh.util.concatenate(meshes)
            else:
                mesh = meshes
        else:
            mesh = scene
            
    except Exception as e:
        print(f"[thumbnail] load error: {e}", file=sys.stderr)
        # Return placeholder
        img = Image.new('RGBA', (size, size), (128, 128, 128, 128))
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"
    
    # Ensure we have a valid mesh
    if not hasattr(mesh, 'vertices') or len(mesh.vertices) == 0:
        print("[thumbnail] empty mesh", file=sys.stderr)
        img = Image.new('RGBA', (size, size), (100, 100, 100, 255))
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"
    
    # Normalize scale
    mesh.vertices -= mesh.centroid
    scale = mesh.bounding_box.extents.max()
    if scale > 0:
        mesh.vertices /= scale
    
    # Auto-orient for consistent view
    if auto_orient:
        mesh = auto_orient_mesh(mesh)
    
    # Find best camera angle
    if best_view and len(mesh.faces) > 0:
        angles = compute_best_camera_angles(mesh)
        best_angle = max(angles, key=lambda a: score_camera_angle(mesh, a))
    else:
        # Default nice angle
        best_angle = (1, 0.5, 1)
    
    # Render
    img = render_with_trimesh(mesh, best_angle, size, background)
    
    # Convert to base64 PNG
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    b64_data = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{b64_data}"


@register("thumbnail.generate_from_path")
def generate_thumbnail_from_path(
    file_path: str,
    size: int = 256,
    background: str = "transparent"
) -> str:
    """
    Generate thumbnail from a file path (for local files).
    """
    with open(file_path, 'rb') as f:
        glb_bytes = f.read()
    
    glb_base64 = base64.b64encode(glb_bytes).decode()
    return generate_thumbnail(glb_base64, size, background)
