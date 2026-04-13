"""
K_OS Procedural Generation
==========================
Noise, patterns, terrain, and procedural content generation.
"""

import numpy as np
from typing import Dict, List, Tuple, Any, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import register

# --- NOISE FUNCTIONS ---

@register("procedural.perlin_2d")
def perlin_noise_2d(width: int, height: int, scale: float = 50.0, octaves: int = 4, seed: int = None) -> Dict[str, Any]:
    """Generate 2D Perlin noise"""
    if seed is not None:
        np.random.seed(seed)
    
    try:
        from noise import pnoise2
        
        noise_map = np.zeros((height, width))
        for y in range(height):
            for x in range(width):
                noise_map[y, x] = pnoise2(
                    x / scale, y / scale,
                    octaves=octaves,
                    persistence=0.5,
                    lacunarity=2.0,
                    repeatx=width,
                    repeaty=height,
                    base=seed or 0
                )
        
        # Normalize to 0-1
        noise_map = (noise_map - noise_map.min()) / (noise_map.max() - noise_map.min() + 1e-8)
        
        return {
            "data": noise_map.tolist(),
            "width": width,
            "height": height
        }
    except ImportError:
        # Fallback to simple value noise
        return value_noise_2d(width, height, scale, octaves, seed)

@register("procedural.value_noise_2d")
def value_noise_2d(width: int, height: int, scale: float = 50.0, octaves: int = 4, seed: int = None) -> Dict[str, Any]:
    """Generate 2D value noise (simpler than Perlin)"""
    if seed is not None:
        np.random.seed(seed)
    
    noise_map = np.zeros((height, width))
    amplitude = 1.0
    frequency = 1.0 / scale
    
    for _ in range(octaves):
        # Generate random grid
        grid_w = int(width * frequency) + 2
        grid_h = int(height * frequency) + 2
        grid = np.random.rand(grid_h, grid_w)
        
        # Interpolate
        from scipy.ndimage import zoom
        layer = zoom(grid, (height / grid_h, width / grid_w), order=1)[:height, :width]
        
        noise_map += layer * amplitude
        amplitude *= 0.5
        frequency *= 2.0
    
    # Normalize to 0-1
    noise_map = (noise_map - noise_map.min()) / (noise_map.max() - noise_map.min() + 1e-8)
    
    return {
        "data": noise_map.tolist(),
        "width": width,
        "height": height
    }

@register("procedural.voronoi")
def voronoi_pattern(width: int, height: int, num_points: int = 50, seed: int = None) -> Dict[str, Any]:
    """Generate Voronoi cell pattern"""
    if seed is not None:
        np.random.seed(seed)
    
    # Random seed points
    points = np.random.rand(num_points, 2) * [width, height]
    
    # Create distance field
    xx, yy = np.meshgrid(np.arange(width), np.arange(height))
    coords = np.stack([xx, yy], axis=-1)
    
    # Find nearest point for each pixel
    distances = np.zeros((height, width))
    cell_ids = np.zeros((height, width), dtype=int)
    
    for i, point in enumerate(points):
        dist = np.sqrt(np.sum((coords - point) ** 2, axis=-1))
        if i == 0:
            distances = dist
            cell_ids = np.zeros_like(distances, dtype=int)
        else:
            mask = dist < distances
            distances[mask] = dist[mask]
            cell_ids[mask] = i
    
    # Normalize distances
    distances = distances / distances.max()
    
    return {
        "distance_field": distances.tolist(),
        "cell_ids": cell_ids.tolist(),
        "points": points.tolist(),
        "width": width,
        "height": height
    }

@register("procedural.fbm")
def fractal_brownian_motion(width: int, height: int, octaves: int = 6, lacunarity: float = 2.0, gain: float = 0.5, seed: int = None) -> Dict[str, Any]:
    """Generate fractal Brownian motion noise"""
    if seed is not None:
        np.random.seed(seed)
    
    result = np.zeros((height, width))
    amplitude = 1.0
    frequency = 1.0
    max_value = 0.0
    
    for _ in range(octaves):
        # Use scipy for smooth interpolation
        grid_size = max(2, int(min(width, height) / (16 * frequency)))
        grid = np.random.rand(grid_size, grid_size)
        
        from scipy.ndimage import zoom
        layer = zoom(grid, (height / grid_size, width / grid_size), order=3)[:height, :width]
        
        result += layer * amplitude
        max_value += amplitude
        amplitude *= gain
        frequency *= lacunarity
    
    result /= max_value
    
    return {
        "data": result.tolist(),
        "width": width,
        "height": height
    }

