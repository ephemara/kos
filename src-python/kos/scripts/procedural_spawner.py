"""
Procedural Spawner - Generate insane patterns of geometry for KGreeble
"""
import numpy as np
from typing import Dict, Any, List
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from main import register

@register("spawn.cube_explosion")
def cube_explosion(
    count: int = 100,
    radius: float = 10.0,
    cube_size: float = 0.5,
    pattern: str = "sphere",  # "sphere", "tower", "spiral", "grid"
    **kwargs
) -> Dict[str, Any]:
    """
    Generate a pattern of cubes for physics mayhem.
    
    Returns a list of cube transforms (position, rotation, scale)
    that KGreeble can spawn.
    """
    cubes = []
    
    if pattern == "sphere":
        # Random sphere distribution
        for i in range(count):
            # Fibonacci sphere
            phi = np.pi * (3. - np.sqrt(5.))  # golden angle
            y = 1 - (i / float(count - 1)) * 2  # y from 1 to -1
            r = np.sqrt(1 - y * y)
            theta = phi * i
            
            x = np.cos(theta) * r * radius
            z = np.sin(theta) * r * radius
            y = y * radius + radius  # Lift it up
            
            cubes.append({
                "position": [float(x), float(y), float(z)],
                "rotation": [0.0, 0.0, 0.0],
                "scale": [cube_size, cube_size, cube_size]
            })
    
    elif pattern == "tower":
        # Stack cubes vertically
        layers = int(np.sqrt(count))
        per_layer = count // layers
        
        for layer in range(layers):
            for i in range(per_layer):
                angle = (i / per_layer) * 2 * np.pi
                r = 2.0
                x = np.cos(angle) * r
                z = np.sin(angle) * r
                y = layer * cube_size * 2.2  # Stack height
                
                cubes.append({
                    "position": [float(x), float(y), float(z)],
                    "rotation": [0.0, float(angle), 0.0],
                    "scale": [cube_size, cube_size, cube_size]
                })
    
    elif pattern == "spiral":
        # Spiral ascending
        for i in range(count):
            t = i / count
            angle = t * 10 * np.pi  # 5 full rotations
            r = 5.0 * (1 - t)  # Shrinking radius
            
            x = np.cos(angle) * r
            z = np.sin(angle) * r
            y = t * 20.0  # Height
            
            cubes.append({
                "position": [float(x), float(y), float(z)],
                "rotation": [0.0, float(angle), 0.0],
                "scale": [cube_size, cube_size, cube_size]
            })
    
    elif pattern == "grid":
        # 3D Grid
        side = int(np.cbrt(count))
        spacing = 2.0
        
        idx = 0
        for x in range(side):
            for y in range(side):
                for z in range(side):
                    if idx >= count:
                        break
                    
                    cubes.append({
                        "position": [
                            float((x - side/2) * spacing),
                            float(y * spacing + 10),
                            float((z - side/2) * spacing)
                        ],
                        "rotation": [0.0, 0.0, 0.0],
                        "scale": [cube_size, cube_size, cube_size]
                    })
                    idx += 1
    
    return {
        "cubes": cubes,
        "count": len(cubes),
        "pattern": pattern
    }


@register("spawn.parametric_mesh")
def parametric_mesh(
    formula: str = "torus",
    resolution: int = 20,
    **kwargs
) -> Dict[str, Any]:
    """
    Generate parametric surfaces for instant visualization.
    
    Formulas: "torus", "sphere", "knot", "mobius", "klein"
    """
    u = np.linspace(0, 2 * np.pi, resolution)
    v = np.linspace(0, 2 * np.pi, resolution)
    U, V = np.meshgrid(u, v)
    
    if formula == "torus":
        R, r = 3.0, 1.0
        X = (R + r * np.cos(V)) * np.cos(U)
        Y = (R + r * np.cos(V)) * np.sin(U)
        Z = r * np.sin(V)
    
    elif formula == "sphere":
        R = 3.0
        X = R * np.sin(V) * np.cos(U)
        Y = R * np.sin(V) * np.sin(U)
        Z = R * np.cos(V)
    
    elif formula == "knot":
        # Trefoil knot
        X = np.sin(U) + 2 * np.sin(2 * U)
        Y = np.cos(U) - 2 * np.cos(2 * U)
        Z = -np.sin(3 * U)
        # Add thickness
        X += 0.5 * np.cos(V) * np.cos(U)
        Y += 0.5 * np.cos(V) * np.sin(U)
        Z += 0.5 * np.sin(V)
    
    elif formula == "mobius":
        # Möbius strip
        width = 1.0
        X = (1 + (width/2) * np.cos(V/2)) * np.cos(U)
        Y = (1 + (width/2) * np.cos(V/2)) * np.sin(U)
        Z = (width/2) * np.sin(V/2)
    
    elif formula == "klein":
        # Klein bottle (simplified)
        a, b = 2.0, 1.0
        X = (a + b * np.cos(V)) * np.cos(U)
        Y = (a + b * np.cos(V)) * np.sin(U)
        Z = b * np.sin(V) * np.cos(U/2)
    
    else:
        # Default to torus
        R, r = 3.0, 1.0
        X = (R + r * np.cos(V)) * np.cos(U)
        Y = (R + r * np.cos(V)) * np.sin(U)
        Z = r * np.sin(V)
    
    # Convert to vertex list
    vertices = []
    faces = []
    
    for i in range(resolution):
        for j in range(resolution):
            vertices.append([float(X[i, j]), float(Z[i, j]), float(Y[i, j])])
    
    # Generate faces (quad grid)
    for i in range(resolution - 1):
        for j in range(resolution - 1):
            v0 = i * resolution + j
            v1 = i * resolution + (j + 1)
            v2 = (i + 1) * resolution + (j + 1)
            v3 = (i + 1) * resolution + j
            
            # Two triangles per quad
            faces.append([v0, v1, v2])
            faces.append([v0, v2, v3])
    
    return {
        "vertices": vertices,
        "faces": faces,
        "formula": formula,
        "vertex_count": len(vertices),
        "face_count": len(faces)
    }
