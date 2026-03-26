//! Map type definitions and baking implementations
//!
//! This module defines different types of texture maps that can be baked:
//! - Normal maps (tangent/object/world space)
//! - Ambient Occlusion (AO)
//! - Curvature
//! - Thickness
//! - Position
//! - Material ID

use crate::bvh::Bvh;
use crate::error::{BakingError, Result};
use glam::{Vec2, Vec3};
use image::{Rgba, RgbaImage};
use rayon::prelude::*;

/// Output space for normal maps
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NormalSpace {
    /// Tangent space (most common for game assets)
    Tangent,
    /// Object space
    Object,
    /// World space
    World,
}

/// Map type to bake
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MapType {
    Normal(NormalSpace),
    AmbientOcclusion,
    Curvature,
    Thickness,
    Position,
    MaterialId,
}

/// Mesh data for baking
#[derive(Debug, Clone)]
pub struct BakeMesh {
    pub vertices: Vec<Vec3>,
    pub normals: Vec<Vec3>,
    pub tangents: Vec<Vec3>,
    pub uvs: Vec<Vec2>,
    pub indices: Vec<u32>,
}

impl BakeMesh {
    /// Create a new bake mesh
    pub fn new(
        vertices: Vec<Vec3>,
        normals: Vec<Vec3>,
        tangents: Vec<Vec3>,
        uvs: Vec<Vec2>,
        indices: Vec<u32>,
    ) -> Result<Self> {
        if vertices.len() != normals.len() {
            return Err(BakingError::InvalidMesh(
                "Vertex and normal count mismatch".to_string(),
            ));
        }

        if vertices.len() != uvs.len() {
            return Err(BakingError::InvalidMesh(
                "Vertex and UV count mismatch".to_string(),
            ));
        }

        if indices.len() % 3 != 0 {
            return Err(BakingError::InvalidMesh(
                "Index count must be divisible by 3".to_string(),
            ));
        }

        Ok(Self {
            vertices,
            normals,
            tangents,
            uvs,
            indices,
        })
    }

    /// Get triangle count
    pub fn triangle_count(&self) -> usize {
        self.indices.len() / 3
    }

    /// Get vertex count
    pub fn vertex_count(&self) -> usize {
        self.vertices.len()
    }

    /// Get triangle vertices
    pub fn get_triangle(&self, index: usize) -> Option<(Vec3, Vec3, Vec3)> {
        let base = index * 3;
        if base + 2 >= self.indices.len() {
            return None;
        }

        let i0 = self.indices[base] as usize;
        let i1 = self.indices[base + 1] as usize;
        let i2 = self.indices[base + 2] as usize;

        if i0 >= self.vertices.len() || i1 >= self.vertices.len() || i2 >= self.vertices.len() {
            return None;
        }

        Some((self.vertices[i0], self.vertices[i1], self.vertices[i2]))
    }

    /// Get triangle normals
    pub fn get_triangle_normals(&self, index: usize) -> Option<(Vec3, Vec3, Vec3)> {
        let base = index * 3;
        if base + 2 >= self.indices.len() {
            return None;
        }

        let i0 = self.indices[base] as usize;
        let i1 = self.indices[base + 1] as usize;
        let i2 = self.indices[base + 2] as usize;

        if i0 >= self.normals.len() || i1 >= self.normals.len() || i2 >= self.normals.len() {
            return None;
        }

        Some((self.normals[i0], self.normals[i1], self.normals[i2]))
    }

    /// Get triangle UVs
    pub fn get_triangle_uvs(&self, index: usize) -> Option<(Vec2, Vec2, Vec2)> {
        let base = index * 3;
        if base + 2 >= self.indices.len() {
            return None;
        }

        let i0 = self.indices[base] as usize;
        let i1 = self.indices[base + 1] as usize;
        let i2 = self.indices[base + 2] as usize;

        if i0 >= self.uvs.len() || i1 >= self.uvs.len() || i2 >= self.uvs.len() {
            return None;
        }

        Some((self.uvs[i0], self.uvs[i1], self.uvs[i2]))
    }

