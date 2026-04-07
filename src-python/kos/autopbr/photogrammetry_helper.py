"""
Photogrammetry Helper - Advanced Mesh Processing

Uses Open3D for Poisson surface reconstruction and mesh optimization.
This provides production-quality mesh generation from point clouds.
"""

import numpy as np
from typing import List, Tuple, Dict, Optional
import json

try:
    import open3d as o3d
    OPEN3D_AVAILABLE = True
except ImportError:
    OPEN3D_AVAILABLE = False
    print("Warning: Open3D not available. Install with: pip install open3d")


def poisson_surface_reconstruction(
    points: List[List[float]],
    normals: List[List[float]],
    colors: List[List[float]],
    depth: int = 9,
    scale: float = 1.1,
    linear_fit: bool = False
) -> Dict:
    """
    Generate triangle mesh from point cloud using Poisson surface reconstruction.
    
    Args:
        points: List of [x, y, z] point positions
        normals: List of [nx, ny, nz] normal vectors
        colors: List of [r, g, b] colors (0-1 range)
        depth: Octree depth for reconstruction (higher = more detail)
        scale: Scale factor for reconstruction
        linear_fit: Use linear interpolation
        
    Returns:
        Dictionary with mesh data: vertices, normals, uvs, indices, colors
    """
    if not OPEN3D_AVAILABLE:
        raise RuntimeError("Open3D not available")
    
    # Create Open3D point cloud
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(np.array(points))
    pcd.normals = o3d.utility.Vector3dVector(np.array(normals))
    pcd.colors = o3d.utility.Vector3dVector(np.array(colors))
    
    # Estimate normals if not provided or invalid
    if len(normals) == 0 or not pcd.has_normals():
        pcd.estimate_normals(
            search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30)
        )
        pcd.orient_normals_consistent_tangent_plane(k=15)
    
    # Poisson surface reconstruction
    print(f"Running Poisson reconstruction (depth={depth})...")
    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pcd, depth=depth, scale=scale, linear_fit=linear_fit
    )
    
    # Remove low-density vertices (noise)
    densities = np.asarray(densities)
    density_threshold = np.quantile(densities, 0.01)
    vertices_to_remove = densities < density_threshold
    mesh.remove_vertices_by_mask(vertices_to_remove)
    
    # Compute vertex normals
    mesh.compute_vertex_normals()
    
    # Generate UV coordinates (simple box projection)
    vertices = np.asarray(mesh.vertices)
    uvs = generate_uv_coordinates(vertices)
    
    # Extract mesh data
    result = {
        "vertices": vertices.tolist(),
        "normals": np.asarray(mesh.vertex_normals).tolist(),
        "uvs": uvs.tolist(),
        "indices": np.asarray(mesh.triangles).flatten().tolist(),
        "colors": np.asarray(mesh.vertex_colors).tolist() if mesh.has_vertex_colors() else [],
    }
    
    print(f"Generated mesh: {len(result['vertices'])} vertices, {len(result['indices'])//3} triangles")
    
    return result


def generate_uv_coordinates(vertices: np.ndarray) -> np.ndarray:
    """
    Generate UV coordinates using box projection.
    
    Args:
        vertices: Nx3 array of vertex positions
        
    Returns:
        Nx2 array of UV coordinates
    """
    # Normalize vertices to 0-1 range
    min_coords = vertices.min(axis=0)
    max_coords = vertices.max(axis=0)
    range_coords = max_coords - min_coords
    range_coords[range_coords == 0] = 1.0  # Avoid division by zero
    
    normalized = (vertices - min_coords) / range_coords
    
    # Use XZ projection for UVs (assuming Y is up)
    uvs = normalized[:, [0, 2]]
    
    return uvs


def optimize_mesh(
    vertices: List[List[float]],
    indices: List[int],
    target_triangles: Optional[int] = None,
    preserve_topology: bool = True
) -> Dict:
    """
    Optimize mesh by simplification and smoothing.
    
    Args:
        vertices: List of [x, y, z] vertex positions
        indices: List of triangle indices (flattened)
        target_triangles: Target number of triangles (None = no simplification)
        preserve_topology: Preserve mesh topology during simplification
        
    Returns:
        Dictionary with optimized mesh data
    """
    if not OPEN3D_AVAILABLE:
        raise RuntimeError("Open3D not available")
    
    # Create Open3D mesh
    mesh = o3d.geometry.TriangleMesh()
    mesh.vertices = o3d.utility.Vector3dVector(np.array(vertices))
    mesh.triangles = o3d.utility.Vector3iVector(
        np.array(indices).reshape(-1, 3)
    )
    
    # Compute normals
    mesh.compute_vertex_normals()
    
    # Simplify if target specified
    if target_triangles is not None:
        print(f"Simplifying mesh to {target_triangles} triangles...")
        mesh = mesh.simplify_quadric_decimation(
            target_number_of_triangles=target_triangles
        )
    
    # Smooth mesh
    mesh = mesh.filter_smooth_simple(number_of_iterations=1)
    
    # Remove degenerate triangles
    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_non_manifold_edges()
    
    # Recompute normals
    mesh.compute_vertex_normals()
    
    # Generate UVs
    vertices_np = np.asarray(mesh.vertices)
    uvs = generate_uv_coordinates(vertices_np)
    
    result = {
        "vertices": vertices_np.tolist(),
        "normals": np.asarray(mesh.vertex_normals).tolist(),
        "uvs": uvs.tolist(),
        "indices": np.asarray(mesh.triangles).flatten().tolist(),
    }
    
    print(f"Optimized mesh: {len(result['vertices'])} vertices, {len(result['indices'])//3} triangles")
    
    return result


def compute_ambient_occlusion(
    vertices: List[List[float]],
    normals: List[List[float]],
    indices: List[int],
    num_samples: int = 256
) -> List[float]:
    """
    Compute ambient occlusion for mesh vertices.
    
    Args:
        vertices: List of [x, y, z] vertex positions
        normals: List of [nx, ny, nz] normal vectors
        indices: List of triangle indices
        num_samples: Number of ray samples per vertex
        
    Returns:
        List of AO values (0-1) per vertex
    """
    if not OPEN3D_AVAILABLE:
        raise RuntimeError("Open3D not available")
    
    # Create Open3D mesh
    mesh = o3d.geometry.TriangleMesh()
    mesh.vertices = o3d.utility.Vector3dVector(np.array(vertices))
    mesh.triangles = o3d.utility.Vector3iVector(
        np.array(indices).reshape(-1, 3)
    )
    mesh.vertex_normals = o3d.utility.Vector3dVector(np.array(normals))
    
    # Create ray casting scene
    scene = o3d.t.geometry.RaycastingScene()
    scene.add_triangles(o3d.t.geometry.TriangleMesh.from_legacy(mesh))
    
    # Compute AO for each vertex
    vertices_np = np.array(vertices)
    normals_np = np.array(normals)
    ao_values = np.ones(len(vertices))
    
    print(f"Computing ambient occlusion ({num_samples} samples per vertex)...")
    
    for i, (vertex, normal) in enumerate(zip(vertices_np, normals_np)):
        # Generate hemisphere samples
        samples = generate_hemisphere_samples(normal, num_samples)
        
        # Cast rays
        rays = np.column_stack([
            np.tile(vertex, (num_samples, 1)),
            samples
        ])
        
        # Count hits
        hits = scene.cast_rays(o3d.core.Tensor(rays, dtype=o3d.core.Dtype.Float32))
        hit_count = np.sum(hits['t_hit'].numpy() < np.inf)
        
        # AO = 1 - (hit_ratio)
        ao_values[i] = 1.0 - (hit_count / num_samples)
    
    print(f"AO computation complete")
    
    return ao_values.tolist()


def generate_hemisphere_samples(normal: np.ndarray, num_samples: int) -> np.ndarray:
    """
    Generate random samples on hemisphere oriented by normal.
    
    Args:
        normal: Normal vector [nx, ny, nz]
        num_samples: Number of samples to generate
        
    Returns:
        Nx3 array of sample directions
    """
    # Generate random samples on unit sphere
    samples = np.random.randn(num_samples, 3)
    samples /= np.linalg.norm(samples, axis=1, keepdims=True)
    
    # Flip samples to hemisphere
    dots = np.dot(samples, normal)
    samples[dots < 0] *= -1
    
    return samples


# JSON-RPC registration (if python_bridge is available)
try:
    from ..python_bridge import register
    
    @register("photogrammetry_poisson_reconstruction")
    def rpc_poisson_reconstruction(data: dict) -> dict:
        """RPC wrapper for Poisson reconstruction"""
        return poisson_surface_reconstruction(
            points=data["points"],
            normals=data["normals"],
            colors=data["colors"],
            depth=data.get("depth", 9),
            scale=data.get("scale", 1.1),
            linear_fit=data.get("linear_fit", False)
        )
    
    @register("photogrammetry_optimize_mesh")
    def rpc_optimize_mesh(data: dict) -> dict:
        """RPC wrapper for mesh optimization"""
        return optimize_mesh(
            vertices=data["vertices"],
            indices=data["indices"],
            target_triangles=data.get("target_triangles"),
            preserve_topology=data.get("preserve_topology", True)
        )
    
    @register("photogrammetry_compute_ao")
    def rpc_compute_ao(data: dict) -> dict:
        """RPC wrapper for AO computation"""
        ao_values = compute_ambient_occlusion(
            vertices=data["vertices"],
            normals=data["normals"],
            indices=data["indices"],
            num_samples=data.get("num_samples", 256)
        )
        return {"ao_values": ao_values}
    
except ImportError:
    print("Python bridge not available - RPC functions not registered")


if __name__ == "__main__":
    # Test with sample data
    if OPEN3D_AVAILABLE:
        print("Testing Poisson reconstruction...")
        
        # Generate sample point cloud (sphere)
        num_points = 1000
        theta = np.random.uniform(0, 2*np.pi, num_points)
        phi = np.random.uniform(0, np.pi, num_points)
        
        points = np.column_stack([
            np.sin(phi) * np.cos(theta),
            np.sin(phi) * np.sin(theta),
            np.cos(phi)
        ])
        
        normals = points / np.linalg.norm(points, axis=1, keepdims=True)
        colors = np.ones_like(points) * 0.8
        
        result = poisson_surface_reconstruction(
            points=points.tolist(),
            normals=normals.tolist(),
            colors=colors.tolist(),
            depth=7
        )
        
        print(f"Test successful: {len(result['vertices'])} vertices generated")
    else:
        print("Open3D not available - skipping test")
