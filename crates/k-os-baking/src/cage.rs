//! Cage-based baking for better control over ray casting
//!
//! A cage mesh is an inflated version of the low-poly mesh that controls
//! the direction and maximum distance of rays during baking.

use crate::error::{BakingError, Result};
use crate::map_types::BakeMesh;
use glam::Vec3;

/// Cage mesh for controlled baking
#[derive(Debug, Clone)]
pub struct CageMesh {
    pub vertices: Vec<Vec3>,
    pub indices: Vec<u32>,
}

impl CageMesh {
    /// Create a new cage mesh
    pub fn new(vertices: Vec<Vec3>, indices: Vec<u32>) -> Result<Self> {
        if indices.len() % 3 != 0 {
            return Err(BakingError::InvalidMesh(
                "Cage index count must be divisible by 3".to_string(),
            ));
        }

        Ok(Self { vertices, indices })
    }

    /// Generate a cage mesh by extruding the low-poly mesh along normals
    pub fn from_mesh(mesh: &BakeMesh, extrusion: f32) -> Result<Self> {
        if extrusion <= 0.0 {
            return Err(BakingError::InvalidSettings(
                "Cage extrusion must be positive".to_string(),
            ));
        }

        let vertices: Vec<Vec3> = mesh
            .vertices
            .iter()
            .zip(mesh.normals.iter())
            .map(|(pos, normal)| *pos + *normal * extrusion)
            .collect();

        Ok(Self {
            vertices,
            indices: mesh.indices.clone(),
        })
    }

    /// Generate a cage with adaptive extrusion based on local geometry
    pub fn from_mesh_adaptive(
        mesh: &BakeMesh,
        min_extrusion: f32,
        max_extrusion: f32,
    ) -> Result<Self> {
        if min_extrusion <= 0.0 || max_extrusion <= min_extrusion {
            return Err(BakingError::InvalidSettings(
                "Invalid cage extrusion range".to_string(),
            ));
        }

        // Compute local curvature or density to determine extrusion amount
        let mut extrusions = vec![min_extrusion; mesh.vertices.len()];

        // Simple heuristic: use average edge length as indicator
        for i in 0..mesh.indices.len() / 3 {
            let i0 = mesh.indices[i * 3] as usize;
            let i1 = mesh.indices[i * 3 + 1] as usize;
            let i2 = mesh.indices[i * 3 + 2] as usize;

            let v0 = mesh.vertices[i0];
            let v1 = mesh.vertices[i1];
            let v2 = mesh.vertices[i2];

            let edge_len = ((v1 - v0).length() + (v2 - v1).length() + (v0 - v2).length()) / 3.0;
            let extrusion = (edge_len * 0.5).clamp(min_extrusion, max_extrusion);

            extrusions[i0] = extrusions[i0].max(extrusion);
            extrusions[i1] = extrusions[i1].max(extrusion);
            extrusions[i2] = extrusions[i2].max(extrusion);
        }

        let vertices: Vec<Vec3> = mesh
            .vertices
            .iter()
            .zip(mesh.normals.iter())
            .zip(extrusions.iter())
            .map(|((pos, normal), extrusion)| *pos + *normal * extrusion)
            .collect();

        Ok(Self {
            vertices,
            indices: mesh.indices.clone(),
        })
    }

    /// Get the ray direction from low-poly surface to cage surface
    pub fn get_ray_direction(
        &self,
        low_poly_pos: Vec3,
        low_poly_normal: Vec3,
        vertex_index: usize,
    ) -> Vec3 {
        if vertex_index >= self.vertices.len() {
            return low_poly_normal; // Fallback to normal
        }

        let cage_pos = self.vertices[vertex_index];
        let direction = (cage_pos - low_poly_pos).normalize();

        // Ensure direction is in the same hemisphere as the normal
        if direction.dot(low_poly_normal) > 0.0 {
            direction
        } else {
            low_poly_normal
        }
    }

    /// Get the maximum ray distance from low-poly to cage
    pub fn get_max_distance(&self, low_poly_pos: Vec3, vertex_index: usize) -> f32 {
        if vertex_index >= self.vertices.len() {
            return 1.0; // Default distance
        }

        (self.vertices[vertex_index] - low_poly_pos).length()
    }

    /// Convert cage mesh to BakeMesh format
    pub fn to_bake_mesh(&self) -> BakeMesh {
        // Create default normals and tangents
        let normals = vec![Vec3::Z; self.vertices.len()];
        let tangents = vec![Vec3::X; self.vertices.len()];
        let uvs = vec![glam::Vec2::ZERO; self.vertices.len()];

        BakeMesh {
            vertices: self.vertices.clone(),
            normals,
            tangents,
            uvs,
            indices: self.indices.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use glam::Vec2;

    #[test]
    fn test_cage_from_mesh() {
        let vertices = vec![Vec3::ZERO, Vec3::X, Vec3::Y];
        let normals = vec![Vec3::Z, Vec3::Z, Vec3::Z];
        let tangents = vec![Vec3::X, Vec3::X, Vec3::X];
        let uvs = vec![Vec2::ZERO, Vec2::X, Vec2::Y];
        let indices = vec![0, 1, 2];

        let mesh = BakeMesh::new(vertices, normals, tangents, uvs, indices).unwrap();
        let cage = CageMesh::from_mesh(&mesh, 0.5).unwrap();

        assert_eq!(cage.vertices.len(), 3);
        assert_eq!(cage.indices.len(), 3);

        // Check that vertices are extruded along normals
        assert_eq!(cage.vertices[0], Vec3::new(0.0, 0.0, 0.5));
        assert_eq!(cage.vertices[1], Vec3::new(1.0, 0.0, 0.5));
        assert_eq!(cage.vertices[2], Vec3::new(0.0, 1.0, 0.5));
    }

    #[test]
    fn test_cage_adaptive() {
        let vertices = vec![Vec3::ZERO, Vec3::X, Vec3::Y];
        let normals = vec![Vec3::Z, Vec3::Z, Vec3::Z];
        let tangents = vec![Vec3::X, Vec3::X, Vec3::X];
        let uvs = vec![Vec2::ZERO, Vec2::X, Vec2::Y];
        let indices = vec![0, 1, 2];

        let mesh = BakeMesh::new(vertices, normals, tangents, uvs, indices).unwrap();
        let cage = CageMesh::from_mesh_adaptive(&mesh, 0.1, 1.0).unwrap();

        assert_eq!(cage.vertices.len(), 3);
        assert!(cage.vertices[0].z >= 0.1 && cage.vertices[0].z <= 1.0);
    }

    #[test]
    fn test_ray_direction() {
        let vertices = vec![Vec3::new(0.0, 0.0, 1.0)];
        let indices = vec![0, 0, 0]; // Valid triangle (degenerate but valid count)
        let cage = CageMesh::new(vertices, indices).unwrap();

        let direction = cage.get_ray_direction(Vec3::ZERO, Vec3::Z, 0);
        assert!((direction - Vec3::Z).length() < 0.01);
    }
}
