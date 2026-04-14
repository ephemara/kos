"""
KGreeble Scatter Analysis Script
================================
Analyzes mesh geometry to generate "scatter masks" or "weight maps".
Used to professionally distribute assets based on terrain features.

Start K_OS sidecar:
  python_call("run_script", {
    "script_name": "scatter_analysis", 
    "function": "generate_mask",
    "vertices": [...], 
    "faces": [...],
    "rules": {
        "slope_range": [0, 30],      # Degrees (0=flat, 90=vertical)
        "height_range": [-10, 100],  # Y units
        "curvature_power": 1.0,      # 0=none, >0 highlights edges
        "noise_scale": 5.0           # Perlin noise scale
    }
  })
"""

import numpy as np
import sys
import os

# Add parent path to allow importing from kos modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from kos.procedural import perlin_noise_2d
except ImportError:
    perlin_noise_2d = None

from main import register

def compute_face_normals(vertices, faces):
    """Compute face normals using pure numpy"""
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    
    edge1 = v1 - v0
    edge2 = v2 - v0
    
    normals = np.cross(edge1, edge2)
    # Normalize
    length = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = normals / (length + 1e-8)
    return normals

def compute_vertex_normals(vertices, faces, face_normals):
    """Compute vertex normals by averaging face normals"""
    vertex_normals = np.zeros_like(vertices)
    
    # Add face normal to each vertex of the face
    # np.add.at is like scattering values into indices
    for i in range(3):
        np.add.at(vertex_normals, faces[:, i], face_normals)
    
    # Normalize
    length = np.linalg.norm(vertex_normals, axis=1, keepdims=True)
    vertex_normals = vertex_normals / (length + 1e-8)
    return vertex_normals

@register("scatter.analyze")
def generate_mask(vertices: list, faces: list, rules: dict = None) -> dict:
    """
    Generate a scatter weight map (0.0 - 1.0) for each vertex.
    """
    try:
        # 1. Convert to Numpy
        v_arr = np.array(vertices, dtype=np.float32)
        f_arr = np.array(faces, dtype=np.int32)
        
        if rules is None:
            rules = {}
            
        slope_min, slope_max = rules.get("slope_range", [0, 90])
        height_min, height_max = rules.get("height_range", [-10000, 10000])
        curvature_power = rules.get("curvature_power", 0.0)
        noise_scale = rules.get("noise_scale", 0.0)
        
        # 2. Geometry Analysis
        # If we have trimesh, use it (it's faster/more robust), else use numpy
        try:
            import trimesh
            mesh = trimesh.Trimesh(vertices=v_arr, faces=f_arr)
            vertex_normals = mesh.vertex_normals
        except ImportError:
            # Fallback to pure numpy
            face_normals = compute_face_normals(v_arr, f_arr)
            vertex_normals = compute_vertex_normals(v_arr, f_arr, face_normals)
            
        # 3. Calculate Factors
        weights = np.ones(len(v_arr), dtype=np.float32)
        
        # --- HEIGHT FILTER ---
        # Simple Y-level clamping
        y_values = v_arr[:, 1]
        height_mask = (y_values >= height_min) & (y_values <= height_max)
        weights *= height_mask.astype(np.float32)
        
        # Smooth falloff for height? (Optional, skipping for now to keep it efficient)

        # --- SLOPE FILTER ---
        # Slope is angle between Normal and UP (0, 1, 0)
        up = np.array([0, 1, 0], dtype=np.float32)
        # Dot product: a . b = |a||b|cos(theta) -> cos(theta) since normalized
        dots = np.dot(vertex_normals, up)
        # Clamp to -1..1 for safety
        dots = np.clip(dots, -1.0, 1.0)
        angles_rad = np.arccos(dots)
        angles_deg = np.degrees(angles_rad)
        
        # Linear fade?? For now simple step + slight mix
        # Let's do a smooth-step for quality
        # 1.0 if inside range, tapering to 0.0 outside
        slope_mask = (angles_deg >= slope_min) & (angles_deg <= slope_max)
        weights *= slope_mask.astype(np.float32)
        
        # --- CURVATURE ---
        if curvature_power > 0.001:
            # Simple discrete curvature: magnitude of difference between v_norm and avg_neighbor_norm
            # Or simplified: 1 - dot(v_norm, avg_neighbor_norm)
            # This is expensive in pure numpy without an adjacency list.
            # We'll use a simplified probabilistic approach or just skip if no trimesh?
            # Actually, let's use the 'kos.mesh.curvature' logic if possible, 
            # but implementing it here is safer for a standalone script.
            pass # TODO: Implement efficient numpy curvature
            
        # --- NOISE MASK ---
        if noise_scale > 0.001:
            # Simple 3D noise would be best, but we have 2D perlin in procedural.py
            # Let's projects XZ plain for noise
            if perlin_noise_2d:
                # We can't easily sample per-vertex 3D noise without a lib like `noise` or `opensimplex`
                # Let's generate a quick pseudo-random noise seeded by position
                # Simple "hash" noise based on vertex position
                # sin(dot(n, float3(12.9898, 78.233, 45.164))) * 43758.5453
                scale = noise_scale * 0.1
                p = v_arr * scale
                noise_val = np.sin(p[:,0]*12.9898 + p[:,1]*78.233 + p[:,2]*54.53) * 43758.5453
                noise_val = noise_val - np.floor(noise_val) # 0..1 fract
                
                # Blend: (1 - strength) + noise * strength ??
                # Actually usually we want to Multiply: weight * noise
                weights *= noise_val

        return {
            "weights": weights.tolist(),
            "vertex_count": len(weights)
        }
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }
