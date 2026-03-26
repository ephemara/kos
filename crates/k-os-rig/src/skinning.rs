// K-RIG Geodesic Skinning
// Heat diffusion-based auto-skinning using KD-Tree for fast lookups

use glam::Vec3;
use kiddo::{KdTree, SquaredEuclidean};
use ndarray::Array3;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

/// Skin weights result - 4 bone influences per vertex
#[derive(Serialize, Deserialize, Clone)]
pub struct SkinWeights {
    pub vertex_count: usize,
    /// Bone indices for each vertex (4 per vertex, flattened)
    pub bone_indices: Vec<u16>,
    /// Bone weights for each vertex (4 per vertex, flattened)
    pub bone_weights: Vec<f32>,
}

/// Voxel grid for geodesic computation
struct VoxelGrid {
    resolution: usize,
    bounds_min: Vec3,
    _bounds_max: Vec3,
    voxel_size: f32,
    /// 1 = solid, 0 = empty
    data: Array3<u8>,
}

impl VoxelGrid {
    fn new(resolution: usize, bounds_min: Vec3, bounds_max: Vec3) -> Self {
        let size = bounds_max - bounds_min;
        let max_dim = size.x.max(size.y).max(size.z);
        let voxel_size = max_dim / resolution as f32;

        Self {
            resolution,
            bounds_min,
            _bounds_max: bounds_max,
            voxel_size,
            data: Array3::zeros((resolution, resolution, resolution)),
        }
    }

    fn world_to_voxel(&self, pos: Vec3) -> (usize, usize, usize) {
        let rel = pos - self.bounds_min;
        let x = ((rel.x / self.voxel_size) as usize).min(self.resolution - 1);
        let y = ((rel.y / self.voxel_size) as usize).min(self.resolution - 1);
        let z = ((rel.z / self.voxel_size) as usize).min(self.resolution - 1);
        (x, y, z)
    }

    fn voxel_to_world(&self, x: usize, y: usize, z: usize) -> Vec3 {
        self.bounds_min
            + Vec3::new(
                (x as f32 + 0.5) * self.voxel_size,
                (y as f32 + 0.5) * self.voxel_size,
                (z as f32 + 0.5) * self.voxel_size,
            )
    }
}

/// Compute geodesic skin weights for all vertices
///
/// This is the core auto-skinning algorithm:
/// 1. Voxelize the mesh
/// 2. For each bone, run heat diffusion from bone position
/// 3. Sample heat values at each vertex position
/// 4. Normalize weights per vertex (top 4 influences)
pub fn compute_geodesic_weights(
    vertices: &[[f32; 3]],
    triangles: &[[u32; 3]],
    bone_positions: &[[f32; 3]],
    resolution: u32,
) -> SkinWeights {
    let resolution = resolution as usize;

    // Calculate bounds
    let mut min = Vec3::splat(f32::MAX);
    let mut max = Vec3::splat(f32::MIN);
    for v in vertices {
        let p = Vec3::from(*v);
        min = min.min(p);
        max = max.max(p);
    }

    // Expand bounds slightly
    let padding = (max - min).length() * 0.05;
    min -= Vec3::splat(padding);
    max += Vec3::splat(padding);

    log::info!("K-RIG: Voxelizing mesh at {}³ resolution", resolution);

    // Step 1: Voxelize mesh
    let mut grid = VoxelGrid::new(resolution, min, max);
    voxelize_mesh(&mut grid, vertices, triangles);

    // Step 2: Compute heat from each bone (parallel)
    log::info!(
        "K-RIG: Computing geodesic weights for {} bones",
        bone_positions.len()
    );

    let bone_heat_maps: Vec<Array3<f32>> = bone_positions
        .par_iter()
        .enumerate()
        .map(|(i, pos)| {
            let bone_pos = Vec3::from(*pos);
            let heat = run_heat_diffusion(&grid, bone_pos, 50);
            log::debug!("K-RIG: Bone {} heat computed", i);
            heat
        })
        .collect();

    // Step 3: Sample weights at each vertex
    log::info!("K-RIG: Transferring weights to {} vertices", vertices.len());

    let weights: Vec<([u16; 4], [f32; 4])> = vertices
        .par_iter()
        .map(|v| {
            let pos = Vec3::from(*v);
            sample_weights_at_vertex(&grid, pos, &bone_heat_maps)
        })
        .collect();

    // Flatten to output format
    let mut bone_indices = Vec::with_capacity(vertices.len() * 4);
    let mut bone_weights = Vec::with_capacity(vertices.len() * 4);

    for (indices, w) in weights {
        bone_indices.extend_from_slice(&indices);
        bone_weights.extend_from_slice(&w);
    }

    log::info!("K-RIG: Geodesic skinning complete");

    SkinWeights {
        vertex_count: vertices.len(),
        bone_indices,
        bone_weights,
    }
}

/// Voxelize mesh using triangle rasterization
fn voxelize_mesh(grid: &mut VoxelGrid, vertices: &[[f32; 3]], triangles: &[[u32; 3]]) {
    for tri in triangles {
        let v0 = Vec3::from(vertices[tri[0] as usize]);
        let v1 = Vec3::from(vertices[tri[1] as usize]);
        let v2 = Vec3::from(vertices[tri[2] as usize]);

        // Get triangle bounding box in voxel space
        let tri_min = v0.min(v1).min(v2);
        let tri_max = v0.max(v1).max(v2);

        let (vmin_x, vmin_y, vmin_z) = grid.world_to_voxel(tri_min);
        let (vmax_x, vmax_y, vmax_z) = grid.world_to_voxel(tri_max);

        // Rasterize triangle into voxels
        for z in vmin_z..=vmax_z {
            for y in vmin_y..=vmax_y {
                for x in vmin_x..=vmax_x {
                    let center = grid.voxel_to_world(x, y, z);
                    if point_near_triangle(center, v0, v1, v2, grid.voxel_size * 1.5) {
                        grid.data[[x, y, z]] = 1;
                    }
                }
            }
        }
    }
}