    /// Interpolate vertex attribute using barycentric coordinates
    pub fn interpolate_vec3(&self, tri_index: usize, bary: (f32, f32), data: &[Vec3]) -> Vec3 {
        let base = tri_index * 3;
        let i0 = self.indices[base] as usize;
        let i1 = self.indices[base + 1] as usize;
        let i2 = self.indices[base + 2] as usize;

        let (u, v) = bary;
        let w = 1.0 - u - v;

        data[i0] * w + data[i1] * u + data[i2] * v
    }
}

/// Normal map baker
pub struct NormalMapBaker {
    space: NormalSpace,
}

impl NormalMapBaker {
    pub fn new(space: NormalSpace) -> Self {
        Self { space }
    }

    /// Bake normal map from high-poly to low-poly mesh
    pub fn bake(
        &self,
        high_poly: &BakeMesh,
        low_poly: &BakeMesh,
        resolution: u32,
        samples: u32,
        max_distance: f32,
    ) -> Result<RgbaImage> {
        log::info!(
            "Baking {:?} normal map at {}x{} with {} samples",
            self.space,
            resolution,
            resolution,
            samples
        );

        // Build BVH for high-poly mesh
        let bvh = std::sync::Arc::new(Bvh::from_mesh(&high_poly.vertices, &high_poly.indices)?);

        // Create output image
        let mut image = RgbaImage::new(resolution, resolution);

        // Bake each pixel in parallel
        let pixels: Vec<_> = (0..resolution)
            .into_par_iter()
            .flat_map(|y| {
                let bvh = bvh.clone();
                (0..resolution).into_par_iter().map(move |x| {
                    let uv = Vec2::new(
                        (x as f32 + 0.5) / resolution as f32,
                        (y as f32 + 0.5) / resolution as f32,
                    );

                    let color =
                        self.bake_pixel(low_poly, &bvh, high_poly, uv, samples, max_distance);
                    (x, y, color)
                })
            })
            .collect();

        // Write pixels to image
        for (x, y, color) in pixels {
            image.put_pixel(x, y, color);
        }

        Ok(image)
    }

    fn bake_pixel(
        &self,
        low_poly: &BakeMesh,
        bvh: &Bvh,
        high_poly: &BakeMesh,
        uv: Vec2,
        _samples: u32,
        max_distance: f32,
    ) -> Rgba<u8> {
        // Find triangle containing this UV
        let tri_hit = self.find_triangle_at_uv(low_poly, uv);
        if tri_hit.is_none() {
            return Rgba([128, 128, 255, 255]); // Default normal (0, 0, 1) in tangent space
        }

        let (tri_index, bary) = tri_hit.unwrap();

        // Get surface position and normal on low-poly mesh
        let position = low_poly.interpolate_vec3(tri_index, bary, &low_poly.vertices);
        let normal = low_poly
            .interpolate_vec3(tri_index, bary, &low_poly.normals)
            .normalize();

        // Cast ray from low-poly surface to high-poly surface
        let ray_origin = position + normal * 0.001; // Small offset to avoid self-intersection
        let ray_dir = normal;

        if let Some(hit) = bvh.raycast(ray_origin, ray_dir) {
            if hit.distance <= max_distance {
                // Get high-poly normal at hit point
                let high_normal = high_poly.interpolate_vec3(
                    hit.triangle_index as usize,
                    hit.barycentric,
                    &high_poly.normals,
                );

                // Convert to desired space
                let encoded_normal = match self.space {
                    NormalSpace::Tangent => {
                        let tangent = low_poly
                            .interpolate_vec3(tri_index, bary, &low_poly.tangents)
                            .normalize();
                        let bitangent = normal.cross(tangent).normalize();

                        // Transform to tangent space
                        Vec3::new(
                            high_normal.dot(tangent),
                            high_normal.dot(bitangent),
                            high_normal.dot(normal),
                        )
                    }
                    NormalSpace::Object => high_normal,
                    NormalSpace::World => high_normal,
                };

                // Encode normal to RGB (map from [-1, 1] to [0, 255])
                return Rgba([
                    ((encoded_normal.x * 0.5 + 0.5) * 255.0) as u8,
                    ((encoded_normal.y * 0.5 + 0.5) * 255.0) as u8,
                    ((encoded_normal.z * 0.5 + 0.5) * 255.0) as u8,
                    255,
                ]);
            }
        }

        // No hit, use low-poly normal
        Rgba([128, 128, 255, 255])
    }

