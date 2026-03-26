//! Core mesh data structures

use glam::{Vec2, Vec3, Vec4};
use serde::{Deserialize, Serialize};

use crate::{MeshError, Result};

/// A vertex in 3D space
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Vertex {
    pub position: Vec3,
}

impl Vertex {
    pub fn new(position: Vec3) -> Self {
        Self { position }
    }
}

/// Axis-aligned bounding box
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Bounds {
    pub min: Vec3,
    pub max: Vec3,
}

impl Bounds {
    pub fn new(min: Vec3, max: Vec3) -> Self {
        Self { min, max }
    }

    pub fn center(&self) -> Vec3 {
        (self.min + self.max) * 0.5
    }

    pub fn size(&self) -> Vec3 {
        self.max - self.min
    }

    pub fn contains(&self, point: Vec3) -> bool {
        point.x >= self.min.x
            && point.x <= self.max.x
            && point.y >= self.min.y
            && point.y <= self.max.y
            && point.z >= self.min.z
            && point.z <= self.max.z
    }
}

/// Triangle mesh with optional attributes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mesh {
    /// Vertex positions
    pub vertices: Vec<Vec3>,

    /// Triangle indices (3 per triangle)
    pub indices: Vec<u32>,

    /// Per-vertex normals (optional)
    pub normals: Option<Vec<Vec3>>,

    /// Per-vertex UV coordinates (optional)
    pub uvs: Option<Vec<Vec2>>,

    /// Per-vertex colors (optional)
    pub colors: Option<Vec<Vec4>>,
}

