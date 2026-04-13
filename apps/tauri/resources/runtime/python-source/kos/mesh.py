"""
K_OS Mesh Utilities
===================
High-level mesh processing using trimesh, Open3D, pymeshlab, etc.
"""

import numpy as np
from typing import Dict, List, Tuple, Any, Optional
import sys
import os

# Add parent to get the register decorator
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import register

# Lazy imports for heavy libraries
_trimesh = None
_o3d = None

def get_trimesh():
    global _trimesh
    if _trimesh is None:
        import trimesh
        _trimesh = trimesh
    return _trimesh

def get_open3d():
    global _o3d
    if _o3d is None:
        import open3d as o3d
        _o3d = o3d
    return _o3d

# --- MESH OPERATIONS ---

@register("mesh.load")
def load_mesh(path: str) -> Dict[str, Any]:
    """Load a mesh file and return vertex/face data"""
    trimesh = get_trimesh()
    mesh = trimesh.load(path)
    return {
        "vertices": mesh.vertices.tolist(),
        "faces": mesh.faces.tolist(),
        "vertex_count": len(mesh.vertices),
        "face_count": len(mesh.faces),
        "bounds": mesh.bounds.tolist()
    }

@register("mesh.decimate")
def decimate_mesh(vertices: List, faces: List, target_faces: int) -> Dict[str, Any]:
    """Reduce mesh polygon count"""
    o3d = get_open3d()
    mesh = o3d.geometry.TriangleMesh()
    mesh.vertices = o3d.utility.Vector3dVector(np.array(vertices))
    mesh.triangles = o3d.utility.Vector3iVector(np.array(faces))
    
    decimated = mesh.simplify_quadric_decimation(target_faces)
    
    return {
        "vertices": np.asarray(decimated.vertices).tolist(),
        "faces": np.asarray(decimated.triangles).tolist()
    }

@register("mesh.remesh")
def remesh_uniform(vertices: List, faces: List, target_edge_length: float) -> Dict[str, Any]:
    """Remesh to uniform triangle size"""
    trimesh = get_trimesh()
    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))
    
    # Subdivide if needed, then simplify
    while mesh.edges_unique_length.mean() > target_edge_length * 1.5:
        mesh = mesh.subdivide()
    
    return {
        "vertices": mesh.vertices.tolist(),
        "faces": mesh.faces.tolist()
    }

@register("mesh.boolean")
def boolean_operation(
    vertices_a: List, faces_a: List,
    vertices_b: List, faces_b: List,
    operation: str = "difference"  # union, intersection, difference
) -> Dict[str, Any]:
    """Perform boolean operation between two meshes"""
    trimesh = get_trimesh()
    mesh_a = trimesh.Trimesh(vertices=np.array(vertices_a), faces=np.array(faces_a))
    mesh_b = trimesh.Trimesh(vertices=np.array(vertices_b), faces=np.array(faces_b))
    
    if operation == "union":
        result = mesh_a.union(mesh_b)
    elif operation == "intersection":
        result = mesh_a.intersection(mesh_b)
    else:  # difference
        result = mesh_a.difference(mesh_b)
    
    return {
        "vertices": result.vertices.tolist(),
        "faces": result.faces.tolist()
    }

@register("mesh.compute_normals")
def compute_normals(vertices: List, faces: List) -> Dict[str, Any]:
    """Compute vertex and face normals"""
    trimesh = get_trimesh()
    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))
    
    return {
        "vertex_normals": mesh.vertex_normals.tolist(),
        "face_normals": mesh.face_normals.tolist()
    }

@register("mesh.curvature")
def compute_curvature(vertices: List, faces: List) -> Dict[str, Any]:
    """Compute per-vertex curvature"""
    o3d = get_open3d()
    mesh = o3d.geometry.TriangleMesh()
    mesh.vertices = o3d.utility.Vector3dVector(np.array(vertices))
    mesh.triangles = o3d.utility.Vector3iVector(np.array(faces))
    mesh.compute_vertex_normals()
    
    # Compute discrete curvatures
    # This is a simplified version - more advanced would use libigl
    vertices_np = np.asarray(mesh.vertices)
    normals_np = np.asarray(mesh.vertex_normals)
    
    # Approximate mean curvature from Laplacian
    from scipy.sparse import lil_matrix
    from scipy.sparse.linalg import norm
    
    n = len(vertices_np)
    adjacency = lil_matrix((n, n))
    
    for face in np.asarray(mesh.triangles):
        for i in range(3):
            adjacency[face[i], face[(i+1)%3]] = 1
            adjacency[face[(i+1)%3], face[i]] = 1
    
    curvature = np.zeros(n)
    for i in range(n):
        neighbors = adjacency[i].nonzero()[1]
        if len(neighbors) > 0:
            diff = vertices_np[neighbors] - vertices_np[i]
            curvature[i] = np.mean(np.linalg.norm(diff, axis=1))
    
    # Normalize to 0-1
    if curvature.max() > 0:
        curvature = curvature / curvature.max()
    
    return {"curvature": curvature.tolist()}

@register("mesh.repair")
def repair_mesh(vertices: List, faces: List) -> Dict[str, Any]:
    """Repair mesh (fill holes, fix normals, remove degenerate faces)"""
    trimesh = get_trimesh()
    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))
    
    # Fill holes
    mesh.fill_holes()
    
    # Remove degenerate faces
    mesh.remove_degenerate_faces()
    
    # Fix normals to be consistent
    mesh.fix_normals()
    
    return {
        "vertices": mesh.vertices.tolist(),
        "faces": mesh.faces.tolist(),
        "is_watertight": mesh.is_watertight
    }