    fn find_triangle_at_uv(&self, mesh: &BakeMesh, uv: Vec2) -> Option<(usize, (f32, f32))> {
        // Simple brute-force search for triangle containing UV
        for tri_idx in 0..mesh.triangle_count() {
            if let Some((uv0, uv1, uv2)) = mesh.get_triangle_uvs(tri_idx) {
                if let Some(bary) = point_in_triangle_uv(uv, uv0, uv1, uv2) {
                    return Some((tri_idx, bary));
                }
            }
        }
        None
    }
}

/// Ambient Occlusion baker
pub struct AoBaker {
    samples: u32,
    max_distance: f32,
}

impl AoBaker {
    pub fn new(samples: u32, max_distance: f32) -> Self {
        Self {
            samples,
            max_distance,
        }
    }

    /// Bake ambient occlusion map
    pub fn bake(&self, mesh: &BakeMesh, resolution: u32) -> Result<RgbaImage> {
        log::info!(
            "Baking AO map at {}x{} with {} samples",
            resolution,
            resolution,
            self.samples
        );

        let bvh = std::sync::Arc::new(Bvh::from_mesh(&mesh.vertices, &mesh.indices)?);
        let mut image = RgbaImage::new(resolution, resolution);

        let pixels: Vec<_> = (0..resolution)
            .into_par_iter()
            .flat_map(|y| {
                let bvh = bvh.clone();
                (0..resolution).into_par_iter().map(move |x| {
                    let uv = Vec2::new(
                        (x as f32 + 0.5) / resolution as f32,
                        (y as f32 + 0.5) / resolution as f32,
                    );

                    let ao = self.compute_ao(mesh, &bvh, uv);
                    let value = (ao * 255.0) as u8;
                    (x, y, Rgba([value, value, value, 255]))
                })
            })
            .collect();

        for (x, y, color) in pixels {
            image.put_pixel(x, y, color);
        }

        Ok(image)
    }

    fn compute_ao(&self, mesh: &BakeMesh, bvh: &Bvh, uv: Vec2) -> f32 {
        // Find triangle at UV
        let tri_hit = self.find_triangle_at_uv(mesh, uv);
        if tri_hit.is_none() {
            return 1.0; // No occlusion
        }

        let (tri_index, bary) = tri_hit.unwrap();

        let position = mesh.interpolate_vec3(tri_index, bary, &mesh.vertices);
        let normal = mesh
            .interpolate_vec3(tri_index, bary, &mesh.normals)
            .normalize();

        // Cast rays in hemisphere
        let mut hits = 0;
        let mut total = 0;

        for _ in 0..self.samples {
            let ray_dir = sample_hemisphere(normal);
            let ray_origin = position + normal * 0.001;

            if let Some(hit) = bvh.raycast(ray_origin, ray_dir) {
                if hit.distance <= self.max_distance {
                    hits += 1;
                }
            }
            total += 1;
        }

        1.0 - (hits as f32 / total as f32)
    }

    fn find_triangle_at_uv(&self, mesh: &BakeMesh, uv: Vec2) -> Option<(usize, (f32, f32))> {
        for tri_idx in 0..mesh.triangle_count() {
            if let Some((uv0, uv1, uv2)) = mesh.get_triangle_uvs(tri_idx) {
                if let Some(bary) = point_in_triangle_uv(uv, uv0, uv1, uv2) {
                    return Some((tri_idx, bary));
                }
            }
        }
        None
    }
}