impl Mesh {
    /// Create a new empty mesh
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
            indices: Vec::new(),
            normals: None,
            uvs: None,
            colors: None,
        }
    }

    /// Create a mesh from vertices and indices
    pub fn from_vertices_indices(vertices: Vec<Vec3>, indices: Vec<u32>) -> Self {
        Self {
            vertices,
            indices,
            normals: None,
            uvs: None,
            colors: None,
        }
    }

    /// Get the number of vertices
    pub fn vertex_count(&self) -> usize {
        self.vertices.len()
    }

    /// Get the number of triangles
    pub fn triangle_count(&self) -> usize {
        self.indices.len() / 3
    }

    /// Get the number of edges (approximate for triangle mesh)
    pub fn edge_count(&self) -> usize {
        // Euler's formula: E = V + F - 2 (for closed manifold)
        // For triangle mesh: E ≈ 3F/2
        self.triangle_count() * 3 / 2
    }

    /// Check if the mesh is empty
    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty() || self.indices.is_empty()
    }

    /// Validate mesh integrity
    pub fn validate(&self) -> Result<()> {
        if self.is_empty() {
            return Err(MeshError::EmptyMesh);
        }

        // Check indices are valid
        for &idx in &self.indices {
            if idx as usize >= self.vertices.len() {
                return Err(MeshError::InvalidIndices(format!(
                    "Index {} out of bounds (vertex count: {})",
                    idx,
                    self.vertices.len()
                )));
            }
        }

        // Check triangle count
        if self.indices.len() % 3 != 0 {
            return Err(MeshError::InvalidIndices(format!(
                "Index count {} is not divisible by 3",
                self.indices.len()
            )));
        }

        // Check optional attributes match vertex count
        if let Some(ref normals) = self.normals {
            if normals.len() != self.vertices.len() {
                return Err(MeshError::InvalidMesh(format!(
                    "Normal count {} does not match vertex count {}",
                    normals.len(),
                    self.vertices.len()
                )));
            }
        }

        if let Some(ref uvs) = self.uvs {
            if uvs.len() != self.vertices.len() {
                return Err(MeshError::InvalidMesh(format!(
                    "UV count {} does not match vertex count {}",
                    uvs.len(),
                    self.vertices.len()
                )));
            }
        }

        if let Some(ref colors) = self.colors {
            if colors.len() != self.vertices.len() {
                return Err(MeshError::InvalidMesh(format!(
                    "Color count {} does not match vertex count {}",
                    colors.len(),
                    self.vertices.len()
                )));
            }
        }

        Ok(())
    }

    /// Calculate axis-aligned bounding box
    pub fn bounds(&self) -> Bounds {
        if self.vertices.is_empty() {
            return Bounds::new(Vec3::ZERO, Vec3::ZERO);
        }

        let mut min = self.vertices[0];
        let mut max = self.vertices[0];

        for &v in &self.vertices {
            min = min.min(v);
            max = max.max(v);
        }

        Bounds::new(min, max)
    }

    /// Calculate mesh center
    pub fn center(&self) -> Vec3 {
        if self.vertices.is_empty() {
            return Vec3::ZERO;
        }

        let sum: Vec3 = self.vertices.iter().sum();
        sum / self.vertices.len() as f32
    }

    /// Get a triangle by index
    pub fn get_triangle(&self, index: usize) -> Option<[Vec3; 3]> {
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

        Some([self.vertices[i0], self.vertices[i1], self.vertices[i2]])
    }

    /// Calculate face normal for a triangle
    pub fn triangle_normal(&self, index: usize) -> Option<Vec3> {
        let tri = self.get_triangle(index)?;
        let edge1 = tri[1] - tri[0];
        let edge2 = tri[2] - tri[0];
        let normal = edge1.cross(edge2);

        if normal.length_squared() > 1e-10 {
            Some(normal.normalize())
        } else {
            None
        }
    }

    /// Calculate triangle area
    pub fn triangle_area(&self, index: usize) -> Option<f32> {
        let tri = self.get_triangle(index)?;
        let edge1 = tri[1] - tri[0];
        let edge2 = tri[2] - tri[0];
        Some(edge1.cross(edge2).length() * 0.5)
    }

    /// Calculate total surface area
    pub fn surface_area(&self) -> f32 {
        (0..self.triangle_count())
            .filter_map(|i| self.triangle_area(i))
            .sum()
    }

    /// Compute smooth vertex normals
    pub fn compute_normals(&mut self) {
        let mut normals = vec![Vec3::ZERO; self.vertices.len()];

        // Accumulate face normals
        for tri_idx in 0..self.triangle_count() {
            if let Some(normal) = self.triangle_normal(tri_idx) {
                let base = tri_idx * 3;
                let i0 = self.indices[base] as usize;
                let i1 = self.indices[base + 1] as usize;
                let i2 = self.indices[base + 2] as usize;

                normals[i0] += normal;
                normals[i1] += normal;
                normals[i2] += normal;
            }
        }

        // Normalize
        for normal in &mut normals {
            if normal.length_squared() > 1e-10 {
                *normal = normal.normalize();
            } else {
                *normal = Vec3::Y; // Default up
            }
        }

        self.normals = Some(normals);
    }

    /// Set UV coordinates
    pub fn set_uvs(&mut self, uvs: Vec<Vec2>) {
        self.uvs = Some(uvs);
    }

    /// Set vertex colors
    pub fn set_colors(&mut self, colors: Vec<Vec4>) {
        self.colors = Some(colors);
    }

    /// Transform all vertices by a matrix
    pub fn transform(&mut self, matrix: &glam::Mat4) {
        for vertex in &mut self.vertices {
            *vertex = matrix.transform_point3(*vertex);
        }

        // Transform normals if present
        if let Some(ref mut normals) = self.normals {
            let normal_matrix = matrix.inverse().transpose();
            for normal in normals {
                *normal = normal_matrix.transform_vector3(*normal).normalize();
            }
        }
    }

    /// Scale mesh uniformly
    pub fn scale(&mut self, scale: f32) {
        for vertex in &mut self.vertices {
            *vertex *= scale;
        }
    }

    /// Translate mesh
    pub fn translate(&mut self, offset: Vec3) {
        for vertex in &mut self.vertices {
            *vertex += offset;
        }
    }

    /// Center mesh at origin
    pub fn center_at_origin(&mut self) {
        let center = self.center();
        self.translate(-center);
    }
}

impl Default for Mesh {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mesh_validation() {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2];
        let mesh = Mesh::from_vertices_indices(vertices, indices);

        assert!(mesh.validate().is_ok());
    }

    #[test]
    fn test_invalid_indices() {
        let vertices = vec![Vec3::ZERO];
        let indices = vec![0, 1, 2]; // Index 1 and 2 out of bounds
        let mesh = Mesh::from_vertices_indices(vertices, indices);

        assert!(mesh.validate().is_err());
    }

    #[test]
    fn test_triangle_normal() {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2];
        let mesh = Mesh::from_vertices_indices(vertices, indices);

        let normal = mesh.triangle_normal(0).unwrap();
        assert!((normal - Vec3::new(0.0, 0.0, 1.0)).length() < 0.001);
    }

    #[test]
    fn test_compute_normals() {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2];
        let mut mesh = Mesh::from_vertices_indices(vertices, indices);

        mesh.compute_normals();
        assert!(mesh.normals.is_some());
        assert_eq!(mesh.normals.as_ref().unwrap().len(), 3);
    }
}