/// Check if a point is near a triangle surface
fn point_near_triangle(p: Vec3, v0: Vec3, v1: Vec3, v2: Vec3, threshold: f32) -> bool {
    let edge1 = v1 - v0;
    let edge2 = v2 - v0;
    let normal = edge1.cross(edge2);

    if normal.length_squared() < 0.0001 {
        return false;
    }

    let n = normal.normalize();
    let dist = (p - v0).dot(n).abs();

    dist < threshold
}

/// Run heat diffusion from a seed point
fn run_heat_diffusion(grid: &VoxelGrid, seed: Vec3, iterations: usize) -> Array3<f32> {
    let res = grid.resolution;
    let mut heat = Array3::<f32>::zeros((res, res, res));

    // Initialize seed
    let (sx, sy, sz) = grid.world_to_voxel(seed);
    heat[[sx, sy, sz]] = 1.0;

    // Diffusion iterations
    for _ in 0..iterations {
        let old_heat = heat.clone();

        for x in 0..res {
            for y in 0..res {
                for z in 0..res {
                    // Skip empty voxels
                    if grid.data[[x, y, z]] == 0 {
                        heat[[x, y, z]] = 0.0;
                        continue;
                    }

                    // Preserve seed heat
                    if x == sx && y == sy && z == sz {
                        heat[[x, y, z]] = 1.0;
                        continue;
                    }

                    // Average neighbors (6-connected)
                    let mut sum = 0.0;
                    let mut count = 0.0;

                    let neighbors = [
                        (x.wrapping_sub(1), y, z),
                        (x + 1, y, z),
                        (x, y.wrapping_sub(1), z),
                        (x, y + 1, z),
                        (x, y, z.wrapping_sub(1)),
                        (x, y, z + 1),
                    ];

                    for (nx, ny, nz) in neighbors {
                        if nx < res && ny < res && nz < res {
                            if grid.data[[nx, ny, nz]] > 0 {
                                sum += old_heat[[nx, ny, nz]];
                                count += 1.0;
                            }
                        }
                    }

                    if count > 0.0 {
                        let diffuse_rate = 0.2;
                        heat[[x, y, z]] = old_heat[[x, y, z]] * (1.0 - diffuse_rate)
                            + (sum / count) * diffuse_rate;
                    }
                }
            }
        }
    }

    heat
}

/// Sample bone weights at a vertex position
fn sample_weights_at_vertex(
    grid: &VoxelGrid,
    pos: Vec3,
    bone_heat_maps: &[Array3<f32>],
) -> ([u16; 4], [f32; 4]) {
    let (vx, vy, vz) = grid.world_to_voxel(pos);

    // Sample heat from all bones
    let mut influences: Vec<(u16, f32)> = bone_heat_maps
        .iter()
        .enumerate()
        .map(|(i, heat)| (i as u16, heat[[vx, vy, vz]]))
        .filter(|(_, w)| *w > 0.001)
        .collect();

    // Sort by weight descending
    influences.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    // Take top 4
    let mut indices = [0u16; 4];
    let mut weights = [0.0f32; 4];

    let total: f32 = influences.iter().take(4).map(|(_, w)| w).sum();

    for (i, (bone_idx, w)) in influences.iter().take(4).enumerate() {
        indices[i] = *bone_idx;
        weights[i] = if total > 0.0 { w / total } else { 0.0 };
    }

    (indices, weights)
}

/// Fast auto-skinning using KD-Tree (for simple distance-based weights)
/// Use this for preview, use geodesic for production
pub fn compute_distance_weights(vertices: &[[f32; 3]], bone_positions: &[[f32; 3]]) -> SkinWeights {
    // Build KD-Tree from bone positions
    let mut tree: KdTree<f32, 3> = KdTree::new();
    for (i, pos) in bone_positions.iter().enumerate() {
        tree.add(pos, i as u64);
    }

    // Query nearest 4 bones for each vertex
    let weights: Vec<([u16; 4], [f32; 4])> = vertices
        .par_iter()
        .map(|v| {
            let nearest = tree.nearest_n::<SquaredEuclidean>(v, 4);

            let mut indices = [0u16; 4];
            let mut raw_weights = [0.0f32; 4];

            for (i, neighbor) in nearest.iter().enumerate() {
                indices[i] = neighbor.item as u16;
                // Inverse square distance falloff
                let dist_sq = neighbor.distance.max(0.0001);
                raw_weights[i] = 1.0 / dist_sq;
            }

            // Normalize
            let total: f32 = raw_weights.iter().sum();
            for w in &mut raw_weights {
                *w /= total;
            }

            (indices, raw_weights)
        })
        .collect();

    let mut bone_indices = Vec::with_capacity(vertices.len() * 4);
    let mut bone_weights = Vec::with_capacity(vertices.len() * 4);

    for (indices, w) in weights {
        bone_indices.extend_from_slice(&indices);
        bone_weights.extend_from_slice(&w);
    }

    SkinWeights {
        vertex_count: vertices.len(),
        bone_indices,
        bone_weights,
    }
}