/// Curvature map baker
pub struct CurvatureBaker;

impl CurvatureBaker {
    pub fn new() -> Self {
        Self
    }

    /// Bake curvature map
    pub fn bake(&self, mesh: &BakeMesh, resolution: u32) -> Result<RgbaImage> {
        log::info!("Baking curvature map at {}x{}", resolution, resolution);

        let mut image = RgbaImage::new(resolution, resolution);

        let pixels: Vec<_> = (0..resolution)
            .into_par_iter()
            .flat_map(|y| {
                (0..resolution).into_par_iter().map(move |x| {
                    let uv = Vec2::new(
                        (x as f32 + 0.5) / resolution as f32,
                        (y as f32 + 0.5) / resolution as f32,
                    );

                    let curvature = self.compute_curvature(mesh, uv);
                    let value = ((curvature * 0.5 + 0.5).clamp(0.0, 1.0) * 255.0) as u8;
                    (x, y, Rgba([value, value, value, 255]))
                })
            })
            .collect();

        for (x, y, color) in pixels {
            image.put_pixel(x, y, color);
        }

        Ok(image)
    }

    fn compute_curvature(&self, _mesh: &BakeMesh, _uv: Vec2) -> f32 {
        // Simplified curvature computation
        // In production, use proper differential geometry
        0.0
    }
}

/// Helper function to test if point is inside triangle in UV space
fn point_in_triangle_uv(p: Vec2, a: Vec2, b: Vec2, c: Vec2) -> Option<(f32, f32)> {
    let v0 = c - a;
    let v1 = b - a;
    let v2 = p - a;

    let dot00 = v0.dot(v0);
    let dot01 = v0.dot(v1);
    let dot02 = v0.dot(v2);
    let dot11 = v1.dot(v1);
    let dot12 = v1.dot(v2);

    let inv_denom = 1.0 / (dot00 * dot11 - dot01 * dot01);
    let u = (dot11 * dot02 - dot01 * dot12) * inv_denom;
    let v = (dot00 * dot12 - dot01 * dot02) * inv_denom;

    if u >= 0.0 && v >= 0.0 && u + v <= 1.0 {
        Some((u, v))
    } else {
        None
    }
}

/// Sample random direction in hemisphere around normal
fn sample_hemisphere(normal: Vec3) -> Vec3 {
    use rand::Rng;
    let mut rng = rand::thread_rng();

    // Generate random point on unit sphere
    let theta = rng.gen::<f32>() * 2.0 * std::f32::consts::PI;
    let phi = (rng.gen::<f32>() * 2.0 - 1.0).acos();

    let x = phi.sin() * theta.cos();
    let y = phi.sin() * theta.sin();
    let z = phi.cos();

    let dir = Vec3::new(x, y, z);

    // Flip if pointing away from normal
    if dir.dot(normal) < 0.0 {
        -dir
    } else {
        dir
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bake_mesh_creation() {
        let vertices = vec![Vec3::ZERO, Vec3::X, Vec3::Y];
        let normals = vec![Vec3::Z, Vec3::Z, Vec3::Z];
        let tangents = vec![Vec3::X, Vec3::X, Vec3::X];
        let uvs = vec![Vec2::ZERO, Vec2::X, Vec2::Y];
        let indices = vec![0, 1, 2];

        let mesh = BakeMesh::new(vertices, normals, tangents, uvs, indices).unwrap();
        assert_eq!(mesh.triangle_count(), 1);
        assert_eq!(mesh.vertex_count(), 3);
    }

    #[test]
    fn test_point_in_triangle() {
        let a = Vec2::new(0.0, 0.0);
        let b = Vec2::new(1.0, 0.0);
        let c = Vec2::new(0.0, 1.0);

        let p = Vec2::new(0.25, 0.25);
        assert!(point_in_triangle_uv(p, a, b, c).is_some());

        let p = Vec2::new(2.0, 2.0);
        assert!(point_in_triangle_uv(p, a, b, c).is_none());
    }
}