@register("procedural.terrain")
def generate_terrain(width: int, height: int, sea_level: float = 0.3, mountain_scale: float = 1.0, seed: int = None) -> Dict[str, Any]:
    """Generate terrain heightmap with erosion simulation"""
    if seed is not None:
        np.random.seed(seed)
    
    # Base terrain using FBM
    fbm_result = fractal_brownian_motion(width, height, octaves=8, seed=seed)
    heightmap = np.array(fbm_result["data"])
    
    # Apply mountain scaling
    heightmap = np.power(heightmap, 1.0 / mountain_scale)
    
    # Simple thermal erosion
    for _ in range(5):
        # Calculate slopes
        dx = np.roll(heightmap, 1, axis=1) - heightmap
        dy = np.roll(heightmap, 1, axis=0) - heightmap
        
        # Move material from steep slopes
        talus = 0.05
        heightmap += np.clip(dx, -talus, talus) * 0.1
        heightmap += np.clip(dy, -talus, talus) * 0.1
    
    # Normalize
    heightmap = (heightmap - heightmap.min()) / (heightmap.max() - heightmap.min())
    
    # Create biome mask
    biome = np.zeros_like(heightmap, dtype=int)
    biome[heightmap < sea_level] = 0  # Water
    biome[(heightmap >= sea_level) & (heightmap < 0.5)] = 1  # Plains
    biome[(heightmap >= 0.5) & (heightmap < 0.75)] = 2  # Hills
    biome[heightmap >= 0.75] = 3  # Mountains
    
    return {
        "heightmap": heightmap.tolist(),
        "biome_map": biome.tolist(),
        "width": width,
        "height": height,
        "biome_legend": ["water", "plains", "hills", "mountains"]
    }

@register("procedural.scatter_points")
def poisson_disc_scatter(width: int, height: int, min_distance: float = 10.0, seed: int = None) -> Dict[str, Any]:
    """Generate Poisson disc distributed points (even scatter)"""
    if seed is not None:
        np.random.seed(seed)
    
    # Bridson's algorithm
    cell_size = min_distance / np.sqrt(2)
    grid_w = int(np.ceil(width / cell_size))
    grid_h = int(np.ceil(height / cell_size))
    grid = -np.ones((grid_h, grid_w), dtype=int)
    
    points = []
    active = []
    
    # First point
    p0 = np.array([np.random.uniform(0, width), np.random.uniform(0, height)])
    points.append(p0)
    active.append(0)
    grid[int(p0[1] / cell_size), int(p0[0] / cell_size)] = 0
    
    k = 30  # Samples before rejection
    
    while active:
        idx = np.random.randint(len(active))
        point = points[active[idx]]
        
        found = False
        for _ in range(k):
            angle = np.random.uniform(0, 2 * np.pi)
            dist = np.random.uniform(min_distance, 2 * min_distance)
            new_point = point + np.array([np.cos(angle), np.sin(angle)]) * dist
            
            if 0 <= new_point[0] < width and 0 <= new_point[1] < height:
                gx, gy = int(new_point[0] / cell_size), int(new_point[1] / cell_size)
                
                # Check neighbors
                valid = True
                for dx in range(-2, 3):
                    for dy in range(-2, 3):
                        nx, ny = gx + dx, gy + dy
                        if 0 <= nx < grid_w and 0 <= ny < grid_h:
                            neighbor_idx = grid[ny, nx]
                            if neighbor_idx >= 0:
                                if np.linalg.norm(points[neighbor_idx] - new_point) < min_distance:
                                    valid = False
                                    break
                    if not valid:
                        break
                
                if valid:
                    points.append(new_point)
                    active.append(len(points) - 1)
                    grid[gy, gx] = len(points) - 1
                    found = True
                    break
        
        if not found:
            active.pop(idx)
    
    return {
        "points": [p.tolist() for p in points],
        "count": len(points),
        "width": width,
        "height": height
    }

@register("procedural.hexagonal_grid")
def hexagonal_grid(width: int, height: int, hex_size: float = 20.0) -> Dict[str, Any]:
    """Generate hexagonal grid coordinates"""
    points = []
    hex_width = hex_size * 2
    hex_height = hex_size * np.sqrt(3)
    
    row = 0
    y = 0
    while y < height:
        col = 0
        x = (row % 2) * (hex_width * 0.75)
        while x < width:
            points.append([x, y])
            x += hex_width * 1.5
            col += 1
        y += hex_height * 0.5
        row += 1
    
    return {
        "centers": points,
        "count": len(points),
        "hex_size": hex_size,
        "width": width,
        "height": height
    }
